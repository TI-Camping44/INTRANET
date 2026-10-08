"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import {
  BUCKET_DOCUMENTOS,
  motivoDeRechazoEvidencia,
  nombreDeArchivoLegible,
  rutaDeEvidencia,
} from "@/lib/adjuntos";
import {
  archivosDelFormulario,
  quitarAdjunto,
  subirAdjuntos,
} from "@/lib/adjuntos-servidor";
import { puedeGestionarAuditorias, requerirUsuario } from "@/lib/sesion";
import { departe, notificar, notificarAVarios } from "@/lib/notificaciones";
import { hoyEnAsuncion, sumarDias } from "@/lib/formato";
import { DIAS_LIMITE_CIERRE_NC, SEGUN_EL_PLAN } from "@/lib/constantes";
import type { EstadoAuditoria, ResultadoAccion, TipoHallazgo } from "@/lib/tipos";

/** Programa anual de auditorias. Hay uno por empresa y por ano. */
export async function crearProgramaAuditoria(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) {
    return { exito: false, error: "Su rol no permite gestionar el programa de auditorías." };
  }

  const supabase = crearClienteServidor();
  const anio = Number(datos.get("anio") ?? new Date().getFullYear());

  if (!Number.isInteger(anio) || anio < 2000 || anio > 2100) {
    return { exito: false, error: "El año del programa no es válido." };
  }

  const { error } = await supabase.from("programas_auditoria").insert({
    empresa_id: usuario.empresa_id,
    anio,
    nombre: String(datos.get("nombre") ?? "").trim() || `Programa anual de auditorías ${anio}`,
    objetivo: String(datos.get("objetivo") ?? "").trim() || null,
    estado: "planificada",
  });

  if (error) {
    if (error.code === "23505") {
      return { exito: false, error: `Ya existe un programa de auditorías para ${anio}.` };
    }
    return { exito: false, error: `No se pudo crear el programa: ${error.message}` };
  }

  revalidatePath("/auditorias");
  return { exito: true, mensaje: `Programa ${anio} creado.` };
}

/**
 * Se pide la aprobacion del programa a alguien, y se le avisa.
 *
 * EL PROGRAMA NO SE APRUEBA SOLO. Antes el boton decia «Aprobar
 * programa» y lo apretaba quien lo estuviera mirando: eso no es una
 * aprobacion, es un cambio de estado. Ahora se elige a quien tiene que
 * aprobarlo, le llega la notificacion, y el boton de aprobar aparece
 * recien para esa persona.
 */
export async function solicitarAprobacionPrograma(
  programaId: string,
  aprobadorId: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) {
    return { exito: false, error: "Su rol no permite gestionar el programa de auditorías." };
  }

  if (!aprobadorId) return { exito: false, error: "Elija a quién le pide la aprobación." };

  const supabase = crearClienteServidor();

  const { data: programa } = await supabase
    .from("programas_auditoria")
    .select("id, nombre, anio, fecha_aprobacion")
    .eq("id", programaId)
    .maybeSingle();

  if (!programa) return { exito: false, error: "El programa no existe o no tiene acceso." };

  const datosPrograma = programa as {
    id: string;
    nombre: string;
    anio: number;
    fecha_aprobacion: string | null;
  };

  if (datosPrograma.fecha_aprobacion) {
    return { exito: false, error: "El programa ya está aprobado." };
  }

  const { error } = await supabase
    .from("programas_auditoria")
    .update({
      aprobacion_solicitada_a: aprobadorId,
      aprobacion_solicitada_en: new Date().toISOString(),
    })
    .eq("id", programaId);

  if (error) {
    return { exito: false, error: `No se pudo pedir la aprobación: ${error.message}` };
  }

  const { data: aprobador } = await supabase
    .from("usuarios")
    .select("id, correo, nombre_completo")
    .eq("id", aprobadorId)
    .maybeSingle();

  if (aprobador) {
    const persona = aprobador as { id: string; correo: string; nombre_completo: string };
    // El correo no bloquea: si el SMTP no responde, la notificacion queda
    // sin enviar y el trabajo programado la reintenta.
    await notificar(supabase, {
      deParteDe: departe(usuario),
      usuarioId: persona.id,
      correoDestino: persona.correo,
      tipo: "revision_solicitada",
      titulo: `Aprobación pendiente: ${datosPrograma.nombre}`,
      mensaje:
        `Se le pidió aprobar el programa anual de auditorías ${datosPrograma.anio}. ` +
        "Entre a la ficha del programa para revisarlo y aprobarlo.",
      enlace: `/auditorias/programas/${programaId}`,
      entidad: "programas_auditoria",
      entidadId: programaId,
      claveUnicidad: `aprobacion-programa:${programaId}:${aprobadorId}`,
    });
  }

  revalidatePath("/auditorias");
  revalidatePath(`/auditorias/programas/${programaId}`);

  return {
    exito: true,
    mensaje: `Aprobación solicitada a ${
      (aprobador as { nombre_completo: string } | null)?.nombre_completo ?? "la persona elegida"
    }.`,
  };
}

/**
 * Aprobacion del programa anual.
 *
 * SOLO APRUEBA A QUIEN SE LE PIDIO, o el Administrador SGC. No alcanza
 * con ocultar el boton: quien tiene la direccion de la accion puede
 * llamarla igual, asi que el control esta aca.
 */
