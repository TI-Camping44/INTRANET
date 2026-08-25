import { redirect } from "next/navigation";
import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ROLES_GESTION } from "@/lib/constantes";
import type { RolUsuario, Usuario } from "@/lib/tipos";

/**
 * Perfil de la persona conectada. Se memoriza por peticion para no
 * repetir la consulta en cada componente de servidor que lo necesite.
 */
export const obtenerUsuarioActual = cache(async (): Promise<Usuario | null> => {
  const supabase = crearClienteServidor();

  const {
    data: { user: cuenta },
  } = await supabase.auth.getUser();

  if (!cuenta) return null;

  const { data: perfil } = await supabase
    .from("usuarios")
    .select(
      "id, empresa_id, correo, nombre_completo, rol, puesto_id, proceso_id, superior_id, telefono, url_avatar, activo, ultimo_ingreso",
    )
    .eq("id", cuenta.id)
    .maybeSingle();

  return (perfil as Usuario | null) ?? null;
});

/** Igual que la anterior, pero redirige si no hay sesion valida. */
export async function requerirUsuario(): Promise<Usuario> {
  const usuario = await obtenerUsuarioActual();

  if (!usuario) redirect("/ingresar");
  if (!usuario.activo) redirect("/sin-acceso?motivo=inactivo");

  return usuario;
}

/** Corta el paso si el rol no esta entre los admitidos. */
export async function requerirRol(roles: RolUsuario[]): Promise<Usuario> {
  const usuario = await requerirUsuario();

  if (!roles.includes(usuario.rol)) {
    redirect("/sin-acceso?motivo=permisos");
  }

  return usuario;
}

export function puedeGestionar(usuario: Usuario | null): boolean {
  return !!usuario && ROLES_GESTION.includes(usuario.rol);
}

export function esAdministrador(usuario: Usuario | null): boolean {
  return usuario?.rol === "administrador_sgc";
}

export function esSoloLectura(usuario: Usuario | null): boolean {
  return usuario?.rol === "direccion";
}

/** Gestiona el programa de auditorias: Calidad y los auditores internos. */
export function puedeGestionarAuditorias(usuario: Usuario | null): boolean {
  return usuario?.rol === "administrador_sgc" || usuario?.rol === "auditor";
}
