"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import { departe, notificar } from "@/lib/notificaciones";
import { hoyEnAsuncion } from "@/lib/formato";
import {
  AREAS_ORGANIZACIONALES,
  ORIGENES_NC_VIGENTES,
  PREGUNTAS_CINCO_PORQUES,
} from "@/lib/constantes";
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

  // El responsable no es opcional en el alta: es quien recibe la no
  // conformidad, analiza la causa y propone la accion correctiva. Una
  // desviacion sin responsable es una desviacion que no le llega a nadie.
  const responsableId = String(datos.get("responsable_id") ?? "") || null;
  if (!responsableId) {
    return {
      exito: false,
      error:
        "Elija al responsable de la acción correctiva. Es quien recibe la no conformidad y " +
        "tiene que analizarla y responder.",
    };
  }

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
      // Las propuestas llegan como varios campos con el mismo nombre. Se
      // descartan las vacias: el formulario abre con un cuadro en blanco
      // y quien no tenga ninguna idea simplemente no lo completa.
      propuestas_mejora: datos
        .getAll("propuestas_mejora")
        .map((propuesta) => String(propuesta).trim())
        .filter((propuesta) => propuesta.length > 0),
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
        deParteDe: departe(usuario),
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
      error: "La descripción debe tener al menos 15 caracteres: es la evidencia del hallazgo.",
    };
  }

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
      // Las propuestas y la fecha de deteccion tambien se editan: el
      // formulario de alta las pide y el de edicion es el mismo, asi que
      // si no se guardaran, editar cualquier cosa las borraria.
      propuestas_mejora: datos
        .getAll("propuestas_mejora")
        .map((valor) => String(valor).trim())
        .filter((propuesta) => propuesta.length > 0),
      fecha_deteccion: String(datos.get("fecha_deteccion") ?? "") || undefined,
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
        deParteDe: departe(usuario),
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
  // Tambien el listado transversal: si no, la accion recien cargada
  // sigue apareciendo como «sin plan de accion» hasta la proxima visita.
  revalidatePath("/acciones");
  return { exito: true, mensaje: "Acción agregada al plan." };
}

/**
 * Responder una no conformidad: descargo, cinco porques y accion.
 *
 * Es el camino que pidio Calidad. Quien recibe la desviacion contesta en
 * un solo paso —explica que paso, encadena los cinco porques hasta la
 * causa raiz y propone la accion— y con eso la no conformidad se cierra.
 *
 * La accion QUEDA ABIERTA a proposito. Lo que hay que controlar de ahi en
 * adelante no es la desviacion, que ya tiene analisis y plan, sino que
 * ese plan se ejecute y despues resulte eficaz.
 *
 * El orden importa: primero el analisis y la accion, y el cierre al
 * final. El disparador `controlar_cierre_nc()` exige que las dos cosas
 * esten para dejar cerrar, asi que cerrar antes fallaria. Si el cierre
 * falla igual, lo cargado queda: es preferible una no conformidad
 * respondida y abierta que perder el descargo y el analisis.
 */