export async function aprobarPrograma(programaId: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();

  const supabase = crearClienteServidor();

  const { data: programa } = await supabase
    .from("programas_auditoria")
    .select("aprobacion_solicitada_a, fecha_aprobacion")
    .eq("id", programaId)
    .maybeSingle();

  if (!programa) return { exito: false, error: "El programa no existe o no tiene acceso." };

  const datosPrograma = programa as {
    aprobacion_solicitada_a: string | null;
    fecha_aprobacion: string | null;
  };

  if (datosPrograma.fecha_aprobacion) {
    return { exito: false, error: "El programa ya está aprobado." };
  }

  const esElAprobador = datosPrograma.aprobacion_solicitada_a === usuario.id;
  if (!esElAprobador && usuario.rol !== "administrador_sgc") {
    return {
      exito: false,
      error: "La aprobación le corresponde a quien se le pidió, o al Administrador SGC.",
    };
  }

  const { error } = await supabase
    .from("programas_auditoria")
    .update({
      estado: "en_ejecucion",
      aprobado_por: usuario.id,
      fecha_aprobacion: hoyEnAsuncion(),
    })
    .eq("id", programaId);

  if (error) return { exito: false, error: `No se pudo aprobar el programa: ${error.message}` };

  revalidatePath("/auditorias");
  revalidatePath(`/auditorias/programas/${programaId}`);
  return { exito: true, mensaje: "Programa aprobado y puesto en ejecución." };
}

/** Se pide la aprobacion del plan de una auditoria, y se le avisa. */
export async function solicitarAprobacionPlan(
  auditoriaId: string,
  aprobadorId: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) {
    return { exito: false, error: "Su rol no permite gestionar auditorías." };
  }

  if (!aprobadorId) return { exito: false, error: "Elija a quién le pide la aprobación." };

  const supabase = crearClienteServidor();

  const { data: auditoria } = await supabase
    .from("auditorias")
    .select("id, codigo, objetivo, plan_fecha_aprobacion")
    .eq("id", auditoriaId)
    .maybeSingle();

  if (!auditoria) return { exito: false, error: "La auditoría no existe o no tiene acceso." };

  const datosAuditoria = auditoria as {
    codigo: string;
    objetivo: string | null;
    plan_fecha_aprobacion: string | null;
  };

  if (datosAuditoria.plan_fecha_aprobacion) {
    return { exito: false, error: "El plan ya está aprobado." };
  }

  const { error } = await supabase
    .from("auditorias")
    .update({
      plan_aprobacion_solicitada_a: aprobadorId,
      plan_aprobacion_solicitada_en: new Date().toISOString(),
    })
    .eq("id", auditoriaId);

  if (error) {
    return { exito: false, error: `No se pudo pedir la aprobación: ${error.message}` };
  }

  const { data: aprobador } = await supabase
    .from("usuarios")
    .select("id, correo, nombre_completo")
    .eq("id", aprobadorId)
    .maybeSingle();

  if (aprobador) {
    const persona = aprobador as { id: string; correo: string; nombre_completo: string };
    await notificar(supabase, {
      deParteDe: departe(usuario),
      usuarioId: persona.id,
      correoDestino: persona.correo,
      tipo: "revision_solicitada",
      titulo: `Aprobación pendiente: plan de ${datosAuditoria.codigo}`,
      mensaje:
        `Se le pidió aprobar el plan de la auditoría ${datosAuditoria.codigo}. ` +
        "Entre a la ficha de la auditoría para revisarlo y aprobarlo.",
      enlace: `/auditorias/${auditoriaId}`,
      entidad: "auditorias",
      entidadId: auditoriaId,
      claveUnicidad: `aprobacion-plan:${auditoriaId}:${aprobadorId}`,
    });
  }

  revalidatePath(`/auditorias/${auditoriaId}`);

  return {
    exito: true,
    mensaje: `Aprobación solicitada a ${
      (aprobador as { nombre_completo: string } | null)?.nombre_completo ?? "la persona elegida"
    }.`,
  };
}

/** Aprobacion del plan de auditoria, por quien se le pidio. */
export async function aprobarPlan(auditoriaId: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();

  const supabase = crearClienteServidor();

  const { data: auditoria } = await supabase
    .from("auditorias")
    .select("plan_aprobacion_solicitada_a, plan_fecha_aprobacion")
    .eq("id", auditoriaId)
    .maybeSingle();

  if (!auditoria) return { exito: false, error: "La auditoría no existe o no tiene acceso." };

  const datosAuditoria = auditoria as {
    plan_aprobacion_solicitada_a: string | null;
    plan_fecha_aprobacion: string | null;
  };

  if (datosAuditoria.plan_fecha_aprobacion) {
    return { exito: false, error: "El plan ya está aprobado." };
  }

  const esElAprobador = datosAuditoria.plan_aprobacion_solicitada_a === usuario.id;
  if (!esElAprobador && usuario.rol !== "administrador_sgc") {
    return {
      exito: false,
      error: "La aprobación le corresponde a quien se le pidió, o al Administrador SGC.",
    };
  }

  const { error } = await supabase
    .from("auditorias")
    .update({
      plan_aprobado_por: usuario.id,
      plan_fecha_aprobacion: hoyEnAsuncion(),
    })
    .eq("id", auditoriaId);

  if (error) return { exito: false, error: `No se pudo aprobar el plan: ${error.message}` };

  revalidatePath(`/auditorias/${auditoriaId}`);
  return { exito: true, mensaje: "Plan de auditoría aprobado." };
}

