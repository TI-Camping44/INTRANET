/**
 * Armado del resumen de ventas a partir de la planilla del informe.
 *
 * Aca vive todo lo que se puede equivocar: bajar las dos hojas, unir cada
 * vendedor con su objetivo y decidir que mes esta en curso. NO IMPORTA
 * NADA DE NEXT a proposito, para que se pueda ejecutar y comprobar fuera
 * del servidor; la cache queda del otro lado, en `ventas-servidor.ts`.
 */

import {
  acumularVentas,
  analizarCsv,
  canalDominante,
  leerConfiguracion,
  mismoVendedor,
  type ConfiguracionPlanilla,
  type ObjetivosDelMes,
} from "@/lib/planilla-ventas";
import type { ResumenDeVentas, VentaDelMes } from "@/lib/ventas";

/**
 * Cuanto se espera a Google antes de darlo por perdido.
 *
 * VEINTE SEGUNDOS, Y ESTA MEDIDO, no estimado: la hoja `DATA` son 5,5 MB
 * y 15.594 lineas, y Google tarda 13 segundos en generar su CSV; `CONFIG`
 * tarda 14. Con el tope anterior de 8 segundos la pantalla cortaba
 * siempre y decia «no respondio», que era verdad y no servia para nada.
 *
 * ES UN PARCHE Y SE NOTA. Veinte segundos de espera contradicen la regla
 * del proyecto: nada que dependa de un servicio externo debe demorar la
 * respuesta que ve la persona. Lo que corresponde es que un trabajo
 * programado lea las hojas y deje el resumen guardado, y que la pantalla
 * lea eso. Mientras tanto, el resultado queda en cache un cuarto de hora,
 * asi que la espera la paga como mucho una persona cada quince minutos.
 */
const ESPERA_MAXIMA_MS = 20_000;

export type FalloDeVentas = "sin_configurar" | "sin_respuesta" | "respuesta_invalida";

/**
 * Un fallo de lectura, como excepcion.
 *
 * Es a proposito que sea una excepcion y no un valor devuelto: lo que
 * lanza NO queda en la cache de `ventas-servidor.ts`. Si se devolviera
 * `{ ok: false }`, la cache lo guardaria y una caida momentanea de Google
 * dejaria la pantalla en error el cuarto de hora siguiente, aunque la hoja
 * ya estuviera respondiendo bien.
 */
export class FalloDeLectura extends Error {
  constructor(readonly motivo: FalloDeVentas) {
    super(motivo);
    this.name = "FalloDeLectura";
  }
}

export function ventasConfiguradas(): boolean {
  return Boolean(process.env.URL_PLANILLA_VENTAS_DATA && process.env.URL_PLANILLA_VENTAS_CONFIG);
}

/** Baja una hoja publicada como CSV. */
async function bajarHoja(direccion: string): Promise<string[][] | null> {
  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), ESPERA_MAXIMA_MS);

  try {
    const respuesta = await fetch(direccion, { signal: corte.signal, cache: "no-store" });
    if (!respuesta.ok) return null;

    const texto = await respuesta.text();

    // Google contesta 200 con una pagina de error cuando la hoja dejo de
    // estar publicada. Sin esto se leeria HTML como si fuera un CSV y la
    // pantalla mostraria cero ventas, que es peor que mostrar un error.
    if (texto.trimStart().startsWith("<")) return null;

    return analizarCsv(texto);
  } catch {
    return null;
  } finally {
    clearTimeout(reloj);
  }
}


export async function calcularResumen(): Promise<ResumenDeVentas> {
  const urlData = process.env.URL_PLANILLA_VENTAS_DATA;
  const urlConfig = process.env.URL_PLANILLA_VENTAS_CONFIG;
  if (!urlData || !urlConfig) throw new FalloDeLectura("sin_configurar");

  // Las dos en paralelo: son independientes y de a una se sumarian las
  // dos esperas.
  const [filasData, filasConfig] = await Promise.all([bajarHoja(urlData), bajarHoja(urlConfig)]);

  if (!filasData || !filasConfig) throw new FalloDeLectura("sin_respuesta");

  const configuracion = leerConfiguracion(filasConfig);
  const acumulado = acumularVentas(filasData);

  if (!acumulado) throw new FalloDeLectura("respuesta_invalida");

  // El mes en curso NO se deduce del calendario: sale de la «Fecha Actual
  // (Corte)» de la hoja. Si Comercial todavia no movio el corte, el
  // comercial tiene que ver el mes cerrado y no el nuevo vacio.
  const ahora = new Date();
  const mesEnCurso = configuracion.corte?.mes ?? ahora.getMonth() + 1;
  const anioEnCurso = configuracion.corte?.anio ?? ahora.getFullYear();

  const filas: VentaDelMes[] = acumulado.map((registro) => {
    const objetivos = objetivosDelMes(configuracion, registro.mes, mesEnCurso);
    return {
      mes: registro.mes,
      anio: registro.anio,
      cod: registro.vendedor,
      vendedor: registro.vendedor,
      canal:
        configuracion.canalPorVendedor[registro.vendedor] ??
        canalDominante(registro.porCanal) ??
        "",
      meta: metaDelVendedor(objetivos, registro.vendedor),
      venta: registro.venta,
      devoluciones: registro.devoluciones,
    };
  });

  return {
    actualizado: ahora.toISOString(),
    mesEnCurso,
    anioEnCurso,
    diasMes: configuracion.diasMes,
    diasTranscurridos: configuracion.diasTranscurridos,
    filas,
  };
}

/**
 * Los objetivos que corresponden a un mes.
 *
 * El mes de corte usa los de `CONFIG`, que es lo que Comercial esta
 * cargando ahora. Un mes cerrado solo tiene objetivo si el informe lo
 * archivo; si no, queda sin meta y la pantalla lo dice. Reusar el
 * objetivo de este mes para meses viejos daria un porcentaje que parece
 * bueno y es falso.
 */
function objetivosDelMes(
  configuracion: ConfiguracionPlanilla,
  mes: number,
  mesEnCurso: number,
): ObjetivosDelMes | null {
  if (mes === mesEnCurso) return configuracion.objetivos;
  return configuracion.historico[String(mes)] ?? null;
}

/**
 * La meta de una persona.
 *
 * Se busca primero por el nombre limpio y despues tolerando que en
 * `CONFIG` figure con mas o menos nombres que en `DATA`.
 */
function metaDelVendedor(objetivos: ObjetivosDelMes | null, vendedor: string): number | null {
  if (!objetivos) return null;

  const directa = objetivos.porVendedor[vendedor];
  if (directa !== undefined) return directa;

  // Se busca con `mismoVendedor` y no con una comparacion propia para que
  // haya un solo criterio de union en todo el proyecto. Se recorre a mano
  // porque hace falta quedarse con la meta, no con un booleano.
  const entrada = Object.entries(objetivos.porVendedor).find(([nombre]) =>
    mismoVendedor(nombre, vendedor),
  );
  return entrada ? entrada[1] : null;
}
