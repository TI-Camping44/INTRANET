"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import { notificar } from "@/lib/notificaciones";
import { hoyEnAsuncion } from "@/lib/formato";
import type {
  CategoriaIshikawa,
  EstadoAccion,
  EstadoNoConformidad,
  ResultadoAccion,
} from "@/lib/tipos";

/** Alta de una desviacion. Cualquier colaborador puede registrarla. */
export async function crearNoConformidad(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) {
    return { exito: false, error: "El perfil de Dirección es de solo lectura." };
  }

  const supabase = crearClienteServidor();

  const titulo = String(datos.get("titulo") ?? "").trim();
  const descripcion = String(datos.get("descripcion") ?? "").trim();

  if (titulo.length < 5) {
    return { exito: false, error: "El título debe tener al menos 5 caracteres." };
  }
  if (descripcion.length < 15) {
    return {
      exito: false,
      error: "Describa la desviación con al menos 15 caracteres: es la evidencia del hallazgo.",
    };
  }

  // El correlativo NC-AAAA-NNN lo calcula la base de datos.
  const { data: codigo, error: errorCodigo } = await supabase.rpc(
    "siguiente_codigo_no_conformidad",
    { p_empresa_id: usuario.empresa_id },
  );

  if (errorCodigo || !codigo) {
    return { exito: false, error: "No se pudo generar el código de la no conformidad." };
  }

  const responsableId = String(datos.get("responsable_id") ?? "") || null;

  const { data: noConformidad, error } = await supabase
    .from("no_conformidades")
    .insert({
      empresa_id: usuario.empresa_id,
      codigo,
      titulo,
      descripcion,
      origen: String(datos.get("origen") ?? "proceso_interno"),
      severidad: String(datos.get("severidad") ?? "menor"),
      estado: "abierta",
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      sede_id: String(datos.get("sede_id") ?? "") || null,
      norma_id: String(datos.get("norma_id") ?? "") || null,
      cliente_id: String(datos.get("cliente_id") ?? "") || null,
      requisito_incumplido: String(datos.get("requisito_incumplido") ?? "").trim() || null,
      correccion_inmediata: String(datos.get("correccion_inmediata") ?? "").trim() || null,
      detectado_por: usuario.id,
      responsable_id: responsableId,
      fecha_deteccion: String(datos.get("fecha_deteccion") ?? hoyEnAsuncion()),
      fecha_limite_cierre: String(datos.get("fecha_limite_cierre") ?? "") || null,
      creado_por: usuario.id,
    })
    .select("id, codigo, titulo")
    .single();

  if (error) {
    return { exito: false, error: `No se pudo registrar la no conformidad: ${error.message}` };
  }

  if (responsableId && responsableId !== usuario.id) {
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
        titulo: `No conformidad asignada: ${noConformidad.codigo}`,
        mensaje:
          `${usuario.nombre_completo} le asignó el tratamiento de "${noConformidad.titulo}". ` +
          "Corresponde analizar la causa raíz y definir el plan de acción.",
        enlace: `/no-conformidades/${noConformidad.id}`,
        entidad: "no_conformidades",
        entidadId: noConformidad.id,
        claveUnicidad: `nc-asignada:${noConformidad.id}:${responsableId}`,
      });
    }
  }

  revalidatePath("/no-conformidades");
  return { exito: true, id: noConformidad.id, mensaje: `${noConformidad.codigo} registrada.` };
}

/** Edicion de los datos de cabecera. */
export async function actualizarNoConformidad(
  id: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("no_conformidades")
    .update({
      titulo: String(datos.get("titulo") ?? "").trim(),
      descripcion: String(datos.get("descripcion") ?? "").trim(),
      origen: String(datos.get("origen") ?? "proceso_interno"),
      severidad: String(datos.get("severidad") ?? "menor"),
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      responsable_id: String(datos.get("responsable_id") ?? "") || null,
      requisito_incumplido: String(datos.get("requisito_incumplido") ?? "").trim() || null,
      correccion_inmediata: String(datos.get("correccion_inmediata") ?? "").trim() || null,
      fecha_limite_cierre: String(datos.get("fecha_limite_cierre") ?? "") || null,
    })
    .eq("id", id);

  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };

  revalidatePath(`/no-conformidades/${id}`);
  return { exito: true, mensaje: "No conformidad actualizada." };
}

/** Cambio de estado dentro del ciclo de tratamiento. */
export async function cambiarEstadoNoConformidad(
  id: string,
  estado: EstadoNoConformidad,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const cambios: Record<string, unknown> = { estado };

  if (estado === "cerrada") {
    // Antes de cerrar, todas las acciones deben estar ejecutadas o verificadas.
    const { data: acciones } = await supabase
      .from("nc_acciones")
      .select("estado")
      .eq("no_conformidad_id", id);

    const abiertas = (acciones ?? []).filter((accion: { estado: EstadoAccion }) =>
      ["pendiente", "en_curso"].includes(accion.estado),
    );

    if (abiertas.length > 0) {
      return {
        exito: false,
        error: `Quedan ${abiertas.length} acciones sin ejecutar. No se puede cerrar la no conformidad.`,
      };
    }

    cambios.fecha_cierre = hoyEnAsuncion();
    cambios.cerrado_por = usuario.id;
  }

  const { error } = await supabase.from("no_conformidades").update(cambios).eq("id", id);

  if (error) return { exito: false, error: `No se pudo cambiar el estado: ${error.message}` };

  revalidatePath(`/no-conformidades/${id}`);
  revalidatePath("/no-conformidades");
  return { exito: true, mensaje: "Estado actualizado." };
}