/** Alta de una auditoria dentro del programa. */
export async function crearAuditoria(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) {
    return { exito: false, error: "Su rol no permite planificar auditorías." };
  }

  const supabase = crearClienteServidor();

  const objetivo = String(datos.get("objetivo") ?? "").trim();
  const fechaPlanificada = String(datos.get("fecha_planificada") ?? "");

  // TODOS LOS CAMPOS SON OBLIGATORIOS. Lo pidio Direccion el 6 de
  // octubre. La validacion del navegador es comodidad; el control va
  // aca, que es por donde pasa la escritura.
  const alcance = String(datos.get("alcance") ?? "").trim();
  const criterios = String(datos.get("criterios") ?? "").trim();
  const fechaAviso = String(datos.get("fecha_aviso") ?? "");

  if (objetivo.length < 10) {
    return { exito: false, error: "Describa el objetivo con al menos 10 caracteres." };
  }
  if (alcance.length < 5) {
    return { exito: false, error: "Indique el alcance de la auditoría." };
  }
  if (criterios.length < 5) {
    return { exito: false, error: "Indique los criterios contra los que se audita." };
  }
  if (!fechaPlanificada) {
    return { exito: false, error: "La auditoría necesita una fecha planificada." };
  }
  if (!fechaAviso) {
    return { exito: false, error: "Indique qué día se avisa a la empresa." };
  }

  const { data: codigo, error: errorCodigo } = await supabase.rpc(
    "siguiente_codigo_auditoria",
    { p_empresa_id: usuario.empresa_id },
  );

  if (errorCodigo || !codigo) {
    return { exito: false, error: "No se pudo generar el código de la auditoría." };
  }

  const auditorLiderId = String(datos.get("auditor_lider_id") ?? "") || usuario.id;

  // EL PROGRAMA SE RESUELVE SOLO POR EL AÑO DE LA FECHA PLANIFICADA.
  //
  // Calidad saco el programa del formulario de alta porque se completaba
  // siempre igual, y el campo quedo leyendose de un `programa_id` que
  // nadie enviaba: todas las auditorias quedaban sueltas y el programa
  // anual era una carpeta vacia. Si el formulario lo manda —el alta
  // desde la ficha del programa lo hace— se respeta; si no, se busca el
  // del año que corresponde.
  let programaId = String(datos.get("programa_id") ?? "") || null;
  if (!programaId) {
    const { data: delAnio } = await supabase
      .from("programas_auditoria")
      .select("id")
      .eq("anio", Number(fechaPlanificada.slice(0, 4)))
      .maybeSingle();

    programaId = (delAnio as { id: string } | null)?.id ?? null;
  }

  // Una auditoria abarca documentos de la informacion documentada.
  // Llegan como varias casillas con el mismo nombre. «Procesos
  // auditados» salio del alta el 6 de octubre: Calidad definio que son
  // lo mismo y que el alcance se declara por documento.
  const documentos = datos
    .getAll("documentos")
    .map((valor) => String(valor))
    .filter((valor) => valor.length > 0);

  const { data: auditoria, error } = await supabase
    .from("auditorias")
    .insert({
      empresa_id: usuario.empresa_id,
      programa_id: programaId,
      codigo,
      tipo: String(datos.get("tipo") ?? "por_proceso"),
      proceso_id: null,
      norma_id: String(datos.get("norma_id") ?? "") || null,
      sede_id: String(datos.get("sede_id") ?? "") || null,
      auditor_lider_id: auditorLiderId,
      objetivo,
      alcance,
      criterios,
      fecha_planificada: fechaPlanificada,
      // El aviso a toda la empresa: el trabajo programado lo manda ese
      // dia y marca `aviso_enviado`.
      fecha_aviso: fechaAviso,
      estado: "planificada",
    })
    .select("id, codigo")
    .single();

  if (error) return { exito: false, error: `No se pudo crear la auditoría: ${error.message}` };

  // Los documentos que abarca. Si falla, la auditoria igual quedo
  // creada: se corrige desde la ficha y no se pierde el alta.
  if (documentos.length > 0) {
    await supabase
      .from("auditoria_documentos")
      .insert(
        documentos.map((documentoId) => ({
          auditoria_id: auditoria.id,
          documento_id: documentoId,
        })),
      );
  }

  // El auditor forma parte del equipo desde el inicio.
  await supabase.from("auditoria_equipo").insert({
    auditoria_id: auditoria.id,
    usuario_id: auditorLiderId,
    rol_equipo: "auditor líder",
  });

  if (auditorLiderId !== usuario.id) {
    const { data: lider } = await supabase
      .from("usuarios")
      .select("id, correo")
      .eq("id", auditorLiderId)
      .maybeSingle();

    if (lider) {
      await notificar(supabase, {
        deParteDe: departe(usuario),
        usuarioId: lider.id,
        correoDestino: lider.correo,
        tipo: "auditoria_programada",
        titulo: `Auditoría asignada: ${auditoria.codigo}`,
        mensaje: `Queda a su cargo como auditor. Fecha planificada: ${fechaPlanificada}.`,
        enlace: `/auditorias/${auditoria.id}`,
        entidad: "auditorias",
        entidadId: auditoria.id,
        claveUnicidad: `auditoria-lider:${auditoria.id}`,
      });
    }
  }

  revalidatePath("/auditorias");
  if (programaId) revalidatePath(`/auditorias/programas/${programaId}`);
  return { exito: true, id: auditoria.id, mensaje: `Auditoría ${auditoria.codigo} planificada.` };
}

