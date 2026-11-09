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

import type { Departamento } from "@/lib/tipos";

/** Una fila de `aplicaciones`. */
export interface Aplicacion {
  id: string;
  nombre: string;
  descripcion: string;
  url: string;
  publico: PublicoAplicacion;
  /** Qué ES la aplicación. El grupo dice de quién es; esto, qué es. */
  tipo: TipoAplicacion;
  /**
   * YA NO SE USA PARA MOSTRAR. La pantalla ordena por nombre desde el 9
   * de noviembre, y el campo salió del formulario: los números habían
   * quedado sin sentido —`comercial` arrancaba en 7, `general` en 12—
   * porque son restos de cuando era una sola lista. La columna queda por
   * si alguna vez hace falta fijar una arriba.
   */
  orden: number;
  /**
   * Qué área resuelve el pedido. Solo las solicitudes lo llevan.
   *
   * NULO ES UN VALOR: quiere decir «no corresponde o no se sabe». Lo
   * tienen los catálogos y los tableros, que no son pedidos de nadie, y
   * dos solicitudes que no se pueden mapear sin inventar —«Comercial»
   * no es ninguno de los catorce departamentos y de «Compra Interna» no
   * está confirmado quién la resuelve—.
   */
  departamento_que_resuelve: Departamento | null;
  /**
   * A qué roles se les muestra la tarjeta.
   *
   * Vacío quiere decir que no la ve nadie más que quien administra la
   * lista: así se oculta una aplicación sin perder su dirección. El
   * Administrador SGC las ve todas, por la política de lectura.
   */
  roles_visibles: RolUsuario[];
  /**
   * Personas que la ven además de los roles.
   *
   * SE SUMAN, no se cruzan: la tarjeta le llega a quien tenga uno de los
   * roles marcados **o** a quien esté nombrado acá. Con los roles vacíos
   * y una sola persona, «la ve solo él» es literal.
   *
   * Hizo falta el 13 de octubre, con el primer pedido de un tablero
   * propio: los permisos del sistema son por rol, y el rol de quien lo
   * pidió lo comparte otra persona de Dirección, así que lo más cerrado
   * que se podía era «lo ve Dirección» —dos personas en vez de una—.
   */
  usuarios_visibles: string[];
  /**
   * De qué empresa del grupo es la aplicación.
   *
   * NULO ES UN VALOR: quiere decir que es del grupo y no de una empresa
   * en particular, que es el caso de casi todas —los tickets, los
   * catálogos, el panel de NPS—. Marcarlas todas llenaría la pantalla de
   * etiquetas que no distinguen nada.
   *
   * No se confunde con `empresa_id`, que es el inquilino de RLS y
   * siempre vale Camping 44.
   */
  empresa_de_la_aplicacion_id: string | null;
}

// Cómo se distingue a Vitalica vive en `lib/empresas.ts`, que lo usan
// las nueve pantallas que declaran empresa. Acá no se repite.
export type { EmpresaDelGrupo } from "@/lib/empresas";

/** Una persona que puede ser nombrada en una aplicación. */
export interface PersonaDeAplicacion {
  id: string;
  nombre_completo: string;
  rol: RolUsuario;
}

/**
 * Qué es cada aplicación, que es una pregunta distinta de para quién es.
 *
 * `solicitud` se completa y se manda a un área; `catalogo` se consulta;
 * `herramienta` se opera y se escribe en ella; `tablero` se mira.
 *
 * LA CLASIFICACIÓN SALE DE LA DESCRIPCIÓN Y NO DEL NOMBRE: «Objetivos
 * Mensuales · Comercial» se llama como un tablero y es una herramienta
 * —«para cargar las metas del mes»—, y el «Canal de denuncias» no es
 * algo que se mira sino un formulario que se completa.
 */
export type TipoAplicacion = "solicitud" | "catalogo" | "herramienta" | "tablero";

export const ETIQUETAS_TIPO_APLICACION: Record<TipoAplicacion, string> = {
  solicitud: "Solicitudes y pedidos",
  catalogo: "Catálogos",
  herramienta: "Herramientas",
  tablero: "Tableros e informes",
};

