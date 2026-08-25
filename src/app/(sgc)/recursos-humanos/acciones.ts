"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { esAdministrador, puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { notificar } from "@/lib/notificaciones";
import { hoyEnAsuncion } from "@/lib/formato";
import type { ResultadoAccion, ResultadoEficacia } from "@/lib/tipos";

// ---------------------------------------------------------------------
// Puestos
// ---------------------------------------------------------------------

export async function crearPuesto(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!esAdministrador(usuario)) {
    return { exito: false, error: "Solo el Administrador SGC puede definir puestos." };
  }

  const supabase = crearClienteServidor();

  const codigo = String(datos.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(datos.get("nombre") ?? "").trim();

  if (!codigo) return { exito: false, error: "Indique el código del puesto." };
  if (nombre.length < 3) {
    return { exito: false, error: "El nombre del puesto debe tener al menos 3 caracteres." };
  }

  const { error } = await supabase.from("puestos").insert({
    empresa_id: usuario.empresa_id,
    codigo,
    nombre,
    area: String(datos.get("area") ?? "").trim() || null,
    proceso_id: String(datos.get("proceso_id") ?? "") || null,
    mision: String(datos.get("mision") ?? "").trim() || null,
    activo: true,
  });

  if (error) {
    if (error.code === "23505") {
      return { exito: false, error: `Ya existe un puesto con el código ${codigo}.` };
    }
    return { exito: false, error: `No se pudo crear el puesto: ${error.message}` };
  }

  revalidatePath("/recursos-humanos");
  return { exito: true, mensaje: `Puesto ${codigo} creado.` };
}

// ---------------------------------------------------------------------
// Competencias y matriz
// ---------------------------------------------------------------------

export async function crearCompetencia(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!esAdministrador(usuario)) {
    return { exito: false, error: "Solo el Administrador SGC puede definir competencias." };
  }

  const supabase = crearClienteServidor();

  const codigo = String(datos.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(datos.get("nombre") ?? "").trim();

  if (!codigo) return { exito: false, error: "Indique el código de la competencia." };
  if (nombre.length < 3) {
    return { exito: false, error: "El nombre debe tener al menos 3 caracteres." };
  }

  const { error } = await supabase.from("competencias").insert({
    empresa_id: usuario.empresa_id,
    codigo,
    nombre,
    descripcion: String(datos.get("descripcion") ?? "").trim() || null,
    tipo: String(datos.get("tipo") ?? "tecnica"),
  });

  if (error) {
    if (error.code === "23505") {
      return { exito: false, error: `Ya existe una competencia con el código ${codigo}.` };
    }
    return { exito: false, error: `No se pudo crear la competencia: ${error.message}` };
  }

  revalidatePath("/recursos-humanos");
  return { exito: true, mensaje: `Competencia ${codigo} creada.` };
}

/**
 * Define el nivel requerido de una competencia para un puesto. Es la
 * celda de la matriz: nivel 0 significa que el puesto no la necesita y se
 * elimina la exigencia.
 */
export async function definirRequisito(
  puestoId: string,
  competenciaId: string,
  nivelRequerido: number,
  critica: boolean,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!esAdministrador(usuario)) {
    return { exito: false, error: "Solo el Administrador SGC puede editar la matriz." };
  }

  const supabase = crearClienteServidor();

  if (nivelRequerido === 0) {
    const { error } = await supabase
      .from("puesto_competencias")
      .delete()
      .eq("puesto_id", puestoId)
      .eq("competencia_id", competenciaId);

    if (error) return { exito: false, error: `No se pudo quitar la exigencia: ${error.message}` };

    revalidatePath("/recursos-humanos");
    return { exito: true, mensaje: "Competencia quitada del puesto." };
  }

  if (!Number.isInteger(nivelRequerido) || nivelRequerido < 1 || nivelRequerido > 5) {
    return { exito: false, error: "El nivel requerido debe estar entre 1 y 5." };
  }

  const { error } = await supabase.from("puesto_competencias").upsert(
    {
      puesto_id: puestoId,
      competencia_id: competenciaId,
      nivel_requerido: nivelRequerido,
      critica,
    },
    { onConflict: "puesto_id,competencia_id" },
  );

  if (error) return { exito: false, error: `No se pudo guardar la matriz: ${error.message}` };

  revalidatePath("/recursos-humanos");
  return { exito: true, mensaje: "Matriz actualizada." };
}

/**
 * Evalua a una persona en una competencia. El nivel requerido se toma de
 * la matriz de su puesto, y la brecha la calcula la base de datos.
 */
