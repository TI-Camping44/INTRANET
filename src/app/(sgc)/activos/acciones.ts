"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { notificar } from "@/lib/notificaciones";
import { hoyEnAsuncion } from "@/lib/formato";
import type { EstadoActivo, ResultadoAccion } from "@/lib/tipos";

export async function crearActivo(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite dar de alta activos." };
  }

  const supabase = crearClienteServidor();

  const codigo = String(datos.get("codigo") ?? "").trim().toUpperCase();
  const nombre = String(datos.get("nombre") ?? "").trim();
  const requiereMantenimiento = datos.get("requiere_mantenimiento") === "on";
  const frecuencia = datos.get("frecuencia_mantenimiento_dias")
    ? Number(datos.get("frecuencia_mantenimiento_dias"))
    : null;

  if (!codigo) return { exito: false, error: "Indique el código del activo." };
  if (nombre.length < 3) {
    return { exito: false, error: "El nombre debe tener al menos 3 caracteres." };
  }
  if (requiereMantenimiento && (!frecuencia || frecuencia < 1)) {
    return {
      exito: false,
      error: "Un activo con mantenimiento preventivo necesita su frecuencia en días.",
    };
  }

  const valorCrudo = String(datos.get("valor_gs") ?? "").replace(/[^0-9]/g, "");

  const { data: activo, error } = await supabase
    .from("activos")
    .insert({
      empresa_id: usuario.empresa_id,
      codigo,
      nombre,
      categoria: String(datos.get("categoria") ?? "").trim() || null,
      descripcion: String(datos.get("descripcion") ?? "").trim() || null,
      sede_id: String(datos.get("sede_id") ?? "") || null,
      ubicacion: String(datos.get("ubicacion") ?? "").trim() || null,
      responsable_id: String(datos.get("responsable_id") ?? "") || null,
      proveedor_id: String(datos.get("proveedor_id") ?? "") || null,
      numero_serie: String(datos.get("numero_serie") ?? "").trim() || null,
      marca: String(datos.get("marca") ?? "").trim() || null,
      modelo: String(datos.get("modelo") ?? "").trim() || null,
      estado: "operativo",
      fecha_adquisicion: String(datos.get("fecha_adquisicion") ?? "") || null,
      valor_gs: valorCrudo ? Number(valorCrudo) : null,
      requiere_mantenimiento: requiereMantenimiento,
      frecuencia_mantenimiento_dias: requiereMantenimiento ? frecuencia : null,
    })
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
  const requiereMantenimiento = datos.get("requiere_mantenimiento") === "on";
  const valorCrudo = String(datos.get("valor_gs") ?? "").replace(/[^0-9]/g, "");

  const { error } = await supabase
    .from("activos")
    .update({
      nombre: String(datos.get("nombre") ?? "").trim(),
      categoria: String(datos.get("categoria") ?? "").trim() || null,
      descripcion: String(datos.get("descripcion") ?? "").trim() || null,
      sede_id: String(datos.get("sede_id") ?? "") || null,
      ubicacion: String(datos.get("ubicacion") ?? "").trim() || null,
      responsable_id: String(datos.get("responsable_id") ?? "") || null,
      proveedor_id: String(datos.get("proveedor_id") ?? "") || null,
      numero_serie: String(datos.get("numero_serie") ?? "").trim() || null,
      marca: String(datos.get("marca") ?? "").trim() || null,
      modelo: String(datos.get("modelo") ?? "").trim() || null,
      valor_gs: valorCrudo ? Number(valorCrudo) : null,
      requiere_mantenimiento: requiereMantenimiento,
      frecuencia_mantenimiento_dias: requiereMantenimiento
        ? Number(datos.get("frecuencia_mantenimiento_dias") ?? 0) || null
        : null,
    })
    .eq("id", id);

  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };

  revalidatePath(`/activos/${id}`);
  return { exito: true, mensaje: "Activo actualizado." };
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
