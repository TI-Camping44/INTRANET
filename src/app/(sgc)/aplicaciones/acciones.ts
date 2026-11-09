"use server";

import { revalidatePath } from "next/cache";
import { requerirModuloEditable } from "@/lib/sesion";
import { esDepartamento } from "@/lib/constantes";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import {
  esDireccionSegura,
  esPublicoDeAplicacion,
  esTipoDeAplicacion,
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
  tipo: string;
  roles: RolUsuario[];
  personas: string[];
  empresa: string | null;
  departamento: string | null;
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

  // QUE ES LA APLICACION, que es una pregunta distinta de para quien
  // es. El grupo dice de quien es —«Comercial y marketing»— y el tipo
  // dice que es —un catalogo, una herramienta—, y con eso la pantalla
  // los separa adentro del grupo. Se comprueba contra la misma lista
  // que el `CHECK` de la base.
  //
  // `orden` ya no se lee: la pantalla ordena por nombre desde el 9 de
  // noviembre y el campo salio del formulario. La columna queda con sus
  // valores, asi que guardar no se los pisa.
  const tipo = String(datos.get("tipo") ?? "").trim();
  if (!esTipoDeAplicacion(tipo)) {
    return { error: "Elija qué es la aplicación: una solicitud, un catálogo, una herramienta o un tablero." };
  }

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

  // Vacío quiere decir «es del grupo», que es el caso de casi todas. No
  // se guarda Camping 44 por omisión: marcarlas todas llenaría la
  // pantalla de etiquetas que no distinguen nada.
  const empresa = String(datos.get("empresa") ?? "").trim() || null;

  // QUE AREA RESUELVE EL PEDIDO. Vacio es un valor y quiere decir «no
  // corresponde o no se sabe»: lo llevan los catalogos y los tableros,
  // que no son pedidos de nadie. Se comprueba contra la lista de
  // departamentos porque la columna tiene su `CHECK` en la base y un
  // valor inventado volveria como error crudo de PostgreSQL.
  const departamentoCrudo = String(datos.get("departamento") ?? "").trim();
  const departamento =
    departamentoCrudo && esDepartamento(departamentoCrudo) ? departamentoCrudo : null;

  return { nombre, descripcion, url, publico, tipo, roles, personas, empresa, departamento };
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
    tipo: revisado.tipo,
    roles_visibles: revisado.roles,
    usuarios_visibles: revisado.personas,
    empresa_de_la_aplicacion_id: revisado.empresa,
    departamento_que_resuelve: revisado.departamento,
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
