/**
 * El resumen de ventas, cacheado.
 *
 * Este archivo hace UNA cosa: envolver el armado del resumen en la cache
 * de Next. El armado vive en `resumen-ventas.ts`, que no depende de Next y
 * por eso se puede ejecutar y comprobar aparte.
 *
 * SE CACHEA EL RESULTADO, NO EL CSV. La hoja `DATA` tiene una fila por
 * linea de factura de todo el año: son varios megas, y la cache de datos
 * de Next descarta lo que pasa de 2 MB. Si se cacheara el `fetch`, el
 * `revalidate` no haria nada y cada carga de pantalla bajaria y parsearia
 * el año entero de nuevo. El resumen ya sumado son unas pocas decenas de
 * filas y entra sin problema.
 */

import { unstable_cache } from "next/cache";

import {
  calcularResumen,
  FalloDeLectura,
  ventasConfiguradas,
  type FalloDeVentas,
} from "@/lib/resumen-ventas";
import type { ResumenDeVentas } from "@/lib/ventas";

export { ventasConfiguradas };
export type { FalloDeVentas };

/**
 * Cada cuanto se vuelve a preguntar.
 *
 * Quince minutos. Las facturas no entran de segundo a segundo y la hoja se
 * actualiza a mano desde el menu del informe; preguntar en cada carga de
 * pantalla no cambiaria ningun numero. La pantalla dice de cuando es el
 * dato, asi nadie lo confunde con tiempo real.
 */
const FRESCURA_SEGUNDOS = 900;

const CLAVE_CACHE = ["resumen-de-ventas"];

export type LecturaDeVentas =
  | { ok: true; resumen: ResumenDeVentas }
  | { ok: false; motivo: FalloDeVentas; detalle?: string };

const resumenCacheado = unstable_cache(calcularResumen, CLAVE_CACHE, {
  revalidate: FRESCURA_SEGUNDOS,
  tags: CLAVE_CACHE,
});

export async function leerResumenDeVentas(): Promise<LecturaDeVentas> {
  // Sin configurar no se consulta nada: no hay a donde preguntar.
  if (!ventasConfiguradas()) return { ok: false, motivo: "sin_configurar" };

  try {
    return { ok: true, resumen: await resumenCacheado() };
  } catch (error) {
    if (error instanceof FalloDeLectura) return { ok: false, motivo: error.motivo };
    return {
      ok: false,
      motivo: "sin_respuesta",
      detalle: error instanceof Error ? error.message : undefined,
    };
  }
}
