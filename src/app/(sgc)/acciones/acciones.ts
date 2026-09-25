"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import { departe, notificar } from "@/lib/notificaciones";
import { hoyEnAsuncion } from "@/lib/formato";
import { PREGUNTAS_CINCO_PORQUES } from "@/lib/constantes";
import type { ResultadoAccion } from "@/lib/tipos";

/**
 * Las escrituras de la acción correctiva.
 *
 * «La acción correctiva» de una desviación es una sola cosa aunque viva
 * en tres tablas: el descargo y las tareas en `nc_acciones`, el análisis
 * en `nc_porques`, y la eficacia en la propia `no_conformidades`. Por eso
 * estas funciones trabajan por no conformidad y no por fila.
 *
 * Nada de acá toca el estado de la no conformidad. Lo pidió Calidad y es
 * la regla que ordena el módulo: la desviación queda «En proceso» en
 * cuanto tiene una acción cargada, y de ahí no se mueve sola. Cerrarla
 * —en plazo o fuera de plazo— lo hace el auditor a mano desde la ficha
 * de la NC, cuando ya controló todas las acciones.
 */

/**
 * Cierra una tarea del plan, diciendo si se ejecutó en plazo o fuera.
 *
 * No hay paso automático. Que venza la fecha límite no significa que la
 * tarea se haya hecho ni que se haya dejado de hacer: significa que
 * venció. Mientras nadie diga que se ejecutó, la acción queda abierta.
 */
export async function ejecutarAccion(
  accionId: string,
  enPlazo: boolean,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) {
    return { exito: false, error: "El perfil de Dirección es de solo lectura." };
  }

  const supabase = crearClienteServidor();

  const { data: accion } = await supabase
    .from("nc_acciones")
    .select("id, no_conformidad_id")
    .eq("id", accionId)
    .maybeSingle();

  if (!accion) return { exito: false, error: "La acción no existe o no tiene acceso." };

  const { error } = await supabase
    .from("nc_acciones")
    .update({
      estado: "ejecutada",
      fecha_ejecucion: hoyEnAsuncion(),
      ejecucion_en_plazo: enPlazo,
    })
    .eq("id", accionId);

  if (error) return { exito: false, error: `No se pudo cerrar la acción: ${error.message}` };

  revalidatePath(`/acciones/${accion.no_conformidad_id}`);
  revalidatePath("/acciones");

  return {
    exito: true,
    mensaje: enPlazo ? "Ejecutada en plazo." : "Ejecutada fuera de plazo.",
  };
}

/** Devuelve una tarea a abierta, borrando su ejecución. */
export async function reabrirAccion(accionId: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) {
    return { exito: false, error: "El perfil de Dirección es de solo lectura." };
  }

  const supabase = crearClienteServidor();

  const { data: accion } = await supabase
    .from("nc_acciones")
    .select("id, no_conformidad_id")
    .eq("id", accionId)
    .maybeSingle();

  if (!accion) return { exito: false, error: "La acción no existe o no tiene acceso." };

  const { error } = await supabase
    .from("nc_acciones")
    .update({ estado: "pendiente", fecha_ejecucion: null, ejecucion_en_plazo: null })
    .eq("id", accionId);

  if (error) return { exito: false, error: `No se pudo reabrir: ${error.message}` };

  // Si la acción correctiva estaba dada por eficaz, deja de estarlo: la
  // eficacia se verifica sobre el plan completo, y el plan volvió a
  // tener una tarea abierta.
  await supabase
    .from("no_conformidades")
    .update({ eficacia: "pendiente" })
    .eq("id", accion.no_conformidad_id)
    .neq("eficacia", "pendiente");

  revalidatePath(`/acciones/${accion.no_conformidad_id}`);
  revalidatePath("/acciones");
  return { exito: true, mensaje: "Acción reabierta." };
}

