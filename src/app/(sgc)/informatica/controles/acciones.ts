"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { obtenerPermisos, requerirUsuario } from "@/lib/sesion";
import { archivosDelFormulario, quitarAdjunto, subirAdjuntos } from "@/lib/adjuntos-servidor";
import { hoyEnAsuncion } from "@/lib/formato";
import { MAXIMO_EVIDENCIAS_ACCION } from "@/lib/constantes";
import {
  LARGO_MINIMO_OBSERVACION,
  describirPeriodo,
  esFrecuencia,
  esResultadoControl,
  periodoDe,
  tocaEnPeriodo,
} from "@/lib/controles-ti";
import type { ResultadoAccion } from "@/lib/tipos";

const ENTIDAD_EJECUCION = "control_ti_ejecuciones";
const RUTA = "/informatica/controles";

/**
 * Quién escribe lo decide RLS (`controles_ti_gestion` y
 * `control_ti_ejecuciones_gestion`, que miran `puede_editar('informatica')`).
 * Esto lo vuelve a preguntar antes para devolver un mensaje que se
 * entienda en vez del error crudo de la base.
 */
async function exigirEdicion(): Promise<string | null> {
  const permisos = await obtenerPermisos();
  return permisos.informatica.editar
    ? null
    : "Su rol no permite modificar los controles de TI.";
}

/** Los campos que comparten el alta y la edición. */
function leerCamposDelControl(datos: FormData) {
  const frecuencia = Number(datos.get("frecuencia_meses") ?? 0);
  const primerMes = String(datos.get("primer_periodo") ?? "").trim();

  return {
    nombre: String(datos.get("nombre") ?? "").trim(),
    descripcion: String(datos.get("descripcion") ?? "").trim() || null,
    documento_origen: String(datos.get("documento_origen") ?? "").trim() || null,
    formulario: String(datos.get("formulario") ?? "").trim() || null,
    frecuencia_meses: frecuencia,
    // El campo es `type="month"` y llega «2026-11»: se guarda el día 1.
    primer_periodo: /^\d{4}-\d{2}/.test(primerMes) ? periodoDe(primerMes) : "",
    responsable_id: String(datos.get("responsable_id") ?? "") || null,
    // La casilla solo está en la edición, y una casilla destildada no
    // viaja en el formulario: el campo oculto dice que se preguntó.
    vigente: datos.has("vigente_preguntado") ? datos.get("vigente") === "on" : true,
  };
}

function revisarCamposDelControl(
  campos: ReturnType<typeof leerCamposDelControl>,
): string | null {
  if (campos.nombre.length < 5) return "El nombre debe tener al menos 5 caracteres.";
  if (!esFrecuencia(campos.frecuencia_meses)) {
    return "Elija la frecuencia: mensual, trimestral, semestral o anual.";
  }
  if (!campos.primer_periodo) return "Indique el mes en que arranca el control.";
  if (!campos.responsable_id) return "Indique quién responde por el control.";
  return null;
}

