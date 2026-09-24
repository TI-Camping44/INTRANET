"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { departe, notificar } from "@/lib/notificaciones";
import { hoyEnAsuncion } from "@/lib/formato";
import { esOrigenDeOportunidadValido, esOrigenValido } from "@/lib/riesgos";
import type { EstadoAccion, EstadoRiesgo, ResultadoAccion } from "@/lib/tipos";

function validarEscala(valor: number): boolean {
  return Number.isInteger(valor) && valor >= 1 && valor <= 5;
}

/**
 * Los campos que Calidad pide completos, con el nombre que ve la persona.
 *
 * Valen para el alta y para la edicion: si se pudiera vaciar un campo al
 * corregir, la obligatoriedad del alta seria decorativa.
 */
const OBLIGATORIOS: { campo: string; nombre: string }[] = [
  { campo: "titulo", nombre: "el título" },
  { campo: "descripcion", nombre: "la descripción" },
  { campo: "proceso_id", nombre: "el proceso afectado" },
  { campo: "responsable_id", nombre: "el responsable" },
  { campo: "causas", nombre: "las causas potenciales" },
  { campo: "consecuencias", nombre: "las consecuencias potenciales" },
  { campo: "controles_existentes", nombre: "los controles existentes" },
  { campo: "tratamiento", nombre: "la opción de tratamiento" },
  { campo: "accion_planificada", nombre: "la acción planificada" },
  { campo: "plazo_accion", nombre: "el plazo de la acción" },
];

/**
 * Los campos que Calidad pide completos en una oportunidad.
 *
 * Los del plan van aparte porque solo se piden cuando se decide
 * abordarla: exigir accion, recursos y plazo para algo que se decidio no
 * abordar seria pedir que se invente un plan que nadie va a ejecutar.
 */
const OBLIGATORIOS_OPORTUNIDAD: { campo: string; nombre: string }[] = [
  { campo: "titulo", nombre: "el título" },
  { campo: "descripcion", nombre: "la descripción" },
  { campo: "efecto_deseado", nombre: "el efecto deseado esperado" },
  { campo: "proceso_id", nombre: "el proceso" },
  { campo: "responsable_id", nombre: "el responsable" },
  { campo: "alineacion_estrategica", nombre: "la alineación con la dirección estratégica" },
  { campo: "fundamento_decision", nombre: "el fundamento de la decisión" },
];

const OBLIGATORIOS_PLAN_OPORTUNIDAD: { campo: string; nombre: string }[] = [
  { campo: "accion_planificada", nombre: "la acción planificada" },
  { campo: "recursos_necesarios", nombre: "los recursos necesarios" },
  { campo: "plazo_accion", nombre: "el plazo" },
];

/** Devuelve el mensaje del primer problema, o null si esta todo bien. */
function revisarCamposDeOportunidad(datos: FormData): string | null {
  if (String(datos.get("titulo") ?? "").trim().length < 5) {
    return "El título debe tener al menos 5 caracteres.";
  }
  if (!esOrigenDeOportunidadValido(String(datos.get("origen") ?? "").trim())) {
    return "Elija un origen de la lista.";
  }

  const pedidos =
    datos.get("se_decide_abordar") === "si"
      ? [...OBLIGATORIOS_OPORTUNIDAD, ...OBLIGATORIOS_PLAN_OPORTUNIDAD]
      : OBLIGATORIOS_OPORTUNIDAD;

  const faltante = pedidos.find(
    (obligatorio) => String(datos.get(obligatorio.campo) ?? "").trim() === "",
  );
  return faltante ? `Falta completar ${faltante.nombre}.` : null;
}

