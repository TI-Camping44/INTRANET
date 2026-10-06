import type { EstadoProveedor } from "@/lib/tipos";

/**
 * Reglas de evaluacion de proveedores, acordadas con Calidad.
 *
 * Viven aca y no en el archivo de acciones porque un modulo "use server"
 * solo puede exportar funciones asincronas, y porque estas reglas las
 * consumen tanto el servidor como los componentes de cliente.
 */

/**
 * Los cuatro criterios del formulario F-SOP-08-01 "Evaluación de
 * Asociados de Negocio y Proveedores", cada uno de 1 a 5.
 */
export const CRITERIOS_EVALUACION = [
  { campo: "calidad", etiqueta: "Calidad" },
  { campo: "logistica", etiqueta: "Logística" },
  { campo: "legal", etiqueta: "Legal" },
  { campo: "servicio", etiqueta: "Servicio" },
] as const;

export type CampoCriterio = (typeof CRITERIOS_EVALUACION)[number]["campo"];

/**
 * QUE SIGNIFICA CADA PUNTO, criterio por criterio.
 *
 * Calidad las paso el 6 de octubre. Antes los cuatro criterios
 * compartian una escala generica —«3 · Aceptable»— que no decia que era
 * aceptable en cada uno: un 3 de logistica y un 3 de legal se elegian a
 * ojo y no significaban lo mismo para dos personas distintas.
 *
 * Van de 5 a 1 porque asi las paso Calidad y asi se leen: primero lo que
 * uno espera encontrar.
 */
export const ESCALAS_EVALUACION: Record<
  CampoCriterio,
  { valor: number; texto: string }[]
> = {
  calidad: [
    { valor: 5, texto: "Excelente: ninguna no conformidad." },
    {
      valor: 4,
      texto:
        "Bueno: no conformidades menores (hasta 2 %), resueltas sin afectar al cliente.",
    },
    { valor: 3, texto: "Aceptable: no conformidades menores repetidas (2 % a 5 %)." },
    { valor: 2, texto: "Deficiente: más del 5 %, o una falla que llegó al cliente." },
    {
      valor: 1,
      texto:
        "Inaceptable: falla grave (producto inseguro o falsificado, o un servicio que " +
        "hubo que rehacer entero) o una falla repetida sin corregir.",
    },
  ],
  logistica: [
    { valor: 5, texto: "98 % o más de entregas a tiempo y completas." },
    { valor: 4, texto: "95 % a 97 %." },
    { valor: 3, texto: "90 % a 94 %." },
    { valor: 2, texto: "80 % a 89 %." },
    {
      valor: 1,
      texto: "Menos de 80 %, o un incumplimiento que frenó una venta u operación clave.",
    },
  ],
  legal: [
    { valor: 5, texto: "Todo vigente, y lo entrega sin que se lo pidamos." },
    { valor: 4, texto: "Todo vigente, pero lo entrega después de un recordatorio." },
    {
      valor: 3,
      texto: "Faltó un documento menor y lo completó a tiempo, sin afectar la operación.",
    },
    { valor: 2, texto: "Un documento vencido o faltante demoró una operación." },
    {
      valor: 1,
      texto:
        "Incumplimiento grave: factura inválida, falta de habilitación o carga sin permiso.",
    },
  ],
  servicio: [
    { valor: 5, texto: "Responde en el día y resuelve los reclamos por iniciativa propia." },
    { valor: 4, texto: "Responde en 48 horas o menos y resuelve." },
    { valor: 3, texto: "Responde, pero hay que insistir, o resuelve solo una parte." },
    { valor: 2, texto: "Tarda más de 5 días o deja reclamos sin resolver." },
    { valor: 1, texto: "No responde o niega la garantía." },
  ],
};

/** Cuatro criterios de 1 a 5 escalados a una nota de 0 a 100. */
export const FACTOR_PUNTAJE = 5;

/** Cuantos criterios se promedian. */
export const CANTIDAD_DE_CRITERIOS = CRITERIOS_EVALUACION.length;

/**
 * El promedio de los cuatro criterios, de 1 a 5.
 *
 * `puntaje` guarda la suma por 5, que es el promedio por 20: un promedio
 * de 4,0 es un puntaje de 80. Se deduce uno del otro, asi que no hay dos
 * numeros que puedan contradecirse.
 */
export function promedioDeEvaluacion(puntaje: number): number {
  return puntaje / (FACTOR_PUNTAJE * CANTIDAD_DE_CRITERIOS);
}

/**
 * Resultado que corresponde al promedio obtenido. Tabla de Calidad del
 * 6 de octubre:
 *
 *   4,0 a 5,0   -> aprobado preferente
 *   3,0 a 3,9   -> aprobado
 *   2,0 a 2,9   -> condicionado
 *   menos de 2  -> no aprobado
 *
 * Se compara sobre el puntaje de 0 a 100 —80, 60, 40— porque es lo que
 * guarda la columna generada `puntaje` de `proveedor_evaluaciones`: asi
 * la banda se calcula sobre el mismo numero que esta escrito, sin
 * redondeos en el medio.
 *
 * «Condicionado» y «No aprobado» son los valores `condicional` y
 * `rechazado` de siempre: lo que cambio es como se llaman en pantalla.
 */
export function resultadoSugerido(puntaje: number): EstadoProveedor {
  if (puntaje >= 80) return "aprobado_preferente";
  if (puntaje >= 60) return "aprobado";
  if (puntaje >= 40) return "condicional";
  return "rechazado";
}

/** Que corresponde hacer con cada resultado, segun la tabla de Calidad. */
export const ACCION_POR_RESULTADO: Record<string, string> = {
  aprobado_preferente: "Ninguna.",
  aprobado: "Seguimiento normal.",
  condicional: "Plan de mejora y nueva evaluación en 3 meses.",
  rechazado: "Se deja de comprar.",
  en_evaluacion: "Sin evaluar todavía.",
  inactivo: "Fuera del padrón activo.",
};

/**
 * Cada cuantos meses se reevalua segun el resultado.
 *
 * Un condicionado se reevalua a los 3 meses, que es lo que dice la tabla
 * de Calidad, y no segun la periodicidad del Asociado de Negocio: la
 * periodicidad es el ritmo normal, y un condicionado no esta en ritmo
 * normal. `null` quiere decir «como siempre».
 */
export const MESES_HASTA_REEVALUAR: Record<string, number | null> = {
  aprobado_preferente: null,
  aprobado: null,
  condicional: 3,
  rechazado: null,
};
