"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { departe, notificar } from "@/lib/notificaciones";
import { archivosDelFormulario, quitarAdjunto, subirAdjuntos } from "@/lib/adjuntos-servidor";
import { esEstadoDePlan } from "@/lib/objetivos";
import { hoyEnAsuncion } from "@/lib/formato";

import type { ResultadoAccion } from "@/lib/tipos";

/**
 * El plan de accion para el logro de los objetivos, hoja 6.2.2.
 *
 * TODO OBLIGATORIO MENOS EL PUESTO. Direccion lo pidio el 8 de octubre:
 * los cinco incisos del apartado 6.2.2 se cargan completos. Una accion a
 * medio llenar no se puede seguir ni auditar, y la planilla de Calidad
 * ya tiene demasiadas filas asi. Lo unico opcional es el puesto del
 * responsable, que es el nombre que le da la planilla y no siempre
 * coincide con un cargo del organigrama.
 *
 * EL SEGUIMIENTO SALIO DE ACA. La fecha real, el resultado de la
 * evaluacion, el avance, el estado y las observaciones ya no se cargan
 * en la accion: el resultado se registra mes a mes en el calendario de
 * la pantalla principal, que es donde Direccion lo va a mirar.
 */

/** Los campos que se exigen completos, con el nombre que ve la persona. */
const OBLIGATORIOS: { campo: string; nombre: string }[] = [
  { campo: "recursos_necesarios", nombre: "qué recursos se requerirán" },
  { campo: "responsable_id", nombre: "quién será responsable" },
  { campo: "fecha_finalizacion", nombre: "cuándo se finalizará" },
  { campo: "como_se_evaluan_resultados", nombre: "cómo se evaluarán los resultados" },
];

/** Devuelve el mensaje del primer problema, o null si esta todo bien. */
function revisarCampos(datos: FormData): string | null {
  if (String(datos.get("que_se_va_a_hacer") ?? "").trim().length < 10) {
    return "Describa qué se va a hacer, con al menos 10 caracteres.";
  }

  if (!String(datos.get("objetivo_id") ?? "").trim()) {
    return "Elija el objetivo al que responde la acción.";
  }

  const faltante = OBLIGATORIOS.find(
    (obligatorio) => String(datos.get(obligatorio.campo) ?? "").trim() === "",
  );
  if (faltante) return `Falta completar ${faltante.nombre}.`;

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
  };
}

// El seguimiento —fecha real, resultado de la evaluacion, avance, estado
// y observaciones— ya no se carga desde el formulario, asi que tampoco
// se escribe: mandarlo vacio al corregir una accion le borraria a la
// planilla lo que ya tenia cargado. Las columnas quedan con su valor por
// omision en el alta y sin tocar en la edicion.

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

// ---------------------------------------------------------------------
// El seguimiento de la accion, al modelo de la accion correctiva
// ---------------------------------------------------------------------
// Direccion lo pidio el 8 de octubre: que una accion del plan se siga
// como se sigue una accion correctiva. Tres cosas: evidencia adjunta,
// estado que se mueve, y al final la eficacia.
//
// Va aparte del formulario de alta a proposito. El alta declara que se
// va a hacer; el seguimiento cuenta que paso. Mezclarlos es lo que hacia
// que al corregir una accion se pisara su seguimiento.

/** Mueve el estado de la accion. */
export async function cambiarEstadoDeLaAccion(
  id: string,
  estado: string,
): Promise<ResultadoAccion> {
  await requerirUsuario();

  if (!esEstadoDePlan(estado)) return { exito: false, error: "Elija un estado de la lista." };

  const supabase = crearClienteServidor();

  // La base exige la fecha real para marcarlo cumplido
  // (`objetivo_planes_cierre_con_fecha`): se pone hoy, que es cuando se
  // esta declarando. Al salir de «cumplido» se limpia, junto con la
  // eficacia, que no puede sobrevivir a una accion que ya no esta
  // cumplida: lo exige `objetivo_planes_eficacia_tras_cumplir`.
  const cambios: Record<string, unknown> =
    estado === "cumplido"
      ? { estado, fecha_real_finalizacion: hoyEnAsuncion() }
      : {
          estado,
          fecha_real_finalizacion: null,
          eficacia: null,
          fecha_evaluacion_eficacia: null,
          observacion_eficacia: null,
        };

  const { data: actualizado, error } = await supabase
    .from("objetivo_planes")
    .update(cambios)
    .eq("id", id)
    .select("id, objetivo_id")
    .maybeSingle();

  if (error) return { exito: false, error: `No se pudo cambiar el estado: ${error.message}` };
  if (!actualizado) {
    return {
      exito: false,
      error: "No se pudo guardar: la acción no existe o su rol no puede moverla.",
    };
  }

  revalidatePath("/indicadores/plan");
  revalidatePath(`/indicadores/objetivos/${actualizado.objetivo_id}`);
  return { exito: true, mensaje: "Estado de la acción actualizado." };
}