export async function actualizarAuditoria(
  id: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) {
    return { exito: false, error: "Su rol no permite editar auditorías." };
  }

  const supabase = crearClienteServidor();

  const objetivo = String(datos.get("objetivo") ?? "").trim();
  if (objetivo.length < 10) {
    return { exito: false, error: "Describa el objetivo con al menos 10 caracteres." };
  }

  const fechaPlanificada = String(datos.get("fecha_planificada") ?? "");
  if (!fechaPlanificada) {
    return { exito: false, error: "La auditoría necesita una fecha planificada." };
  }

  // Al mover la fecha a otro año, la auditoría pasa al programa de ese
  // año. Si no hay programa para el año nuevo queda suelta, que es
  // preferible a dejarla contada en un programa que no le corresponde.
  const { data: delAnio } = await supabase
    .from("programas_auditoria")
    .select("id")
    .eq("anio", Number(fechaPlanificada.slice(0, 4)))
    .maybeSingle();

  const { data: antes } = await supabase
    .from("auditorias")
    .select("programa_id")
    .eq("id", id)
    .maybeSingle();

  const procesoElegido = String(datos.get("proceso_id") ?? "");

  const { error } = await supabase
    .from("auditorias")
    .update({
      programa_id: (delAnio as { id: string } | null)?.id ?? null,
      objetivo,
      alcance: String(datos.get("alcance") ?? "").trim() || null,
      criterios: String(datos.get("criterios") ?? "").trim() || null,
      // «Procesos declarados en el Plan» no es un proceso: es una
      // columna propia, y es excluyente con el proceso suelto.
      proceso_id: procesoElegido === SEGUN_EL_PLAN ? null : procesoElegido || null,
      procesos_segun_plan: procesoElegido === SEGUN_EL_PLAN,
      norma_id: String(datos.get("norma_id") ?? "") || null,
      sede_id: String(datos.get("sede_id") ?? "") || null,
      auditor_lider_id: String(datos.get("auditor_lider_id") ?? "") || null,
      fecha_planificada: fechaPlanificada,
      fecha_aviso: String(datos.get("fecha_aviso") ?? "") || null,
    })
    .eq("id", id);

  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };

  revalidatePath("/auditorias");
  revalidatePath(`/auditorias/${id}`);
  for (const programa of [(antes as { programa_id: string | null } | null)?.programa_id,
                          (delAnio as { id: string } | null)?.id]) {
    if (programa) revalidatePath(`/auditorias/programas/${programa}`);
  }

  return { exito: true, mensaje: "Plan de auditoría guardado." };
}

/**
 * Baja de una auditoria.
 *
 * NO SE BORRA UNA AUDITORIA CON HALLAZGOS QUE YA GENERARON UNA NO
 * CONFORMIDAD. La NC es el registro que la auditoría exige para cerrar,
 * y borrar de dónde salió la deja sin origen: la trazabilidad se corta
 * justo donde ISO pide que exista. Primero se resuelve la NC.
 *
 * Los hallazgos sin NC sí se van con ella, y antes sus evidencias: si se
 * borrara la fila y después fallara el borrado de los archivos,
 * quedarían adjuntos apuntando a un hallazgo inexistente que nadie va a
 * encontrar para limpiar.
 */
export async function eliminarAuditoria(id: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) {
    return { exito: false, error: "Su rol no permite eliminar auditorías." };
  }

  const supabase = crearClienteServidor();

  const { data: auditoria } = await supabase
    .from("auditorias")
    .select("codigo, programa_id")
    .eq("id", id)
    .maybeSingle();

  if (!auditoria) {
    return { exito: false, error: "La auditoría no existe o no tiene acceso." };
  }

  const { data: hallazgos } = await supabase
    .from("auditoria_hallazgos")
    .select("id, codigo, no_conformidad_id")
    .eq("auditoria_id", id);

  const lista = (hallazgos as { id: string; codigo: string; no_conformidad_id: string | null }[] | null) ?? [];
  const conNc = lista.filter((hallazgo) => hallazgo.no_conformidad_id);

  if (conNc.length > 0) {
    return {
      exito: false,
      error:
        `No se puede eliminar: ${conNc.length} hallazgo(s) ya generaron una no conformidad ` +
        `(${conNc.map((hallazgo) => hallazgo.codigo).join(", ")}). ` +
        "Borrar la auditoría dejaría esas NC sin origen.",
    };
  }

  for (const hallazgo of lista) {
    await eliminarHallazgo(hallazgo.id, id);
  }

  const { error } = await supabase.from("auditorias").delete().eq("id", id);
  if (error) return { exito: false, error: `No se pudo eliminar la auditoría: ${error.message}` };

  revalidatePath("/auditorias");
  const programa = (auditoria as { programa_id: string | null }).programa_id;
  if (programa) revalidatePath(`/auditorias/programas/${programa}`);

  return {
    exito: true,
    mensaje: `Auditoría ${(auditoria as { codigo: string }).codigo} eliminada.`,
  };
}

