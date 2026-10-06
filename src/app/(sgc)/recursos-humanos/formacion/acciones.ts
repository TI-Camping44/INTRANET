"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { departe, notificar } from "@/lib/notificaciones";
import { archivosDelFormulario, quitarAdjunto, subirAdjuntos } from "@/lib/adjuntos-servidor";
import { exigeMotivo, ESTADOS_FORMACION_VIGENTES, MODALIDADES } from "@/lib/formacion";
import { hoyEnAsuncion } from "@/lib/formato";
import type { EstadoCapacitacion, ResultadoAccion, ResultadoEficacia } from "@/lib/tipos";

/**
 * Formacion y Competencia.
 *
 * Donde Capital Humano planifica las acciones formativas del año y les
 * sigue el rastro. Una accion nace Planificada y se mueve a mano, segun
 * la fecha del calendario, a Ejecutada, No ejecutada o Pospuesta.
 */

/** Devuelve el mensaje del primer problema, o null si esta todo bien. */
function revisarCampos(datos: FormData): string | null {
  if (String(datos.get("nombre") ?? "").trim().length < 5) {
    return "Escriba el nombre de la acción formativa.";
  }

  const modalidad = String(datos.get("modalidad") ?? "").trim();
  if (!(MODALIDADES as string[]).includes(modalidad)) {
    return "Elija la modalidad: presencial, e-learning, mixto u otros.";
  }

  const tipo = String(datos.get("tipo") ?? "").trim();
  if (tipo !== "interna" && tipo !== "externa") {
    return "Indique si la formación es interna o externa.";
  }

  if (!String(datos.get("objetivo") ?? "").trim()) {
    return "Escriba el objetivo de la acción formativa.";
  }

  // EL FORMADOR DEPENDE DEL TIPO. Si es interna es una persona de la
  // casa y se elige de la lista; si es externa no tiene perfil en la
  // intranet y el nombre se escribe.
  if (tipo === "interna" && !String(datos.get("formador_id") ?? "").trim()) {
    return "Elija al formador de la lista de personas.";
  }
  if (tipo === "externa" && !String(datos.get("instructor") ?? "").trim()) {
    return "Escriba el nombre del formador externo.";
  }

  const participantes = datos.getAll("participantes").filter((valor) => String(valor).trim());
  if (participantes.length === 0) {
    return "Elija al menos un participante.";
  }

  const desde = String(datos.get("fecha_inicio") ?? "").trim();
  const hasta = String(datos.get("fecha_fin") ?? "").trim();
  if (!desde) return "Indique desde cuándo se dicta.";
  if (hasta && hasta < desde) return "La formación no puede terminar antes de empezar.";

  const sesiones = Number(datos.get("cantidad_sesiones") ?? 0);
  if (!Number.isInteger(sesiones) || sesiones < 1) {
    return "Indique la cantidad de sesiones, como un número entero mayor a cero.";
  }

  const horas = Number(datos.get("horas_por_sesion") ?? 0);
  if (!Number.isFinite(horas) || horas <= 0 || horas > 24) {
    return "Indique cuántas horas dura cada sesión, entre 0 y 24.";
  }

  return null;
}

function camposDelFormulario(datos: FormData) {
  const tipo = String(datos.get("tipo") ?? "externa");

  return {
    nombre: String(datos.get("nombre") ?? "").trim(),
    objetivo: String(datos.get("objetivo") ?? "").trim() || null,
    modalidad: String(datos.get("modalidad") ?? "").trim(),
    tipo,
    // Uno u otro, nunca los dos: guardar ambos dejaria dos formadores
    // para la misma accion y ninguna forma de saber cual vale.
    formador_id: tipo === "interna" ? String(datos.get("formador_id") ?? "") || null : null,
    instructor: tipo === "externa" ? String(datos.get("instructor") ?? "").trim() || null : null,
    fecha_inicio: String(datos.get("fecha_inicio") ?? "") || null,
    fecha_fin: String(datos.get("fecha_fin") ?? "") || null,
    cantidad_sesiones: Number(datos.get("cantidad_sesiones") ?? 0),
    horas_por_sesion: Number(datos.get("horas_por_sesion") ?? 0),
  };
}

/** Los participantes elegidos, sin repetidos ni vacios. */
function participantesDelFormulario(datos: FormData): string[] {
  return Array.from(
    new Set(
      datos
        .getAll("participantes")
        .map((valor) => String(valor).trim())
        .filter(Boolean),
    ),
  );
}

