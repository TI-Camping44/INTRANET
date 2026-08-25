"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { notificar } from "@/lib/notificaciones";
import { hoyEnAsuncion, sumarDias } from "@/lib/formato";
import { DIAS_LIMITE_CIERRE_NC } from "@/lib/constantes";
import type { ResultadoAccion } from "@/lib/tipos";

// ---------------------------------------------------------------------
// Encuestas
// ---------------------------------------------------------------------

export async function crearEncuesta(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite crear encuestas." };
  }

  const supabase = crearClienteServidor();

  const nombre = String(datos.get("nombre") ?? "").trim();
  if (nombre.length < 5) {
    return { exito: false, error: "El nombre de la encuesta debe tener al menos 5 caracteres." };
  }

  const { data: codigo } = await supabase.rpc("siguiente_codigo_encuesta", {
    p_empresa_id: usuario.empresa_id,
  });

  const { data: encuesta, error } = await supabase
    .from("encuestas")
    .insert({
      empresa_id: usuario.empresa_id,
      codigo: codigo ?? "ENC-01",
      nombre,
      tipo: String(datos.get("tipo") ?? "nps"),
      descripcion: String(datos.get("descripcion") ?? "").trim() || null,
      fecha_inicio: String(datos.get("fecha_inicio") ?? "") || hoyEnAsuncion(),
      fecha_fin: String(datos.get("fecha_fin") ?? "") || null,
      fuente_externa: String(datos.get("fuente_externa") ?? "").trim() || null,
      activa: true,
    })
    .select("id, codigo")
    .single();

  if (error) return { exito: false, error: `No se pudo crear la encuesta: ${error.message}` };

  revalidatePath("/satisfaccion");
  return { exito: true, id: encuesta.id, mensaje: `Encuesta ${encuesta.codigo} creada.` };
}

export async function cambiarEstadoEncuesta(
  id: string,
  activa: boolean,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite cerrar encuestas." };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("encuestas")
    .update({ activa, fecha_fin: activa ? null : hoyEnAsuncion() })
    .eq("id", id);

  if (error) return { exito: false, error: `No se pudo actualizar la encuesta: ${error.message}` };

  revalidatePath("/satisfaccion");
  revalidatePath(`/satisfaccion/${id}`);
  return { exito: true, mensaje: activa ? "Encuesta reabierta." : "Encuesta cerrada." };
}

// ---------------------------------------------------------------------
// Respuestas
// ---------------------------------------------------------------------

/**
 * Carga manual de una respuesta. La via normal es la ingesta desde el
 * panel de NPS existente; esto cubre la respuesta que llega por telefono
 * o en el mostrador y que si no se carga a mano se pierde.
 */
export async function registrarRespuesta(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite cargar respuestas." };
  }

  const supabase = crearClienteServidor();

  const encuestaId = String(datos.get("encuesta_id") ?? "");
  const puntaje = Number(datos.get("puntaje"));
  const fecha = String(datos.get("fecha") ?? "") || hoyEnAsuncion();

  if (!encuestaId) return { exito: false, error: "Indique a qué encuesta corresponde." };
  if (!Number.isInteger(puntaje) || puntaje < 0 || puntaje > 10) {
    return { exito: false, error: "El puntaje debe ser un número entero de 0 a 10." };
  }
  if (fecha > hoyEnAsuncion()) {
    return { exito: false, error: "La fecha de la respuesta no puede ser futura." };
  }

  const { error } = await supabase.from("encuesta_respuestas").insert({
    encuesta_id: encuestaId,
    cliente_id: String(datos.get("cliente_id") ?? "") || null,
    fecha,
    puntaje,
    comentario: String(datos.get("comentario") ?? "").trim() || null,
    canal: String(datos.get("canal") ?? "").trim() || null,
    sede_id: String(datos.get("sede_id") ?? "") || null,
  });

  if (error) return { exito: false, error: `No se pudo registrar la respuesta: ${error.message}` };

  revalidatePath("/satisfaccion");
  revalidatePath(`/satisfaccion/${encuestaId}`);

  return {
    exito: true,
    mensaje:
      puntaje <= 6
        ? "Respuesta registrada. Es un cliente detractor: corresponde tratarla como reclamo."
        : "Respuesta registrada.",
  };
}

/**
 * Convierte el comentario de un detractor en una no conformidad de
 * origen "reclamo_cliente". La regla vive en la base de datos
 * (generar_no_conformidad_desde_respuesta) para que valga tambien si la
 * escritura no viene de esta pantalla.
 */
export async function generarNoConformidadDesdeRespuesta(
  respuestaId: string,
  encuestaId: string,
  responsableId: string | null,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite abrir no conformidades." };
  }

  const supabase = crearClienteServidor();

  const { data: ncId, error } = await supabase.rpc(
    "generar_no_conformidad_desde_respuesta",
    {
      p_respuesta_id: respuestaId,
      p_responsable_id: responsableId || null,
      p_fecha_limite: sumarDias(hoyEnAsuncion(), DIAS_LIMITE_CIERRE_NC),
    },
  );

  if (error) {
    return { exito: false, error: error.message.replace(/^.*?:\s*/, "") };
  }

  const { data: nc } = await supabase
    .from("no_conformidades")
    .select("codigo, titulo, fecha_limite_cierre")
    .eq("id", ncId)
    .maybeSingle();

  if (responsableId) {
    const { data: responsable } = await supabase
      .from("usuarios")
      .select("id, correo")
      .eq("id", responsableId)
      .maybeSingle();

    if (responsable) {
      await notificar(supabase, {
        usuarioId: responsable.id,
        correoDestino: responsable.correo,
        tipo: "no_conformidad_asignada",
        titulo: `Reclamo de cliente asignado: ${nc?.codigo ?? ""}`,
        mensaje:
          `Se abrió la no conformidad ${nc?.codigo ?? ""} a partir de una encuesta de satisfacción` +
          (nc?.fecha_limite_cierre ? `, con cierre previsto el ${nc.fecha_limite_cierre}.` : "."),
        enlace: `/no-conformidades/${ncId}`,
        entidad: "no_conformidades",
        entidadId: ncId as string,
        claveUnicidad: `nc-reclamo:${ncId}`,
      });
    }
  }

  revalidatePath("/satisfaccion");
  revalidatePath(`/satisfaccion/${encuestaId}`);
  revalidatePath("/no-conformidades");

  return {
    exito: true,
    id: ncId as string,
    mensaje: `Se abrió la no conformidad ${nc?.codigo ?? ""} con el comentario del cliente como evidencia.`,
  };
}