export async function evaluarCompetencia(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const usuarioId = String(datos.get("usuario_id") ?? "");
  const competenciaId = String(datos.get("competencia_id") ?? "");
  const nivelActual = Number(datos.get("nivel_actual"));

  if (!usuarioId || !competenciaId) {
    return { exito: false, error: "Indique la persona y la competencia a evaluar." };
  }
  if (!Number.isInteger(nivelActual) || nivelActual < 0 || nivelActual > 5) {
    return { exito: false, error: "El nivel alcanzado debe estar entre 0 y 5." };
  }

  // El nivel exigido sale de la matriz del puesto de la persona.
  const { data: persona } = await supabase
    .from("usuarios")
    .select("id, nombre_completo, correo, puesto_id, superior_id")
    .eq("id", usuarioId)
    .maybeSingle();

  if (!persona) return { exito: false, error: "La persona no existe." };

  if (!esAdministrador(usuario) && persona.superior_id !== usuario.id) {
    return {
      exito: false,
      error: "Solo el jefe inmediato de esa persona o Calidad pueden evaluarla.",
    };
  }

  let nivelRequerido = Number(datos.get("nivel_requerido") ?? 0);

  if (!nivelRequerido && persona.puesto_id) {
    const { data: requisito } = await supabase
      .from("puesto_competencias")
      .select("nivel_requerido")
      .eq("puesto_id", persona.puesto_id)
      .eq("competencia_id", competenciaId)
      .maybeSingle();

    nivelRequerido = requisito?.nivel_requerido ?? 0;
  }

  if (!nivelRequerido) {
    return {
      exito: false,
      error:
        "Esa competencia no está exigida en el puesto de la persona. " +
        "Agréguela primero a la matriz o indique el nivel requerido.",
    };
  }

  const { error } = await supabase.from("evaluaciones_competencia").insert({
    usuario_id: usuarioId,
    competencia_id: competenciaId,
    nivel_actual: nivelActual,
    nivel_requerido: nivelRequerido,
    fecha: String(datos.get("fecha") ?? hoyEnAsuncion()),
    evaluado_por: usuario.id,
    observacion: String(datos.get("observacion") ?? "").trim() || null,
  });

  if (error) return { exito: false, error: `No se pudo registrar la evaluación: ${error.message}` };

  revalidatePath("/recursos-humanos");
  const brecha = nivelRequerido - nivelActual;

  return {
    exito: true,
    mensaje:
      brecha > 0
        ? `Evaluación registrada. Brecha de ${brecha} nivel${brecha === 1 ? "" : "es"}: corresponde plan de capacitación.`
        : "Evaluación registrada. Sin brecha.",
  };
}

// ---------------------------------------------------------------------
// Capacitaciones
// ---------------------------------------------------------------------

export async function crearCapacitacion(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite planificar capacitaciones." };
  }

  const supabase = crearClienteServidor();

  const codigo = String(datos.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(datos.get("nombre") ?? "").trim();

  if (!codigo) return { exito: false, error: "Indique el código de la capacitación." };
  if (nombre.length < 5) {
    return { exito: false, error: "El nombre debe tener al menos 5 caracteres." };
  }

  const costoCrudo = String(datos.get("costo_gs") ?? "").replace(/[^0-9]/g, "");

  const { data: capacitacion, error } = await supabase
    .from("capacitaciones")
    .insert({
      empresa_id: usuario.empresa_id,
      codigo,
      nombre,
      descripcion: String(datos.get("descripcion") ?? "").trim() || null,
      tipo: String(datos.get("tipo") ?? "interna"),
      proveedor_nombre: String(datos.get("proveedor_nombre") ?? "").trim() || null,
      instructor: String(datos.get("instructor") ?? "").trim() || null,
      fecha_inicio: String(datos.get("fecha_inicio") ?? "") || null,
      fecha_fin: String(datos.get("fecha_fin") ?? "") || null,
      horas: datos.get("horas") ? Number(datos.get("horas")) : null,
      costo_gs: costoCrudo ? Number(costoCrudo) : 0,
      estado: "planificada",
      competencia_id: String(datos.get("competencia_id") ?? "") || null,
    })
    .select("id, codigo")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { exito: false, error: `Ya existe una capacitación con el código ${codigo}.` };
    }
    return { exito: false, error: `No se pudo crear la capacitación: ${error.message}` };
  }

  revalidatePath("/recursos-humanos");
  return {
    exito: true,
    id: capacitacion.id,
    mensaje: `Capacitación ${capacitacion.codigo} planificada.`,
  };
}