/** Devuelve el mensaje del primer problema, o null si esta todo bien. */
function revisarCamposDeRiesgo(datos: FormData): string | null {
  if (String(datos.get("titulo") ?? "").trim().length < 5) {
    return "El título debe tener al menos 5 caracteres.";
  }
  if (!esOrigenValido(String(datos.get("origen") ?? "").trim())) {
    return "Elija un origen de la lista.";
  }

  const faltante = OBLIGATORIOS.find(
    (obligatorio) => String(datos.get(obligatorio.campo) ?? "").trim() === "",
  );
  return faltante ? `Falta completar ${faltante.nombre}.` : null;
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
  const severidad = Number(datos.get("severidad") ?? 1);
  const origen = String(datos.get("origen") ?? "").trim();

  if (!validarEscala(probabilidad) || !validarEscala(severidad)) {
    return { exito: false, error: "La probabilidad y la severidad deben estar entre 1 y 5." };
  }

  // Calidad pidio la ficha completa: un riesgo a medio cargar no se
  // puede valorar ni revisar despues. El navegador ya lo pide, pero eso
  // es comodidad; el control es este.
  const problema = revisarCamposDeRiesgo(datos);
  if (problema) return { exito: false, error: problema };

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
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      responsable_id: String(datos.get("responsable_id") ?? "") || usuario.id,
      tratamiento: String(datos.get("tratamiento") ?? "") || null,
      causas: String(datos.get("causas") ?? "").trim() || null,
      consecuencias: String(datos.get("consecuencias") ?? "").trim() || null,
      controles_existentes: String(datos.get("controles_existentes") ?? "").trim() || null,
      // Columnas del F-EST-01-03.
      origen,
      asociado_disrupcion: datos.get("asociado_disrupcion") === "si",
      accion_planificada: String(datos.get("accion_planificada") ?? "").trim() || null,
      plazo_accion: String(datos.get("plazo_accion") ?? "") || null,
      proceso_accion_id: String(datos.get("proceso_accion_id") ?? "") || null,
      fundamento_decision: String(datos.get("fundamento_decision") ?? "").trim() || null,
      probabilidad,
      severidad,
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
    severidad,
    comentario: "Evaluación inicial.",
    evaluado_por: usuario.id,
  });

  revalidatePath("/riesgos");
  return { exito: true, id: riesgo.id, mensaje: `Riesgo ${riesgo.codigo} registrado.` };
}

/**
 * Correccion de los datos con los que se registro el riesgo.
 *
 * No toca la valoracion. Cambiar la probabilidad o la severidad es
 * reevaluar, y una reevaluacion lleva fecha, autor y comentario en
 * `riesgo_evaluaciones`: para eso esta `reevaluarRiesgo`. Si se pudiera
 * cambiar el nivel desde acá, se moveria sin dejar rastro de quien lo
 * movio ni por que.
 *
 * Quien puede guardar lo decide RLS. El chequeo de rol que hay acá es
 * para dar un mensaje en vez de un update que afecta cero filas y se
 * ve como exito.
 */
export async function actualizarRiesgo(id: string, datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite editar riesgos." };
  }

  const problema = revisarCamposDeRiesgo(datos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();

  const { data: actualizado, error } = await supabase
    .from("riesgos")
    .update({
      titulo: String(datos.get("titulo") ?? "").trim(),
      descripcion: String(datos.get("descripcion") ?? "").trim() || null,
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      responsable_id: String(datos.get("responsable_id") ?? "") || null,
      tratamiento: String(datos.get("tratamiento") ?? "") || null,
      causas: String(datos.get("causas") ?? "").trim() || null,
      consecuencias: String(datos.get("consecuencias") ?? "").trim() || null,
      controles_existentes: String(datos.get("controles_existentes") ?? "").trim() || null,
      origen: String(datos.get("origen") ?? "").trim() || null,
      asociado_disrupcion: datos.get("asociado_disrupcion") === "si",
      accion_planificada: String(datos.get("accion_planificada") ?? "").trim() || null,
      plazo_accion: String(datos.get("plazo_accion") ?? "") || null,
      proceso_accion_id: String(datos.get("proceso_accion_id") ?? "") || null,
      fundamento_decision: String(datos.get("fundamento_decision") ?? "").trim() || null,
    })
    .eq("id", id)
    .select("codigo")
    .maybeSingle();

  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };
  if (!actualizado) {
    return {
      exito: false,
      error: "No se pudo guardar: el riesgo no existe o su rol no puede editarlo.",
    };
  }

  revalidatePath("/riesgos");
  revalidatePath(`/riesgos/${id}`);
  return { exito: true, mensaje: `${actualizado.codigo} actualizado.` };
}

/**
 * Baja del riesgo.
 *
 * Solo el Administrador SGC. Existe para lo que no deberia haberse
 * cargado —una prueba, un duplicado—: un riesgo real no se borra, se
 * cierra, porque la norma pide conservar el registro con su historial de
 * evaluaciones.
 *
 * Se lleva por delante las evaluaciones y las acciones de tratamiento,
 * que cascadean por su clave foranea. La constancia de la baja queda en
 * la bitacora, que la registra antes de que la fila desaparezca.
 */