/** Edicion del programa anual: el nombre y el objetivo. */
export async function actualizarProgramaAuditoria(
  programaId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) {
    return { exito: false, error: "Su rol no permite editar el programa de auditorías." };
  }

  const nombre = String(datos.get("nombre") ?? "").trim();
  if (nombre.length < 3) {
    return { exito: false, error: "El nombre del programa debe tener al menos 3 caracteres." };
  }

  const supabase = crearClienteServidor();

  // EL AÑO NO SE EDITA. Es lo que ata las auditorías a su programa, y
  // cambiarlo las dejaría a todas en el año equivocado de una sola vez.
  // Un programa de otro año es otro programa.
  const { error } = await supabase
    .from("programas_auditoria")
    .update({
      nombre,
      objetivo: String(datos.get("objetivo") ?? "").trim() || null,
    })
    .eq("id", programaId);

  if (error) return { exito: false, error: `No se pudo guardar el programa: ${error.message}` };

  revalidatePath("/auditorias");
  revalidatePath(`/auditorias/programas/${programaId}`);
  return { exito: true, mensaje: "Programa actualizado." };
}

/**
 * Baja del programa anual.
 *
 * NO SE BORRA UN PROGRAMA CON AUDITORIAS ADENTRO. Quedarían sueltas, sin
 * año y fuera de todo avance, y nadie se enteraría hasta que el reporte
 * del ejercicio apareciera incompleto.
 */
export async function eliminarProgramaAuditoria(programaId: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) {
    return { exito: false, error: "Su rol no permite eliminar el programa de auditorías." };
  }

  const supabase = crearClienteServidor();

  const { count } = await supabase
    .from("auditorias")
    .select("id", { count: "exact", head: true })
    .eq("programa_id", programaId);

  if ((count ?? 0) > 0) {
    return {
      exito: false,
      error:
        `No se puede eliminar: el programa tiene ${count} auditoría(s). ` +
        "Elimínelas o muévalas de año antes.",
    };
  }

  const { error } = await supabase
    .from("programas_auditoria")
    .delete()
    .eq("id", programaId);

  if (error) return { exito: false, error: `No se pudo eliminar el programa: ${error.message}` };

  revalidatePath("/auditorias");
  return { exito: true, mensaje: "Programa eliminado." };
}

/**
 * Avance del ciclo: planificada -> en ejecucion -> informe pendiente ->
 * cerrada. Las fechas de inicio y fin se registran solas.
 */
export async function cambiarEstadoAuditoria(
  id: string,
  estado: EstadoAuditoria,
  conclusiones?: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) {
    return { exito: false, error: "Su rol no permite cambiar el estado de la auditoría." };
  }

  const supabase = crearClienteServidor();
  const hoy = hoyEnAsuncion();
  const cambios: Record<string, unknown> = { estado };

  if (estado === "en_ejecucion") cambios.fecha_inicio = hoy;
  if (estado === "informe_pendiente") cambios.fecha_fin = hoy;

  if (estado === "cerrada") {
    // No se cierra una auditoría cuyos hallazgos de no conformidad
    // todavía no derivaron en la NC correspondiente: es el mecanismo que
    // conecta la auditoría con el tratamiento de la desviación.
    const { data: hallazgos } = await supabase
      .from("auditoria_hallazgos")
      .select("codigo, tipo, no_conformidad_id")
      .eq("auditoria_id", id);

    const sinTratar = (hallazgos ?? []).filter(
      (hallazgo: { tipo: TipoHallazgo; no_conformidad_id: string | null }) =>
        hallazgo.tipo.startsWith("no_conformidad") && !hallazgo.no_conformidad_id,
    );

    if (sinTratar.length > 0) {
      const codigos = sinTratar
        .map((hallazgo: { codigo: string | null }) => hallazgo.codigo ?? "sin código")
        .join(", ");
      return {
        exito: false,
        error:
          `No se puede cerrar: ${sinTratar.length} hallazgo${sinTratar.length === 1 ? "" : "s"} ` +
          `de no conformidad sin su NC generada (${codigos}).`,
      };
    }

    if (!conclusiones?.trim()) {
      return { exito: false, error: "Para cerrar la auditoría debe registrar las conclusiones." };
    }

    cambios.conclusiones = conclusiones.trim();
    if (!cambios.fecha_fin) cambios.fecha_fin = hoy;
  }

  const { error } = await supabase.from("auditorias").update(cambios).eq("id", id);

  if (error) return { exito: false, error: `No se pudo cambiar el estado: ${error.message}` };

  revalidatePath(`/auditorias/${id}`);
  revalidatePath("/auditorias");
  return { exito: true, mensaje: "Estado de la auditoría actualizado." };
}