/** Guarda la cadena completa de los cinco porques. */
export async function guardarPorques(
  noConformidadId: string,
  porques: { pregunta: string; respuesta: string }[],
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const validos = porques.filter((porque) => porque.respuesta.trim().length > 0);

  await supabase.from("nc_porques").delete().eq("no_conformidad_id", noConformidadId);

  if (validos.length > 0) {
    const { error } = await supabase.from("nc_porques").insert(
      validos.map((porque, indice) => ({
        no_conformidad_id: noConformidadId,
        orden: indice + 1,
        pregunta: porque.pregunta.trim() || `¿Por qué? (${indice + 1})`,
        respuesta: porque.respuesta.trim(),
      })),
    );

    if (error) return { exito: false, error: `No se pudo guardar el análisis: ${error.message}` };
  }

  revalidatePath(`/no-conformidades/${noConformidadId}`);
  return { exito: true, mensaje: "Análisis de los cinco porqués guardado." };
}

/** Agrega una causa al diagrama de Ishikawa. */
export async function agregarCausaIshikawa(
  noConformidadId: string,
  categoria: CategoriaIshikawa,
  causa: string,
  esCausaRaiz: boolean,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  if (causa.trim().length < 3) {
    return { exito: false, error: "Describa la causa con al menos 3 caracteres." };
  }

  const { error } = await supabase.from("nc_ishikawa").insert({
    no_conformidad_id: noConformidadId,
    categoria,
    causa: causa.trim(),
    es_causa_raiz: esCausaRaiz,
  });

  if (error) return { exito: false, error: `No se pudo agregar la causa: ${error.message}` };

  revalidatePath(`/no-conformidades/${noConformidadId}`);
  return { exito: true, mensaje: "Causa agregada al diagrama." };
}

export async function eliminarCausaIshikawa(
  id: string,
  noConformidadId: string,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { error } = await supabase.from("nc_ishikawa").delete().eq("id", id);
  if (error) return { exito: false, error: `No se pudo eliminar la causa: ${error.message}` };

  revalidatePath(`/no-conformidades/${noConformidadId}`);
  return { exito: true, mensaje: "Causa eliminada." };
}

/** Conclusion del analisis de causa raiz. */
export async function guardarConclusionCausaRaiz(
  noConformidadId: string,
  conclusion: string,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("no_conformidades")
    .update({ conclusion_causa_raiz: conclusion.trim() || null })
    .eq("id", noConformidadId);

  if (error) return { exito: false, error: `No se pudo guardar la conclusión: ${error.message}` };

  revalidatePath(`/no-conformidades/${noConformidadId}`);
  return { exito: true, mensaje: "Conclusión de causa raíz guardada." };
}

/** Alta de una accion del plan, con aviso a su responsable. */
export async function crearAccion(
  noConformidadId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const descripcion = String(datos.get("descripcion") ?? "").trim();
  const fechaLimite = String(datos.get("fecha_limite") ?? "");
  const responsableId = String(datos.get("responsable_id") ?? "") || null;

  if (descripcion.length < 10) {
    return { exito: false, error: "Describa la acción con al menos 10 caracteres." };
  }
  if (!fechaLimite) {
    return { exito: false, error: "La acción necesita una fecha límite." };
  }

  const { error } = await supabase.from("nc_acciones").insert({
    no_conformidad_id: noConformidadId,
    tipo: String(datos.get("tipo") ?? "accion_correctiva"),
    descripcion,
    responsable_id: responsableId,
    fecha_limite: fechaLimite,
    estado: "pendiente",
  });

  if (error) return { exito: false, error: `No se pudo crear la acción: ${error.message}` };

  if (responsableId && responsableId !== usuario.id) {
    const [{ data: responsable }, { data: noConformidad }] = await Promise.all([
      supabase.from("usuarios").select("id, correo").eq("id", responsableId).maybeSingle(),
      supabase.from("no_conformidades").select("codigo").eq("id", noConformidadId).maybeSingle(),
    ]);

    if (responsable) {
      await notificar(supabase, {
        usuarioId: responsable.id,
        correoDestino: responsable.correo,
        tipo: "no_conformidad_asignada",
        titulo: `Acción asignada · ${noConformidad?.codigo ?? ""}`,
        mensaje: `Tiene a su cargo: "${descripcion}". Fecha límite: ${fechaLimite}.`,
        enlace: `/no-conformidades/${noConformidadId}`,
        entidad: "no_conformidades",
        entidadId: noConformidadId,
      });
    }
  }

  revalidatePath(`/no-conformidades/${noConformidadId}`);
  return { exito: true, mensaje: "Acción agregada al plan." };
}

