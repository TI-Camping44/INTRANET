import { DIAS_LIMITE_CIERRE_NC } from "@/lib/constantes";
import { diasEntre, hoyEnAsuncion } from "@/lib/formato";
import type { EstadoNoConformidad } from "@/lib/tipos";

/**
 * La línea de estados de la no conformidad, como la definió Calidad.
 *
 * Son cuatro pasos y no los tres del enumerado: el cierre se parte en
 * «en plazo» y «fuera de plazo». Esa distinción no vive en `estado`
 * —sigue siendo 'cerrada'— sino en la columna `cierre_en_plazo`, así que
 * el paso en el que está la desviación se calcula de las dos cosas.
 *
 * Los dos primeros son automáticos: se abre al registrarla y pasa a
 * proceso cuando se le carga la primera acción correctiva. Los dos
 * cierres los elige una persona; el sistema sugiere cuál corresponde,
 * pero no decide.
 */
export type PasoNoConformidad =
  | "abierto"
  | "en_proceso"
  | "cerrado_en_plazo"
  | "cerrado_fuera_de_plazo";

export const PASOS_NO_CONFORMIDAD: PasoNoConformidad[] = [
  "abierto",
  "en_proceso",
  "cerrado_en_plazo",
  "cerrado_fuera_de_plazo",
];

export const ETIQUETAS_PASO_NC: Record<PasoNoConformidad, string> = {
  abierto: "Abierto",
  en_proceso: "En proceso",
  cerrado_en_plazo: "Cerrado en plazo",
  cerrado_fuera_de_plazo: "Cerrado fuera de plazo",
};

/**
 * El color de cada paso, con los que pidió Calidad.
 *
 * Salen de las variables del tema y no de un color fijo, así funcionan
 * igual en claro y en oscuro. El gris del cierre fuera de plazo es a
 * propósito el color apagado del sistema: no es un error —la desviación
 * se cerró— pero tampoco es un logro.
 */
export const CLASES_PASO_NC: Record<PasoNoConformidad, string> = {
  abierto: "bg-semaforo-critico text-white",
  en_proceso: "bg-semaforo-alto text-white",
  cerrado_en_plazo: "bg-semaforo-bajo text-white",
  cerrado_fuera_de_plazo: "bg-atenuado-contraste text-fondo",
};

/** El mismo color, en texto, para cuando el fondo tiene que quedar limpio. */
export const CLASES_TEXTO_PASO_NC: Record<PasoNoConformidad, string> = {
  abierto: "text-semaforo-critico",
  en_proceso: "text-semaforo-alto",
  cerrado_en_plazo: "text-semaforo-bajo",
  cerrado_fuera_de_plazo: "text-atenuado-contraste",
};

/** En qué paso está la desviación, a partir de lo que hay en la base. */
export function pasoDeNoConformidad(
  estado: EstadoNoConformidad,
  cierreEnPlazo: boolean | null,
): PasoNoConformidad {
  if (estado === "cerrada") {
    // Un cierre viejo sin clasificar se muestra como fuera de plazo
    // antes que inventarle un cumplimiento que nadie verificó.
    return cierreEnPlazo === true ? "cerrado_en_plazo" : "cerrado_fuera_de_plazo";
  }
  if (estado === "abierta") return "abierto";
  return "en_proceso";
}

export function estaCerrada(estado: EstadoNoConformidad): boolean {
  return estado === "cerrada";
}

/**
 * Qué cierre corresponde según las fechas.
 *
 * Se compara la fecha de la primera acción correctiva contra la de
 * detección: si llegó dentro de los cinco días corridos, el cierre es en
 * plazo. Es una sugerencia; la elección final la hace quien cierra, que
 * puede saber algo que el sistema no.
 */
export function cierreSugerido(
  fechaDeteccion: string,
  fechaPrimeraAccion: string | null,
): { enPlazo: boolean; dias: number } | null {
  if (!fechaPrimeraAccion) return null;
  const dias = diasEntre(fechaDeteccion, fechaPrimeraAccion);
  return { enPlazo: dias <= DIAS_LIMITE_CIERRE_NC, dias };
}