/**
 * Cierra la acción correctiva como eficaz o no eficaz.
 *
 * Solo cuando todas las tareas del plan están ejecutadas. Es la regla de
 * Calidad y tiene sentido: la eficacia se mide sobre lo que se hizo, y
 * con una tarea todavía abierta no se hizo todo.
 *
 * Esto NO cierra la no conformidad. La desviación la cierra el auditor a
 * mano desde su ficha, con el criterio de plazo que ya estaba.
 */
export async function verificarEficacia(
  noConformidadId: string,
  eficaz: boolean,
  observacion: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) {
    return { exito: false, error: "El perfil de Dirección es de solo lectura." };
  }

  const supabase = crearClienteServidor();

  const { data: acciones } = await supabase
    .from("nc_acciones")
    .select("id, estado")
    .eq("no_conformidad_id", noConformidadId);

  const cargadas = (acciones as { id: string; estado: string }[] | null) ?? [];

  if (cargadas.length === 0) {
    return { exito: false, error: "Esta no conformidad no tiene ninguna acción cargada." };
  }

  const abiertas = cargadas.filter(
    (accion) => accion.estado !== "ejecutada" && accion.estado !== "verificada",
  );

  if (abiertas.length > 0) {
    return {
      exito: false,
      error:
        `Quedan ${abiertas.length} ${abiertas.length === 1 ? "acción" : "acciones"} sin ` +
        "ejecutar. La eficacia se verifica cuando el plan está completo.",
    };
  }

  const texto = observacion.trim();
  if (texto.length < 10) {
    return {
      exito: false,
      error: "Escriba en qué se basa la verificación, con al menos 10 caracteres.",
    };
  }

  const { error } = await supabase
    .from("no_conformidades")
    .update({
      eficacia: eficaz ? "eficaz" : "no_eficaz",
      observacion_eficacia: texto,
    })
    .eq("id", noConformidadId);

  if (error) return { exito: false, error: `No se pudo registrar: ${error.message}` };

  // Las tareas quedan como verificadas: ya se controlaron.
  await supabase
    .from("nc_acciones")
    .update({ verificado_por: usuario.id, fecha_verificacion: hoyEnAsuncion() })
    .eq("no_conformidad_id", noConformidadId)
    .eq("estado", "ejecutada");

  revalidatePath(`/acciones/${noConformidadId}`);
  revalidatePath(`/no-conformidades/${noConformidadId}`);
  revalidatePath("/acciones");

  return {
    exito: true,
    mensaje: eficaz ? "Acción correctiva cerrada como eficaz." : "Cerrada como no eficaz.",
  };
}

/** Deja la eficacia sin verificar, para volver a evaluarla. */
export async function reabrirEficacia(noConformidadId: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) {
    return { exito: false, error: "El perfil de Dirección es de solo lectura." };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("no_conformidades")
    .update({ eficacia: "pendiente" })
    .eq("id", noConformidadId);

  if (error) return { exito: false, error: `No se pudo reabrir: ${error.message}` };

  revalidatePath(`/acciones/${noConformidadId}`);
  return { exito: true, mensaje: "La verificación de eficacia quedó pendiente otra vez." };
}

/**
 * Guarda la edición de la acción correctiva completa.
 *
 * El descargo, los cinco porqués y las tareas. Las tareas que ya existen
 * se actualizan por su id —conservan su estado de ejecución—, las nuevas
 * se insertan y las que se sacaron del formulario se borran.
 *
 * El descargo se escribe en todas las filas: es de la persona y de la
 * desviación, no de cada tarea.
 */