export async function crearFormacion(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite planificar formaciones." };
  }

  const problema = revisarCampos(datos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();

  const { data: creada, error } = await supabase
    .from("capacitaciones")
    .insert({
      ...camposDelFormulario(datos),
      empresa_id: usuario.empresa_id,
      // Nace planificada, siempre. El estado se mueve despues, a mano.
      estado: "planificada",
      creado_por: usuario.id,
    })
    .select("id, nombre")
    .single();

  if (error) return { exito: false, error: `No se pudo crear la formación: ${error.message}` };

  const participantes = participantesDelFormulario(datos);
  const { error: errorParticipantes } = await supabase.from("capacitacion_participantes").insert(
    participantes.map((usuarioId) => ({
      capacitacion_id: creada.id,
      usuario_id: usuarioId,
      eficacia: "pendiente",
    })),
  );

  if (errorParticipantes) {
    return {
      exito: false,
      error:
        `La formación se creó pero no se pudieron cargar los participantes: ` +
        `${errorParticipantes.message}`,
    };
  }

  // El plan o programa, si ya lo tiene a mano.
  const archivos = archivosDelFormulario(datos, "plan");
  if (archivos.length > 0) {
    await subirAdjuntos(supabase, {
      entidad: "capacitaciones",
      entidadId: creada.id,
      carpeta: "formacion",
      archivos,
      descripcion: "Plan o programa",
      empresaId: usuario.empresa_id,
      usuarioId: usuario.id,
    });
  }

  await avisarALosParticipantes(supabase, usuario, creada, participantes);

  revalidatePath("/recursos-humanos/formacion");
  return { exito: true, id: creada.id, mensaje: `Formación «${creada.nombre}» planificada.` };
}

export async function actualizarFormacion(
  id: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite editar formaciones." };
  }

  const problema = revisarCampos(datos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();

  const { data: actualizada, error } = await supabase
    .from("capacitaciones")
    .update(camposDelFormulario(datos))
    .eq("id", id)
    .select("id, nombre")
    .maybeSingle();

  if (error) return { exito: false, error: `No se pudo guardar: ${error.message}` };
  if (!actualizada) {
    return { exito: false, error: "No se pudo guardar: la formación no existe o no tiene acceso." };
  }

  // Los participantes se reemplazan por los elegidos. Se borran solo los
  // que salieron, no todos: quien sigue conserva su asistencia y su
  // evaluacion de eficacia, que es lo que no se puede perder.
  const elegidos = participantesDelFormulario(datos);
  const { data: actuales } = await supabase
    .from("capacitacion_participantes")
    .select("usuario_id")
    .eq("capacitacion_id", id);

  const yaEstan = new Set(
    ((actuales as { usuario_id: string }[] | null) ?? []).map((fila) => fila.usuario_id),
  );

  const salen = Array.from(yaEstan).filter((usuarioId) => !elegidos.includes(usuarioId));
  const entran = elegidos.filter((usuarioId) => !yaEstan.has(usuarioId));

  if (salen.length > 0) {
    await supabase
      .from("capacitacion_participantes")
      .delete()
      .eq("capacitacion_id", id)
      .in("usuario_id", salen);
  }

  if (entran.length > 0) {
    await supabase.from("capacitacion_participantes").insert(
      entran.map((usuarioId) => ({
        capacitacion_id: id,
        usuario_id: usuarioId,
        eficacia: "pendiente",
      })),
    );
    await avisarALosParticipantes(supabase, usuario, actualizada, entran);
  }

  const archivos = archivosDelFormulario(datos, "plan");
  if (archivos.length > 0) {
    await subirAdjuntos(supabase, {
      entidad: "capacitaciones",
      entidadId: id,
      carpeta: "formacion",
      archivos,
      descripcion: "Plan o programa",
      empresaId: usuario.empresa_id,
      usuarioId: usuario.id,
    });
  }

  revalidatePath("/recursos-humanos/formacion");
  revalidatePath(`/recursos-humanos/formacion/${id}`);
  return { exito: true, mensaje: `Formación «${actualizada.nombre}» actualizada.` };
}

/**
 * Cambio de estado de la accion.
 *
 * Nace planificada y se mueve a mano segun la fecha del calendario.
 * «No ejecutada» y «pospuesta» exigen decir por que: un plan anual con
 * acciones caidas y sin motivo no se puede revisar.
 */
