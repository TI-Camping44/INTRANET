"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import type { EstadoPublicacion, ResultadoAccion } from "@/lib/tipos";

export async function crearPublicacion(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite publicar en la intranet." };
  }

  const supabase = crearClienteServidor();

  const titulo = String(datos.get("titulo") ?? "").trim();
  const cuerpo = String(datos.get("cuerpo") ?? "").trim();

  if (titulo.length < 5) {
    return { exito: false, error: "El título debe tener al menos 5 caracteres." };
  }
  if (cuerpo.length < 10) {
    return { exito: false, error: "El cuerpo debe tener al menos 10 caracteres." };
  }

  // Publicar es lo normal; el borrador es para lo que se deja a medias.
  const publicar = datos.get("publicar") === "si";

  const { data: publicacion, error } = await supabase
    .from("publicaciones")
    .insert({
      empresa_id: usuario.empresa_id,
      tipo: String(datos.get("tipo") ?? "anuncio"),
      titulo,
      cuerpo,
      resumen: String(datos.get("resumen") ?? "").trim() || null,
      estado: publicar ? "publicada" : "borrador",
      fijada: publicar && datos.get("fijada") === "si",
      fecha_vencimiento: String(datos.get("fecha_vencimiento") ?? "") || null,
      usuario_referido_id: String(datos.get("usuario_referido_id") ?? "") || null,
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      creado_por: usuario.id,
    })
    .select("id, titulo")
    .single();

  if (error) {
    return { exito: false, error: `No se pudo crear la publicación: ${error.message}` };
  }

  revalidatePath("/inicio");
  return {
    exito: true,
    id: publicacion.id,
    mensaje: publicar ? "Publicación visible para todos." : "Guardada como borrador.",
  };
}

export async function cambiarEstadoPublicacion(
  id: string,
  estado: EstadoPublicacion,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite cambiar publicaciones." };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase.from("publicaciones").update({ estado }).eq("id", id);
  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };

  revalidatePath("/inicio");

  const mensajes: Record<EstadoPublicacion, string> = {
    publicada: "Publicación visible para todos.",
    borrador: "Vuelve a borrador: deja de verse.",
    archivada: "Archivada. Sigue en el listado, no en el inicio.",
  };
  return { exito: true, mensaje: mensajes[estado] };
}

/**
 * Fijar deja la publicacion arriba de todo. Solo puede haber una: si se
 * fijan cinco cosas, no hay nada destacado y el recurso se gasta.
 */
export async function fijarPublicacion(id: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite destacar publicaciones." };
  }

  const supabase = crearClienteServidor();

  const { data: actual } = await supabase
    .from("publicaciones")
    .select("fijada")
    .eq("id", id)
    .maybeSingle();

  const fijar = !actual?.fijada;

  if (fijar) {
    await supabase
      .from("publicaciones")
      .update({ fijada: false })
      .eq("empresa_id", usuario.empresa_id)
      .eq("fijada", true);
  }

  const { error } = await supabase.from("publicaciones").update({ fijada: fijar }).eq("id", id);
  if (error) return { exito: false, error: `No se pudo destacar: ${error.message}` };

  revalidatePath("/inicio");
  return {
    exito: true,
    mensaje: fijar ? "Queda fijada arriba de todo." : "Ya no está fijada.",
  };
}
