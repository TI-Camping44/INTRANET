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


// ---------------------------------------------------------------------
// Plan de accion para el logro de los objetivos (hoja 6.2.2)
// ---------------------------------------------------------------------

export type EstadoPlan = "pendiente" | "en_curso" | "cumplido" | "no_cumplido" | "cancelado";

export const ESTADOS_PLAN: EstadoPlan[] = [
  "pendiente",
  "en_curso",
  "cumplido",
  "no_cumplido",
  "cancelado",
];

export const ETIQUETAS_ESTADO_PLAN: Record<EstadoPlan, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  cumplido: "Cumplido",
  no_cumplido: "No cumplido",
  cancelado: "Cancelado",
};

/**
 * Colores del estado del plan.
 *
 * No es un semaforo de desempeño: es el recorrido de la accion.
 * «No cumplido» va en rojo porque es el unico que significa que algo
 * quedo sin hacer; «cumplido» en verde; los demas en neutro.
 *
 * LA MISMA LISTA ESTA EN EL `CHECK` de `objetivo_planes.estado`. Si
 * cambia, cambia en los dos lados.
 */
export const CLASES_ESTADO_PLAN: Record<EstadoPlan, string> = {
  pendiente: "border-borde text-atenuado-contraste",
  en_curso: "border-semaforo-medio/40 bg-semaforo-medio/10 text-semaforo-medio",
  cumplido: "border-semaforo-bajo/40 bg-semaforo-bajo/10 text-semaforo-bajo",
  no_cumplido: "border-semaforo-critico/40 bg-semaforo-critico/10 text-semaforo-critico",
  cancelado: "border-borde text-atenuado-contraste",
};

export function esEstadoDePlan(valor: string): valor is EstadoPlan {
  return (ESTADOS_PLAN as string[]).includes(valor);
}

// ---------------------------------------------------------------------
// EL OBJETIVO SEGUN DIRECCION, 8 de octubre.
//
// Lo de arriba es el F-EST-01-05: codigo, año, meta escrita a mano y un
// porcentaje de avance. Sigue vivo porque la hoja del plan lo usa.
//
// Lo de aca abajo es lo que Direccion pidio declarar al crear un
// objetivo: que se mide, en que periodo, con que frecuencia, contra que
// resultado esperado y con que recursos.
//
// LAS REGLAS VIVEN EN LOS DOS LADOS, como pide el proyecto: aca y en las
// restricciones CHECK de `objetivos`. Si cambian, cambian en ambos.
// ---------------------------------------------------------------------

/** Cómo se declara el resultado del objetivo. */
export type TipoResultadoObjetivo = "si_no" | "texto" | "numerico";

export const TIPOS_RESULTADO: TipoResultadoObjetivo[] = ["si_no", "texto", "numerico"];

export const ETIQUETAS_TIPO_RESULTADO: Record<TipoResultadoObjetivo, string> = {
  si_no: "Sí / No",
  texto: "Texto",
  numerico: "Valor numérico",
};

/** Qué significa cada tipo, para que no se elija a ojo. */
export const AYUDA_TIPO_RESULTADO: Record<TipoResultadoObjetivo, string> = {
  si_no: "Se cumple o no se cumple. Hay que declarar cuál es el resultado esperado.",
  texto: "El resultado se describe con palabras. Útil cuando no hay un número que lo resuma.",
  numerico: "Se mide con un número, entre un mínimo y un máximo esperables.",
};

export type FrecuenciaMedicion = "semanal" | "mensual" | "trimestral" | "semestral" | "anual";

export const FRECUENCIAS_MEDICION: FrecuenciaMedicion[] = [
  "semanal",
  "mensual",
  "trimestral",
  "semestral",
  "anual",
];

export const ETIQUETAS_FRECUENCIA_MEDICION: Record<FrecuenciaMedicion, string> = {
  semanal: "Semanal",
  mensual: "Mensual",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

/**
 * El ciclo del objetivo, en cuatro estados.
 *
 * Van en orden: se identifica, se agenda, se mide y se cierra. Cerrar
 * exige declarar si se alcanzó o no —lo controla el `CHECK`
 * `objetivos_cierre_declarado`—, porque un objetivo cerrado sin
 * resultado no dice nada.
 */
export type EstadoObjetivo = "identificado" | "a_medir" | "en_medicion" | "cerrado";

export const ESTADOS_OBJETIVO: EstadoObjetivo[] = [
  "identificado",
  "a_medir",
  "en_medicion",
  "cerrado",
];

export const ETIQUETAS_ESTADO_OBJETIVO: Record<EstadoObjetivo, string> = {
  identificado: "Identificado",
  a_medir: "A medir próximamente",
  en_medicion: "En medición",
  cerrado: "Cerrado",
};

export const VARIANTE_ESTADO_OBJETIVO: Record<EstadoObjetivo, string> = {
  identificado: "neutra",
  a_medir: "atencion",
  en_medicion: "primaria",
  cerrado: "exito",
};

/**
 * El resultado esperado, dicho en una línea.
 *
 * Se arma al leer y no se guarda: es la misma información que ya está en
 * las columnas del tipo, y guardarla duplicada seria tener dos versiones
 * de la misma verdad.
 */
export function resultadoEsperado(objetivo: {
  tipo_resultado: string | null;
  resultado_esperado_si_no: boolean | null;
  resultado_esperado_texto: string | null;
  valor_minimo: number | string | null;
  valor_maximo: number | string | null;
  unidad_valor: string | null;
}): string {
  if (objetivo.tipo_resultado === "si_no") {
    if (objetivo.resultado_esperado_si_no === null) return "Sin declarar";
    return objetivo.resultado_esperado_si_no ? "Sí" : "No";
  }

  if (objetivo.tipo_resultado === "texto") {
    return objetivo.resultado_esperado_texto?.trim() || "Sin declarar";
  }

  if (objetivo.tipo_resultado === "numerico") {
    const unidad = objetivo.unidad_valor?.trim() ? ` ${objetivo.unidad_valor.trim()}` : "";
    const minimo = objetivo.valor_minimo;
    const maximo = objetivo.valor_maximo;

    if (minimo === null && maximo === null) return "Sin declarar";
    if (minimo !== null && maximo !== null) return `Entre ${minimo} y ${maximo}${unidad}`;
    if (minimo !== null) return `Desde ${minimo}${unidad}`;
    return `Hasta ${maximo}${unidad}`;
  }

  return "Sin declarar";
}
