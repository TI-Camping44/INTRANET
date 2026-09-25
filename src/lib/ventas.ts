/**
 * Lectura del tablero comercial.
 *
 * DE DONDE SALEN LOS DATOS. No de Odoo. El tablero comercial que la
 * empresa ya usa —«Informe de ventas», en GitHub Pages— lee dos pestañas
 * de una planilla de Google publicada en la web, y esa planilla ya trae,
 * por vendedor, la meta del mes y lo vendido. La intranet lee lo mismo.
 *
 * Es deliberado: si la intranet calculara por su cuenta a partir de Odoo,
 * tarde o temprano daría un número distinto al del tablero y nadie sabría
 * cuál creer. Un solo origen, un solo número.
 *
 * ESTE ARCHIVO NO HACE PEDIDOS DE RED. Solo interpreta el texto que le
 * pasan, así que se puede probar sin internet y lo comparten servidor y
 * cliente.
 */

/**
 * La planilla publicada, pestaña de datos.
 *
 * Sale del propio tablero comercial, que la tiene escrita en su HTML.
 * Se puede reemplazar por variable de entorno sin tocar el código: el día
 * que la planilla deje de ser pública y pase a leerse con credenciales,
 * cambia acá y nada más.
 */
export const URL_PLANILLA_VENTAS =
  process.env.URL_PLANILLA_VENTAS ??
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSp2zrO1KG9ReWEdh5COq97li6O19H-ff3L-rDLblngpBf-SZVGrAIWrthhWkFu9Wd8E9MUofy91vvf/pub?gid=171657140&single=true&output=csv";

/** Encabezado de la tabla que interesa, dentro del CSV. */
const TABLA_RESUMEN = "TABLA 1";

/**
 * Las columnas se buscan POR NOMBRE, nunca por posición.
 *
 * Si alguien agrega una columna en el medio de la planilla, buscando por
 * posición leeríamos la columna equivocada y mostraríamos plata que no es.
 * Buscando por nombre, o la encuentra o falla ruidoso.
 */

/**
 * Sin estas cinco la pantalla no tiene nada que mostrar. Si falta alguna,
 * se corta: es mejor decir «no se pudo leer» que mostrar la columna
 * equivocada.
 */
const COLUMNAS_NECESARIAS = {
  canal: "Canal",
  cod: "Cod",
  vendedor: "Vendedor",
  metaGeneral: "Meta General (GS)",
  ventaGeneral: "Venta General Alcanzada (GS)",
} as const;

/**
 * Estas son el detalle, y NO están siempre.
 *
 * Se comprobó contra los cierres de enero a junio de 2026: el bloque
 * «A&M» falta entero en febrero y en mayo-junio quedó con el encabezado
 * cortado. Exigirlas haría que la pantalla se caiga en los meses donde
 * quien arma la planilla no las incluyó, que es justamente cuando no
 * hacen falta. Lo que no venga, no se muestra.
 */
const COLUMNAS_OPCIONALES = {
  metaMarcas: "Meta Marcas Total (GS)",
  ventaMarcas: "Venta Marcas Alcanzada (GS)",
  metaAyM: "Meta A&M Total (GS)",
  ventaAyM: "Venta A&M Alcanzada (GS)",
} as const;

export interface FilaComercial {
  canal: string;
  /** Nombre completo, tal como figura en la planilla. Es la clave de unión. */
  cod: string;
  /** Nombre corto, el que se muestra. */
  vendedor: string;
  metaGeneral: number | null;
  ventaGeneral: number | null;
  metaMarcas: number | null;
  ventaMarcas: number | null;
  metaAyM: number | null;
  ventaAyM: number | null;
}

/**
 * Convierte un número de la planilla.
 *
 * Vienen en formato paraguayo —`485.000.000`, punto como separador de
 * miles— y a veces vienen vacíos o con el error de la planilla
 * (`#DIV/0!`). En esos casos devuelve `null` y NO cero: cero significa
 * «vendió cero», y vacío significa «no hay dato». Confundirlos haría que
 * un vendedor sin meta cargada aparezca como si tuviera meta cero y
 * hubiera alcanzado el infinito.
 */
export function numeroDePlanilla(texto: string | undefined): number | null {
  const limpio = (texto ?? "").trim();
  if (!limpio || limpio.startsWith("#")) return null;

  const valor = Number(limpio.replace(/\./g, "").replace(",", "."));
  return Number.isFinite(valor) ? valor : null;
}

/** Parte una línea de CSV respetando las comillas. */
function partirLinea(linea: string): string[] {
  const celdas: string[] = [];
  let actual = "";
  let entreComillas = false;

  for (let i = 0; i < linea.length; i += 1) {
    const caracter = linea[i];

    if (caracter === '"') {
      // Dos comillas seguidas adentro de un campo son una comilla literal.
      if (entreComillas && linea[i + 1] === '"') {
        actual += '"';
        i += 1;
      } else {
        entreComillas = !entreComillas;
      }
    } else if (caracter === "," && !entreComillas) {
      celdas.push(actual);
      actual = "";
    } else {
      actual += caracter;
    }
  }

  celdas.push(actual);
  return celdas.map((c) => c.trim());
}

