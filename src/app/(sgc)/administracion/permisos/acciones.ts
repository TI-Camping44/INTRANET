"use server";

import { revalidatePath } from "next/cache";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import {
  CLAVES_MODULO,
  esClaveDeModulo,
  rolConPisoCompleto,
  type ClaveModulo,
} from "@/lib/permisos";
import { ETIQUETAS_ROL } from "@/lib/constantes";
import type { ResultadoAccion, RolUsuario } from "@/lib/tipos";

/**
 * Guarda la matriz de un rol.
 *
 * Se guarda el rol entero y no casilla por casilla: así la pantalla
 * manda un estado completo y no hay forma de que queden a medias el
 * «ver» y el «editar» de un mismo módulo.
 */
export async function guardarPermisosDelRol(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirRol(["administrador_sgc"]);
  const supabase = crearClienteServidor();

  const rol = String(datos.get("rol") ?? "") as RolUsuario;
  if (!rol || !(rol in ETIQUETAS_ROL)) {
    return { exito: false, error: "No se reconoce el rol que se intenta guardar." };
  }

  // EL ADMINISTRADOR SGC NO SE GUARDA. Su piso está en `puede_ver()` y
  // `puede_editar()` de la base, que cortan antes de mirar la tabla.
  // Dejar que se escriba su fila daría la impresión de que se le puede
  // quitar algo, y no se puede: la base la ignora.
  if (rolConPisoCompleto(rol)) {
    return {
      exito: false,
      error:
        "El Administrador SGC conserva todos los módulos por diseño. " +
        "Es lo que garantiza que siempre haya alguien que pueda entrar a corregir esta pantalla.",
    };
  }

  const marcados = new Set(
    datos
      .getAll("permiso")
      .map((valor) => String(valor))
      .filter((valor) => valor.length > 0),
  );

  const filas = CLAVES_MODULO.map((modulo: ClaveModulo) => {
    const ver = marcados.has(`${modulo}:ver`);
    // Editar sin ver no significa nada: la pantalla a la que se entraría
    // está cerrada. La base lo rechaza con un CHECK; acá se corrige
    // antes, para no devolver un error por algo que se puede resolver.
    const editar = ver && marcados.has(`${modulo}:editar`);
    return { rol, modulo, ver, editar, empresa_id: usuario.empresa_id };
  });

  // Se escribe de una, con `upsert` sobre el índice único de la tabla:
  // si fueran veintiún llamadas sueltas, una que fallara dejaría la
  // matriz a mitad de camino y nadie sabría en cuál.
  const { error } = await supabase
    .from("permisos")
    .upsert(filas, { onConflict: "empresa_id,rol,modulo" });

  if (error) {
    console.error("guardarPermisosDelRol:", error.message);
    return {
      exito: false,
      error: "No se pudieron guardar los permisos. Vuelva a intentar en unos segundos.",
    };
  }

  // El menú de cada persona sale de esta tabla, así que cambia para
  // todos: se revalida la raíz y no una pantalla.
  revalidatePath("/", "layout");

  return {
    exito: true,
    mensaje: `Permisos de ${ETIQUETAS_ROL[rol]} guardados.`,
  };
}

/** Lo que hay guardado para un rol, para dibujar la pantalla. */
export async function leerPermisosDelRol(
  rol: RolUsuario,
): Promise<Record<string, { ver: boolean; editar: boolean }>> {
  await requerirRol(["administrador_sgc"]);
  const supabase = crearClienteServidor();

  const { data } = await supabase
    .from("permisos")
    .select("modulo, ver, editar")
    .eq("rol", rol);

  const matriz: Record<string, { ver: boolean; editar: boolean }> = {};
  for (const fila of (data ?? []) as { modulo: string; ver: boolean; editar: boolean }[]) {
    if (esClaveDeModulo(fila.modulo)) {
      matriz[fila.modulo] = { ver: fila.ver, editar: fila.editar };
    }
  }

  return matriz;
}
