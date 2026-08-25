import { NextResponse, type NextRequest } from "next/server";
import { crearClienteAdministrador } from "@/lib/supabase/administrador";
import { notificar } from "@/lib/notificaciones";
import { enviarCorreo, urlAbsoluta } from "@/lib/correo";
import { hoyEnAsuncion, sumarDias } from "@/lib/formato";
import {
  DIAS_AVISO_ACCION,
  DIAS_AVISO_REVISION_DOCUMENTO,
  DIAS_ESCALAMIENTO_NC,
  DIAS_ESCALAMIENTO_SEGUNDO_NIVEL,
} from "@/lib/constantes";

/**
 * Trabajo programado de alertas por vencimiento.
 *
 * Se ejecuta una vez por dia desde Vercel Cron (ver vercel.json) y
 * atiende cinco frentes:
 *   1. Acciones correctivas proximas a vencer.
 *   2. Acciones vencidas, con escalamiento al jefe inmediato a los
 *      diez dias y al nivel siguiente a los veinte.
 *   3. Documentos vigentes que se acercan a su fecha de revision.
 *   4. Riesgos que llegaron a su fecha de reevaluacion.
 *   5. Mantenimientos preventivos programados para la semana.
 *   6. Reenvio de las notificaciones cuyo correo no salio en su momento.
 *
 * Corre con la clave de servicio porque no hay sesion de usuario. La
 * duplicacion de avisos se evita con la clave de unicidad de cada
 * notificacion, no con el estado del proceso.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface Resumen {
  accionesPorVencer: number;
  accionesVencidas: number;
  escalamientos: number;
  documentosPorRevisar: number;
  riesgosPorReevaluar: number;
  mantenimientosProximos: number;
  correosReenviados: number;
}

export async function GET(peticion: NextRequest) {
  const secreto = process.env.CRON_SECRETO;
  const cabecera = peticion.headers.get("authorization");

  // Vercel Cron envía el secreto en la cabecera Authorization.
  if (!secreto || cabecera !== `Bearer ${secreto}`) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = crearClienteAdministrador();
  const hoy = hoyEnAsuncion();

  const resumen: Resumen = {
    accionesPorVencer: 0,
    accionesVencidas: 0,
    escalamientos: 0,
    documentosPorRevisar: 0,
    riesgosPorReevaluar: 0,
    mantenimientosProximos: 0,
    correosReenviados: 0,
  };

  // -------------------------------------------------------------------
  // 1 y 2 · Acciones correctivas
  // -------------------------------------------------------------------
  const { data: acciones } = await supabase
    .from("nc_acciones")
    .select(
      "id, descripcion, fecha_limite, estado, nivel_escalamiento, responsable_id, " +
        "no_conformidad_id, no_conformidades:no_conformidad_id (codigo, titulo), " +
        "responsable:responsable_id (id, correo, nombre_completo, superior_id)",
    )
    .in("estado", ["pendiente", "en_curso"])
    .lte("fecha_limite", sumarDias(hoy, DIAS_AVISO_ACCION));

  for (const accion of (acciones ?? []) as any[]) {
    const responsable = accion.responsable;
    if (!responsable) continue;

    const enlace = `/no-conformidades/${accion.no_conformidad_id}`;
    const codigo = accion.no_conformidades?.codigo ?? "";
    const diasVencida = Math.floor(
      (new Date(`${hoy}T12:00:00`).getTime() -
        new Date(`${accion.fecha_limite}T12:00:00`).getTime()) /
        86_400_000,
    );

    if (diasVencida < 0) {
      // Aviso previo al vencimiento.
      await notificar(supabase, {
        usuarioId: responsable.id,
        correoDestino: responsable.correo,
        tipo: "accion_por_vencer",
        titulo: `Acción por vencer · ${codigo}`,
        mensaje:
          `La acción "${accion.descripcion}" vence el ${accion.fecha_limite}. ` +
          "Registre el avance en la ficha de la no conformidad.",
        enlace,
        entidad: "nc_acciones",
        entidadId: accion.id,
        claveUnicidad: `accion-por-vencer:${accion.id}:${accion.fecha_limite}`,
      });
      resumen.accionesPorVencer += 1;
      continue;
    }

    // Acción vencida: aviso al responsable.
    await notificar(supabase, {
      usuarioId: responsable.id,
      correoDestino: responsable.correo,
      tipo: "accion_vencida",
      titulo: `Acción vencida · ${codigo}`,
      mensaje:
        `La acción "${accion.descripcion}" venció el ${accion.fecha_limite} ` +
        `(${diasVencida} ${diasVencida === 1 ? "día" : "días"} de atraso).`,
      enlace,
      entidad: "nc_acciones",
      entidadId: accion.id,
      claveUnicidad: `accion-vencida:${accion.id}:${hoy}`,
    });
    resumen.accionesVencidas += 1;

    // Escalamiento por línea de mando.
    const nivelObjetivo =
      diasVencida >= DIAS_ESCALAMIENTO_SEGUNDO_NIVEL
        ? 2
        : diasVencida >= DIAS_ESCALAMIENTO_NC
          ? 1
          : 0;

    if (nivelObjetivo === 0 || accion.nivel_escalamiento >= nivelObjetivo) continue;

    const destinatario = await resolverSuperior(supabase, responsable.superior_id, nivelObjetivo);
    if (!destinatario) continue;

    await notificar(supabase, {
      usuarioId: destinatario.id,
      correoDestino: destinatario.correo,
      tipo: "escalamiento",
      titulo: `Escalamiento · acción vencida en ${codigo}`,
      mensaje:
        `La acción "${accion.descripcion}", a cargo de ${responsable.nombre_completo}, ` +
        `lleva ${diasVencida} días vencida y sigue sin resolverse. ` +
        "Se eleva a su conocimiento conforme al procedimiento de acciones correctivas.",
      enlace,
      entidad: "nc_acciones",
      entidadId: accion.id,
      claveUnicidad: `escalamiento:${accion.id}:nivel-${nivelObjetivo}`,
    });

    await supabase
      .from("nc_acciones")
      .update({ nivel_escalamiento: nivelObjetivo, fecha_ultima_alerta: new Date().toISOString() })
      .eq("id", accion.id);

    resumen.escalamientos += 1;
  }

  // -------------------------------------------------------------------
  // 3 · Documentos próximos a su revisión
  // -------------------------------------------------------------------
  const { data: documentos } = await supabase
    .from("documentos")
    .select(
      "id, codigo, titulo, fecha_proxima_revision, " +
        "responsable:responsable_id (id, correo)",
    )
    .eq("estado", "vigente")
    .lte("fecha_proxima_revision", sumarDias(hoy, DIAS_AVISO_REVISION_DOCUMENTO));

  for (const documento of (documentos ?? []) as any[]) {
    if (!documento.responsable) continue;

    await notificar(supabase, {
      usuarioId: documento.responsable.id,
      correoDestino: documento.responsable.correo,
      tipo: "documento_por_revisar",
      titulo: `Documento por revisar · ${documento.codigo}`,
      mensaje:
        `"${documento.titulo}" tiene su revisión prevista para el ` +
        `${documento.fecha_proxima_revision}. Confirme la vigencia del contenido o publique una versión nueva.`,
      enlace: `/documentos/${documento.id}`,
      entidad: "documentos",
      entidadId: documento.id,
      claveUnicidad: `doc-revision:${documento.id}:${documento.fecha_proxima_revision}`,
    });
    resumen.documentosPorRevisar += 1;
  }

  // -------------------------------------------------------------------
  // 4 · Riesgos que llegaron a su fecha de reevaluación
  // -------------------------------------------------------------------
  const { data: riesgos } = await supabase
    .from("riesgos")
    .select("id, codigo, titulo, nivel, fecha_proxima_revision, responsable:responsable_id (id, correo)")
    .in("estado", ["identificado", "en_tratamiento", "materializado"])
    .lte("fecha_proxima_revision", hoy);

  for (const riesgo of (riesgos ?? []) as any[]) {
    if (!riesgo.responsable) continue;

    await notificar(supabase, {
      usuarioId: riesgo.responsable.id,
      correoDestino: riesgo.responsable.correo,
      tipo: "riesgo_por_reevaluar",
      titulo: `Riesgo por reevaluar · ${riesgo.codigo}`,
      mensaje:
        `"${riesgo.titulo}" (nivel ${riesgo.nivel}) alcanzó su fecha de reevaluación. ` +
        "Revise si la probabilidad y el impacto siguen vigentes.",
      enlace: `/riesgos/${riesgo.id}`,
      entidad: "riesgos",
      entidadId: riesgo.id,
      claveUnicidad: `riesgo-reevaluar:${riesgo.id}:${riesgo.fecha_proxima_revision}`,
    });
    resumen.riesgosPorReevaluar += 1;
  }

  // -------------------------------------------------------------------
  // 5 · Mantenimientos preventivos de la semana
  // -------------------------------------------------------------------
  // Primero se marcan como vencidos los que ya pasaron de fecha.
  await supabase.rpc("marcar_mantenimientos_vencidos");

  const { data: mantenimientos } = await supabase
    .from("mantenimientos")
    .select(
      "id, descripcion, fecha_programada, activo_id, activos:activo_id (codigo, nombre), " +
        "responsable:responsable_id (id, correo)",
    )
    .in("estado", ["programado", "vencido"])
    .lte("fecha_programada", sumarDias(hoy, 7));

  for (const mantenimiento of (mantenimientos ?? []) as any[]) {
    if (!mantenimiento.responsable) continue;

    await notificar(supabase, {
      usuarioId: mantenimiento.responsable.id,
      correoDestino: mantenimiento.responsable.correo,
      tipo: "mantenimiento_programado",
      titulo: `Mantenimiento programado · ${mantenimiento.activos?.codigo ?? ""}`,
      mensaje:
        `${mantenimiento.activos?.nombre ?? "Activo"} tiene mantenimiento previsto para el ` +
        `${mantenimiento.fecha_programada}.`,
      enlace: "/activos",
      entidad: "mantenimientos",
      entidadId: mantenimiento.id,
      claveUnicidad: `mantenimiento:${mantenimiento.id}:${mantenimiento.fecha_programada}`,
    });
    resumen.mantenimientosProximos += 1;
  }

  // -------------------------------------------------------------------
  // 6 · Reenvio de los correos pendientes
  // -------------------------------------------------------------------
  // Dentro de una peticion el envio tiene un tope de espera corto, para no
  // demorar la respuesta que ve la persona. Lo que no salio en aquel
  // momento se reintenta aca, donde nadie esta esperando.
  const { data: pendientes } = await supabase
    .from("notificaciones")
    .select("id, titulo, mensaje, enlace, usuarios:usuario_id (correo)")
    .eq("requiere_correo", true)
    .eq("correo_enviado", false)
    .gte("creado_en", new Date(Date.now() - 7 * 86_400_000).toISOString())
    .order("creado_en", { ascending: true })
    .limit(50);

  for (const notificacion of (pendientes ?? []) as any[]) {
    const destino = notificacion.usuarios?.correo;
    if (!destino) continue;

    const enviado = await enviarCorreo({
      para: destino,
      asunto: notificacion.titulo,
      titulo: notificacion.titulo,
      cuerpo: notificacion.mensaje,
      enlace: urlAbsoluta(notificacion.enlace),
    });

    if (enviado) {
      await supabase
        .from("notificaciones")
        .update({ correo_enviado: true, correo_enviado_en: new Date().toISOString() })
        .eq("id", notificacion.id);
      resumen.correosReenviados += 1;
    }
  }

  return NextResponse.json({ ejecutado: hoy, resumen });
}

/**
 * Sube por la linea de mando tantos niveles como indique el escalamiento.
 * Si la cadena se corta antes, devuelve el ultimo superior disponible.
 */
async function resolverSuperior(
  supabase: ReturnType<typeof crearClienteAdministrador>,
  superiorId: string | null,
  niveles: number,
): Promise<{ id: string; correo: string } | null> {
  let actual = superiorId;
  let anterior: { id: string; correo: string } | null = null;

  for (let nivel = 1; nivel <= niveles && actual; nivel += 1) {
    const { data } = await supabase
      .from("usuarios")
      .select("id, correo, superior_id, activo")
      .eq("id", actual)
      .maybeSingle();

    if (!data || !data.activo) break;

    anterior = { id: data.id, correo: data.correo };
    if (nivel === niveles) return anterior;
    actual = data.superior_id;
  }

  return anterior;
}
