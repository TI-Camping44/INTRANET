import { NextResponse, type NextRequest } from "next/server";
import { revisarSecreto } from "@/lib/trabajos-programados";
import { crearClienteAdministrador } from "@/lib/supabase/administrador";
import { notificar } from "@/lib/notificaciones";
import { enviarCorreo, urlAbsoluta } from "@/lib/correo";
import { formatearFecha, hoyEnAsuncion, sumarDias } from "@/lib/formato";
import {
  CORREO_TODOS,
  DIAS_AVISO_ACCION,
  DIAS_AVISO_REVISION_DOCUMENTO,
  ETIQUETAS_TIPO_AUDITORIA,
} from "@/lib/constantes";
import {
  DIAS_AVISO_RECLAMO,
  DIAS_VERIFICACION_PLAN_C,
  ESTADOS_RECLAMO_ABIERTOS,
  sumarDiasHabiles,
} from "@/lib/reclamos";

/**
 * Trabajo programado de alertas por vencimiento.
 *
 * Se ejecuta una vez por dia desde Vercel Cron (ver vercel.json) y
 * atiende cinco frentes:
 *   1. Acciones correctivas proximas a vencer.
 *   2. Acciones vencidas: aviso al responsable. Sin escalamiento al
 *      lider: lo retiro Calidad el 23 de septiembre.
 *   3. Documentos vigentes que se acercan a su fecha de revision.
 *   4. Riesgos que llegaron a su fecha de reevaluacion.
 *   5. Mantenimientos preventivos programados para la semana.
 *   6. Reenvio de las notificaciones cuyo correo no salio en su momento.
 *   7. Aviso de auditoria a la lista de distribucion de la empresa.
 *   8. Reclamos de clientes: contacto o resolucion vencidos, resolucion
 *      por vencer y verificacion del Plan C pendiente.
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
  documentosPorRevisar: number;
  riesgosPorReevaluar: number;
  mantenimientosProximos: number;
  avisosDeAuditoria: number;
  correosReenviados: number;
  reclamosPorVencer: number;
  reclamosVencidos: number;
  verificacionesPendientes: number;
}

export async function GET(peticion: NextRequest) {
  // Vercel Cron envía el secreto en la cabecera Authorization, tomado de
  // la variable CRON_SECRET. Ver src/lib/trabajos-programados.ts.
  const rechazo = revisarSecreto(peticion.headers.get("authorization"));

  if (rechazo === "sin_secreto") {
    return NextResponse.json(
      {
        error: "CRON_SECRET no está configurada",
        detalle:
          "Sin esa variable Vercel no firma el trabajo programado y las " +
          "alertas no se envían. Cárguela y vuelva a desplegar.",
      },
      { status: 503 },
    );
  }

  if (rechazo) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const supabase = crearClienteAdministrador();
  const hoy = hoyEnAsuncion();

  const resumen: Resumen = {
    accionesPorVencer: 0,
    accionesVencidas: 0,
    documentosPorRevisar: 0,
    riesgosPorReevaluar: 0,
    mantenimientosProximos: 0,
    avisosDeAuditoria: 0,
    correosReenviados: 0,
    reclamosPorVencer: 0,
    reclamosVencidos: 0,
    verificacionesPendientes: 0,
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

    // El escalamiento por linea de mando se retiro el 23 de septiembre,
    // a pedido de Calidad: «que no avise nada a nadie, eso lo gestiono yo
    // por fuera». El aviso al responsable de la accion vencida se
    // conserva —es de el y de su trabajo—; lo que deja de salir es el
    // aviso al lider y al nivel siguiente.
    //
    // La columna `nivel_escalamiento` se conserva con lo que ya tenia
    // cargado: es historia de lo que paso, no una regla vigente. Si
    // Calidad lo vuelve a pedir, esto se reactiva sin migrar nada.
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
      titulo: `Documento por revisar · ${documento.codigo ?? documento.titulo}`,
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

  // ---------------------------------------------------------------
  // 7 · Aviso de auditoria a toda la empresa
  // ---------------------------------------------------------------
  // Calidad fija la fecha al planificar la auditoria. Ese dia sale un
  // correo a la lista de distribucion: es un anuncio, no una asignacion,
  // asi que no genera notificacion en la campana de nadie.
  //
  // Se toman tambien las fechas ya pasadas (lte y no eq): si el trabajo
  // no corrio un dia, el aviso sale al siguiente en vez de perderse. La
  // marca `aviso_enviado` es lo que evita que se repita.
  const { data: auditoriasPorAvisar } = await supabase
    .from("auditorias")
    .select("id, codigo, tipo, objetivo, fecha_planificada")
    .eq("aviso_enviado", false)
    .not("fecha_aviso", "is", null)
    .lte("fecha_aviso", hoy)
    .in("estado", ["planificada", "en_curso"]);

  for (const auditoria of (auditoriasPorAvisar ?? []) as any[]) {
    const enviado = await enviarCorreo({
      para: CORREO_TODOS,
      asunto: `Auditoría ${auditoria.codigo} · ${formatearFecha(auditoria.fecha_planificada)}`,
      titulo: `Auditoría ${ETIQUETAS_TIPO_AUDITORIA[auditoria.tipo] ?? auditoria.tipo}`,
      cuerpo:
        `Se realizará la auditoría ${auditoria.codigo} el ` +
        `${formatearFecha(auditoria.fecha_planificada)}.\n\n${auditoria.objetivo}`,
      enlace: urlAbsoluta(`/auditorias/${auditoria.id}`),
      textoEnlace: "Ver la auditoría",
    });

    if (enviado) {
      await supabase.from("auditorias").update({ aviso_enviado: true }).eq("id", auditoria.id);
      resumen.avisosDeAuditoria += 1;
    }
  }

  // ---------------------------------------------------------------
  // 8 · Reclamos de clientes
  // ---------------------------------------------------------------
  // ES LO QUE HACE QUE EL PLAZO EXISTA. El procedimiento pone 24 horas
  // habiles para el primer contacto y de 3 a 15 dias habiles para
  // resolver; sin un aviso, el unico que mira el vencimiento es quien
  // abre el listado, y el caso vencido es justamente el que nadie abrio.
  //
  // El aviso va al gestor del caso, con copia al responsable del area
  // cuando esta cargado y es otra persona. No hay escalamiento al lider:
  // el mismo criterio que Calidad fijo para las acciones correctivas.
  //
  // LO VENCIDO SE AVISA TODOS LOS DIAS, no una sola vez: por eso la clave
  // de unicidad de esos dos avisos lleva la fecha de hoy y no la del
  // vencimiento. Es la convencion que ya tiene «accion vencida», y la
  // razon es la misma: un plazo incumplido que avisa una vez y despues se
  // calla vuelve a ser un plazo que nadie mira. Se comprobo en la corrida
  // real del 30 de septiembre: REC-2026-901 estaba vencido desde el 26,
  // aviso ese dia y al dia siguiente ya no aviso nada.
  //
  // «Por vencer» sigue atado al vencimiento, que es lo correcto: es un
  // adelanto, y un adelanto repetido todos los dias no adelanta nada.
  const { data: reclamos } = await supabase
    .from("reclamos")
    .select(
      "id, codigo, titulo, plan, estado, tramite_digemabel, cliente_nombre, " +
        "fecha_limite_contacto, fecha_contacto, fecha_limite_resolucion, fecha_resolucion, " +
        "gestor:gestor_id (id, correo), responsable_area:responsable_area_id (id, correo)",
    )
    .in("estado", ESTADOS_RECLAMO_ABIERTOS);

  const limiteAviso = sumarDiasHabiles(hoy, DIAS_AVISO_RECLAMO);

  for (const reclamo of (reclamos ?? []) as any[]) {
    const destinatarios = [reclamo.gestor, reclamo.responsable_area].filter(
      (persona, indice, todos) =>
        persona && todos.findIndex((otra) => otra?.id === persona.id) === indice,
    );
    if (destinatarios.length === 0) continue;

    const avisar = async (
      tipo: "reclamo_vencido" | "reclamo_por_vencer",
      titulo: string,
      mensaje: string,
      clave: string,
    ) => {
      for (const persona of destinatarios) {
        await notificar(supabase, {
          usuarioId: persona.id,
          correoDestino: persona.correo,
          tipo,
          titulo,
          mensaje,
          enlace: `/reclamos/${reclamo.id}`,
          entidad: "reclamos",
          entidadId: reclamo.id,
          claveUnicidad: `${clave}:${persona.id}`,
        });
      }
    };

    // El primer contacto no lo tapa nada: el tramite ante la DIGEMABEL
    // suspende la resolucion, pero si al cliente todavia no se le hablo,
    // ese plazo esta vencido igual.
    if (!reclamo.fecha_contacto && reclamo.fecha_limite_contacto < hoy) {
      await avisar(
        "reclamo_vencido",
        `Sin contactar al cliente · ${reclamo.codigo}`,
        `El plazo para el primer contacto de "${reclamo.titulo}" (${reclamo.cliente_nombre}) ` +
          `venció el ${formatearFecha(reclamo.fecha_limite_contacto)} y el caso sigue sin contacto ` +
          "registrado. Llame al cliente y deje la fecha cargada.",
        `reclamo-contacto:${reclamo.id}:${hoy}`,
      );
      resumen.reclamosVencidos += 1;
    }

    // Un caso suspendido por tramite no tiene plazo corriendo: avisar de
    // un vencimiento detenido seria pedir algo que no se puede hacer.
    if (reclamo.fecha_resolucion || reclamo.tramite_digemabel) continue;

    if (reclamo.fecha_limite_resolucion < hoy) {
      await avisar(
        "reclamo_vencido",
        `Reclamo vencido · ${reclamo.codigo}`,
        `"${reclamo.titulo}" (${reclamo.cliente_nombre}) tenía que estar resuelto el ` +
          `${formatearFecha(reclamo.fecha_limite_resolucion)} y sigue abierto. ` +
          "Resuélvalo o registre por qué no se pudo.",
        `reclamo-vencido:${reclamo.id}:${hoy}`,
      );
      resumen.reclamosVencidos += 1;
    } else if (reclamo.fecha_limite_resolucion <= limiteAviso) {
      await avisar(
        "reclamo_por_vencer",
        `Reclamo por vencer · ${reclamo.codigo}`,
        `"${reclamo.titulo}" (${reclamo.cliente_nombre}) vence el ` +
          `${formatearFecha(reclamo.fecha_limite_resolucion)}.`,
        `reclamo-por-vencer:${reclamo.id}:${reclamo.fecha_limite_resolucion}`,
      );
      resumen.reclamosPorVencer += 1;
    }
  }

  // Verificacion con el cliente a los 30 dias de cerrar un Plan C. Son
  // dias corridos y no habiles: el procedimiento habla de un mes despues,
  // no de una carga de trabajo.
  const { data: porVerificar } = await supabase
    .from("reclamos")
    .select("id, codigo, titulo, cliente_nombre, fecha_cierre, gestor:gestor_id (id, correo)")
    .eq("plan", "c")
    .eq("estado", "cerrado")
    .is("fecha_verificacion", null)
    .not("fecha_cierre", "is", null)
    .lte("fecha_cierre", sumarDias(hoy, -DIAS_VERIFICACION_PLAN_C));

  for (const reclamo of (porVerificar ?? []) as any[]) {
    if (!reclamo.gestor) continue;

    await notificar(supabase, {
      usuarioId: reclamo.gestor.id,
      correoDestino: reclamo.gestor.correo,
      tipo: "reclamo_verificacion_pendiente",
      titulo: `Verificación pendiente · ${reclamo.codigo}`,
      mensaje:
        `Se cumplieron ${DIAS_VERIFICACION_PLAN_C} días del cierre de "${reclamo.titulo}" ` +
        `(${reclamo.cliente_nombre}). El Plan C pide volver a hablar con el cliente y dejar ` +
        "registrado si la solución se sostuvo.",
      enlace: `/reclamos/${reclamo.id}`,
      entidad: "reclamos",
      entidadId: reclamo.id,
      claveUnicidad: `reclamo-verificacion:${reclamo.id}`,
    });
    resumen.verificacionesPendientes += 1;
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
