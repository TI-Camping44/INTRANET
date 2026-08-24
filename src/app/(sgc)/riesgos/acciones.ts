"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { notificar } from "@/lib/notificaciones";
import { hoyEnAsuncion } from "@/lib/formato";
import type { EstadoAccion, EstadoRiesgo, ResultadoAccion } from "@/lib/tipos";

function validarEscala(valor: number): boolean {
  return Number.isInteger(valor) && valor >= 1 && valor <= 5;
}

/** Alta de un riesgo u oportunidad en la matriz. */
export async function crearRiesgo(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite crear riesgos." };
  }

  const supabase = crearClienteServidor();

  const titulo = String(datos.get("titulo") ?? "").trim();
  const probabilidad = Number(datos.get("probabilidad") ?? 1);
  const impacto = Number(datos.get("impacto") ?? 1);

  if (titulo.length < 5) {
    return { exito: false, error: "El título debe tener al menos 5 caracteres." };
  }
  if (!validarEscala(probabilidad) || !validarEscala(impacto)) {
    return { exito: false, error: "La probabilidad y el impacto deben estar entre 1 y 5." };
  }

  const { data: codigo, error: errorCodigo } = await supabase.rpc("siguiente_codigo_riesgo", {
    p_empresa_id: usuario.empresa_id,
  });

  if (errorCodigo || !codigo) {
    return { exito: false, error: "No se pudo generar el código del riesgo." };
  }

  const { data: riesgo, error } = await supabase
    .from("riesgos")
    .insert({
      empresa_id: usuario.empresa_id,
      codigo,
      titulo,
      descripcion: String(datos.get("descripcion") ?? "").trim() || null,
      tipo: String(datos.get("tipo") ?? "riesgo"),
      categoria: String(datos.get("categoria") ?? "").trim() || null,
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      responsable_id: String(datos.get("responsable_id") ?? "") || usuario.id,
      tratamiento: String(datos.get("tratamiento") ?? "mitigar"),
      causas: String(datos.get("causas") ?? "").trim() || null,
      consecuencias: String(datos.get("consecuencias") ?? "").trim() || null,
      controles_existentes: String(datos.get("controles_existentes") ?? "").trim() || null,
      probabilidad,
      impacto,
      estado: "identificado",
      creado_por: usuario.id,
    })
    .select("id, codigo, nivel")
    .single();

  if (error) return { exito: false, error: `No se pudo crear el riesgo: ${error.message}` };

  // Primera evaluación registrada en el historial.
  await supabase.from("riesgo_evaluaciones").insert({
    riesgo_id: riesgo.id,
    probabilidad,
    impacto,
    comentario: "Evaluación inicial.",
    evaluado_por: usuario.id,
  });

  revalidatePath("/riesgos");
  return { exito: true, id: riesgo.id, mensaje: `Riesgo ${riesgo.codigo} registrado.` };
}

/** Edicion de los datos descriptivos del riesgo. */
export async function actualizarRiesgo(id: string, datos: FormData): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("riesgos")
    .update({
      titulo: String(datos.get("titulo") ?? "").trim(),
      descripcion: String(datos.get("descripcion") ?? "").trim() || null,
      categoria: String(datos.get("categoria") ?? "").trim() || null,
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      responsable_id: String(datos.get("responsable_id") ?? "") || null,
      tratamiento: String(datos.get("tratamiento") ?? "mitigar"),
      causas: String(datos.get("causas") ?? "").trim() || null,
      consecuencias: String(datos.get("consecuencias") ?? "").trim() || null,
      controles_existentes: String(datos.get("controles_existentes") ?? "").trim() || null,
    })
    .eq("id", id);

  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };

  revalidatePath(`/riesgos/${id}`);
  return { exito: true, mensaje: "Riesgo actualizado." };
}

/**
 * Reevaluacion del riesgo. Queda registrada en el historial y el
 * disparador de la base de datos recalcula la fecha de proxima revision
 * segun el nivel resultante.
 */