export async function cambiarEstadoFormacion(
  id: string,
  estado: EstadoCapacitacion,
  comentario: string,
  fechaNueva: string | null,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite cambiar el estado de una formación." };
  }

  if (!ESTADOS_FORMACION_VIGENTES.includes(estado)) {
    return { exito: false, error: "Ese estado no está en uso." };
  }

  if (exigeMotivo(estado) && comentario.trim().length < 10) {
    return {
      exito: false,
      error:
        estado === "pospuesta"
          ? "Explique por qué se pospone, con al menos 10 caracteres."
          : "Explique por qué no se ejecutó, con al menos 10 caracteres.",
    };
  }

  if (estado === "pospuesta" && !fechaNueva) {
    return { exito: false, error: "Indique la nueva fecha prevista." };
  }

  const supabase = crearClienteServidor();

  const { data: actualizada, error } = await supabase
    .from("capacitaciones")
    .update({
      estado,
      comentario_estado: exigeMotivo(estado) ? comentario.trim() : null,
      fecha_nueva: exigeMotivo(estado) ? fechaNueva : null,
    })
    .eq("id", id)
    .select("nombre")
    .maybeSingle();

  if (error) return { exito: false, error: `No se pudo cambiar el estado: ${error.message}` };
  if (!actualizada) {
    return { exito: false, error: "No se pudo guardar: la formación no existe o no tiene acceso." };
  }

  revalidatePath("/recursos-humanos/formacion");
  revalidatePath(`/recursos-humanos/formacion/${id}`);
  return { exito: true, mensaje: `«${actualizada.nombre}» quedó como ${estado.replace("_", " ")}.` };
}

export async function eliminarFormacion(id: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite eliminar formaciones." };
  }

  const supabase = crearClienteServidor();

  // Los archivos primero, por lo mismo de siempre: si se borra la fila y
  // despues falla el borrado de los adjuntos, quedan archivos apuntando
  // a una formacion que ya no existe y nadie los va a encontrar.
  const { data: adjuntos } = await supabase
    .from("adjuntos")
    .select("id")
    .eq("entidad", "capacitaciones")
    .eq("entidad_id", id);

  for (const adjunto of (adjuntos as { id: string }[] | null) ?? []) {
    await quitarAdjunto(supabase, adjunto.id, "capacitaciones", id);
  }

  const { error } = await supabase.from("capacitaciones").delete().eq("id", id);
  if (error) return { exito: false, error: `No se pudo eliminar: ${error.message}` };

  revalidatePath("/recursos-humanos/formacion");
  return { exito: true, mensaje: "Formación eliminada." };
}

/** El plan, el registro de participación y los certificados. */
export async function adjuntarArchivoFormacion(
  formacionId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite subir archivos a una formación." };
  }

  const archivos = archivosDelFormulario(datos, "archivo");
  if (archivos.length === 0) return { exito: false, error: "Elija al menos un archivo." };

  const supabase = crearClienteServidor();

  const { data: formacion } = await supabase
    .from("capacitaciones")
    .select("id")
    .eq("id", formacionId)
    .maybeSingle();

  if (!formacion) return { exito: false, error: "La formación no existe o no tiene acceso." };

  const { subidos, fallidos } = await subirAdjuntos(supabase, {
    entidad: "capacitaciones",
    entidadId: formacionId,
    carpeta: "formacion",
    archivos,
    descripcion: String(datos.get("descripcion") ?? "") || null,
    empresaId: usuario.empresa_id,
    usuarioId: usuario.id,
  });

  revalidatePath(`/recursos-humanos/formacion/${formacionId}`);

  if (subidos === 0) return { exito: false, error: `No se pudo subir: ${fallidos.join(" · ")}` };

  return {
    exito: true,
    mensaje:
      fallidos.length > 0
        ? `${subidos} archivo(s) subido(s). No entraron: ${fallidos.join(" · ")}`
        : `${subidos} archivo(s) subido(s).`,
  };
}

export async function eliminarArchivoFormacion(
  adjuntoId: string,
  formacionId: string,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const resultado = await quitarAdjunto(supabase, adjuntoId, "capacitaciones", formacionId);
  if (!resultado.ok) return { exito: false, error: resultado.error };

  revalidatePath(`/recursos-humanos/formacion/${formacionId}`);
  return { exito: true, mensaje: `«${resultado.nombre}» eliminado.` };
}