export async function actualizarRespuesta(
  noConformidadId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) {
    return { exito: false, error: "El perfil de Dirección es de solo lectura." };
  }

  const supabase = crearClienteServidor();

  const descargo = String(datos.get("descargo") ?? "").trim();
  const porques = datos.getAll("porque").map((valor) => String(valor).trim());

  // `null` es «no contesto»: distinto de «no». La validacion de abajo lo
  // exige, asi que no se puede guardar una respuesta sin responder esto.
  const respuestaSimilares = String(datos.get("hay_nc_similares") ?? "");
  const hayNcSimilares =
    respuestaSimilares === "si" ? true : respuestaSimilares === "no" ? false : null;
  const analisisHorizontal = String(datos.get("analisis_horizontal") ?? "").trim();

  const ids = datos.getAll("accion_id").map((valor) => String(valor));
  const descripciones = datos.getAll("accion_descripcion").map((valor) => String(valor).trim());
  const plazos = datos.getAll("accion_fecha_limite").map((valor) => String(valor));
  const responsables = datos.getAll("accion_responsable").map((valor) => String(valor));

  const tareas = descripciones.map((descripcion, indice) => ({
    id: ids[indice] || null,
    descripcion,
    fechaLimite: plazos[indice] ?? "",
    responsableId: responsables[indice] || null,
  }));

  if (descargo.length < 10) {
    return { exito: false, error: "El descargo debe tener al menos 10 caracteres." };
  }
  if (porques.length < 5 || porques.some((porque) => porque.length === 0)) {
    return { exito: false, error: "Complete los cinco porqués." };
  }
  if (tareas.length === 0) {
    return { exito: false, error: "Deje al menos una acción." };
  }
  if (hayNcSimilares === null) {
    return {
      exito: false,
      error: "Indique si existen no conformidades similares o que puedan ocurrir.",
    };
  }
  if (hayNcSimilares && analisisHorizontal.length < 15) {
    return {
      exito: false,
      error:
        "Detalle el análisis horizontal con al menos 15 caracteres: dónde más ocurrió o puede ocurrir.",
    };
  }
  for (let indice = 0; indice < tareas.length; indice += 1) {
    const cual = tareas.length === 1 ? "la acción" : `la acción ${indice + 1}`;
    if (tareas[indice].descripcion.length < 10) {
      return { exito: false, error: `Describa ${cual} con al menos 10 caracteres.` };
    }
    if (!tareas[indice].fechaLimite) {
      return { exito: false, error: `Indique la fecha límite de ${cual}.` };
    }
  }

  // El análisis se reemplaza entero: la cadena es una sola.
  await supabase.from("nc_porques").delete().eq("no_conformidad_id", noConformidadId);
  const { error: errorPorques } = await supabase.from("nc_porques").insert(
    porques.map((respuesta, indice) => ({
      no_conformidad_id: noConformidadId,
      orden: indice + 1,
      pregunta: PREGUNTAS_CINCO_PORQUES[indice] ?? `¿Por qué? (${indice + 1})`,
      respuesta,
    })),
  );

  if (errorPorques) {
    return { exito: false, error: `No se pudo guardar el análisis: ${errorPorques.message}` };
  }

  await supabase
    .from("no_conformidades")
    .update({
      conclusion_causa_raiz: porques[porques.length - 1],
      hay_nc_similares: hayNcSimilares,
      // Si contesto que no, no queda guardado un analisis que contradice
      // la respuesta: se limpia.
      analisis_horizontal: hayNcSimilares ? analisisHorizontal : null,
    })
    .eq("id", noConformidadId);

  // Las que se sacaron del formulario. Se borran primero, para que la
  // cuenta de acciones que mira el disparador quede bien de una vez.
  const conservados = tareas.map((tarea) => tarea.id).filter(Boolean) as string[];
  const { data: existentes } = await supabase
    .from("nc_acciones")
    .select("id")
    .eq("no_conformidad_id", noConformidadId);

  const sobrantes = ((existentes as { id: string }[] | null) ?? [])
    .map((fila) => fila.id)
    .filter((id) => !conservados.includes(id));

  if (sobrantes.length > 0) {
    await supabase.from("nc_acciones").delete().in("id", sobrantes);
  }

  const nuevas = tareas.filter((tarea) => !tarea.id);
  if (nuevas.length > 0) {
    const { error } = await supabase.from("nc_acciones").insert(
      nuevas.map((tarea) => ({
        no_conformidad_id: noConformidadId,
        tipo: "accion_correctiva",
        descripcion: tarea.descripcion,
        descargo,
        responsable_id: tarea.responsableId,
        fecha_limite: tarea.fechaLimite,
        estado: "pendiente",
      })),
    );
    if (error) return { exito: false, error: `No se pudo agregar la acción: ${error.message}` };
  }

  const existentesEditadas = tareas.filter((tarea) => tarea.id);
  const resultados = await Promise.all(
    existentesEditadas.map((tarea) =>
      supabase
        .from("nc_acciones")
        .update({
          descripcion: tarea.descripcion,
          descargo,
          responsable_id: tarea.responsableId,
          fecha_limite: tarea.fechaLimite,
        })
        .eq("id", tarea.id as string),
    ),
  );

  const fallido = resultados.find((resultado) => resultado.error);
  if (fallido?.error) {
    return { exito: false, error: `No se pudo guardar: ${fallido.error.message}` };
  }

  revalidatePath(`/acciones/${noConformidadId}`);
  revalidatePath(`/no-conformidades/${noConformidadId}`);
  revalidatePath("/acciones");

  return { exito: true, id: noConformidadId, mensaje: "Acción correctiva actualizada." };
}