/** Define el equipo auditor y avisa a quienes se incorporan. */
export async function definirEquipo(
  auditoriaId: string,
  integrantes: string[],
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) {
    return { exito: false, error: "Su rol no permite definir el equipo auditor." };
  }

  const supabase = crearClienteServidor();

  const { data: auditoria } = await supabase
    .from("auditorias")
    .select("codigo, auditor_lider_id, fecha_planificada")
    .eq("id", auditoriaId)
    .maybeSingle();

  if (!auditoria) return { exito: false, error: "La auditoría no existe." };

  const { data: previos } = await supabase
    .from("auditoria_equipo")
    .select("usuario_id")
    .eq("auditoria_id", auditoriaId);

  const yaEstaban = new Set(
    (previos ?? []).map((fila: { usuario_id: string }) => fila.usuario_id),
  );

  // El auditor líder siempre integra el equipo.
  const finales = Array.from(new Set([...integrantes, auditoria.auditor_lider_id].filter(Boolean)));

  await supabase.from("auditoria_equipo").delete().eq("auditoria_id", auditoriaId);

  if (finales.length > 0) {
    const { error } = await supabase.from("auditoria_equipo").insert(
      finales.map((id) => ({
        auditoria_id: auditoriaId,
        usuario_id: id,
        rol_equipo: id === auditoria.auditor_lider_id ? "auditor líder" : "auditor",
      })),
    );

    if (error) return { exito: false, error: `No se pudo guardar el equipo: ${error.message}` };
  }

  const nuevos = finales.filter((id) => !yaEstaban.has(id));
  if (nuevos.length > 0) {
    const { data: personas } = await supabase
      .from("usuarios")
      .select("id, correo")
      .in("id", nuevos);

    await notificarAVarios(supabase, (personas ?? []) as { id: string; correo: string }[], {
      deParteDe: departe(usuario),
      tipo: "auditoria_programada",
      titulo: `Integra el equipo de la auditoría ${auditoria.codigo}`,
      mensaje: `Fecha planificada: ${auditoria.fecha_planificada ?? "a definir"}.`,
      enlace: `/auditorias/${auditoriaId}`,
      entidad: "auditorias",
      entidadId: auditoriaId,
      claveUnicidad: `auditoria-equipo:${auditoriaId}`,
    });
  }

  revalidatePath(`/auditorias/${auditoriaId}`);
  return { exito: true, mensaje: "Equipo auditor actualizado." };
}

/** Registro de un hallazgo, con su codigo correlativo dentro de la auditoria. */
export async function crearHallazgo(
  auditoriaId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) {
    return { exito: false, error: "Su rol no permite registrar hallazgos." };
  }

  const supabase = crearClienteServidor();

  const descripcion = String(datos.get("descripcion") ?? "").trim();
  if (descripcion.length < 15) {
    return {
      exito: false,
      error: "Describa el hallazgo con al menos 15 caracteres: es la evidencia del informe.",
    };
  }

  const { data: codigo } = await supabase.rpc("siguiente_codigo_hallazgo", {
    p_auditoria_id: auditoriaId,
  });

  const { data: hallazgo, error } = await supabase
    .from("auditoria_hallazgos")
    .insert({
      auditoria_id: auditoriaId,
      codigo: codigo ?? null,
      tipo: String(datos.get("tipo") ?? "no_conformidad_menor"),
      descripcion,
      evidencia: String(datos.get("evidencia") ?? "").trim() || null,
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      registrado_por: usuario.id,
    })
    .select("id")
    .single();

  if (error) return { exito: false, error: `No se pudo registrar el hallazgo: ${error.message}` };

  // Las evidencias adjuntas. Si alguna falla, el hallazgo igual quedo
  // registrado: el mensaje lo dice y se vuelve a intentar, que es mejor
  // que perder la descripcion recien escrita.
  const archivos = datos
    .getAll("evidencias")
    .filter((archivo): archivo is File => archivo instanceof File && archivo.size > 0);

  const fallidos: string[] = [];

  for (const archivo of archivos) {
    const motivo = motivoDeRechazoEvidencia(archivo.name, archivo.size);
    if (motivo) {
      fallidos.push(`${archivo.name}: ${motivo}`);
      continue;
    }

    const ruta = rutaDeEvidencia(hallazgo.id, archivo.name);

    const { error: errorCarga } = await supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .upload(ruta, archivo, { contentType: archivo.type || undefined, upsert: false });

    if (errorCarga) {
      fallidos.push(`${archivo.name}: ${errorCarga.message}`);
      continue;
    }

    const { error: errorRegistro } = await supabase.from("adjuntos").insert({
      empresa_id: usuario.empresa_id,
      entidad: "auditoria_hallazgos",
      entidad_id: hallazgo.id,
      nombre_archivo: nombreDeArchivoLegible(archivo.name),
      ruta,
      bucket: BUCKET_DOCUMENTOS,
      tamano_bytes: archivo.size,
      tipo_mime: archivo.type || null,
      subido_por: usuario.id,
    });

    if (errorRegistro) {
      // El archivo ya esta arriba: si no se pudo registrar, se retira
      // para no dejar un huerfano que nadie sabe de quien es.
      await supabase.storage.from(BUCKET_DOCUMENTOS).remove([ruta]);
      fallidos.push(`${archivo.name}: ${errorRegistro.message}`);
    }
  }

  revalidatePath(`/auditorias/${auditoriaId}`);

  if (fallidos.length > 0) {
    return {
      exito: true,
      mensaje:
        `Hallazgo ${codigo ?? ""} registrado, pero no se pudieron adjuntar: ` +
        `${fallidos.join("; ")}.`,
    };
  }

  return { exito: true, mensaje: `Hallazgo ${codigo ?? ""} registrado.` };
}

