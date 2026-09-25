"use server";

import { revalidatePath } from "next/cache";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import {
  puedePasarA,
  ROLES_QUE_APRUEBAN_CAMBIOS,
  ROLES_QUE_SIGUEN_CAMBIOS,
  type DecisionCambio,
  type EstadoCambio,
  type TipoCambio,
} from "@/lib/cambios";
import type { ResultadoAccion, RolUsuario } from "@/lib/tipos";

/**
 * Escrituras del modulo de Planificacion y Gestion de Cambios.
 *
 * TODO LO QUE EL PROCEDIMIENTO EXIGE SE VALIDA ACA, ademas de en los
 * CHECK de la base. La validacion del navegador es comodidad: quien mande
 * el formulario por otro camino tiene que chocar contra lo mismo.
 */

/** Los campos que el procedimiento exige documentar de todo cambio. */
const CAMPOS_OBLIGATORIOS: { nombre: string; etiqueta: string; minimo: number }[] = [
  { nombre: "titulo", etiqueta: "el título", minimo: 5 },
  { nombre: "proposito", etiqueta: "el propósito", minimo: 15 },
  { nombre: "consecuencias_potenciales", etiqueta: "las consecuencias potenciales", minimo: 15 },
  { nombre: "impacto_integridad_sgc", etiqueta: "el impacto en la integridad del SGC", minimo: 15 },
  { nombre: "recursos_necesarios", etiqueta: "los recursos e información necesarios", minimo: 10 },
  { nombre: "responsabilidades", etiqueta: "las responsabilidades a asignar", minimo: 10 },
  { nombre: "comunicacion_a_quien", etiqueta: "a quién se comunica", minimo: 3 },
  { nombre: "comunicacion_cuando", etiqueta: "cuándo se comunica", minimo: 3 },
  { nombre: "comunicacion_canal", etiqueta: "por qué canal se comunica", minimo: 3 },
  { nombre: "indicador_exito", etiqueta: "el indicador del cambio", minimo: 5 },
  { nombre: "criterio_exito", etiqueta: "el criterio de éxito", minimo: 5 },
];

interface CamposDelCambio {
  valores: Record<string, string>;
  afectaMaterialControlado: boolean;
  impactoTrazabilidad: string;
  fechaRevision: string;
  tipo: TipoCambio;
  procesoId: string | null;
  responsableId: string | null;
}

function leerCampos(datos: FormData): CamposDelCambio {
  const valores: Record<string, string> = {};
  for (const campo of CAMPOS_OBLIGATORIOS) {
    valores[campo.nombre] = String(datos.get(campo.nombre) ?? "").trim();
  }

  return {
    valores,
    afectaMaterialControlado: datos.get("afecta_material_controlado") === "on",
    impactoTrazabilidad: String(datos.get("impacto_trazabilidad") ?? "").trim(),
    fechaRevision: String(datos.get("fecha_revision") ?? ""),
    tipo: String(datos.get("tipo") ?? "otro") as TipoCambio,
    procesoId: String(datos.get("proceso_id") ?? "") || null,
    responsableId: String(datos.get("responsable_id") ?? "") || null,
  };
}

function validar(campos: CamposDelCambio): string | null {
  for (const campo of CAMPOS_OBLIGATORIOS) {
    if (campos.valores[campo.nombre].length < campo.minimo) {
      return `Complete ${campo.etiqueta}: al menos ${campo.minimo} caracteres.`;
    }
  }

  // La fecha de revision es lo que convierte esto en un seguimiento y no
  // en un aviso: sin ella nadie vuelve a mirar el cambio.
  if (!campos.fechaRevision) {
    return "Indique la fecha en la que se van a revisar los resultados del cambio.";
  }

  // Decir que toca material controlado y no decir que pasa con la
  // trazabilidad deja afuera lo unico que la DIGEMABEL va a pedir.
  if (campos.afectaMaterialControlado && campos.impactoTrazabilidad.length < 15) {
    return "Describa el impacto en la trazabilidad de la Ley N° 7411/2024: al menos 15 caracteres.";
  }

  return null;
}

