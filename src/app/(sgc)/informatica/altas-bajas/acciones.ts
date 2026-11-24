"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { obtenerPermisos, requerirUsuario } from "@/lib/sesion";
import { PATRON_TICKET, normalizarTicket } from "@/lib/avances-ti";
import {
  armarPasos,
  esEstadoPaso,
  esTipoMovimiento,
  type FilaMatriz,
} from "@/lib/altas-bajas-ti";
import { esDeVitalica, type EmpresaDelGrupo } from "@/lib/empresas";
import type { ResultadoAccion } from "@/lib/tipos";

const RUTA = "/informatica/altas-bajas";

async function exigirEdicion(): Promise<string | null> {
  const permisos = await obtenerPermisos();
  return permisos.informatica.editar ? null : "Su rol no permite registrar altas y bajas.";
}

/**
 * Da de alta un ingreso o una desvinculación con sus pasos.
 *
 * LOS PASOS SALEN DE LA MATRIZ DEL PUESTO EN ESTE MOMENTO y se guardan
 * escritos: si la matriz cambia mañana, lo que se hizo con esta persona
 * sigue diciendo lo que correspondía cuando entró o salió.
 */
export async function crearMovimiento(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  const tipo = String(datos.get("tipo") ?? "");
  const personaNombre = String(datos.get("persona_nombre") ?? "").trim();
  const personaCorreo = String(datos.get("persona_correo") ?? "").trim().toLowerCase() || null;
  const puestoId = String(datos.get("puesto_id") ?? "") || null;
  const empresaId = String(datos.get("empresa_de_la_persona_id") ?? "") || null;
  const fecha = String(datos.get("fecha_efectiva") ?? "").trim();
  const ticket = normalizarTicket(String(datos.get("ticket") ?? ""));
  const origen = String(datos.get("origen") ?? "").trim() || null;
  const observaciones = String(datos.get("observaciones") ?? "").trim() || null;

  if (!esTipoMovimiento(tipo)) return { exito: false, error: "Elija si es un ingreso o una desvinculación." };
  if (personaNombre.length < 3) return { exito: false, error: "Escriba el nombre de la persona." };
  if (personaCorreo && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(personaCorreo)) {
    return { exito: false, error: "El correo no tiene un formato válido." };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    return { exito: false, error: "Indique la fecha de ingreso o de salida." };
  }
  if (ticket && !PATRON_TICKET.test(ticket)) {
    return { exito: false, error: "El ticket va con el formato de la ticketera, por ejemplo TI-0140." };
  }
  if (!empresaId) return { exito: false, error: "Elija de qué empresa del grupo es la persona." };

  const supabase = crearClienteServidor();
  const { data: datosEmpresas } = await supabase.rpc("empresas_del_grupo");
  const empresa = ((datosEmpresas as EmpresaDelGrupo[] | null) ?? []).find((e) => e.id === empresaId);
  if (!empresa) return { exito: false, error: "Elija una de las dos empresas del grupo." };

  let fila: FilaMatriz | null = null;
  if (puestoId) {
    const { data } = await supabase
      .from("accesos_por_puesto")
      .select("*")
      .eq("puesto_id", puestoId)
      .maybeSingle();
    fila = (data as FilaMatriz | null) ?? null;
  }

  const { data: movimiento, error } = await supabase
    .from("movimientos_accesos_ti")
    .insert({
      empresa_id: usuario.empresa_id,
      tipo,
      persona_nombre: personaNombre,
      persona_correo: personaCorreo,
      puesto_id: puestoId,
      empresa_de_la_persona_id: empresaId,
      fecha_efectiva: fecha,
      ticket,
      origen,
      observaciones,
      creado_por: usuario.id,
    })
    .select("id")
    .single();

  if (error || !movimiento) {
    return { exito: false, error: "No se pudo guardar el registro. Revise los datos e intente de nuevo." };
  }
  const movimientoId = (movimiento as { id: string }).id;

  const pasos = armarPasos(tipo, fila, esDeVitalica(empresa.nombre)).map((paso, indice) => ({
    empresa_id: usuario.empresa_id,
    movimiento_id: movimientoId,
    orden: indice + 1,
    sistema: paso.sistema,
    descripcion: paso.descripcion,
    estado: paso.estado,
    observacion: paso.observacion,
    resuelto_en: paso.estado === "no_aplica" ? new Date().toISOString() : null,
    resuelto_por: paso.estado === "no_aplica" ? usuario.id : null,
  }));

  const { error: errorPasos } = await supabase.from("movimiento_accesos_pasos").insert(pasos);
  if (errorPasos) {
    // Un movimiento sin pasos no sirve como evidencia: se deshace entero.
    await supabase.from("movimientos_accesos_ti").delete().eq("id", movimientoId);
    return { exito: false, error: "No se pudieron armar los pasos. Intente de nuevo." };
  }

  revalidatePath(RUTA);
  return { exito: true, mensaje: "Registro creado con sus pasos.", id: movimientoId };
}

/**
 * Marca un paso. «No aplica» pide el motivo: es lo que lee la auditoría
 * cuando un paso que la matriz pedía no se hizo. La base lo exige igual.
 */
export async function actualizarPaso(
  pasoId: string,
  estado: string,
  observacion: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  if (!esEstadoPaso(estado)) return { exito: false, error: "Estado no válido." };
  const nota = observacion.trim() || null;
  if (estado === "no_aplica" && (!nota || nota.length < 3)) {
    return { exito: false, error: "Escriba por qué no aplica." };
  }

  const supabase = crearClienteServidor();
  const { data, error } = await supabase
    .from("movimiento_accesos_pasos")
    .update({
      estado,
      observacion: nota,
      resuelto_en: estado === "pendiente" ? null : new Date().toISOString(),
      resuelto_por: estado === "pendiente" ? null : usuario.id,
    })
    .eq("id", pasoId)
    .select("movimiento_id")
    .single();

  if (error || !data) return { exito: false, error: "No se pudo guardar el paso. Intente de nuevo." };

  revalidatePath(RUTA);
  revalidatePath(`${RUTA}/${(data as { movimiento_id: string }).movimiento_id}`);
  return { exito: true, mensaje: "Paso actualizado." };
}

/** Para un registro cargado por error. Los pasos se borran con él. */
export async function eliminarMovimiento(id: string): Promise<ResultadoAccion> {
  await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  const supabase = crearClienteServidor();
  const { error } = await supabase.from("movimientos_accesos_ti").delete().eq("id", id);
  if (error) return { exito: false, error: "No se pudo eliminar el registro. Intente de nuevo." };

  revalidatePath(RUTA);
  return { exito: true, mensaje: "Registro eliminado." };
}
