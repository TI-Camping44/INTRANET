import { diasEntre, hoyEnAsuncion } from "@/lib/formato";
import type { EstadoAccion } from "@/lib/tipos";

/**
 * Los tres estados de una acción planificada, como los pidió Calidad.
 *
 * Es el mismo criterio que el de la no conformidad, un nivel más abajo:
 * mientras nadie diga que se hizo, la acción está abierta; cuando se
 * cierra, se dice si se ejecutó en plazo o fuera de plazo.
 *
 * No hay paso automático a ejecutada. Que venza la fecha límite no
 * significa que se haya hecho ni que se haya dejado de hacer: significa
 * que venció, y eso lo dice el indicador de plazo, no el estado.
 */
export type PasoAccion = "abierta" | "ejecutada_en_plazo" | "ejecutada_fuera_de_plazo";

export const PASOS_ACCION: PasoAccion[] = [
  "abierta",
  "ejecutada_en_plazo",
  "ejecutada_fuera_de_plazo",
];

export const ETIQUETAS_PASO_ACCION: Record<PasoAccion, string> = {
  abierta: "Abierta",
  ejecutada_en_plazo: "Ejecutada en plazo",
  ejecutada_fuera_de_plazo: "Ejecutada fuera de plazo",
};

/** Los mismos colores que los estados de la no conformidad, por coherencia. */
export const CLASES_PASO_ACCION: Record<PasoAccion, string> = {
  abierta: "bg-semaforo-medio/15 text-semaforo-medio border-semaforo-medio/30",
  ejecutada_en_plazo: "bg-semaforo-bajo/15 text-semaforo-bajo border-semaforo-bajo/30",
  ejecutada_fuera_de_plazo: "bg-atenuado text-atenuado-contraste border-borde",
};

/** En qué paso está la acción, a partir de lo que hay en la base. */
export function pasoDeAccion(
  estado: EstadoAccion,
  ejecucionEnPlazo: boolean | null,
): PasoAccion {
  if (estado === "ejecutada" || estado === "verificada") {
    // Una ejecución vieja sin clasificar se muestra como fuera de plazo
    // antes que inventarle un cumplimiento que nadie verificó.
    return ejecucionEnPlazo === true ? "ejecutada_en_plazo" : "ejecutada_fuera_de_plazo";
  }
  return "abierta";
}

export function estaEjecutada(estado: EstadoAccion): boolean {
  return estado === "ejecutada" || estado === "verificada";
}

/**
 * Qué cierre corresponde según las fechas: se ejecuta hoy, y se compara
 * contra la fecha límite que se había fijado.
 */
export function ejecucionSugerida(fechaLimite: string | null): boolean {
  if (!fechaLimite) return true;
  return hoyEnAsuncion() <= fechaLimite;
}

function plural(cantidad: number): string {
  return cantidad === 1 ? "día" : "días";
}

/**
 * El indicador de plazo de una acción, en días corridos.
 *
 * Mientras está abierta cuenta desde que se cargó —«Abierto desde hace
 * X días»—, que es lo que pidió Calidad: la acción está abierta hasta
 * que alguien la cierre a mano, y lo que interesa es hace cuánto.
 *
 * Que la fecha límite ya haya pasado no cambia este texto: eso lo dice
 * la columna de fecha límite, que ya avisa «Vencida hace X días». Dos
 * lugares diciendo lo mismo con palabras distintas confunden más de lo
 * que informan.
 */
export function textoDePlazoAccion(
  creadoEn: string,
  fechaEjecucion: string | null,
  ejecutada: boolean,
): string {
  const desde = creadoEn.slice(0, 10);

  if (ejecutada) {
    if (!fechaEjecucion) return "Ejecutada";
    const dias = diasEntre(desde, fechaEjecucion);
    if (dias <= 0) return "Ejecutada el mismo día";
    return `Ejecutada en ${dias} ${plural(dias)}`;
  }

  const transcurridos = diasEntre(desde, hoyEnAsuncion());
  if (transcurridos <= 0) return "Abierta hoy";
  return `Abierta desde hace ${transcurridos} ${plural(transcurridos)}`;
}
