import { redirect } from "next/navigation";
import { cache } from "react";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ROLES_GESTION } from "@/lib/constantes";
import {
  esClaveDeModulo,
  permisosDelAdministrador,
  permisosVacios,
  rolConPisoCompleto,
  type ClaveModulo,
  type PermisosDelRol,
} from "@/lib/permisos";
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
      "id, empresa_id, correo, nombre_completo, nombres, apellidos, fecha_nacimiento, " +
        "rol, puesto_id, proceso_id, superior_id, telefono, url_avatar, activo, ultimo_ingreso",
    )
    .eq("id", cuenta.id)
    .maybeSingle();

  return (perfil as Usuario | null) ?? null;
});

/**
 * El perfil esta completo cuando tiene nombres, apellidos y fecha de
 * nacimiento.
 *
 * Los tres se piden en el primer ingreso. Google devuelve un
 * `nombre_completo` en una sola pieza y no devuelve el cumpleaños, asi
 * que sin este paso el legajo nace incompleto y los cumpleaños del mes
 * de la portada quedan vacios para siempre: nadie vuelve a entrar a un
 * perfil que ya anda.
 */
export function perfilCompleto(usuario: Usuario | null): boolean {
  return Boolean(
    usuario?.nombres?.trim() && usuario?.apellidos?.trim() && usuario?.fecha_nacimiento,
  );
}

/**
 * Igual que la anterior, pero redirige si no hay sesion valida.
 *
 * Y MANDA A COMPLETAR EL PERFIL si falta. Es la unica pantalla que
 * queda accesible con el perfil incompleto, ademas de la propia de
 * completarlo y la de salir: lo pidio Direccion el 5 de octubre para que
 * «Personas sin Puesto» y los cumpleaños se alimenten solos.
 */
export async function requerirUsuario(): Promise<Usuario> {
  const usuario = await obtenerUsuarioActual();

  if (!usuario) redirect("/ingresar");
  if (!usuario.activo) redirect("/sin-acceso?motivo=inactivo");
  if (!perfilCompleto(usuario)) redirect("/completar-perfil");

  return usuario;
}

/**
 * Como `requerirUsuario`, pero sin exigir el perfil completo.
 *
 * La usa la pantalla de completarlo: si usara la otra, se mandaria a si
 * misma en un bucle.
 */
export async function requerirUsuarioSinPerfil(): Promise<Usuario> {
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

/**
 * Quien puede mover el organigrama: Calidad y Dirección.
 *
 * ES LA ÚNICA ESCRITURA DE DIRECCIÓN EN TODO EL SISTEMA. El rol es de
 * solo lectura en los demás módulos y sigue siéndolo; esta es la
 * excepción, y es deliberada: la línea de reporte la conoce Dirección,
 * no Calidad, y el dato que trae Odoo no siempre es el real.
 *
 * El permiso de verdad está en `mover_en_organigrama()`, que es
 * `SECURITY DEFINER` y vuelve a comprobarlo. Esto solo decide si la
 * pantalla deja arrastrar: ocultar un botón no es un control de acceso.
 */
export function puedeEditarElOrganigrama(usuario: Usuario | null): boolean {
  return usuario?.rol === "administrador_sgc" || usuario?.rol === "direccion";
}

/** Gestiona el programa de auditorias: Calidad y los auditores internos. */
export function puedeGestionarAuditorias(usuario: Usuario | null): boolean {
  return usuario?.rol === "administrador_sgc" || usuario?.rol === "auditor";
}

/**
 * Lo que ve y edita el rol de la persona conectada, módulo por módulo.
 *
 * Se memoriza por petición: lo consultan el menú del layout y cada
 * pantalla que se protege, y sin esto sería la misma consulta repetida
 * media docena de veces por carga.
 *
 * EL ADMINISTRADOR SGC NO CONSULTA LA TABLA. Su piso está en
 * `puede_ver()` y `puede_editar()` de la base, y acá se refleja igual:
 * una matriz mal cargada no puede dejar al sistema sin nadie capaz de
 * entrar a arreglarla.
 *
 * Si la consulta falla, se devuelve la matriz vacía. Cierra de más en
 * vez de abrir de más, que es como tiene que fallar un permiso.
 */
export const obtenerPermisos = cache(async (): Promise<PermisosDelRol> => {
  const usuario = await obtenerUsuarioActual();
  if (!usuario) return permisosVacios();
  if (rolConPisoCompleto(usuario.rol)) return permisosDelAdministrador();

  const supabase = crearClienteServidor();
  const { data, error } = await supabase
    .from("permisos")
    .select("modulo, ver, editar")
    .eq("rol", usuario.rol);

  if (error) {
    console.error("permisos:", error.message);
    return permisosVacios();
  }

  const matriz = permisosVacios();
  for (const fila of (data ?? []) as { modulo: string; ver: boolean; editar: boolean }[]) {
    if (esClaveDeModulo(fila.modulo)) {
      matriz[fila.modulo] = { ver: fila.ver, editar: fila.editar };
    }
  }

  return matriz;
});

/**
 * Corta el paso si el módulo no está habilitado para el rol.
 *
 * Es el equivalente de `requerirRol` para los módulos que no tienen
 * tabla propia —el panel de calidad, Aplicaciones, el directorio—, que
 * son los únicos donde RLS no puede decidir sola porque leen datos de
 * otros módulos o de ninguno.
 *
 * En los demás, esto solo evita una pantalla vacía: quien entre igual
 * escribiendo la dirección se va a encontrar con que la base no le
 * devuelve nada, que es donde está el control de verdad.
 */
export async function requerirModulo(modulo: ClaveModulo): Promise<Usuario> {
  const usuario = await requerirUsuario();
  const permisos = await obtenerPermisos();

  if (!permisos[modulo].ver) {
    redirect("/sin-acceso?motivo=permisos");
  }

  return usuario;
}

/** Como la anterior, pero exige poder editar el módulo. */
export async function requerirModuloEditable(modulo: ClaveModulo): Promise<Usuario> {
  const usuario = await requerirUsuario();
  const permisos = await obtenerPermisos();

  if (!permisos[modulo].editar) {
    redirect("/sin-acceso?motivo=permisos");
  }

  return usuario;
}
