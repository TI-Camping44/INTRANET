"use server";

import { revalidatePath } from "next/cache";
import { requerirModuloEditable } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import {
  esDireccionSegura,
  esPublicoDeAplicacion,
  LARGO_MAXIMO_DESCRIPCION_APLICACION,
  LARGO_MAXIMO_NOMBRE_APLICACION,
  ROLES_DE_APLICACION,
} from "@/lib/aplicaciones";
import type { ResultadoAccion, RolUsuario } from "@/lib/tipos";

/**
 * Las escrituras de la lista de aplicaciones.
 *
 * El permiso sale del mismo lugar que todo lo demás: «editar» del módulo
 * `aplicaciones` en la matriz de permisos. Se comprueba acá para poder
 * devolver un mensaje en español, y lo vuelve a comprobar la política de
 * la base, que es la que manda.
 */

function revisarCampos(datos: FormData): { error: string } | {
  nombre: string;
  descripcion: string;
  url: string;
  publico: string;
  orden: number;
  roles: RolUsuario[];
  personas: string[];
} {
  const nombre = String(datos.get("nombre") ?? "").trim();
  const descripcion = String(datos.get("descripcion") ?? "").trim();
  const url = String(datos.get("url") ?? "").trim();
  const publico = String(datos.get("publico") ?? "").trim();

  if (!nombre) return { error: "Escriba el nombre de la aplicación." };
  if (nombre.length > LARGO_MAXIMO_NOMBRE_APLICACION) {
    return {
      error: `El nombre no puede pasar de ${LARGO_MAXIMO_NOMBRE_APLICACION} caracteres.`,
    };
  }

  if (!descripcion) {
    return { error: "Escriba para qué sirve: es lo que se lee abajo del nombre." };
  }
  if (descripcion.length > LARGO_MAXIMO_DESCRIPCION_APLICACION) {
    return {
      error:
        `La descripción no puede pasar de ${LARGO_MAXIMO_DESCRIPCION_APLICACION} ` +
        "caracteres. Es una línea de contexto, no un instructivo.",
    };
  }

  // LA DIRECCIÓN TIENE QUE SER HTTPS. No es formalidad: la tarjeta es un
  // enlace que la pantalla dibuja tal cual, y una dirección que no sea
  // https la abriría el resto de la empresa desde su propia sesión.
  if (!esDireccionSegura(url)) {
    return {
      error: "La dirección tiene que empezar con https:// y ser la del sitio al que lleva.",
    };
  }

  if (!esPublicoDeAplicacion(publico)) {
    return { error: "Elija en qué grupo se muestra la aplicación." };
  }

  const crudo = Number(datos.get("orden") ?? 0);
  const orden = Number.isFinite(crudo) ? Math.trunc(crudo) : 0;

  const marcados = new Set(datos.getAll("rol").map((valor) => String(valor)));
  const roles = ROLES_DE_APLICACION.filter((rol) => marcados.has(rol));

  // Las personas se nombran ADEMÁS de los roles, no en vez de ellos: la
  // tarjeta le llega a quien tenga uno de esos roles o a quien esté
  // nombrado. Se quitan los repetidos porque el formulario podría
  // mandar el mismo id dos veces y el arreglo de la base no lo impide.
  const personas = Array.from(
    new Set(
      datos
        .getAll("persona")
        .map((valor) => String(valor).trim())
        .filter(Boolean),
    ),
  );

  return { nombre, descripcion, url, publico, orden, roles, personas };
}

/**
 * Crea una aplicación o actualiza la que se está editando.
 *
 * Un solo camino para los dos casos: con dos formularios, el de edición
 * termina pidiendo menos campos que el alta y guardar le borra a la fila
 * lo que no le preguntó.
 */
export async function guardarAplicacion(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirModuloEditable("aplicaciones");
  const supabase = crearClienteServidor();

  const revisado = revisarCampos(datos);
  if ("error" in revisado) return { exito: false, error: revisado.error };

  const id = String(datos.get("id") ?? "").trim();

  // LAS PERSONAS SE COMPRUEBAN CONTRA `usuarios`. La columna es un
  // arreglo y PostgreSQL no admite clave foránea sobre un arreglo, así
  // que el control vive acá: un id que no existe no rompe nada, pero
  // guardarlo sería guardar basura que nadie va a poder explicar.
  if (revisado.personas.length > 0) {
    const { data: existen } = await supabase
      .from("usuarios")
      .select("id")
      .in("id", revisado.personas);

    if ((existen?.length ?? 0) !== revisado.personas.length) {
      return {
        exito: false,
        error:
          "Alguna de las personas elegidas ya no existe. Vuelva a abrir la pantalla y elíjalas de nuevo.",
      };
    }
  }

  const fila = {
    nombre: revisado.nombre,
    descripcion: revisado.descripcion,
    url: revisado.url,
    publico: revisado.publico,
    orden: revisado.orden,
    roles_visibles: revisado.roles,
    usuarios_visibles: revisado.personas,
  };

  const { error } = id
    ? await supabase.from("aplicaciones").update(fila).eq("id", id)
    : await supabase
        .from("aplicaciones")
        .insert({ ...fila, empresa_id: usuario.empresa_id, creado_por: usuario.id });

  if (error) {
    // El índice único es por nombre: dos tarjetas con el mismo nombre
    // son un error de carga, y el mensaje crudo de PostgreSQL no se lo
    // explica a nadie.
    if (error.code === "23505") {
      return { exito: false, error: "Ya hay una aplicación con ese nombre." };
    }
    console.error("guardarAplicacion:", error.message);
    return { exito: false, error: "No se pudo guardar la aplicación. Intente de nuevo." };
  }

  revalidatePath("/aplicaciones");
  revalidatePath("/aplicaciones/administrar");
  return { exito: true, mensaje: id ? "Aplicación actualizada." : "Aplicación agregada." };
}

/**
 * Saca la aplicación de la lista.
 *
 * Borrar es el camino largo: para retirar una tarjeta de la pantalla sin
 * perder su dirección alcanza con destildar los cinco roles. Eso se dice
 * en la pantalla, y el disparador de bitácora guarda qué había en la
 * fila por si alguien borra lo que no era.
 */
export async function eliminarAplicacion(datos: FormData): Promise<ResultadoAccion> {
  await requerirModuloEditable("aplicaciones");
  const supabase = crearClienteServidor();

  const id = String(datos.get("id") ?? "").trim();
  if (!id) return { exito: false, error: "No se indicó qué aplicación eliminar." };

  const { error } = await supabase.from("aplicaciones").delete().eq("id", id);
  if (error) {
    console.error("eliminarAplicacion:", error.message);
    return { exito: false, error: "No se pudo eliminar la aplicación. Intente de nuevo." };
  }

  revalidatePath("/aplicaciones");
  revalidatePath("/aplicaciones/administrar");
  return { exito: true, mensaje: "Aplicación eliminada." };
}