function aFilaDeBase(campos: CamposDelCambio) {
  return {
    ...campos.valores,
    tipo: campos.tipo,
    proceso_id: campos.procesoId,
    responsable_id: campos.responsableId,
    fecha_revision: campos.fechaRevision,
    afecta_material_controlado: campos.afectaMaterialControlado,
    impacto_trazabilidad: campos.afectaMaterialControlado ? campos.impactoTrazabilidad : null,
  };
}

export async function crearCambio(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) {
    return { exito: false, error: "El perfil de Dirección es de solo lectura." };
  }

  const campos = leerCampos(datos);
  const problema = validar(campos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();

  // El correlativo lo resuelve la base, para que dos altas simultaneas no
  // se lleven el mismo numero.
  const { data: codigo, error: errorCodigo } = await supabase.rpc("siguiente_codigo_cambio", {
    p_empresa_id: usuario.empresa_id,
  });

  if (errorCodigo || !codigo) {
    return { exito: false, error: "No se pudo asignar el código del cambio. Intente de nuevo." };
  }

  const { data: creado, error } = await supabase
    .from("cambios")
    .insert({
      empresa_id: usuario.empresa_id,
      codigo,
      estado: "borrador",
      creado_por: usuario.id,
      ...aFilaDeBase(campos),
    })
    .select("id, codigo")
    .single();

  if (error || !creado) {
    return { exito: false, error: `No se pudo registrar el cambio: ${error?.message ?? ""}` };
  }

  revalidatePath("/cambios");
  const fila = creado as { id: string; codigo: string };
  return { exito: true, id: fila.id, mensaje: `${fila.codigo} registrado como borrador.` };
}