/** En qué orden se muestran los tipos dentro de un grupo. */
export const ORDEN_TIPO: TipoAplicacion[] = [
  "solicitud",
  "catalogo",
  "herramienta",
  "tablero",
];

/** Los mismos valores que el `CHECK` de `aplicaciones.tipo`. */
export function esTipoDeAplicacion(valor: string): valor is TipoAplicacion {
  return (ORDEN_TIPO as string[]).includes(valor);
}

/**
 * A partir de cuántas tarjetas el subtítulo por tipo aporta algo.
 *
 * Con dos tarjetas la lista se escanea de un vistazo y dos subtítulos
 * encima de una tarjeta cada uno son más ruido que orden. Pasa hoy en
 * «Para toda la empresa», que tiene el Canal de denuncias y el Panel de
 * NPS: dos cosas, dos tipos.
 */
export const MINIMO_PARA_SUBTITULAR = 3;

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
 * Compara dos nombres como los leería una persona.
 *
 * `sensitivity: "base"` ignora tildes y mayúsculas, que es lo que hace
 * que «Catálogo de Salón» quede antes que «Catálogo Mayorista» y no
 * después por una M mayúscula.
 */
function porNombre(uno: Aplicacion, otro: Aplicacion): number {
  return uno.nombre.localeCompare(otro.nombre, "es", { sensitivity: "base" });
}

/** Un tramo de un grupo: las aplicaciones de un mismo tipo. */
export interface TramoDeAplicaciones {
  tipo: TipoAplicacion;
  aplicaciones: Aplicacion[];
}

export interface GrupoDeAplicaciones {
  publico: PublicoAplicacion;
  /** Todas las del grupo, ya ordenadas, para cuando no se subtitula. */
  aplicaciones: Aplicacion[];
  /** Los tramos por tipo, en el orden de `ORDEN_TIPO`. */
  tramos: TramoDeAplicaciones[];
  /**
   * Si corresponde dibujar los subtítulos por tipo.
   *
   * SOLO CUANDO EL GRUPO MEZCLA TIPOS Y TIENE TARJETAS SUFICIENTES. Un
   * grupo de un solo tipo subtitulado se leería «Solicitudes y pedidos»
   * dentro de «Solicitudes y pedidos», que es decir dos veces lo mismo;
   * y con dos tarjetas de dos tipos los subtítulos ocupan más que lo que
   * ordenan.
   */
  subtitular: boolean;
}

/**
 * Las aplicaciones agrupadas por público y, dentro, por tipo.
 *
 * EL GRUPO SIGUE SIENDO EL ÁREA porque es como la gente busca: «lo
 * mío». El tipo entra como segundo nivel y solo donde hace falta.
 *
 * Todo va en orden alfabético: el `orden` numérico dejó de usarse el 9
 * de noviembre porque sus valores eran restos de cuando la lista era
 * una sola y nadie podía explicar por qué una tarjeta iba antes que
 * otra.
 *
 * Los grupos sin aplicaciones no se dibujan: una etiqueta sola, sin nada
 * abajo, se lee como un error de carga.
 */
export function agruparAplicaciones(aplicaciones: Aplicacion[]): GrupoDeAplicaciones[] {
  return ORDEN_PUBLICO.map((publico) => {
    const delGrupo = aplicaciones.filter((a) => a.publico === publico).sort(porNombre);

    const tramos = ORDEN_TIPO.map((tipo) => ({
      tipo,
      aplicaciones: delGrupo.filter((a) => a.tipo === tipo),
    })).filter((tramo) => tramo.aplicaciones.length > 0);

    return {
      publico,
      aplicaciones: delGrupo,
      tramos,
      subtitular: tramos.length > 1 && delGrupo.length >= MINIMO_PARA_SUBTITULAR,
    };
  }).filter((grupo) => grupo.aplicaciones.length > 0);
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
  return aplicacion.roles_visibles.length === 0 && aplicacion.usuarios_visibles.length === 0;
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
