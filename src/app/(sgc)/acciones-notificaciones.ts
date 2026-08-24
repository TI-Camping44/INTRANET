"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { requerirUsuario } from "@/lib/sesion";
import type { ResultadoAccion } from "@/lib/tipos";

/** Marca una notificacion como leida. */
export async function marcarNotificacionLeida(id: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("notificaciones")
    .update({ leida: true, leida_en: new Date().toISOString() })
    .eq("id", id)
    .eq("usuario_id", usuario.id);

  if (error) return { exito: false, error: "No se pudo marcar la notificación como leída." };

  revalidatePath("/", "layout");
  return { exito: true };
}

/** Marca como leidas todas las notificaciones pendientes. */
export async function marcarTodasLeidas(): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("notificaciones")
    .update({ leida: true, leida_en: new Date().toISOString() })
    .eq("usuario_id", usuario.id)
    .eq("leida", false);

  if (error) return { exito: false, error: "No se pudieron marcar las notificaciones." };

  revalidatePath("/", "layout");
  return { exito: true, mensaje: "Notificaciones marcadas como leídas." };
}
