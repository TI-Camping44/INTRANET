"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { departe, notificar } from "@/lib/notificaciones";
import { hoyEnAsuncion } from "@/lib/formato";
import { CLASES_ACTIVO, CRITICIDADES_ACTIVO, ESTADOS_ACTIVO } from "@/lib/constantes";
import type {
  ClaseActivo,
  CriticidadActivo,
  EstadoActivo,
  ResultadoAccion,
} from "@/lib/tipos";

/**
 * Los campos que comparten el alta y la edicion.
 *
 * LA CLASE, LA CRITICIDAD Y EL ESTADO van en el alta desde el 6 de
 * octubre: Direccion lleva los activos edilicios y los tecnologicos por
 * separado, y el estado dejo de nacer siempre en «operativo» porque un
 * activo se puede cargar ya en reserva o ya fuera de servicio.
 */
function leerCamposDelActivo(datos: FormData) {
  const valorCrudo = String(datos.get("valor_gs") ?? "").replace(/[^0-9]/g, "");
  const requiereMantenimiento = datos.get("requiere_mantenimiento") === "on";
  const frecuencia = Number(datos.get("frecuencia_mantenimiento_dias") ?? 0) || null;

  return {
    nombre: String(datos.get("nombre") ?? "").trim(),
    clase: (String(datos.get("clase") ?? "") || "tecnologico") as ClaseActivo,
    criticidad: (String(datos.get("criticidad") ?? "") || "media") as CriticidadActivo,
    estado: (String(datos.get("estado") ?? "") || "operativo") as EstadoActivo,
    categoria: String(datos.get("categoria") ?? "").trim() || null,
    descripcion: String(datos.get("descripcion") ?? "").trim() || null,
    sede_id: String(datos.get("sede_id") ?? "") || null,
    ubicacion: String(datos.get("ubicacion") ?? "").trim() || null,
    responsable_id: String(datos.get("responsable_id") ?? "") || null,
    proveedor_id: String(datos.get("proveedor_id") ?? "") || null,
    numero_serie: String(datos.get("numero_serie") ?? "").trim() || null,
    marca: String(datos.get("marca") ?? "").trim() || null,
    modelo: String(datos.get("modelo") ?? "").trim() || null,
    fecha_adquisicion: String(datos.get("fecha_adquisicion") ?? "") || null,
    vencimiento_garantia: String(datos.get("vencimiento_garantia") ?? "") || null,
    observaciones: String(datos.get("observaciones") ?? "").trim() || null,
    valor_gs: valorCrudo ? Number(valorCrudo) : null,
    requiere_mantenimiento: requiereMantenimiento,
    frecuencia_mantenimiento_dias: requiereMantenimiento ? frecuencia : null,
  };
}

/** El mensaje del primer problema, o null si esta todo bien. */
function revisarCamposDelActivo(campos: ReturnType<typeof leerCamposDelActivo>): string | null {
  if (campos.nombre.length < 3) return "El nombre debe tener al menos 3 caracteres.";
  if (!CLASES_ACTIVO.includes(campos.clase)) return "Indique si el activo es edilicio o tecnológico.";
  if (!CRITICIDADES_ACTIVO.includes(campos.criticidad)) return "Indique la criticidad del activo.";
  if (!ESTADOS_ACTIVO.includes(campos.estado)) return "Indique el estado del activo.";
  if (campos.requiere_mantenimiento && !campos.frecuencia_mantenimiento_dias) {
    return "Un activo con mantenimiento preventivo necesita su frecuencia en días.";
  }
  return null;
}

export async function crearActivo(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite dar de alta activos." };
  }

  const supabase = crearClienteServidor();

  const codigo = String(datos.get("codigo") ?? "").trim().toUpperCase();
  if (!codigo) return { exito: false, error: "Indique el código del activo." };

  const campos = leerCamposDelActivo(datos);
  const problema = revisarCamposDelActivo(campos);
  if (problema) return { exito: false, error: problema };

  const { data: activo, error } = await supabase
    .from("activos")
    .insert({ empresa_id: usuario.empresa_id, codigo, ...campos })
    .select("id, codigo")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { exito: false, error: `Ya existe un activo con el código ${codigo}.` };
    }
    return { exito: false, error: `No se pudo crear el activo: ${error.message}` };
  }

  revalidatePath("/activos");
  return { exito: true, id: activo.id, mensaje: `Activo ${activo.codigo} registrado.` };
}

export async function actualizarActivo(id: string, datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite editar activos." };
  }

  const supabase = crearClienteServidor();

  const campos = leerCamposDelActivo(datos);
  const problema = revisarCamposDelActivo(campos);
  if (problema) return { exito: false, error: problema };

  // El codigo no se edita: identifica al activo en el inventario y en
  // sus mantenimientos.
  const { error } = await supabase.from("activos").update(campos).eq("id", id);

  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };

  revalidatePath("/activos");
  revalidatePath(`/activos/${id}`);
  return { exito: true, mensaje: "Activo actualizado." };
}

/**
 * Elimina un activo.
 *
 * SE LLEVA SU HISTORIAL DE MANTENIMIENTOS. Existe para lo que no deberia
 * haberse cargado —una prueba, un duplicado—: un activo real que se
 * retira se pasa a «Dado de baja», que es justamente el estado que
 * Direccion pidio para eso, y asi queda en la tabla como historial.
 */
