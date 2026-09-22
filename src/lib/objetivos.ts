import type { SentidoIndicador } from "@/lib/tipos";

/**
 * Las reglas del F-EST-01-05, «Objetivos de la calidad e indicadores».
 *
 * La hoja resume los doce meses en un resultado, lo compara contra la
 * meta y pinta un semáforo. Acá viven esas tres operaciones, en un solo
 * lugar, porque las usan la tabla y cualquier corte que se haga después.
 *
 * Si Calidad cambia un criterio, cambia acá. Y si alguna vez el cálculo
 * pasa a la base de datos, tiene que cambiar en los dos lados, como con
 * el nivel de riesgo.
 */

export type NivelObjetivo = "estrategico" | "tactico" | "operativo";

export const ETIQUETAS_NIVEL_OBJETIVO: Record<NivelObjetivo, string> = {
  estrategico: "Estratégico",
  tactico: "Táctico",
  operativo: "Operativo",
};

export const NIVELES_OBJETIVO: NivelObjetivo[] = ["estrategico", "tactico", "operativo"];

export type Consolidacion = "suma" | "promedio" | "ultimo";

export const ETIQUETAS_CONSOLIDACION: Record<Consolidacion, string> = {
  suma: "Suma",
  promedio: "Promedio",
  ultimo: "Último valor",
};

/**
 * Cómo se resume el año a partir de los períodos cargados.
 *
 * Suma para cantidades —las no conformidades del año son la suma de las
 * de cada mes—, promedio para porcentajes —el cumplimiento del año no es
 * la suma de doce porcentajes— y último valor para lo que ya se mide de
 * forma acumulada.
 *
 * Los meses sin cargar no cuentan: no valen cero. Un año con tres meses
 * cargados se consolida sobre esos tres, y la tabla muestra cuántos son.
 */
export function consolidar(valores: number[], modo: Consolidacion): number | null {
  const cargados = valores.filter((valor) => Number.isFinite(valor));
  if (cargados.length === 0) return null;

  if (modo === "suma") return cargados.reduce((total, valor) => total + valor, 0);
  if (modo === "ultimo") return cargados[cargados.length - 1];
  return cargados.reduce((total, valor) => total + valor, 0) / cargados.length;
}

/**
 * Porcentaje de cumplimiento del resultado contra la meta.
 *
 * Depende del sentido del indicador, y no es un detalle: en «menor es
 * mejor» —reclamos, días de demora, rechazos— quedar por debajo de la
 * meta es cumplir, y la división directa daría lo contrario.
 *
 * En los indicadores de rango no se calcula: no hay un número único
 * contra el cual dividir, y un porcentaje inventado ahí es peor que
 * ninguno. La tabla muestra el resultado y la meta, y decide la persona.
 */
export function porcentajeDeCumplimiento(
  resultado: number | null,
  meta: number | null,
  sentido: SentidoIndicador,
): number | null {
  if (resultado === null || meta === null || sentido === "rango") return null;

  if (sentido === "menor_mejor") {
    // Meta cero y resultado cero es cumplimiento pleno; meta cero con
    // resultado positivo es incumplimiento, no una división por cero.
    if (meta === 0) return resultado === 0 ? 100 : 0;
    return (meta / resultado) * 100;
  }

  if (meta === 0) return resultado >= 0 ? 100 : 0;
  return (resultado / meta) * 100;
}

export type Semaforo = "verde" | "amarillo" | "rojo";

/**
 * El semáforo de la hoja, con los cortes que fijó Calidad: verde desde
 * el 100 %, amarillo entre 90 y 99, rojo por debajo de 90.
 *
 * Verde solo cuando se alcanzó la meta. Un verde al 95 % convierte la
 * meta en una sugerencia.
 */
export function semaforoDeCumplimiento(porcentaje: number | null): Semaforo | null {
  if (porcentaje === null) return null;
  if (porcentaje >= 100) return "verde";
  if (porcentaje >= 90) return "amarillo";
  return "rojo";
}

export const ETIQUETAS_SEMAFORO: Record<Semaforo, string> = {
  verde: "En meta",
  amarillo: "Cerca",
  rojo: "Fuera de meta",
};

/** Clases del semáforo, con contraste suficiente en los dos temas. */
export const CLASES_SEMAFORO: Record<Semaforo, string> = {
  verde: "bg-semaforo-bajo/15 text-semaforo-bajo border-semaforo-bajo/30",
  amarillo: "bg-semaforo-medio/15 text-semaforo-medio border-semaforo-medio/30",
  rojo: "bg-semaforo-critico/15 text-semaforo-critico border-semaforo-critico/30",
};

/** Los doce meses, abreviados como en la hoja. */
export const MESES_ABREVIADOS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];
