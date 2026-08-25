"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { puedeGestionarAuditorias, requerirUsuario } from "@/lib/sesion";
import { notificar, notificarAVarios } from "@/lib/notificaciones";
import { hoyEnAsuncion, sumarDias } from "@/lib/formato";
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

/** Aprobacion del programa anual por Direccion o Calidad. */
export async function aprobarPrograma(programaId: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (usuario.rol !== "administrador_sgc") {
    return { exito: false, error: "Solo el Administrador SGC puede aprobar el programa." };
  }

  const supabase = crearClienteServidor();

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
  return { exito: true, mensaje: "Programa aprobado y puesto en ejecución." };
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

  if (objetivo.length < 10) {
    return { exito: false, error: "Describa el objetivo con al menos 10 caracteres." };
  }
  if (!fechaPlanificada) {
    return { exito: false, error: "La auditoría necesita una fecha planificada." };
  }

  const { data: codigo, error: errorCodigo } = await supabase.rpc(
    "siguiente_codigo_auditoria",
    { p_empresa_id: usuario.empresa_id },
  );

  if (errorCodigo || !codigo) {
    return { exito: false, error: "No se pudo generar el código de la auditoría." };
  }

  const auditorLiderId = String(datos.get("auditor_lider_id") ?? "") || usuario.id;

  const { data: auditoria, error } = await supabase
    .from("auditorias")
    .insert({
      empresa_id: usuario.empresa_id,
      programa_id: String(datos.get("programa_id") ?? "") || null,
      codigo,
      tipo: String(datos.get("tipo") ?? "interna"),
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      norma_id: String(datos.get("norma_id") ?? "") || null,
      sede_id: String(datos.get("sede_id") ?? "") || null,
      auditor_lider_id: auditorLiderId,
      objetivo,
      alcance: String(datos.get("alcance") ?? "").trim() || null,
      criterios: String(datos.get("criterios") ?? "").trim() || null,
      fecha_planificada: fechaPlanificada,
      estado: "planificada",
    })
    .select("id, codigo")
    .single();

  if (error) return { exito: false, error: `No se pudo crear la auditoría: ${error.message}` };

  // El auditor líder forma parte del equipo desde el inicio.
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
        usuarioId: lider.id,
        correoDestino: lider.correo,
        tipo: "auditoria_programada",
        titulo: `Auditoría asignada: ${auditoria.codigo}`,
        mensaje: `Queda a su cargo como auditor líder. Fecha planificada: ${fechaPlanificada}.`,
        enlace: `/auditorias/${auditoria.id}`,
        entidad: "auditorias",
        entidadId: auditoria.id,
        claveUnicidad: `auditoria-lider:${auditoria.id}`,
      });
    }
  }

  revalidatePath("/auditorias");
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

  const { error } = await supabase
    .from("auditorias")
    .update({
      objetivo: String(datos.get("objetivo") ?? "").trim(),
      alcance: String(datos.get("alcance") ?? "").trim() || null,
      criterios: String(datos.get("criterios") ?? "").trim() || null,
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      norma_id: String(datos.get("norma_id") ?? "") || null,
      sede_id: String(datos.get("sede_id") ?? "") || null,
      auditor_lider_id: String(datos.get("auditor_lider_id") ?? "") || null,
      fecha_planificada: String(datos.get("fecha_planificada") ?? "") || null,
    })
    .eq("id", id);

  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };

  revalidatePath(`/auditorias/${id}`);
  return { exito: true, mensaje: "Auditoría actualizada." };
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

  const { error } = await supabase.from("auditoria_hallazgos").insert({
    auditoria_id: auditoriaId,
    codigo: codigo ?? null,
    tipo: String(datos.get("tipo") ?? "observacion"),
    requisito: String(datos.get("requisito") ?? "").trim() || null,
    descripcion,
    evidencia: String(datos.get("evidencia") ?? "").trim() || null,
    proceso_id: String(datos.get("proceso_id") ?? "") || null,
    registrado_por: usuario.id,
  });

  if (error) return { exito: false, error: `No se pudo registrar el hallazgo: ${error.message}` };

  revalidatePath(`/auditorias/${auditoriaId}`);
  return { exito: true, mensaje: `Hallazgo ${codigo ?? ""} registrado.` };
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
    p_fecha_limite: fechaLimite || sumarDias(hoyEnAsuncion(), 30),
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