/** Declara si la accion sirvio para lo que se hizo. */
export async function verificarEficaciaDeLaAccion(
  id: string,
  eficaz: boolean,
  observacion: string,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: accion } = await supabase
    .from("objetivo_planes")
    .select("id, objetivo_id, estado")
    .eq("id", id)
    .maybeSingle();

  if (!accion) return { exito: false, error: "La acción no existe o no tiene acceso." };
  if ((accion as { estado: string }).estado !== "cumplido") {
    return {
      exito: false,
      error:
        "Primero marque la acción como cumplida. La eficacia se declara sobre lo que ya se hizo.",
    };
  }

  // Un «no eficaz» sin explicacion no sirve para decidir nada: la
  // Revision por la Direccion necesita saber por que no alcanzo.
  if (!eficaz && observacion.trim().length < 10) {
    return { exito: false, error: "Explique por qué la acción no fue eficaz." };
  }

  const { error } = await supabase
    .from("objetivo_planes")
    .update({
      eficacia: eficaz ? "eficaz" : "no_eficaz",
      fecha_evaluacion_eficacia: hoyEnAsuncion(),
      observacion_eficacia: observacion.trim() || null,
    })
    .eq("id", id);

  if (error) return { exito: false, error: `No se pudo registrar la eficacia: ${error.message}` };

  revalidatePath("/indicadores/plan");
  revalidatePath(`/indicadores/objetivos/${(accion as { objetivo_id: string }).objetivo_id}`);
  return {
    exito: true,
    mensaje: eficaz ? "Acción registrada como eficaz." : "Acción registrada como no eficaz.",
  };
}

/** Vuelve atras la eficacia, para corregir una declarada por error. */
export async function reabrirEficaciaDeLaAccion(id: string): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: actualizado, error } = await supabase
    .from("objetivo_planes")
    .update({ eficacia: null, fecha_evaluacion_eficacia: null, observacion_eficacia: null })
    .eq("id", id)
    .select("objetivo_id")
    .maybeSingle();

  if (error) return { exito: false, error: `No se pudo reabrir: ${error.message}` };
  if (!actualizado) return { exito: false, error: "La acción no existe o no tiene acceso." };

  revalidatePath(`/indicadores/objetivos/${actualizado.objetivo_id}`);
  return { exito: true, mensaje: "Eficacia reabierta." };
}

/**
 * Sube evidencia de la accion.
 *
 * `adjuntos` es generica —`entidad` + `entidad_id`— y su RLS no mira el
 * valor de `entidad`, asi que no hizo falta tocar el esquema: alcanza
 * con usar 'objetivo_planes', igual que la accion correctiva usa
 * 'nc_acciones'.
 */
export async function adjuntarEvidenciaDeLaAccion(
  id: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite subir evidencia." };
  }

  const archivos = archivosDelFormulario(datos, "archivos");
  if (archivos.length === 0) return { exito: false, error: "Elija al menos un archivo." };

  const supabase = crearClienteServidor();

  // La accion se lee antes de subir nada, y de ella sale el objetivo
  // para refrescar la pantalla: no se confia en un id del navegador.
  const { data: accion } = await supabase
    .from("objetivo_planes")
    .select("id, objetivo_id")
    .eq("id", id)
    .maybeSingle();

  if (!accion) return { exito: false, error: "La acción no existe o no tiene acceso." };

  const { subidos, fallidos } = await subirAdjuntos(supabase, {
    entidad: "objetivo_planes",
    entidadId: id,
    carpeta: "objetivos",
    archivos,
    descripcion: String(datos.get("descripcion") ?? ""),
    empresaId: usuario.empresa_id,
    usuarioId: usuario.id,
  });

  revalidatePath(`/indicadores/objetivos/${(accion as { objetivo_id: string }).objetivo_id}`);

  if (subidos === 0) {
    return { exito: false, error: fallidos[0] ?? "No se pudo subir la evidencia." };
  }

  return {
    exito: true,
    mensaje:
      `Se subió ${subidos} archivo${subidos === 1 ? "" : "s"}.` +
      (fallidos.length > 0 ? ` No entraron: ${fallidos.join(" ")}` : ""),
  };
}

/** Quita un archivo de evidencia. */
export async function quitarEvidenciaDeLaAccion(
  adjuntoId: string,
  accionId: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite quitar evidencia." };
  }

  const supabase = crearClienteServidor();

  // La entidad y el id van en el borrado: sin eso, un id de adjunto de
  // otra pantalla borraria un archivo que no es de esta accion.
  const resultado = await quitarAdjunto(supabase, adjuntoId, "objetivo_planes", accionId);
  if (!resultado.ok) return { exito: false, error: resultado.error };

  const { data: accion } = await supabase
    .from("objetivo_planes")
    .select("objetivo_id")
    .eq("id", accionId)
    .maybeSingle();

  if (accion) {
    revalidatePath(`/indicadores/objetivos/${(accion as { objetivo_id: string }).objetivo_id}`);
  }

  return { exito: true, mensaje: "Evidencia quitada." };
}