function plural(cantidad: number): string {
  return cantidad === 1 ? "día" : "días";
}

/**
 * El texto del indicador de plazo, en días corridos.
 *
 * Corridos quiere decir corridos: incluye fines de semana y feriados. Es
 * lo que pidió Calidad y es lo que ya hace el plazo de cierre en la base
 * —`fecha_deteccion + 5`—, así que las dos cuentas dan lo mismo.
 *
 * Mientras está abierta el contador corre; cuando se cierra deja de
 * correr y pasa a decir cuánto tardó, que es el dato que después se
 * mira. El día cero se dice con palabras: «hace 0 días» se lee como un
 * error de cálculo.
 */
export function textoDePlazo(
  fechaDeteccion: string,
  fechaCierre: string | null,
  cerrada: boolean,
): string {
  if (cerrada) {
    if (!fechaCierre) return "Cerrado";
    const dias = diasEntre(fechaDeteccion, fechaCierre);
    if (dias === 0) return "Cerrado el mismo día";
    return `Cerrado en ${dias} ${plural(dias)}`;
  }

  const transcurridos = diasEntre(fechaDeteccion, hoyEnAsuncion());

  if (transcurridos <= DIAS_LIMITE_CIERRE_NC) {
    if (transcurridos === 0) return "Abierto hoy";
    return `Abierto desde hace ${transcurridos} ${plural(transcurridos)}`;
  }

  const vencidos = transcurridos - DIAS_LIMITE_CIERRE_NC;
  return `Vencido desde hace ${vencidos} ${plural(vencidos)}`;
}

/** Si el plazo ya se pasó, para pintar el indicador. */
export function estaVencida(
  fechaDeteccion: string,
  cerrada: boolean,
): boolean {
  if (cerrada) return false;
  return diasEntre(fechaDeteccion, hoyEnAsuncion()) > DIAS_LIMITE_CIERRE_NC;
}

/**
 * El color de cada paso para los gráficos, como variable del tema.
 *
 * Son los cuatro que pidió Calidad: rojo, naranja, verde y gris. El
 * naranja es el ámbar del semáforo y no el naranja fuerte: contra el
 * rojo de «Abierto», el naranja fuerte queda a una diferencia que el ojo
 * normal casi no distingue, y son justo los dos estados que más se
 * comparan. El ámbar los separa sin dejar de ser naranja.
 *
 * El gris del cierre fuera de plazo es deliberadamente apagado: la
 * desviación se cerró, así que no es un error, pero tampoco es un logro.
 *
 * Van como `hsl(var(...))` para que el gráfico cambie solo entre el modo
 * claro y el oscuro, igual que el resto de la interfaz.
 */
export const COLOR_PASO_NC: Record<PasoNoConformidad, string> = {
  abierto: "hsl(var(--semaforo-critico))",
  en_proceso: "hsl(var(--semaforo-medio))",
  cerrado_en_plazo: "hsl(var(--semaforo-bajo))",
  cerrado_fuera_de_plazo: "hsl(var(--atenuado-contraste))",
};

/**
 * Traduce el paso elegido en el filtro a una condición sobre la base.
 *
 * Los cuatro pasos que se ven no son cuatro valores de `estado`: los dos
 * cierres comparten el valor 'cerrada' y se distinguen por
 * `cierre_en_plazo`. Esto es lo único que sabe traducir una cosa en la
 * otra, para que el listado y los gráficos filtren igual.
 */
export function condicionDePaso(
  paso: string | undefined,
): { estado: EstadoNoConformidad; enPlazo?: boolean } | null {
  switch (paso) {
    case "abierto":
      return { estado: "abierta" };
    case "en_proceso":
      return { estado: "en_tratamiento" };
    case "cerrado_en_plazo":
      return { estado: "cerrada", enPlazo: true };
    case "cerrado_fuera_de_plazo":
      return { estado: "cerrada", enPlazo: false };
    default:
      return null;
  }
}
