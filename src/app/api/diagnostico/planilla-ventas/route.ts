import { NextResponse } from "next/server";

import { esAdministrador, obtenerUsuarioActual } from "@/lib/sesion";

/**
 * Por que «Mis ventas» no puede leer el informe.
 *
 * La pantalla solo puede decir «no respondio»: no le sirve de nada a la
 * persona saber si fue el tamaño, el tiempo o un enlace vencido. Esta
 * ruta lo dice, para poder arreglarlo sin adivinar.
 *
 * SOLO EL ADMINISTRADOR SGC. Se comprueba con la sesion, no con una clave
 * en la direccion: el Administrador ya esta conectado y una clave en la
 * barra del navegador termina pegada en un chat.
 *
 * NO DEVUELVE DATOS DE VENTAS. De cada hoja informa el tamaño, el tiempo
 * que tardo y la PRIMERA LINEA, que son los titulos de las columnas.
 * Ninguna factura, ningun cliente, ningun importe.
 */

export const dynamic = "force-dynamic";

/**
 * Un minuto, que es lo maximo que permite la funcion.
 *
 * La pantalla corta a los ocho segundos y no puede hacer otra cosa, pero
 * aca hace falta saber cuanto tarda DE VERDAD: si Google tarda treinta
 * segundos, cortar a los ocho y decir «no respondio» esconde justamente
 * el dato que hay que ver.
 */
export const maxDuration = 60;

const ESPERA_DIAGNOSTICO_MS = 50_000;

interface Sondeo {
  hoja: string;
  configurada: boolean;
  ok: boolean;
  estado?: number;
  tipoContenido?: string | null;
  bytes?: number;
  milisegundos?: number;
  esHtml?: boolean;
  lineas?: number;
  primeraLinea?: string;
  error?: string;
}

async function sondear(hoja: string, direccion: string | undefined): Promise<Sondeo> {
  if (!direccion) return { hoja, configurada: false, ok: false, error: "variable sin cargar" };

  const corte = new AbortController();
  const reloj = setTimeout(() => corte.abort(), ESPERA_DIAGNOSTICO_MS);
  const arranque = Date.now();

  try {
    const respuesta = await fetch(direccion, { signal: corte.signal, cache: "no-store" });
    const texto = await respuesta.text();
    const milisegundos = Date.now() - arranque;

    return {
      hoja,
      configurada: true,
      ok: respuesta.ok && !texto.trimStart().startsWith("<"),
      estado: respuesta.status,
      tipoContenido: respuesta.headers.get("content-type"),
      bytes: texto.length,
      milisegundos,
      esHtml: texto.trimStart().startsWith("<"),
      lineas: texto.split("\n").length,
      // Solo la primera linea y recortada: son los titulos de columna.
      primeraLinea: texto.split("\n")[0]?.slice(0, 300),
    };
  } catch (error) {
    return {
      hoja,
      configurada: true,
      ok: false,
      milisegundos: Date.now() - arranque,
      error: error instanceof Error ? `${error.name}: ${error.message}` : "desconocido",
    };
  } finally {
    clearTimeout(reloj);
  }
}

export async function GET() {
  const usuario = await obtenerUsuarioActual();
  if (!esAdministrador(usuario)) {
    return NextResponse.json({ error: "Solo el Administrador SGC" }, { status: 403 });
  }

  // Las dos a la vez, como las pide la pantalla.
  const [data, config] = await Promise.all([
    sondear("DATA", process.env.URL_PLANILLA_VENTAS_DATA),
    sondear("CONFIG", process.env.URL_PLANILLA_VENTAS_CONFIG),
  ]);

  return NextResponse.json({
    version: "diagnostico-planilla-1",
    esperaDeLaPantallaMs: 8_000,
    hojas: [data, config],
  });
}