export async function crearControl(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  const codigo = String(datos.get("codigo") ?? "").trim().toUpperCase();
  if (codigo.length < 2) return { exito: false, error: "Indique el código del control." };

  const campos = leerCamposDelControl(datos);
  const problema = revisarCamposDelControl(campos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();
  const { data, error } = await supabase
    .from("controles_ti")
    .insert({
      ...campos,
      codigo,
      empresa_id: usuario.empresa_id,
      creado_por: usuario.id,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { exito: false, error: `Ya hay un control con el código ${codigo}. Elija otro.` };
    }
    return {
      exito: false,
      error: "No se pudo guardar el control. Revise los datos e intente de nuevo.",
    };
  }

  revalidatePath(RUTA);
  return { exito: true, mensaje: "Control programado.", id: (data as { id: string }).id };
}

/**
 * Edita un control. EL CÓDIGO NO SE EDITA: identifica al control en las
 * ejecuciones ya registradas y en la bitácora.
 *
 * Cambiar la frecuencia o el mes de arranque reprograma el cronograma
 * hacia adelante, pero no borra nada: una ejecución registrada para un
 * período que deja de tocar sigue en el historial de la ficha.
 */
export async function actualizarControl(id: string, datos: FormData): Promise<ResultadoAccion> {
  await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  const campos = leerCamposDelControl(datos);
  const problema = revisarCamposDelControl(campos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();
  const { error } = await supabase.from("controles_ti").update(campos).eq("id", id);

  if (error) {
    return {
      exito: false,
      error: "No se pudo guardar el cambio. Revise los datos e intente de nuevo.",
    };
  }

  revalidatePath(RUTA);
  revalidatePath(`${RUTA}/${id}`);
  return { exito: true, mensaje: "Control actualizado." };
}

/**
 * Registra que un control se hizo, con su evidencia.
 *
 * El período tiene que ser uno de los que el control tiene programados
 * y no puede ser futuro: registrar hoy el control de marzo que viene
 * sería adelantar un resultado que todavía no existe.
 */
export async function registrarEjecucion(
  controlId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  const supabase = crearClienteServidor();
  const { data: control } = await supabase
    .from("controles_ti")
    .select("id, codigo, primer_periodo, frecuencia_meses")
    .eq("id", controlId)
    .maybeSingle();

  if (!control) return { exito: false, error: "El control no existe o no tiene acceso." };

  const periodo = String(datos.get("periodo") ?? "");
  const fecha = String(datos.get("fecha_ejecucion") ?? "");
  const resultado = String(datos.get("resultado") ?? "");
  const observaciones = String(datos.get("observaciones") ?? "").trim() || null;
  const hoy = hoyEnAsuncion();

  if (!/^\d{4}-\d{2}-01$/.test(periodo) || !tocaEnPeriodo(control, periodo)) {
    return { exito: false, error: "Elija uno de los períodos programados del control." };
  }
  if (periodo > periodoDe(hoy)) {
    return { exito: false, error: "No se puede registrar un período que todavía no llegó." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { exito: false, error: "Indique la fecha en que se hizo el control." };
  }
  if (fecha > hoy) {
    return { exito: false, error: "La fecha de ejecución no puede ser posterior a hoy." };
  }
  if (!esResultadoControl(resultado)) {
    return { exito: false, error: "Indique el resultado del control." };
  }
  if (resultado !== "conforme" && (observaciones?.length ?? 0) < LARGO_MINIMO_OBSERVACION) {
    return {
      exito: false,
      error: "Si el resultado no es conforme, describa qué se encontró y qué se hizo.",
    };
  }

  const archivos = archivosDelFormulario(datos, "evidencias");
  if (archivos.length > MAXIMO_EVIDENCIAS_ACCION) {
    return {
      exito: false,
      error: `Se admiten hasta ${MAXIMO_EVIDENCIAS_ACCION} archivos de evidencia por ejecución.`,
    };
  }

  const { data: ejecucion, error } = await supabase
    .from("control_ti_ejecuciones")
    .insert({
      empresa_id: usuario.empresa_id,
      control_id: controlId,
      periodo,
      fecha_ejecucion: fecha,
      resultado,
      observaciones,
      ejecutado_por: usuario.id,
      creado_por: usuario.id,
    })
    .select("id")
    .single();

  if (error || !ejecucion) {
    if (error?.code === "23505") {
      return {
        exito: false,
        error: `${describirPeriodo(periodo)} ya tiene su ejecución registrada.`,
      };
    }
    return {
      exito: false,
      error: "No se pudo registrar la ejecución. Revise los datos e intente de nuevo.",
    };
  }

  const ejecucionId = (ejecucion as { id: string }).id;
  const carga = await subirAdjuntos(supabase, {
    entidad: ENTIDAD_EJECUCION,
    entidadId: ejecucionId,
    carpeta: "controles-ti",
    archivos,
    empresaId: usuario.empresa_id,
    usuarioId: usuario.id,
  });

  revalidatePath(RUTA);
  revalidatePath(`${RUTA}/${controlId}`);

  if (carga.fallidos.length > 0) {
    return {
      exito: true,
      mensaje:
        `Ejecución registrada, pero ${carga.fallidos.length} archivo(s) no se subieron: ` +
        carga.fallidos.join(" · "),
    };
  }

  return {
    exito: true,
    mensaje:
      carga.subidos > 0
        ? `Ejecución registrada con ${carga.subidos} archivo(s) de evidencia.`
        : "Ejecución registrada.",
    id: ejecucionId,
  };
}

/**
 * Agrega evidencia a una ejecución ya registrada, con el mismo tope de
 * cinco archivos contando los que ya tiene: es un tope por ejecución, no
 * por subida.
 */
export async function agregarEvidencia(
  controlId: string,
  ejecucionId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  const archivos = archivosDelFormulario(datos, "evidencias");
  if (archivos.length === 0) return { exito: false, error: "Elija al menos un archivo." };

  const supabase = crearClienteServidor();
  const { count } = await supabase
    .from("adjuntos")
    .select("id", { count: "exact", head: true })
    .eq("entidad", ENTIDAD_EJECUCION)
    .eq("entidad_id", ejecucionId);

  const cupo = MAXIMO_EVIDENCIAS_ACCION - (count ?? 0);
  if (archivos.length > cupo) {
    return {
      exito: false,
      error:
        cupo <= 0
          ? `La ejecución ya tiene los ${MAXIMO_EVIDENCIAS_ACCION} archivos que se admiten.`
          : `Solo queda lugar para ${cupo} archivo(s) más.`,
    };
  }

  const carga = await subirAdjuntos(supabase, {
    entidad: ENTIDAD_EJECUCION,
    entidadId: ejecucionId,
    carpeta: "controles-ti",
    archivos,
    empresaId: usuario.empresa_id,
    usuarioId: usuario.id,
  });

  revalidatePath(`${RUTA}/${controlId}`);

  if (carga.subidos === 0) {
    return { exito: false, error: `No se subió ningún archivo: ${carga.fallidos.join(" · ")}` };
  }
  return {
    exito: true,
    mensaje:
      carga.fallidos.length > 0
        ? `Se subieron ${carga.subidos}; fallaron: ${carga.fallidos.join(" · ")}`
        : "Evidencia agregada.",
  };
}

export async function quitarEvidencia(
  controlId: string,
  ejecucionId: string,
  adjuntoId: string,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();
  const resultado = await quitarAdjunto(supabase, adjuntoId, ENTIDAD_EJECUCION, ejecucionId);
  if (!resultado.ok) return { exito: false, error: resultado.error };

  revalidatePath(`${RUTA}/${controlId}`);
  return { exito: true, mensaje: `Se quitó ${resultado.nombre}.` };
}

/**
 * Anula el registro de una ejecución cargada por error. Se lleva su
 * evidencia: un archivo sin la ejecución a la que respalda no dice nada.
 * La bitácora conserva lo que se borró.
 */
export async function eliminarEjecucion(
  controlId: string,
  ejecucionId: string,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  const supabase = crearClienteServidor();
  const { data: adjuntos } = await supabase
    .from("adjuntos")
    .select("id")
    .eq("entidad", ENTIDAD_EJECUCION)
    .eq("entidad_id", ejecucionId);

  for (const adjunto of (adjuntos ?? []) as { id: string }[]) {
    await quitarAdjunto(supabase, adjunto.id, ENTIDAD_EJECUCION, ejecucionId);
  }

  const { error } = await supabase.from("control_ti_ejecuciones").delete().eq("id", ejecucionId);
  if (error) {
    return { exito: false, error: "No se pudo eliminar el registro. Intente de nuevo." };
  }

  revalidatePath(RUTA);
  revalidatePath(`${RUTA}/${controlId}`);
  return { exito: true, mensaje: "Registro eliminado." };
}
