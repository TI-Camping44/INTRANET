"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import { notificar } from "@/lib/notificaciones";
import { hoyEnAsuncion } from "@/lib/formato";
import { AREAS_ORGANIZACIONALES, ORIGENES_NC_VIGENTES } from "@/lib/constantes";
import type {
  AreaOrganizacional,
  EstadoAccion,
  EstadoNoConformidad,
  OrigenNoConformidad,
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

  const area = String(datos.get("area") ?? "");
  if (!(area in AREAS_ORGANIZACIONALES)) {
    return { exito: false, error: "Elija el área a la que corresponde la desviación." };
  }

  const origen = String(datos.get("origen") ?? "proceso_interno");
  if (!ORIGENES_NC_VIGENTES.includes(origen as OrigenNoConformidad)) {
    return { exito: false, error: "El origen elegido no está en la lista de Calidad." };
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
      origen,
      severidad: String(datos.get("severidad") ?? "menor"),
      estado: "abierta",
      area: area as AreaOrganizacional,
      empresa_afectada_id: String(datos.get("empresa_afectada_id") ?? "") || usuario.empresa_id,
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      correccion_inmediata: String(datos.get("correccion_inmediata") ?? "").trim() || null,
      detectado_por: usuario.id,
      responsable_id: responsableId,
      fecha_deteccion: String(datos.get("fecha_deteccion") ?? hoyEnAsuncion()),
      // fecha_limite_cierre no se manda: la fija el disparador
      // fijar_limite_cierre_nc() a diez dias de la deteccion.
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
      area: String(datos.get("area") ?? "") || null,
      empresa_afectada_id: String(datos.get("empresa_afectada_id") ?? "") || null,
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      responsable_id: String(datos.get("responsable_id") ?? "") || null,
      correccion_inmediata: String(datos.get("correccion_inmediata") ?? "").trim() || null,
    })
    .eq("id", id);

  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };

  revalidatePath(`/no-conformidades/${id}`);
  return { exito: true, mensaje: "No conformidad actualizada." };
}

/**
 * Completa el area y la empresa de una no conformidad ya registrada.
 *
 * Hace falta porque no todas nacen del formulario: las que genera el
 * sistema desde un hallazgo de auditoria o desde un reclamo de cliente
 * llegan sin area, y sin esto Calidad no tenia como ponersela.
 */
export async function clasificarNoConformidad(
  id: string,
  area: string,
  empresaAfectadaId: string,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  if (!(area in AREAS_ORGANIZACIONALES)) {
    return { exito: false, error: "Elija el área a la que corresponde la desviación." };
  }

  const { error } = await supabase
    .from("no_conformidades")
    .update({ area, empresa_afectada_id: empresaAfectadaId || null })
    .eq("id", id);

  if (error) return { exito: false, error: `No se pudo guardar: ${error.message}` };

  revalidatePath(`/no-conformidades/${id}`);
  revalidatePath("/no-conformidades");
  return { exito: true, mensaje: "Clasificación actualizada." };
}

/**
 * Cambio de estado dentro del ciclo de tratamiento.
 *
 * El cierre esta reservado a Calidad y solo despues de verificar la
 * eficacia. Lo controla tambien el disparador controlar_cierre_nc(): lo
 * de aca es para dar un mensaje entendible antes de llegar a la base.
 */
export async function cambiarEstadoNoConformidad(
  id: string,
  estado: EstadoNoConformidad,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const cambios: Record<string, unknown> = { estado };

  if (estado === "cerrada") {
    if (usuario.rol !== "administrador_sgc") {
      return {
        exito: false,
        error:
          "Cerrar una no conformidad es atribución de Calidad, después de verificar la " +
          "eficacia de la acción correctiva.",
      };
    }

    const { data: noConformidad } = await supabase
      .from("no_conformidades")
      .select("eficacia")
      .eq("id", id)
      .maybeSingle();

    if (!noConformidad || noConformidad.eficacia === "pendiente") {
      return {
        exito: false,
        error:
          "Registre primero la verificación de eficacia: una no conformidad no se cierra sin ella.",
      };
    }

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

/**
 * Guarda la cadena de los cinco porques.
 *
 * Los cinco son obligatorios. Calidad lo pidio asi por una razon
 * concreta: cuando se permite cortar antes, se corta en el segundo, y el
 * segundo porque casi nunca es la causa raiz sino otro sintoma.
 */
export async function guardarPorques(
  noConformidadId: string,
  porques: { pregunta: string; respuesta: string }[],
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const validos = porques.filter((porque) => porque.respuesta.trim().length > 0);

  if (validos.length < porques.length) {
    return {
      exito: false,
      error: "Complete los cinco porqués: la cadena tiene que llegar hasta la causa raíz.",
    };
  }

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

// El puente con el modulo de Riesgos —crear un riesgo desde el analisis
// de causa raiz y vincularlo— se retiro de la ficha. La columna riesgo_id
// sigue en la tabla: Riesgos y oportunidades se rehace con Calidad y ahi
// se decide como vuelve el vinculo.

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
