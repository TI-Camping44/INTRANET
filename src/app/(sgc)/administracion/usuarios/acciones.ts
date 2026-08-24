"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { requerirRol } from "@/lib/sesion";
import type { ResultadoAccion, RolUsuario } from "@/lib/tipos";

/**
 * Administracion de usuarios. Solo el Administrador SGC puede modificar
 * rol, superior y estado: la base de datos lo refuerza con un disparador,
 * de modo que nadie pueda elevarse el rol editando su propio perfil.
 */
export async function actualizarUsuario(
  id: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const administrador = await requerirRol(["administrador_sgc"]);
  const supabase = crearClienteServidor();

  const rol = String(datos.get("rol") ?? "colaborador") as RolUsuario;
  const superiorId = String(datos.get("superior_id") ?? "") || null;

  if (superiorId === id) {
    return { exito: false, error: "Una persona no puede ser su propio superior." };
  }

  // Evita el caso simple de jerarquía circular entre dos personas.
  if (superiorId) {
    const { data: superior } = await supabase
      .from("usuarios")
      .select("superior_id")
      .eq("id", superiorId)
      .maybeSingle();

    if (superior?.superior_id === id) {
      return {
        exito: false,
        error: "La jerarquía quedaría circular: esa persona ya reporta a este usuario.",
      };
    }
  }

  if (id === administrador.id && rol !== "administrador_sgc") {
    return {
      exito: false,
      error:
        "No puede quitarse a sí mismo el rol de Administrador SGC. Pídaselo a otro administrador.",
    };
  }

  const { error } = await supabase
    .from("usuarios")
    .update({
      rol,
      superior_id: superiorId,
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      puesto_id: String(datos.get("puesto_id") ?? "") || null,
      activo: datos.get("activo") === "on",
    })
    .eq("id", id);

  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };

  revalidatePath("/administracion/usuarios");
  return { exito: true, mensaje: "Usuario actualizado." };
}

/** Edicion de los datos propios del perfil. */
export async function actualizarPerfilPropio(datos: FormData): Promise<ResultadoAccion> {
  const supabase = crearClienteServidor();

  const {
    data: { user: cuenta },
  } = await supabase.auth.getUser();

  if (!cuenta) return { exito: false, error: "No hay sesión activa." };

  const nombre = String(datos.get("nombre_completo") ?? "").trim();
  if (nombre.length < 3) {
    return { exito: false, error: "El nombre debe tener al menos 3 caracteres." };
  }

  const { error } = await supabase
    .from("usuarios")
    .update({
      nombre_completo: nombre,
      telefono: String(datos.get("telefono") ?? "").trim() || null,
    })
    .eq("id", cuenta.id);

  if (error) return { exito: false, error: `No se pudo actualizar el perfil: ${error.message}` };

  revalidatePath("/perfil");
  return { exito: true, mensaje: "Perfil actualizado." };
}
