"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { departe, notificar } from "@/lib/notificaciones";
import { esEstadoDePlan } from "@/lib/objetivos";
import type { ResultadoAccion } from "@/lib/tipos";

/**
 * El plan de accion para el logro de los objetivos, hoja 6.2.2.
 *
 * Los cinco incisos del apartado 6.2.2 de la norma. De los cinco, dos se
 * exigen siempre —que se va a hacer y quien es responsable— y los otros
 * tres se pueden completar despues: la planilla de Calidad tiene filas a
 * medio llenar y esa es justamente la informacion que falta recoger.
 * Exigirlos todos desde el alta obligaria a inventarlos.
 */

/** Devuelve el mensaje del primer problema, o null si esta todo bien. */
function revisarCampos(datos: FormData): string | null {
  if (String(datos.get("que_se_va_a_hacer") ?? "").trim().length < 10) {
    return "Describa qué se va a hacer, con al menos 10 caracteres.";
  }

  const responsableId = String(datos.get("responsable_id") ?? "").trim();
  const responsableTexto = String(datos.get("responsable_declarado") ?? "").trim();
  if (!responsableId && !responsableTexto) {
    return "Indique quién será responsable: elija una persona o escriba el cargo.";
  }

  const estado = String(datos.get("estado") ?? "").trim();
  if (!esEstadoDePlan(estado)) return "Elija un estado de la lista.";

  const avance = Number(datos.get("avance_porcentaje") ?? 0);
  if (!Number.isFinite(avance) || avance < 0 || avance > 100) {
    return "El avance tiene que estar entre 0 y 100.";
  }

  // La base lo exige tambien, en `objetivo_planes_cierre_con_fecha`: una
  // fila que dice que termino sin decir cuando no sirve para auditar.
  const fechaReal = String(datos.get("fecha_real_finalizacion") ?? "").trim();
  if (estado === "cumplido" && !fechaReal) {
    return "Para marcarlo cumplido, cargue la fecha real de finalización.";
  }

  return null;
}

/** Los campos tal como vienen del formulario, listos para escribir. */
function camposDelFormulario(datos: FormData) {
  return {
    objetivo_id: String(datos.get("objetivo_id") ?? "") || null,
    objetivo_declarado: String(datos.get("objetivo_declarado") ?? "").trim() || null,
    que_se_va_a_hacer: String(datos.get("que_se_va_a_hacer") ?? "").trim(),
    recursos_necesarios: String(datos.get("recursos_necesarios") ?? "").trim() || null,
    responsable_id: String(datos.get("responsable_id") ?? "") || null,
    responsable_declarado: String(datos.get("responsable_declarado") ?? "").trim() || null,
    fecha_finalizacion: String(datos.get("fecha_finalizacion") ?? "") || null,
    como_se_evaluan_resultados:
      String(datos.get("como_se_evaluan_resultados") ?? "").trim() || null,
    fecha_real_finalizacion: String(datos.get("fecha_real_finalizacion") ?? "") || null,
    resultado_evaluacion: String(datos.get("resultado_evaluacion") ?? "").trim() || null,
    avance_porcentaje: Number(datos.get("avance_porcentaje") ?? 0),
    estado: String(datos.get("estado") ?? "pendiente"),
    observaciones: String(datos.get("observaciones") ?? "").trim() || null,
  };
}

export async function crearPlanDeObjetivo(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite cargar acciones del plan." };
  }

  const problema = revisarCampos(datos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();
  const campos = camposDelFormulario(datos);

  const { data: creado, error } = await supabase
    .from("objetivo_planes")
    .insert({ ...campos, empresa_id: usuario.empresa_id, creado_por: usuario.id })
    .select("id")
    .single();

  if (error) return { exito: false, error: `No se pudo cargar la acción: ${error.message}` };

  await avisarAlResponsable(supabase, usuario, campos);

  revalidatePath("/indicadores/plan");
  revalidatePath("/indicadores");
  return { exito: true, id: creado.id, mensaje: "Acción del plan cargada." };
}

export async function actualizarPlanDeObjetivo(
  id: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();

  const problema = revisarCampos(datos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();

  // Quien puede guardar lo decide RLS (`objetivo_planes_gestion`): quien
  // gestiona, o el responsable de la accion. El update que no afecta
  // ninguna fila se traduce en un mensaje y no en un exito silencioso.
  const { data: actualizado, error } = await supabase
    .from("objetivo_planes")
    .update(camposDelFormulario(datos))
    .eq("id", id)
    .select("id")
    .maybeSingle();

  if (error) return { exito: false, error: `No se pudo guardar: ${error.message}` };
  if (!actualizado) {
    return {
      exito: false,
      error: "No se pudo guardar: la acción no existe o su rol no puede editarla.",
    };
  }

  revalidatePath("/indicadores/plan");
  revalidatePath("/indicadores");
  return { exito: true, mensaje: "Acción del plan actualizada." };
}

export async function eliminarPlanDeObjetivo(id: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (usuario.rol !== "administrador_sgc") {
    return {
      exito: false,
      error: "Solo el Administrador SGC puede eliminar una acción del plan.",
    };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase.from("objetivo_planes").delete().eq("id", id);
  if (error) return { exito: false, error: `No se pudo eliminar: ${error.message}` };

  revalidatePath("/indicadores/plan");
  revalidatePath("/indicadores");
  return { exito: true, mensaje: "Acción eliminada del plan." };
}

/**
 * Aviso a quien queda a cargo.
 *
 * Solo cuando es otra persona y cuando tiene perfil: la planilla nombra
 * cargos y la mayoria todavia no ingreso, asi que casi siempre no hay a
 * quien avisar. No es un error: es el estado del padron.
 */
async function avisarAlResponsable(
  supabase: ReturnType<typeof crearClienteServidor>,
  usuario: Awaited<ReturnType<typeof requerirUsuario>>,
  campos: ReturnType<typeof camposDelFormulario>,
) {
  if (!campos.responsable_id || campos.responsable_id === usuario.id) return;

  const { data: responsable } = await supabase
    .from("usuarios")
    .select("id, correo")
    .eq("id", campos.responsable_id)
    .maybeSingle();

  if (!responsable) return;

  await notificar(supabase, {
    deParteDe: departe(usuario),
    usuarioId: responsable.id,
    correoDestino: responsable.correo,
    tipo: "general",
    titulo: "Acción del plan de objetivos asignada",
    mensaje: `Tiene a su cargo: "${campos.que_se_va_a_hacer}".`,
    enlace: "/indicadores/plan",
    entidad: "objetivo_planes",
    entidadId: null,
  });
}