export async function cambiarEstadoCapacitacion(
  id: string,
  estado: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite cambiar el estado." };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase.from("capacitaciones").update({ estado }).eq("id", id);
  if (error) return { exito: false, error: `No se pudo cambiar el estado: ${error.message}` };

  revalidatePath(`/recursos-humanos/capacitaciones/${id}`);
  revalidatePath("/recursos-humanos");
  return { exito: true, mensaje: "Estado actualizado." };
}

/** Inscribe participantes y les avisa. */
export async function inscribirParticipantes(
  capacitacionId: string,
  usuarios: string[],
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite inscribir participantes." };
  }

  const supabase = crearClienteServidor();

  const { data: previos } = await supabase
    .from("capacitacion_participantes")
    .select("usuario_id")
    .eq("capacitacion_id", capacitacionId);

  const yaEstaban = new Set(
    (previos ?? []).map((fila: { usuario_id: string }) => fila.usuario_id),
  );
  const nuevos = usuarios.filter((id) => !yaEstaban.has(id));

  if (nuevos.length > 0) {
    const { error } = await supabase.from("capacitacion_participantes").insert(
      nuevos.map((id) => ({
        capacitacion_id: capacitacionId,
        usuario_id: id,
        asistio: false,
        eficacia: "pendiente",
      })),
    );

    if (error) {
      return { exito: false, error: `No se pudieron inscribir: ${error.message}` };
    }

    const { data: capacitacion } = await supabase
      .from("capacitaciones")
      .select("codigo, nombre, fecha_inicio")
      .eq("id", capacitacionId)
      .maybeSingle();

    const { data: personas } = await supabase
      .from("usuarios")
      .select("id, correo")
      .in("id", nuevos);

    for (const persona of personas ?? []) {
      await notificar(supabase, {
        usuarioId: persona.id,
        correoDestino: persona.correo,
        tipo: "general",
        titulo: `Capacitación asignada: ${capacitacion?.codigo ?? ""}`,
        mensaje:
          `Queda inscripto en "${capacitacion?.nombre ?? ""}"` +
          (capacitacion?.fecha_inicio ? `, prevista para el ${capacitacion.fecha_inicio}.` : "."),
        enlace: `/recursos-humanos/capacitaciones/${capacitacionId}`,
        entidad: "capacitaciones",
        entidadId: capacitacionId,
        claveUnicidad: `capacitacion:${capacitacionId}:${persona.id}`,
      });
    }
  }

  // Quienes ya no figuran quedan fuera.
  const aQuitar = Array.from(yaEstaban).filter((id) => !usuarios.includes(id));
  if (aQuitar.length > 0) {
    await supabase
      .from("capacitacion_participantes")
      .delete()
      .eq("capacitacion_id", capacitacionId)
      .in("usuario_id", aQuitar);
  }

  revalidatePath(`/recursos-humanos/capacitaciones/${capacitacionId}`);
  return { exito: true, mensaje: "Participantes actualizados." };
}

export async function registrarAsistencia(
  participanteId: string,
  capacitacionId: string,
  asistio: boolean,
  calificacion: number | null,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite registrar asistencia." };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("capacitacion_participantes")
    .update({ asistio, calificacion })
    .eq("id", participanteId);

  if (error) return { exito: false, error: `No se pudo registrar: ${error.message}` };

  revalidatePath(`/recursos-humanos/capacitaciones/${capacitacionId}`);
  return { exito: true, mensaje: "Asistencia registrada." };
}

/**
 * Verificacion de la eficacia de la capacitacion sobre una persona.
 * Es el requisito de ISO 9001 7.2: no alcanza con dictar la capacitacion,
 * hay que comprobar que sirvio.
 */
export async function verificarEficacia(
  participanteId: string,
  capacitacionId: string,
  eficacia: ResultadoEficacia,
  observacion: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite verificar la eficacia." };
  }

  if (eficacia !== "pendiente" && observacion.trim().length < 10) {
    return {
      exito: false,
      error: "Indique cómo se verificó la eficacia, con al menos 10 caracteres.",
    };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("capacitacion_participantes")
    .update({
      eficacia,
      fecha_evaluacion_eficacia: eficacia === "pendiente" ? null : hoyEnAsuncion(),
      observacion: observacion.trim() || null,
    })
    .eq("id", participanteId);

  if (error) return { exito: false, error: `No se pudo registrar: ${error.message}` };

  revalidatePath(`/recursos-humanos/capacitaciones/${capacitacionId}`);
  return { exito: true, mensaje: "Eficacia verificada." };
}