export async function reevaluarRiesgo(
  id: string,
  probabilidad: number,
  impacto: number,
  comentario: string,
  esResidual: boolean,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  if (!validarEscala(probabilidad) || !validarEscala(impacto)) {
    return { exito: false, error: "La probabilidad y el impacto deben estar entre 1 y 5." };
  }

  const cambios = esResidual
    ? { probabilidad_residual: probabilidad, impacto_residual: impacto }
    : { probabilidad, impacto };

  const { error } = await supabase.from("riesgos").update(cambios).eq("id", id);

  if (error) return { exito: false, error: `No se pudo reevaluar: ${error.message}` };

  await supabase.from("riesgo_evaluaciones").insert({
    riesgo_id: id,
    probabilidad,
    impacto,
    comentario:
      comentario.trim() ||
      (esResidual ? "Evaluación del riesgo residual." : "Reevaluación periódica."),
    evaluado_por: usuario.id,
  });

  revalidatePath(`/riesgos/${id}`);
  revalidatePath("/riesgos");
  return { exito: true, mensaje: "Reevaluación registrada." };
}

export async function cambiarEstadoRiesgo(
  id: string,
  estado: EstadoRiesgo,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { error } = await supabase.from("riesgos").update({ estado }).eq("id", id);
  if (error) return { exito: false, error: `No se pudo cambiar el estado: ${error.message}` };

  revalidatePath(`/riesgos/${id}`);
  revalidatePath("/riesgos");
  return { exito: true, mensaje: "Estado actualizado." };
}

/** Alta de una accion de tratamiento del riesgo. */
export async function crearAccionRiesgo(
  riesgoId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const descripcion = String(datos.get("descripcion") ?? "").trim();
  if (descripcion.length < 10) {
    return { exito: false, error: "Describa la acción con al menos 10 caracteres." };
  }

  const responsableId = String(datos.get("responsable_id") ?? "") || null;
  const fechaLimite = String(datos.get("fecha_limite") ?? "") || null;

  const { error } = await supabase.from("riesgo_acciones").insert({
    riesgo_id: riesgoId,
    descripcion,
    tratamiento: String(datos.get("tratamiento") ?? "mitigar"),
    responsable_id: responsableId,
    fecha_limite: fechaLimite,
    estado: "pendiente",
  });

  if (error) return { exito: false, error: `No se pudo crear la acción: ${error.message}` };

  if (responsableId && responsableId !== usuario.id) {
    const [{ data: responsable }, { data: riesgo }] = await Promise.all([
      supabase.from("usuarios").select("id, correo").eq("id", responsableId).maybeSingle(),
      supabase.from("riesgos").select("codigo").eq("id", riesgoId).maybeSingle(),
    ]);

    if (responsable) {
      await notificar(supabase, {
        usuarioId: responsable.id,
        correoDestino: responsable.correo,
        tipo: "general",
        titulo: `Acción de tratamiento asignada · ${riesgo?.codigo ?? ""}`,
        mensaje: `Tiene a su cargo: "${descripcion}".`,
        enlace: `/riesgos/${riesgoId}`,
        entidad: "riesgos",
        entidadId: riesgoId,
      });
    }
  }

  revalidatePath(`/riesgos/${riesgoId}`);
  return { exito: true, mensaje: "Acción de tratamiento agregada." };
}

export async function actualizarAccionRiesgo(
  accionId: string,
  riesgoId: string,
  estado: EstadoAccion,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const cambios: Record<string, unknown> = { estado };
  if (estado === "ejecutada") cambios.fecha_ejecucion = hoyEnAsuncion();

  const { error } = await supabase.from("riesgo_acciones").update(cambios).eq("id", accionId);
  if (error) return { exito: false, error: `No se pudo actualizar la acción: ${error.message}` };

  revalidatePath(`/riesgos/${riesgoId}`);
  return { exito: true, mensaje: "Acción actualizada." };
}

export async function eliminarAccionRiesgo(
  accionId: string,
  riesgoId: string,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { error } = await supabase.from("riesgo_acciones").delete().eq("id", accionId);
  if (error) return { exito: false, error: `No se pudo eliminar la acción: ${error.message}` };

  revalidatePath(`/riesgos/${riesgoId}`);
  return { exito: true, mensaje: "Acción eliminada." };
}