/** Asistencia de una persona, en la pantalla de ejecución. */
export async function registrarAsistencia(
  participanteId: string,
  formacionId: string,
  asistio: boolean,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite registrar la asistencia." };
  }

  const supabase = crearClienteServidor();

  const { data: actualizado, error } = await supabase
    .from("capacitacion_participantes")
    .update({ asistio })
    .eq("id", participanteId)
    .eq("capacitacion_id", formacionId)
    .select("id")
    .maybeSingle();

  if (error) return { exito: false, error: `No se pudo registrar: ${error.message}` };
  if (!actualizado) return { exito: false, error: "La persona no está en esta formación." };

  revalidatePath(`/recursos-humanos/formacion/${formacionId}`);
  return { exito: true, mensaje: asistio ? "Asistencia registrada." : "Marcado como ausente." };
}

/** Aviso a quienes quedaron como participantes. No bloquea: ver `notificar`. */
async function avisarALosParticipantes(
  supabase: ReturnType<typeof crearClienteServidor>,
  usuario: Awaited<ReturnType<typeof requerirUsuario>>,
  formacion: { id: string; nombre: string },
  participantes: string[],
) {
  const otros = participantes.filter((id) => id !== usuario.id);
  if (otros.length === 0) return;

  const { data: personas } = await supabase
    .from("usuarios")
    .select("id, correo")
    .in("id", otros);

  for (const persona of (personas as { id: string; correo: string }[] | null) ?? []) {
    await notificar(supabase, {
      deParteDe: departe(usuario),
      usuarioId: persona.id,
      correoDestino: persona.correo,
      tipo: "general",
      titulo: "Formación planificada",
      mensaje: `Quedó como participante de «${formacion.nombre}».`,
      enlace: `/recursos-humanos/formacion/${formacion.id}`,
      entidad: "capacitaciones",
      entidadId: formacion.id,
    });
  }
}

/**
 * La Evaluacion de Eficacia de la Formacion, persona por persona.
 *
 * ES POR PERSONA Y NO POR CURSO. Es una regla del proyecto y no una
 * decision de pantalla: un curso donde la mitad aprovecho y la otra
 * mitad no, promediado, no dice nada, y lo que Calidad necesita saber es
 * quien quedo con la brecha abierta.
 *
 * SOLO SE EXIGE EN LAS DE MAS DE DOS HORAS. El corte lo calcula la base,
 * en `capacitaciones.requiere_eficacia`, y se controla acá: dejar
 * evaluar una formacion corta llenaria el registro de evaluaciones que
 * nadie pidio y que despues hay que explicar.
 *
 * Y SOLO SOBRE LO EJECUTADO. Evaluar la eficacia de algo que no se dicto
 * es afirmar sobre lo que no paso.
 */
export async function verificarEficacia(
  participanteId: string,
  formacionId: string,
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

  const { data } = await supabase
    .from("capacitaciones")
    .select("estado, requiere_eficacia")
    .eq("id", formacionId)
    .maybeSingle();

  const formacion = data as { estado: string; requiere_eficacia: boolean } | null;
  if (!formacion) return { exito: false, error: "La formación no existe o no tiene acceso." };

  if (formacion.estado !== "ejecutada") {
    return {
      exito: false,
      error: "Primero registre la ejecución: la eficacia se evalúa sobre lo que se dictó.",
    };
  }

  if (!formacion.requiere_eficacia) {
    return {
      exito: false,
      error:
        "Esta formación no supera las 2 horas, así que no exige Evaluación de Eficacia de la " +
        "Formación.",
    };
  }

  const { data: actualizado, error } = await supabase
    .from("capacitacion_participantes")
    .update({
      eficacia,
      fecha_evaluacion_eficacia: eficacia === "pendiente" ? null : hoyEnAsuncion(),
      observacion: observacion.trim() || null,
    })
    .eq("id", participanteId)
    .eq("capacitacion_id", formacionId)
    .select("id")
    .maybeSingle();

  if (error) return { exito: false, error: `No se pudo registrar: ${error.message}` };
  if (!actualizado) return { exito: false, error: "La persona no está en esta formación." };

  revalidatePath(`/recursos-humanos/formacion/${formacionId}`);
  revalidatePath("/recursos-humanos/formacion");
  return { exito: true, mensaje: "Eficacia verificada." };
}