export async function eliminarActivo(id: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (usuario.rol !== "administrador_sgc") {
    return { exito: false, error: "Solo el Administrador SGC puede eliminar un activo." };
  }

  const supabase = crearClienteServidor();

  const { data: activo } = await supabase
    .from("activos")
    .select("codigo")
    .eq("id", id)
    .maybeSingle();

  if (!activo) return { exito: false, error: "El activo no existe o no tiene acceso." };

  const { error: errorMantenimientos } = await supabase
    .from("mantenimientos")
    .delete()
    .eq("activo_id", id);

  if (errorMantenimientos) {
    return {
      exito: false,
      error: `No se pudieron eliminar sus mantenimientos: ${errorMantenimientos.message}`,
    };
  }

  const { error } = await supabase.from("activos").delete().eq("id", id);
  if (error) return { exito: false, error: `No se pudo eliminar el activo: ${error.message}` };

  revalidatePath("/activos");
  return {
    exito: true,
    mensaje: `Activo ${(activo as { codigo: string }).codigo} eliminado.`,
  };
}

export async function cambiarEstadoActivo(
  id: string,
  estado: EstadoActivo,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite cambiar el estado del activo." };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase.from("activos").update({ estado }).eq("id", id);
  if (error) return { exito: false, error: `No se pudo cambiar el estado: ${error.message}` };

  revalidatePath(`/activos/${id}`);
  revalidatePath("/activos");
  return { exito: true, mensaje: "Estado del activo actualizado." };
}

/** Programa un mantenimiento y avisa a su responsable. */
export async function programarMantenimiento(
  activoId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite programar mantenimientos." };
  }

  const supabase = crearClienteServidor();

  const fechaProgramada = String(datos.get("fecha_programada") ?? "");
  if (!fechaProgramada) {
    return { exito: false, error: "Indique la fecha programada del mantenimiento." };
  }

  const responsableId = String(datos.get("responsable_id") ?? "") || null;
  const costoCrudo = String(datos.get("costo_gs") ?? "").replace(/[^0-9]/g, "");

  const { error } = await supabase.from("mantenimientos").insert({
    activo_id: activoId,
    tipo: String(datos.get("tipo") ?? "preventivo"),
    descripcion: String(datos.get("descripcion") ?? "").trim() || null,
    fecha_programada: fechaProgramada,
    responsable_id: responsableId,
    proveedor_id: String(datos.get("proveedor_id") ?? "") || null,
    estado: "programado",
    costo_gs: costoCrudo ? Number(costoCrudo) : 0,
  });

  if (error) {
    return { exito: false, error: `No se pudo programar el mantenimiento: ${error.message}` };
  }

  if (responsableId && responsableId !== usuario.id) {
    const [{ data: responsable }, { data: activo }] = await Promise.all([
      supabase.from("usuarios").select("id, correo").eq("id", responsableId).maybeSingle(),
      supabase.from("activos").select("codigo, nombre").eq("id", activoId).maybeSingle(),
    ]);

    if (responsable) {
      await notificar(supabase, {
        deParteDe: departe(usuario),
        usuarioId: responsable.id,
        correoDestino: responsable.correo,
        tipo: "mantenimiento_programado",
        titulo: `Mantenimiento asignado · ${activo?.codigo ?? ""}`,
        mensaje: `${activo?.nombre ?? "Activo"} tiene mantenimiento previsto para el ${fechaProgramada}.`,
        enlace: `/activos/${activoId}`,
        entidad: "mantenimientos",
        entidadId: activoId,
      });
    }
  }

  revalidatePath(`/activos/${activoId}`);
  revalidatePath("/activos");
  return { exito: true, mensaje: "Mantenimiento programado." };
}

/**
 * Cierra un mantenimiento. El disparador de la base de datos actualiza la
 * fecha del ultimo mantenimiento del activo, agenda el siguiente segun su
 * frecuencia y lo devuelve a operativo si estaba en mantenimiento.
 */
export async function ejecutarMantenimiento(
  mantenimientoId: string,
  activoId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: mantenimiento } = await supabase
    .from("mantenimientos")
    .select("id, estado, responsable_id")
    .eq("id", mantenimientoId)
    .maybeSingle();

  if (!mantenimiento) return { exito: false, error: "El mantenimiento no existe." };
  if (mantenimiento.estado === "ejecutado") {
    return { exito: false, error: "Este mantenimiento ya fue ejecutado." };
  }
  if (!puedeGestionar(usuario) && mantenimiento.responsable_id !== usuario.id) {
    return { exito: false, error: "Solo su responsable o Calidad pueden cerrarlo." };
  }

  const costoCrudo = String(datos.get("costo_gs") ?? "").replace(/[^0-9]/g, "");

  const { error } = await supabase
    .from("mantenimientos")
    .update({
      estado: "ejecutado",
      fecha_ejecucion: String(datos.get("fecha_ejecucion") ?? hoyEnAsuncion()),
      observacion: String(datos.get("observacion") ?? "").trim() || null,
      costo_gs: costoCrudo ? Number(costoCrudo) : 0,
    })
    .eq("id", mantenimientoId);

  if (error) return { exito: false, error: `No se pudo cerrar el mantenimiento: ${error.message}` };

  revalidatePath(`/activos/${activoId}`);
  revalidatePath("/activos");
  return {
    exito: true,
    mensaje: "Mantenimiento ejecutado. El siguiente quedó agendado según la frecuencia del activo.",
  };
}

export async function cancelarMantenimiento(
  mantenimientoId: string,
  activoId: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite cancelar mantenimientos." };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("mantenimientos")
    .update({ estado: "cancelado" })
    .eq("id", mantenimientoId);

  if (error) return { exito: false, error: `No se pudo cancelar: ${error.message}` };

  revalidatePath(`/activos/${activoId}`);
  return { exito: true, mensaje: "Mantenimiento cancelado." };
}
