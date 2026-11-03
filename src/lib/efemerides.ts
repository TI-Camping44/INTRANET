/**
 * Cumpleaños y aniversarios: qué se muestra y en qué orden.
 *
 * Vive acá y no en la pantalla porque son reglas sincronas que no
 * dependen de React, y porque la cuenta de «cuántos días faltan» es lo
 * único delicado del asunto.
 */

export interface Efemeride {
  id: string;
  nombre_completo: string;
  url_avatar: string | null;
  puesto: string | null;
  motivo: string;
  mes: number;
  dia: number;
  anos: number | null;
}

export interface EfemerideProxima extends Efemeride {
  /** Cuántos días faltan. 0 es hoy. */
  faltan: number;
}

/**
 * La ventana que se mira hacia adelante.
 *
 * SON 30 DIAS CORRIDOS Y NO «LO QUE QUEDA DEL MES», que es como estaba
 * hasta el 3 de noviembre. Con el mes como techo la tarjeta se vaciaba
 * sola: el 28 decía «no quedan cumpleaños en noviembre» aunque alguien
 * cumpliera el 2 de diciembre. Una ventana corrida nunca se queda sin
 * nadie por un cambio de hoja del calendario.
 */
export const DIAS_DE_ANTICIPACION = 30;

/** Cuántas caben en la franja antes de que deje de leerse de un vistazo. */
export const MAXIMO_EN_LA_FRANJA = 8;

/**
 * Días desde `hoy` hasta la próxima vez que caiga ese día y ese mes.
 *
 * `hoy` llega como `AAAA-MM-DD` de `hoyEnAsuncion()`, y la cuenta se
 * hace en UTC a propósito: las dos fechas se arman igual, así que la
 * resta es exacta y no la corre el huso ni el horario de verano.
 *
 * SI YA PASO ESTE AÑO, CUENTA CONTRA EL QUE VIENE. Sin eso, en
 * diciembre un cumpleaños del 3 de enero daría negativo y quedaría
 * afuera, que es el mismo error del techo de mes pero a fin de año.
 *
 * El 29 de febrero en un año que no es bisiesto cae al 1 de marzo, que
 * es lo que hace `Date.UTC` y es la convención habitual.
 */
export function diasHasta(hoy: string, mes: number, dia: number): number {
  const anio = Number(hoy.slice(0, 4));
  const base = Date.UTC(anio, Number(hoy.slice(5, 7)) - 1, Number(hoy.slice(8, 10)));

  let objetivo = Date.UTC(anio, mes - 1, dia);
  if (objetivo < base) objetivo = Date.UTC(anio + 1, mes - 1, dia);

  return Math.round((objetivo - base) / 86_400_000);
}

/**
 * Las que vienen, ordenadas de la más cercana a la más lejana.
 *
 * NO SE MIRA HACIA ATRAS, y es deliberado: un cumpleaños de hace dos
 * semanas ya no sirve para saludar. El piso es hoy; lo que se corrigió
 * es el techo.
 */
export function proximasEfemerides(
  efemerides: Efemeride[],
  hoy: string,
  dias: number = DIAS_DE_ANTICIPACION,
): EfemerideProxima[] {
  return efemerides
    .map((efemeride) => ({
      ...efemeride,
      faltan: diasHasta(hoy, efemeride.mes, efemeride.dia),
    }))
    .filter((efemeride) => efemeride.faltan <= dias)
    .sort((a, b) => a.faltan - b.faltan || a.nombre_completo.localeCompare(b.nombre_completo, "es"));
}

/**
 * Cuándo es, dicho como lo diría una persona.
 *
 * «Hoy» y «mañana» en palabras: un «en 0 días» obliga a traducir
 * mentalmente justo en la fila que pide hacer algo.
 */
export function cuandoEs(faltan: number): string {
  if (faltan === 0) return "hoy";
  if (faltan === 1) return "mañana";
  return `en ${faltan} días`;
}

/** Qué se festeja, en una línea. */
export function motivoEnPalabras(efemeride: Efemeride): string {
  if (efemeride.motivo === "cumpleanos") return "Cumple años";
  if (efemeride.anos === null) return "Aniversario en la empresa";
  return `${efemeride.anos} año${efemeride.anos === 1 ? "" : "s"} en la empresa`;
}