export async function eliminarRiesgo(id: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();

  if (usuario.rol !== "administrador_sgc") {
    return {
      exito: false,
      error:
        "Solo el Administrador SGC puede eliminar un riesgo. " +
        "Si el riesgo es real, ciérrelo en vez de borrarlo.",
    };
  }

  const supabase = crearClienteServidor();

  const { data: riesgo } = await supabase
    .from("riesgos")
    .select("codigo, tipo")
    .eq("id", id)
    .maybeSingle();

  if (!riesgo) return { exito: false, error: "El riesgo no existe o no tiene acceso." };

  // Se pide la fila de vuelta para distinguir «se borro» de «RLS no
  // dejo»: un delete que no afecta ninguna fila no devuelve error, y sin
  // esto la pantalla diria que se elimino algo que sigue ahi.
  const { data: borrado, error } = await supabase
    .from("riesgos")
    .delete()
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return { exito: false, error: `No se pudo eliminar: ${error.message}` };
  if (!borrado) {
    return { exito: false, error: "No se pudo eliminar: su rol no tiene permiso para darlo de baja." };
  }

  revalidatePath("/riesgos");
  revalidatePath("/oportunidades");

  return {
    exito: true,
    mensaje: `${riesgo.codigo} eliminado junto con sus evaluaciones y acciones.`,
  };
}

/**
 * Reevaluacion del riesgo. Queda registrada en el historial y el
 * disparador de la base de datos recalcula la fecha de proxima revision
 * segun el nivel resultante.
 */