/**
 * Saca del CSV la tabla de resumen por vendedor.
 *
 * LANZA si no encuentra la tabla o le falta una columna. Es a propósito:
 * ante una planilla que cambió de forma, la pantalla tiene que decir «no
 * se pudo leer» y no mostrar números equivocados. Un comercial tomando
 * decisiones sobre una cifra mal leída es peor que un comercial sin la
 * pantalla.
 */
export function leerResumenComercial(csv: string): FilaComercial[] {
  const lineas = csv.split(/\r?\n/);

  const inicio = lineas.findIndex((l) => l.includes(TABLA_RESUMEN));
  if (inicio === -1) {
    throw new Error(`La planilla no tiene la «${TABLA_RESUMEN}» que esta pantalla necesita.`);
  }

  const encabezados = partirLinea(lineas[inicio + 1] ?? "");

  const indice: Record<string, number> = {};

  for (const [clave, titulo] of Object.entries(COLUMNAS_NECESARIAS)) {
    const donde = encabezados.indexOf(titulo);
    if (donde === -1) {
      throw new Error(`La planilla no tiene la columna «${titulo}».`);
    }
    indice[clave] = donde;
  }

  // Las opcionales entran si están; si no, la fila las trae en `null`.
  for (const [clave, titulo] of Object.entries(COLUMNAS_OPCIONALES)) {
    const donde = encabezados.indexOf(titulo);
    if (donde !== -1) indice[clave] = donde;
  }

  const celdaDe = (celdas: string[], clave: string): string | undefined =>
    indice[clave] === undefined ? undefined : celdas[indice[clave]];

  const filas: FilaComercial[] = [];

  for (let i = inicio + 2; i < lineas.length; i += 1) {
    const linea = lineas[i];
    // La tabla termina donde empieza la siguiente, o en una linea vacia.
    if (!linea || linea.startsWith("---") || linea.replace(/,/g, "").trim() === "") break;

    const celdas = partirLinea(linea);
    const cod = celdaDe(celdas, "cod") ?? "";
    if (!cod) continue;

    filas.push({
      canal: celdaDe(celdas, "canal") ?? "",
      cod,
      vendedor: celdaDe(celdas, "vendedor") || cod,
      metaGeneral: numeroDePlanilla(celdaDe(celdas, "metaGeneral")),
      ventaGeneral: numeroDePlanilla(celdaDe(celdas, "ventaGeneral")),
      metaMarcas: numeroDePlanilla(celdaDe(celdas, "metaMarcas")),
      ventaMarcas: numeroDePlanilla(celdaDe(celdas, "ventaMarcas")),
      metaAyM: numeroDePlanilla(celdaDe(celdas, "metaAyM")),
      ventaAyM: numeroDePlanilla(celdaDe(celdas, "ventaAyM")),
    });
  }

  return filas;
}

/**
 * El alcance contra la meta, en porcentaje.
 *
 * SE CALCULA ACA Y NO SE TOMA DE LA PLANILLA. La planilla trae dos
 * columnas que se llaman igual —«% Alcance»— y se calculan distinto: la
 * general es el DESVIO `(venta - meta) / meta`, y la de marcas es el
 * ALCANCE `venta / meta`. Un vendedor que hizo el 87% de su meta lee
 * «-13%» en una columna y, con el mismo criterio, «101%» en la otra.
 *
 * Acá siempre es alcance: cuánto de la meta se cumplió. Devuelve `null`
 * cuando no hay meta cargada, y en ese caso la pantalla lo dice en vez de
 * inventar un porcentaje.
 */
export function alcance(meta: number | null, venta: number | null): number | null {
  if (meta === null || venta === null || meta <= 0) return null;
  return (venta / meta) * 100;
}

/** Cuánto falta para la meta. Negativo significa que ya se superó. */
export function faltante(meta: number | null, venta: number | null): number | null {
  if (meta === null || venta === null) return null;
  return meta - venta;
}

/**
 * Como se lee un alcance, para el semaforo.
 *
 * Los cortes los define Comercial, no este archivo; quedan acá para que
 * la pantalla no los invente en tres lugares distintos.
 */
export type NivelAlcance = "sin_meta" | "lejos" | "en_camino" | "cumplido";

export function nivelDeAlcance(porcentaje: number | null): NivelAlcance {
  if (porcentaje === null) return "sin_meta";
  if (porcentaje >= 100) return "cumplido";
  if (porcentaje >= 70) return "en_camino";
  return "lejos";
}

export const ETIQUETAS_NIVEL_ALCANCE: Record<NivelAlcance, string> = {
  sin_meta: "Sin meta cargada",
  lejos: "Lejos de la meta",
  en_camino: "En camino",
  cumplido: "Meta cumplida",
};

export const CLASES_NIVEL_ALCANCE: Record<NivelAlcance, string> = {
  sin_meta: "text-atenuado-contraste",
  lejos: "text-semaforo-critico",
  en_camino: "text-semaforo-medio",
  cumplido: "text-semaforo-bajo",
};