/** Avance de una accion por parte de su responsable o de Calidad. */
export async function actualizarEstadoAccion(
  accionId: string,
  noConformidadId: string,
  estado: EstadoAccion,
  evidencia?: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const cambios: Record<string, unknown> = { estado };

  if (estado === "ejecutada") {
    cambios.fecha_ejecucion = hoyEnAsuncion();
    if (evidencia?.trim()) cambios.evidencia = evidencia.trim();
  }
  if (estado === "verificada") {
    cambios.verificado_por = usuario.id;
    cambios.fecha_verificacion = hoyEnAsuncion();
  }

  const { error } = await supabase.from("nc_acciones").update(cambios).eq("id", accionId);

  if (error) return { exito: false, error: `No se pudo actualizar la acción: ${error.message}` };

  revalidatePath(`/no-conformidades/${noConformidadId}`);
  return { exito: true, mensaje: "Acción actualizada." };
}

export async function eliminarAccion(
  accionId: string,
  noConformidadId: string,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { error } = await supabase.from("nc_acciones").delete().eq("id", accionId);
  if (error) return { exito: false, error: `No se pudo eliminar la acción: ${error.message}` };

  revalidatePath(`/no-conformidades/${noConformidadId}`);
  return { exito: true, mensaje: "Acción eliminada." };
}

/**
 * Crea un riesgo a partir del analisis de causa raiz y lo deja vinculado
 * a la no conformidad. Es el puente pedido entre ambos modulos: cuando el
 * analisis revela un riesgo que la matriz no contemplaba.
 */
export async function crearRiesgoDesdeNoConformidad(
  noConformidadId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const titulo = String(datos.get("titulo") ?? "").trim();
  const probabilidad = Number(datos.get("probabilidad") ?? 3);
  const impacto = Number(datos.get("impacto") ?? 3);

  if (titulo.length < 5) {
    return { exito: false, error: "El título del riesgo debe tener al menos 5 caracteres." };
  }
  if (![1, 2, 3, 4, 5].includes(probabilidad) || ![1, 2, 3, 4, 5].includes(impacto)) {
    return { exito: false, error: "La probabilidad y el impacto deben estar entre 1 y 5." };
  }

  const { data: noConformidad } = await supabase
    .from("no_conformidades")
    .select("id, codigo, proceso_id, conclusion_causa_raiz")
    .eq("id", noConformidadId)
    .maybeSingle();

  if (!noConformidad) return { exito: false, error: "La no conformidad no existe." };

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
      tipo: "riesgo",
      categoria: String(datos.get("categoria") ?? "").trim() || null,
      proceso_id: noConformidad.proceso_id,
      responsable_id: usuario.id,
      estado: "identificado",
      causas: noConformidad.conclusion_causa_raiz,
      probabilidad,
      impacto,
      creado_por: usuario.id,
    })
    .select("id, codigo")
    .single();

  if (error) return { exito: false, error: `No se pudo crear el riesgo: ${error.message}` };

  const { error: errorVinculo } = await supabase
    .from("no_conformidades")
    .update({ riesgo_id: riesgo.id })
    .eq("id", noConformidadId);

  if (errorVinculo) {
    return {
      exito: false,
      error: `El riesgo ${riesgo.codigo} se creó, pero no se pudo vincular: ${errorVinculo.message}`,
    };
  }

  revalidatePath(`/no-conformidades/${noConformidadId}`);
  revalidatePath("/riesgos");
  return {
    exito: true,
    id: riesgo.id,
    mensaje: `Riesgo ${riesgo.codigo} creado y vinculado a ${noConformidad.codigo}.`,
  };
}

/** Vincula la no conformidad a un riesgo ya existente en la matriz. */
export async function vincularRiesgoExistente(
  noConformidadId: string,
  riesgoId: string | null,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("no_conformidades")
    .update({ riesgo_id: riesgoId })
    .eq("id", noConformidadId);

  if (error) return { exito: false, error: `No se pudo vincular el riesgo: ${error.message}` };

  revalidatePath(`/no-conformidades/${noConformidadId}`);
  return { exito: true, mensaje: riesgoId ? "Riesgo vinculado." : "Vínculo eliminado." };
}

/** Verificacion de la eficacia del tratamiento. */
export async function registrarEficacia(
  noConformidadId: string,
  eficacia: string,
  observacion: string,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("no_conformidades")
    .update({ eficacia, observacion_eficacia: observacion.trim() || null })
    .eq("id", noConformidadId);

  if (error) return { exito: false, error: `No se pudo registrar la eficacia: ${error.message}` };

  revalidatePath(`/no-conformidades/${noConformidadId}`);
  return { exito: true, mensaje: "Verificación de eficacia registrada." };
}