export async function reevaluarRiesgo(
  id: string,
  probabilidad: number,
  severidad: number,
  comentario: string,
  esResidual: boolean,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  if (!validarEscala(probabilidad) || !validarEscala(severidad)) {
    return { exito: false, error: "La probabilidad y la severidad deben estar entre 1 y 5." };
  }

  const cambios = esResidual
    ? { probabilidad_residual: probabilidad, severidad_residual: severidad }
    : { probabilidad, severidad };

  const { error } = await supabase.from("riesgos").update(cambios).eq("id", id);

  if (error) return { exito: false, error: `No se pudo reevaluar: ${error.message}` };

  await supabase.from("riesgo_evaluaciones").insert({
    riesgo_id: id,
    probabilidad,
    severidad,
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
        deParteDe: departe(usuario),
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


// ---------------------------------------------------------------------
// Oportunidades
// ---------------------------------------------------------------------
// Van aparte de los riesgos porque no se valoran igual. Una oportunidad
// no tiene probabilidad ni severidad: tiene Beneficio por Factibilidad,
// y de ahi sale su indice y su prioridad. Es el apartado 6 del
// instructivo, y es lo que la intranet tenia mal: las metia en la misma
// matriz 5x5.

function validarEscalaOpcional(valor: unknown): number | null {
  const numero = Number(valor);
  if (!Number.isInteger(numero) || numero < 1 || numero > 5) return null;
  return numero;
}

/** Alta de una oportunidad segun el F-EST-01-04. */
export async function crearOportunidad(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite registrar oportunidades." };
  }

  const supabase = crearClienteServidor();

  const titulo = String(datos.get("titulo") ?? "").trim();
  const beneficio = validarEscalaOpcional(datos.get("beneficio"));
  const factibilidad = validarEscalaOpcional(datos.get("factibilidad"));

  if (beneficio === null || factibilidad === null) {
    return {
      exito: false,
      error: "El beneficio y la factibilidad deben estar entre 1 y 5.",
    };
  }

  const problema = revisarCamposDeOportunidad(datos);
  if (problema) return { exito: false, error: problema };

  const { data: codigo, error: errorCodigo } = await supabase.rpc("siguiente_codigo_riesgo", {
    p_empresa_id: usuario.empresa_id,
  });

  if (errorCodigo || !codigo) {
    return { exito: false, error: "No se pudo generar el código de la oportunidad." };
  }

  const { data: oportunidad, error } = await supabase
    .from("riesgos")
    .insert({
      empresa_id: usuario.empresa_id,
      codigo,
      titulo,
      tipo: "oportunidad",
      descripcion: String(datos.get("descripcion") ?? "").trim() || null,
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      responsable_id: String(datos.get("responsable_id") ?? "") || usuario.id,
      origen: String(datos.get("origen") ?? "").trim(),
      efecto_deseado: String(datos.get("efecto_deseado") ?? "").trim() || null,
      beneficio,
      factibilidad,
      alineacion_estrategica: String(datos.get("alineacion_estrategica") ?? "") || null,
      se_decide_abordar: datos.get("se_decide_abordar") === "si",
      fundamento_decision: String(datos.get("fundamento_decision") ?? "").trim() || null,
      accion_planificada: String(datos.get("accion_planificada") ?? "").trim() || null,
      recursos_necesarios: String(datos.get("recursos_necesarios") ?? "").trim() || null,
      plazo_accion: String(datos.get("plazo_accion") ?? "") || null,
      proceso_accion_id: String(datos.get("proceso_accion_id") ?? "") || null,
      estado: "identificado",
      creado_por: usuario.id,
    })
    .select("id, codigo, indice")
    .single();

  if (error) {
    return { exito: false, error: `No se pudo registrar la oportunidad: ${error.message}` };
  }

  revalidatePath("/oportunidades");
  return {
    exito: true,
    id: oportunidad.id,
    mensaje: `Oportunidad ${oportunidad.codigo} registrada, con índice ${oportunidad.indice}.`,
  };
}

/** Edicion de una oportunidad ya cargada. */
/**
 * Correccion de los datos con los que se registro la oportunidad.
 *
 * A diferencia del riesgo, acá SI se corrige la valoracion. El riesgo
 * tiene «Reevaluar» en la ficha, que deja fecha, autor y comentario en
 * `riesgo_evaluaciones`; la oportunidad no tiene ese panel, asi que si no
 * se pudiera cambiar el beneficio o la factibilidad desde acá, un numero
 * mal cargado quedaria para siempre.
 *
 * No toca las columnas de eficacia —`resultado_obtenido`,
 * `fecha_evaluacion_eficacia`, `eficacia_accion`—: no estan en este
 * formulario, y escribirlas desde acá las vaciaria. La eficacia se
 * evalua al cierre, cuando Calidad defina esa pantalla.
 */
export async function actualizarOportunidad(
  id: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite editar oportunidades." };
  }

  const beneficio = validarEscalaOpcional(datos.get("beneficio"));
  const factibilidad = validarEscalaOpcional(datos.get("factibilidad"));

  if (beneficio === null || factibilidad === null) {
    return { exito: false, error: "El beneficio y la factibilidad deben estar entre 1 y 5." };
  }

  const problema = revisarCamposDeOportunidad(datos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();

  const { data: actualizada, error } = await supabase
    .from("riesgos")
    .update({
      titulo: String(datos.get("titulo") ?? "").trim(),
      descripcion: String(datos.get("descripcion") ?? "").trim() || null,
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      responsable_id: String(datos.get("responsable_id") ?? "") || null,
      origen: String(datos.get("origen") ?? "").trim(),
      efecto_deseado: String(datos.get("efecto_deseado") ?? "").trim() || null,
      beneficio,
      factibilidad,
      alineacion_estrategica: String(datos.get("alineacion_estrategica") ?? "") || null,
      se_decide_abordar: datos.get("se_decide_abordar") === "si",
      fundamento_decision: String(datos.get("fundamento_decision") ?? "").trim() || null,
      accion_planificada: String(datos.get("accion_planificada") ?? "").trim() || null,
      recursos_necesarios: String(datos.get("recursos_necesarios") ?? "").trim() || null,
      plazo_accion: String(datos.get("plazo_accion") ?? "") || null,
      proceso_accion_id: String(datos.get("proceso_accion_id") ?? "") || null,
    })
    .eq("id", id)
    .select("codigo")
    .maybeSingle();

  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };
  if (!actualizada) {
    return {
      exito: false,
      error: "No se pudo guardar: la oportunidad no existe o su rol no puede editarla.",
    };
  }

  revalidatePath("/oportunidades");
  revalidatePath(`/riesgos/${id}`);
  return { exito: true, mensaje: `${actualizada.codigo} actualizada.` };
}

/**
 * Guarda la evaluacion de eficacia de la accion de un riesgo.
 *
 * Va aparte del residual porque son dos momentos distintos: el residual
 * se valora cuando la accion ya opero un ciclo completo o tres meses, y
 * la eficacia se concluye a partir de ese residual.
 */
export async function guardarEficaciaRiesgo(
  id: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite registrar la eficacia." };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("riesgos")
    .update({
      fecha_evaluacion_eficacia: String(datos.get("fecha_evaluacion_eficacia") ?? "") || null,
      eficacia_accion: String(datos.get("eficacia_accion") ?? "") || null,
      resultado_obtenido: String(datos.get("resultado_obtenido") ?? "").trim() || null,
    })
    .eq("id", id);

  if (error) return { exito: false, error: `No se pudo guardar la eficacia: ${error.message}` };

  revalidatePath(`/riesgos/${id}`);
  revalidatePath("/riesgos");
  return { exito: true, mensaje: "Evaluación de eficacia registrada." };
}
