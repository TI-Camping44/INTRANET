import type { ResumenDeVentas } from "@/lib/ventas";

/**
 * Le pide al informe de ventas el resumen por vendedor.
 *
 * Corre SOLO EN EL SERVIDOR. El navegador de la persona nunca habla con
 * el informe: si lo hiciera, cualquiera podría abrir esa dirección y ver
 * las ventas de todos. Acá se pide todo y después la pantalla entrega
 * solamente la fila de quien está mirando.
 */

/**
 * Cuánto se espera al informe antes de darlo por perdido.
 *
 * Misma regla que el correo: nada que dependa de un servicio externo
 * puede demorar la respuesta que ve la persona. Si el informe no
 * contesta en seis segundos, la pantalla lo dice y sigue viva.
 */
const ESPERA_MAXIMA_MS = 6_000;

/**
 * Cada cuánto se vuelve a preguntar.
 *
 * Quince minutos. Las ventas no cambian de un segundo al otro y el
 * informe tarda en responder; preguntarle en cada carga de pantalla lo
 * castigaría sin que nadie note la diferencia. La pantalla dice de cuándo
 * es el dato, así nadie lo confunde con tiempo real.
 */
const FRESCURA_SEGUNDOS = 900;

export type FalloDeVentas = "sin_configurar" | "sin_respuesta" | "respuesta_invalida";

export type LecturaDeVentas =
  | { ok: true; resumen: ResumenDeVentas }
  | { ok: false; motivo: FalloDeVentas; detalle?: string };

export function ventasConfiguradas(): boolean {
  return Boolean(process.env.URL_INFORME_VENTAS);
}

export async function leerResumenDeVentas(): Promise<LecturaDeVentas> {
  const base = process.env.URL_INFORME_VENTAS;
  if (!base) return { ok: false, motivo: "sin_configurar" };

  // La clave viaja en la petición y vive en Vercel. La dirección del
  // informe queda publicada —Apps Script no ofrece otra cosa— así que sin
  // esto alcanzaría con tener el enlace para ver las ventas de todos.
  const clave = process.env.CLAVE_INFORME_VENTAS;
  const direccion = new URL(base);
  if (clave) direccion.searchParams.set("clave", clave);

  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), ESPERA_MAXIMA_MS);

  try {
    const respuesta = await fetch(direccion, {
      signal: corte.signal,
      next: { revalidate: FRESCURA_SEGUNDOS },
    });

    if (!respuesta.ok) {
      return { ok: false, motivo: "sin_respuesta", detalle: `HTTP ${respuesta.status}` };
    }

    const cuerpo = (await respuesta.json()) as Partial<ResumenDeVentas>;

    // Se comprueba la forma antes de confiar. Un Apps Script que falla
    // suele devolver una página de error con código 200: sin esto, la
    // pantalla mostraría cero ventas como si fuera un dato real, que es
    // peor que mostrar un error.
    if (!Array.isArray(cuerpo.filas) || typeof cuerpo.mesEnCurso !== "number") {
      return { ok: false, motivo: "respuesta_invalida" };
    }

    return {
      ok: true,
      resumen: {
        actualizado: cuerpo.actualizado ?? new Date().toISOString(),
        mesEnCurso: cuerpo.mesEnCurso,
        anioEnCurso: cuerpo.anioEnCurso ?? new Date().getFullYear(),
        filas: cuerpo.filas,
      },
    };
  } catch (error) {
    return {
      ok: false,
      motivo: "sin_respuesta",
      detalle: error instanceof Error ? error.message : undefined,
    };
  } finally {
    clearTimeout(reloj);
  }
}