/**
 * Edicion de un hallazgo ya registrado.
 *
 * EL TIPO NO SE CAMBIA DESPUES DE GENERADA LA NO CONFORMIDAD. La NC
 * nacio con la severidad que dice el tipo del hallazgo; moverlo despues
 * dejaria a las dos diciendo cosas distintas sobre el mismo hecho. El
 * texto si se corrige: una redaccion mejor del hallazgo no contradice
 * nada.
 */
export async function actualizarHallazgo(
  hallazgoId: string,
  auditoriaId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) {
    return { exito: false, error: "Su rol no permite editar hallazgos." };
  }

  const descripcion = String(datos.get("descripcion") ?? "").trim();
  if (descripcion.length < 15) {
    return {
      exito: false,
      error: "Describa el hallazgo con al menos 15 caracteres: es la evidencia del informe.",
    };
  }

  const supabase = crearClienteServidor();

  const { data: actual } = await supabase
    .from("auditoria_hallazgos")
    .select("no_conformidad_id, tipo")
    .eq("id", hallazgoId)
    .maybeSingle();

  if (!actual) return { exito: false, error: "El hallazgo no existe o no tiene acceso." };

  const yaTieneNc = Boolean((actual as { no_conformidad_id: string | null }).no_conformidad_id);
  const tipoPedido = String(datos.get("tipo") ?? "");
  const tipoActual = (actual as { tipo: string }).tipo;

  if (yaTieneNc && tipoPedido && tipoPedido !== tipoActual) {
    return {
      exito: false,
      error:
        "El hallazgo ya generó una no conformidad: no se puede cambiar su tipo. " +
        "El texto y la evidencia sí se pueden corregir.",
    };
  }

  const { error } = await supabase
    .from("auditoria_hallazgos")
    .update({
      tipo: yaTieneNc ? tipoActual : tipoPedido || tipoActual,
      descripcion,
      evidencia: String(datos.get("evidencia") ?? "").trim() || null,
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
    })
    .eq("id", hallazgoId);

  if (error) return { exito: false, error: `No se pudo guardar el hallazgo: ${error.message}` };

  revalidatePath(`/auditorias/${auditoriaId}`);
  return { exito: true, mensaje: "Hallazgo actualizado." };
}

export async function eliminarHallazgo(
  hallazgoId: string,
  auditoriaId: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) {
    return { exito: false, error: "Su rol no permite eliminar hallazgos." };
  }

  const supabase = crearClienteServidor();

  const { data: hallazgo } = await supabase
    .from("auditoria_hallazgos")
    .select("no_conformidad_id")
    .eq("id", hallazgoId)
    .maybeSingle();

  if (hallazgo?.no_conformidad_id) {
    return {
      exito: false,
      error:
        "El hallazgo ya generó una no conformidad y no se puede eliminar. " +
        "Si corresponde, anule la no conformidad desde su ficha.",
    };
  }

  // LAS EVIDENCIAS PRIMERO. `adjuntos` es una tabla generica —`entidad`
  // mas `entidad_id`—, asi que no hay clave foranea que las arrastre:
  // borrando solo la fila del hallazgo quedaban los registros apuntando
  // a un hallazgo inexistente y los archivos ocupando el bucket, sin
  // ninguna pantalla desde donde encontrarlos para limpiarlos.
  const { data: evidencias } = await supabase
    .from("adjuntos")
    .select("id")
    .eq("entidad", "auditoria_hallazgos")
    .eq("entidad_id", hallazgoId);

  for (const evidencia of (evidencias as { id: string }[] | null) ?? []) {
    await quitarAdjunto(supabase, evidencia.id, "auditoria_hallazgos", hallazgoId);
  }

  const { error } = await supabase.from("auditoria_hallazgos").delete().eq("id", hallazgoId);
  if (error) return { exito: false, error: `No se pudo eliminar: ${error.message}` };

  revalidatePath(`/auditorias/${auditoriaId}`);
  return { exito: true, mensaje: "Hallazgo eliminado." };
}

/**
 * Genera la no conformidad correspondiente a un hallazgo.
 *
 * La operacion la resuelve la funcion generar_no_conformidad_desde_hallazgo
 * en la base de datos, de modo que el correlativo y el vinculo queden
 * consistentes aunque falle algo en el medio.
 */
export async function generarNoConformidad(
  hallazgoId: string,
  auditoriaId: string,
  responsableId: string | null,
  fechaLimite: string | null,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) {
    return { exito: false, error: "Su rol no permite generar no conformidades." };
  }

  const supabase = crearClienteServidor();

  const { data: ncId, error } = await supabase.rpc("generar_no_conformidad_desde_hallazgo", {
    p_hallazgo_id: hallazgoId,
    p_responsable_id: responsableId,
    p_fecha_limite: fechaLimite || sumarDias(hoyEnAsuncion(), DIAS_LIMITE_CIERRE_NC),
  });

  if (error) return { exito: false, error: error.message };

  const { data: noConformidad } = await supabase
    .from("no_conformidades")
    .select("codigo, titulo")
    .eq("id", ncId as string)
    .maybeSingle();

  if (responsableId) {
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
        titulo: `No conformidad asignada: ${noConformidad?.codigo ?? ""}`,
        mensaje:
          `Se generó desde un hallazgo de auditoría y queda a su cargo. ` +
          `Corresponde analizar la causa raíz y definir el plan de acción.`,
        enlace: `/no-conformidades/${ncId}`,
        entidad: "no_conformidades",
        entidadId: ncId as string,
        claveUnicidad: `nc-desde-hallazgo:${hallazgoId}`,
      });
    }
  }

  revalidatePath(`/auditorias/${auditoriaId}`);
  revalidatePath("/no-conformidades");

  return {
    exito: true,
    id: ncId as string,
    mensaje: `${noConformidad?.codigo ?? "No conformidad"} generada desde el hallazgo.`,
  };
}