/**
 * Elimina la acción correctiva entera: sus tareas y su análisis.
 *
 * Es el mismo criterio que en el módulo de no conformidades: sirve para
 * lo que no debería haberse cargado, no para dar por terminada una
 * respuesta real. Solo el Administrador SGC, igual que allá.
 *
 * La desviación vuelve sola a «Abierto» —lo hace el disparador cuando se
 * borra la última acción— porque es lo que pasa a ser: una desviación
 * sin respuesta.
 */
export async function eliminarRespuesta(noConformidadId: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();

  if (usuario.rol !== "administrador_sgc") {
    return {
      exito: false,
      error: "Solo el Administrador SGC puede eliminar una acción correctiva.",
    };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("nc_acciones")
    .delete()
    .eq("no_conformidad_id", noConformidadId);

  if (error) return { exito: false, error: `No se pudo eliminar: ${error.message}` };

  await supabase.from("nc_porques").delete().eq("no_conformidad_id", noConformidadId);
  await supabase
    .from("no_conformidades")
    .update({ conclusion_causa_raiz: null, eficacia: "pendiente", observacion_eficacia: null })
    .eq("id", noConformidadId);

  revalidatePath(`/no-conformidades/${noConformidadId}`);
  revalidatePath("/acciones");

  return {
    exito: true,
    mensaje: "Acción correctiva eliminada. La no conformidad vuelve a quedar abierta.",
  };
}

/** Avisa al responsable de una tarea que la tiene a su cargo. */
export async function recordarAccion(accionId: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: accion } = await supabase
    .from("nc_acciones")
    .select("id, descripcion, fecha_limite, responsable_id, no_conformidad_id")
    .eq("id", accionId)
    .maybeSingle();

  if (!accion?.responsable_id) {
    return { exito: false, error: "Esta acción no tiene responsable asignado." };
  }

  const [{ data: persona }, { data: noConformidad }] = await Promise.all([
    supabase.from("usuarios").select("id, correo").eq("id", accion.responsable_id).maybeSingle(),
    supabase
      .from("no_conformidades")
      .select("codigo")
      .eq("id", accion.no_conformidad_id)
      .maybeSingle(),
  ]);

  if (!persona) return { exito: false, error: "No se encontró a la persona responsable." };

  await notificar(supabase, {
    deParteDe: departe(usuario),
    usuarioId: persona.id,
    correoDestino: persona.correo,
    tipo: "no_conformidad_asignada",
    titulo: `Recordatorio · ${noConformidad?.codigo ?? ""}`,
    mensaje: `Tiene pendiente: ${accion.descripcion}. Fecha límite: ${accion.fecha_limite}.`,
    enlace: `/acciones/${accion.no_conformidad_id}`,
    entidad: "no_conformidades",
    entidadId: accion.no_conformidad_id,
  });

  return { exito: true, mensaje: "Recordatorio enviado." };
}
