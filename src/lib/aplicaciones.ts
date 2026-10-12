import type { RolUsuario } from "@/lib/tipos";

/**
 * Las aplicaciones que Camping 44 ya tiene publicadas.
 *
 * Catálogos, tableros, informes y formularios de pedido que hasta ahora
 * había que conocer de memoria o tener en los marcadores. La intranet no
 * los reemplaza ni los copia: los reúne y les pone nombre, que es lo que
 * faltaba.
 *
 * LA LISTA VIVE EN LA BASE, no acá. Estuvo escrita en este archivo hasta
 * el 12 de octubre, y el propio archivo decía cuándo tenía que dejar de
 * estarlo: «cuando se vuelvan muchas o las tenga que cambiar alguien que
 * no toca código, pasa a una tabla». Las dos cosas pasaron a la vez,
 * cuando hizo falta decidir qué rol ve cada una: esa decisión no puede
 * exigir un cambio de código y un despliegue.
 *
 * Acá quedan los grupos y las reglas, que sí son del código: son el
 * vocabulario con el que la tabla se ordena.
 *
 * Las solicitudes se enlazan y no se absorben. Se evaluó traerlas adentro
 * —las seis comparten motor y el modelo se traducía bien a la base— y se
 * decidió que no: funcionan, están en uso y reemplazarlas era mucho
 * trabajo para no cambiar nada que la gente note.
 */

/** A quién le sirve, para que la lista se pueda agrupar. */
export type PublicoAplicacion =
  | "solicitudes"
  | "general"
  | "comercial"
  | "operaciones"
  | "tecnologia"
  | "direccion";

/** Una fila de `aplicaciones`. */
export interface Aplicacion {
  id: string;
  nombre: string;
  descripcion: string;
  url: string;
  publico: PublicoAplicacion;
  orden: number;
  /**
   * A qué roles se les muestra la tarjeta.
   *
   * Vacío quiere decir que no la ve nadie más que quien administra la
   * lista: así se oculta una aplicación sin perder su dirección. El
   * Administrador SGC las ve todas, por la política de lectura.
   */
  roles_visibles: RolUsuario[];
}

export const ETIQUETAS_PUBLICO: Record<PublicoAplicacion, string> = {
  solicitudes: "Solicitudes y pedidos",
  general: "Para toda la empresa",
  comercial: "Comercial y marketing",
  operaciones: "Operaciones",
  tecnologia: "Tecnología",
  direccion: "Dirección",
};

/**
 * El orden en que se muestran los grupos.
 *
 * Las solicitudes van primero: son lo que cualquiera de los 49 abre en el
 * día a día. Los tableros los mira mucha menos gente y mucho menos
 * seguido.
 */
export const ORDEN_PUBLICO: PublicoAplicacion[] = [
  "solicitudes",
  "general",
  "comercial",
  "operaciones",
  "tecnologia",
  "direccion",
];

/** Los mismos valores que el `CHECK` de `aplicaciones.publico`. */
export function esPublicoDeAplicacion(valor: string): valor is PublicoAplicacion {
  return (ORDEN_PUBLICO as string[]).includes(valor);
}

/**
 * LA DIRECCIÓN TIENE QUE SER HTTPS, y es un control y no una formalidad:
 * la tarjeta es un enlace que la pantalla dibuja tal cual, así que sin
 * esto quien administre la lista podría pegar un `javascript:` y el
 * resto lo abriría desde su propia sesión. La base lo repite en un
 * `CHECK`; esto es para poder explicarlo en español antes de escribir.
 */
export function esDireccionSegura(url: string): boolean {
  return /^https:\/\/[^\s]+$/i.test(url.trim()) && url.trim().length <= 2048;
}

export const LARGO_MAXIMO_NOMBRE_APLICACION = 80;
export const LARGO_MAXIMO_DESCRIPCION_APLICACION = 300;

/**
 * Las aplicaciones agrupadas por público, en el orden de presentación.
 *
 * Los grupos sin aplicaciones no se dibujan: una etiqueta sola, sin nada
 * abajo, se lee como un error de carga.
 */
export function agruparAplicaciones(
  aplicaciones: Aplicacion[],
): { publico: PublicoAplicacion; aplicaciones: Aplicacion[] }[] {
  return ORDEN_PUBLICO.map((publico) => ({
    publico,
    aplicaciones: aplicaciones
      .filter((a) => a.publico === publico)
      .sort((a, b) => a.orden - b.orden || a.nombre.localeCompare(b.nombre, "es")),
  })).filter((grupo) => grupo.aplicaciones.length > 0);
}

/**
 * Si la aplicación no la ve ningún rol.
 *
 * Es un estado legítimo y no un error: así se retira una tarjeta de la
 * pantalla sin perder su dirección, que es la única parte difícil de
 * recuperar. Quien administra la lista la sigue viendo —si no, no
 * podría volver a habilitarla— y la pantalla se la marca.
 */
export function estaOculta(aplicacion: Aplicacion): boolean {
  return aplicacion.roles_visibles.length === 0;
}

/**
 * Los roles que se configuran, en el mismo orden que la matriz de
 * permisos.
 *
 * El Administrador SGC no está: las ve todas por la política de
 * lectura, igual que el piso de `puede_ver()`. Ofrecer su casilla daría
 * a entender que se le puede ocultar algo, y no se puede.
 */
export const ROLES_DE_APLICACION: RolUsuario[] = [
  "direccion",
  "responsable_proceso",
  "auditor",
  "vendedor",
  "colaborador",
];