// ---------------------------------------------------------------------
// LOS ARCHIVOS DEL PLAN Y DEL PROGRAMA.
//
// El plan y el programa anual existen en papel antes que en el sistema:
// se redactan, se firman y se archivan. Sin donde ponerlos, el PDF
// firmado queda en el Drive de quien lo armo y la auditoria de
// certificacion pide justamente ese archivo.
//
// Se guardan en la tabla `adjuntos`, que ya es generica —`entidad` +
// `entidad_id`— y ya tiene su RLS y su tope de 20 MB, y se entregan por
// la ruta /adjuntos/[id], que firma el enlace en el momento del clic. No
// hizo falta tocar el esquema.
//
// SOLO PDF. Lo pidio Direccion el 8 de octubre: es un documento firmado
// que se entrega como esta, no un archivo que se sigue editando.
// ---------------------------------------------------------------------

/** Rechaza lo que no sea PDF, con el motivo listo para mostrar. */
function noEsPdf(archivo: File): string | null {
  return archivo.name.toLowerCase().endsWith(".pdf")
    ? null
    : `${archivo.name}: solo se admiten archivos PDF.`;
}

async function adjuntarPdf(
  entidad: "auditorias" | "programas_auditoria",
  entidadId: string,
  carpeta: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) {
    return { exito: false, error: "Su rol no permite adjuntar archivos de auditoría." };
  }

  const archivos = archivosDelFormulario(datos, "archivos");
  if (archivos.length === 0) return { exito: false, error: "Elija al menos un archivo." };

  const rechazados = archivos.map(noEsPdf).filter((motivo): motivo is string => motivo !== null);
  if (rechazados.length > 0) {
    return { exito: false, error: rechazados.join("; ") };
  }

  const supabase = crearClienteServidor();

  // Se comprueba que el registro exista y sea visible ANTES de subir
  // nada: sin esto un id equivocado deja archivos en el bucket que no
  // cuelgan de ningun registro.
  const { data: existe } = await supabase
    .from(entidad)
    .select("id")
    .eq("id", entidadId)
    .maybeSingle();

  if (!existe) return { exito: false, error: "El registro no existe o no tiene acceso." };

  const { subidos, fallidos } = await subirAdjuntos(supabase, {
    entidad,
    entidadId,
    carpeta,
    archivos,
    descripcion: String(datos.get("descripcion") ?? ""),
    empresaId: usuario.empresa_id,
    usuarioId: usuario.id,
  });

  revalidatePath("/auditorias");
  revalidatePath(`/auditorias/${entidadId}`);

  if (subidos === 0) return { exito: false, error: `No se pudo adjuntar: ${fallidos.join("; ")}.` };

  if (fallidos.length > 0) {
    return {
      exito: true,
      mensaje: `Se adjuntaron ${subidos} de ${archivos.length}. Faltaron: ${fallidos.join("; ")}.`,
    };
  }

  return {
    exito: true,
    mensaje: subidos === 1 ? "Archivo adjuntado." : `Se adjuntaron ${subidos} archivos.`,
  };
}

/** Sube el PDF del plan de la auditoría. */
export async function adjuntarArchivosAuditoria(
  auditoriaId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  return adjuntarPdf("auditorias", auditoriaId, "auditorias", datos);
}

/** Sube el PDF del programa anual. */
export async function adjuntarArchivosPrograma(
  programaId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  return adjuntarPdf("programas_auditoria", programaId, "programas-auditoria", datos);
}

/** Quita un archivo del plan de la auditoría. */
export async function eliminarAdjuntoAuditoria(
  adjuntoId: string,
  auditoriaId: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) {
    return { exito: false, error: "Su rol no permite quitar archivos de auditoría." };
  }

  const supabase = crearClienteServidor();
  const resultado = await quitarAdjunto(supabase, adjuntoId, "auditorias", auditoriaId);
  if (!resultado.ok) return { exito: false, error: resultado.error };

  revalidatePath(`/auditorias/${auditoriaId}`);
  return { exito: true, mensaje: `«${resultado.nombre}» eliminado.` };
}

/** Quita un archivo del programa anual. */
export async function eliminarAdjuntoPrograma(
  adjuntoId: string,
  programaId: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionarAuditorias(usuario)) {
    return { exito: false, error: "Su rol no permite quitar archivos de auditoría." };
  }

  const supabase = crearClienteServidor();
  const resultado = await quitarAdjunto(supabase, adjuntoId, "programas_auditoria", programaId);
  if (!resultado.ok) return { exito: false, error: resultado.error };

  revalidatePath("/auditorias");
  return { exito: true, mensaje: `«${resultado.nombre}» eliminado.` };
}