export async function responderNoConformidad(
  noConformidadId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const descargo = String(datos.get("descargo") ?? "").trim();
  const descripcion = String(datos.get("descripcion") ?? "").trim();
  const fechaLimite = String(datos.get("fecha_limite") ?? "");
  const responsableId = String(datos.get("responsable_id") ?? "") || null;
  const porques = datos.getAll("porque").map((valor) => String(valor).trim());

  if (descargo.length < 10) {
    return {
      exito: false,
      error: "Escriba el descargo: qué pasó y por qué, con al menos 10 caracteres.",
    };
  }
  if (descripcion.length < 10) {
    return { exito: false, error: "Describa la acción con al menos 10 caracteres." };
  }
  if (!fechaLimite) {
    return { exito: false, error: "La acción necesita una fecha límite." };
  }
  if (porques.length < 5 || porques.some((porque) => porque.length === 0)) {
    return {
      exito: false,
      error:
        "Complete los cinco porqués. El quinto es la causa raíz: si la cadena se corta antes, " +
        "la acción ataca un síntoma.",
    };
  }

  // 1 · El analisis. Se reemplaza el que hubiera: la cadena es una sola.
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

  // 2 · La accion, con el descargo. Queda pendiente: es lo que se sigue.
  const { error: errorAccion } = await supabase.from("nc_acciones").insert({
    no_conformidad_id: noConformidadId,
    tipo: String(datos.get("tipo") ?? "accion_correctiva"),
    descripcion,
    descargo,
    responsable_id: responsableId,
    fecha_limite: fechaLimite,
    estado: "pendiente",
  });

  if (errorAccion) {
    return { exito: false, error: `No se pudo cargar la acción: ${errorAccion.message}` };
  }

  // 3 · La causa raiz queda como conclusion del analisis, que es donde la
  // busca quien lee la ficha. Este update si pasa por RLS, y esta bien
  // que asi sea: lo escribe quien puede editar la desviacion.
  await supabase
    .from("no_conformidades")
    .update({ conclusion_causa_raiz: porques[porques.length - 1] })
    .eq("id", noConformidadId);

  // 4 · El estado NO se toca aca. La desviacion pasa a «En proceso»
  // sola, por el disparador `sincronizar_estado_nc_por_accion()`, en
  // cuanto existe la accion que se acaba de insertar.
  //
  // Hasta el 22 de septiembre responder cerraba la no conformidad. La
  // especificacion de Calidad del 23 lo cambio: cargar la accion la pasa
  // a «En proceso» y el cierre lo elige una persona desde la linea de
  // estados, diciendo si fue en plazo o fuera de plazo. Las dos cosas no
  // pueden convivir: si responder cerrara, «En proceso» no existiria.
  revalidatePath(`/no-conformidades/${noConformidadId}`);
  revalidatePath("/no-conformidades");
  revalidatePath("/acciones");

  if (responsableId && responsableId !== usuario.id) {
    const [{ data: responsable }, { data: noConformidad }] = await Promise.all([
      supabase.from("usuarios").select("id, correo").eq("id", responsableId).maybeSingle(),
      supabase.from("no_conformidades").select("codigo").eq("id", noConformidadId).maybeSingle(),
    ]);

    if (responsable) {
      await notificar(supabase, {
        deParteDe: departe(usuario),
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

  return {
    exito: true,
    id: noConformidadId,
    mensaje:
      "No conformidad respondida. Queda en proceso: el cierre se registra desde la ficha, " +
      "indicando si fue en plazo o fuera de plazo.",
  };
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


/**
 * Cierra la no conformidad, diciendo si fue en plazo o fuera de plazo.
 *
 * El cierre lo elige una persona. El sistema sugiere cual corresponde
 * comparando la fecha de la primera accion correctiva con la de
 * deteccion, pero no decide: quien cierra puede saber algo que el
 * sistema no, y lo que vale en una auditoria es que la decision este
 * tomada por alguien y quede registrada.
 *
 * Lo unico obligatorio es que haya una accion correctiva cargada. Lo
 * controla tambien el disparador `controlar_cierre_nc()`; aca se repite
 * para poder dar un mensaje entendible en vez del error de PostgreSQL.
 *
 * Reemplaza al cierre automatico al responder que se habia definido el
 * 22 de septiembre: con el nuevo circuito, cargar la accion pasa la
 * desviacion a «En proceso» y el cierre es el paso siguiente.
 */
export async function cerrarNoConformidad(
  id: string,
  enPlazo: boolean,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) {
    return { exito: false, error: "El perfil de Dirección es de solo lectura." };
  }

  const supabase = crearClienteServidor();

  const { count } = await supabase
    .from("nc_acciones")
    .select("id", { count: "exact", head: true })
    .eq("no_conformidad_id", id);

  if (!count) {
    return {
      exito: false,
      error:
        "No se puede cerrar una no conformidad sin acción correctiva. Cargue primero la " +
        "acción desde «Acciones correctivas».",
    };
  }

  const { error } = await supabase
    .from("no_conformidades")
    .update({
      estado: "cerrada",
      cierre_en_plazo: enPlazo,
      fecha_cierre: hoyEnAsuncion(),
      cerrado_por: usuario.id,
    })
    .eq("id", id);

  if (error) return { exito: false, error: `No se pudo cerrar: ${error.message}` };

  revalidatePath(`/no-conformidades/${id}`);
  revalidatePath("/no-conformidades");

  return {
    exito: true,
    mensaje: enPlazo ? "Cerrada en plazo." : "Cerrada fuera de plazo.",
  };
}

/**
 * Reabre una no conformidad cerrada.
 *
 * Vuelve al estado que le corresponda por sus acciones: si tiene alguna,
 * «En proceso»; si no, «Abierto». El disparador limpia la fecha y la
 * clasificacion del cierre, para que si vuelve a cerrarse se decida de
 * nuevo en vez de arrastrar la decision anterior.
 */
export async function reabrirNoConformidad(id: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) {
    return { exito: false, error: "El perfil de Dirección es de solo lectura." };
  }

  const supabase = crearClienteServidor();

  const { count } = await supabase
    .from("nc_acciones")
    .select("id", { count: "exact", head: true })
    .eq("no_conformidad_id", id);

  const { error } = await supabase
    .from("no_conformidades")
    .update({ estado: count ? "en_tratamiento" : "abierta", cerrado_por: null })
    .eq("id", id);

  if (error) return { exito: false, error: `No se pudo reabrir: ${error.message}` };

  revalidatePath(`/no-conformidades/${id}`);
  revalidatePath("/no-conformidades");
  return { exito: true, mensaje: "No conformidad reabierta." };
}

/**
 * Elimina una no conformidad con todo lo que cuelga de ella.
 *
 * Es para lo que no deberia haberse cargado: una prueba, un duplicado,
 * un registro mal abierto. No es la forma de dar por terminada una
 * desviacion real —para eso esta el cierre, que la conserva con su
 * historial, que es lo que pide la norma—.
 *
 * Solo el Administrador SGC, que es lo que ya dice RLS
 * (`no_conformidades_baja`). Se repite aca para dar un mensaje en vez de
 * un borrado que afecta cero filas y no avisa nada.
 *
 * La bitacora conserva la constancia: el disparador registra la baja con
 * quien la hizo antes de que la fila desaparezca.
 */
export async function eliminarNoConformidad(id: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();

  if (usuario.rol !== "administrador_sgc") {
    return {
      exito: false,
      error:
        "Solo el Administrador SGC puede eliminar una no conformidad. " +
        "Si la desviación es real, ciérrela en vez de borrarla.",
    };
  }

  const supabase = crearClienteServidor();

  const { data: noConformidad } = await supabase
    .from("no_conformidades")
    .select("codigo, titulo")
    .eq("id", id)
    .maybeSingle();

  if (!noConformidad) {
    return { exito: false, error: "La no conformidad no existe o no tiene acceso." };
  }

  // Las acciones y los porques se van solos: su clave foranea cascadea.
  const { error } = await supabase.from("no_conformidades").delete().eq("id", id);

  if (error) return { exito: false, error: `No se pudo eliminar: ${error.message}` };

  revalidatePath("/no-conformidades");
  revalidatePath("/acciones");

  return {
    exito: true,
    mensaje: `${noConformidad.codigo} eliminada junto con sus acciones y su análisis.`,
  };
}