export async function actualizarCambio(id: string, datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (esSoloLectura(usuario)) {
    return { exito: false, error: "El perfil de Dirección es de solo lectura." };
  }

  const campos = leerCampos(datos);
  const problema = validar(campos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();

  // Un cambio aprobado o cerrado ya no se edita: lo que se aprobo tiene
  // que seguir diciendo lo que decia cuando se aprobo.
  const { data: actual } = await supabase.from("cambios").select("estado").eq("id", id).maybeSingle();
  const estado = (actual as { estado: EstadoCambio } | null)?.estado;
  if (!estado) return { exito: false, error: "No se encontró el cambio." };
  if (estado !== "borrador" && estado !== "rechazado") {
    return {
      exito: false,
      error: "Solo se puede editar un cambio en borrador o rechazado: ya fue enviado a aprobación.",
    };
  }

  const { error } = await supabase.from("cambios").update(aFilaDeBase(campos)).eq("id", id);
  if (error) return { exito: false, error: `No se pudo guardar: ${error.message}` };

  revalidatePath("/cambios");
  revalidatePath(`/cambios/${id}`);
  return { exito: true, mensaje: "Cambio actualizado." };
}

function puedeAprobar(rol: RolUsuario): boolean {
  return (ROLES_QUE_APRUEBAN_CAMBIOS as readonly string[]).includes(rol);
}

function puedeSeguir(rol: RolUsuario): boolean {
  return (ROLES_QUE_SIGUEN_CAMBIOS as readonly string[]).includes(rol);
}

/**
 * Mueve el cambio de estado.
 *
 * UNA SOLA PUERTA para todas las transiciones, y la tabla de
 * `TRANSICIONES_CAMBIO` decide: asi la pantalla y el servidor no pueden
 * discrepar sobre lo que es posible.
 */
export async function cambiarEstadoCambio(
  id: string,
  nuevoEstado: EstadoCambio,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: actual } = await supabase
    .from("cambios")
    .select("id, codigo, estado, titulo, fecha_revision")
    .eq("id", id)
    .maybeSingle();

  const cambio = actual as
    | { id: string; codigo: string; estado: EstadoCambio; titulo: string; fecha_revision: string }
    | null;
  if (!cambio) return { exito: false, error: "No se encontró el cambio." };

  if (!puedePasarA(cambio.estado, nuevoEstado)) {
    return { exito: false, error: "Esa transición no está permitida desde el estado actual." };
  }

  const hoy = new Date().toISOString().slice(0, 10);
  const parche: Record<string, unknown> = { estado: nuevoEstado };

  if (nuevoEstado === "aprobado" || nuevoEstado === "rechazado") {
    if (!puedeAprobar(usuario.rol)) {
      return {
        exito: false,
        error: "Aprobar o rechazar un cambio es atribución de Dirección o del Administrador SGC.",
      };
    }
    parche.aprobado_por = usuario.id;
    parche.fecha_aprobacion = hoy;

    if (nuevoEstado === "rechazado") {
      const motivo = String(datos.get("motivo_rechazo") ?? "").trim();
      if (motivo.length < 10) {
        return { exito: false, error: "Diga por qué se rechaza: al menos 10 caracteres." };
      }
      parche.motivo_rechazo = motivo;
    } else {
      parche.motivo_rechazo = null;
    }
  }

  if (nuevoEstado === "implementado") {
    if (esSoloLectura(usuario)) {
      return { exito: false, error: "El perfil de Dirección es de solo lectura." };
    }
    const detalle = String(datos.get("capacitacion_detalle") ?? "").trim();
    // El Dueño del Proceso capacita al personal afectado (MP-SOP-01).
    // Implementar sin decir a quien se capacito deja el registro a medias.
    if (detalle.length < 10) {
      return {
        exito: false,
        error: "Indique a quién se capacitó y cómo: al menos 10 caracteres.",
      };
    }
    parche.fecha_implementacion = String(datos.get("fecha_implementacion") ?? "") || hoy;
    parche.capacitacion_realizada = true;
    parche.capacitacion_detalle = detalle;
  }

  if (nuevoEstado === "cerrado") {
    if (!puedeSeguir(usuario.rol)) {
      return {
        exito: false,
        error:
          "El seguimiento de la eficacia es atribución del Administrador SGC, que coordina Calidad.",
      };
    }

    const resultado = String(datos.get("resultado") ?? "");
    if (resultado !== "eficaz" && resultado !== "no_eficaz") {
      return { exito: false, error: "Indique si el cambio fue eficaz o no." };
    }

    const observacion = String(datos.get("seguimiento_observacion") ?? "").trim();
    if (observacion.length < 10) {
      return { exito: false, error: "Deje la observación del seguimiento: al menos 10 caracteres." };
    }

    parche.resultado = resultado;
    parche.seguimiento_observacion = observacion;
    parche.fecha_seguimiento = hoy;
    parche.seguido_por = usuario.id;

    if (resultado === "no_eficaz") {
      const decision = String(datos.get("decision") ?? "") as DecisionCambio;
      if (!["ajuste", "reversion", "accion_correctiva"].includes(decision)) {
        return {
          exito: false,
          error: "Si el cambio no fue eficaz, decida entre ajuste, reversión o acción correctiva.",
        };
      }
      parche.decision = decision;
    } else {
      parche.decision = null;
      parche.requiere_actualizar_documentacion =
        datos.get("requiere_actualizar_documentacion") === "on";
      parche.documentacion_actualizada =
        String(datos.get("documentacion_actualizada") ?? "").trim() || null;
    }
  }

  const { error } = await supabase.from("cambios").update(parche).eq("id", id);
  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };

  revalidatePath("/cambios");
  revalidatePath(`/cambios/${id}`);
  return { exito: true, mensaje: `${cambio.codigo}: ${nuevoEstado.replace("_", " ")}.` };
}

export async function eliminarCambio(id: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (usuario.rol !== "administrador_sgc") {
    return { exito: false, error: "Solo el Administrador SGC puede eliminar un cambio." };
  }

  const supabase = crearClienteServidor();
  const { error } = await supabase.from("cambios").delete().eq("id", id);
  if (error) return { exito: false, error: `No se pudo eliminar: ${error.message}` };

  revalidatePath("/cambios");
  return { exito: true, mensaje: "Cambio eliminado." };
}
