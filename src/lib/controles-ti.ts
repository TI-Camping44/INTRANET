/**
 * Reglas del cronograma de controles periódicos de TI.
 *
 * Viven acá y no en `acciones.ts` porque las usan los dos lados: la
 * pantalla dibuja el cronograma con ellas y la acción de servidor las
 * vuelve a aplicar antes de escribir. Un archivo `"use server"` solo
 * puede exportar funciones asíncronas.
 *
 * EL CRONOGRAMA SE CALCULA, NO SE GUARDA. Un control dice desde qué mes
 * arranca y cada cuántos meses toca; los períodos programados salen de
 * esas dos cosas. Así cambiar la frecuencia reprograma todo sin tener
 * que regenerar filas.
 *
 * LOS PERÍODOS SE MANEJAN COMO TEXTO «AAAA-MM-01», nunca con
 * `new Date()`: una columna `date` llega como texto y `new Date()` la
 * leería en UTC, y en Asunción el día 1 caería en el mes anterior.
 */

export const FRECUENCIAS_CONTROL = [1, 3, 6, 12] as const;
export type FrecuenciaControl = (typeof FRECUENCIAS_CONTROL)[number];

export const ETIQUETAS_FRECUENCIA: Record<FrecuenciaControl, string> = {
  1: "Mensual",
  3: "Trimestral",
  6: "Semestral",
  12: "Anual",
};

export const RESULTADOS_CONTROL = ["conforme", "con_observaciones", "no_conforme"] as const;
export type ResultadoControl = (typeof RESULTADOS_CONTROL)[number];

export const ETIQUETAS_RESULTADO_CONTROL: Record<ResultadoControl, string> = {
  conforme: "Conforme",
  con_observaciones: "Con observaciones",
  no_conforme: "No conforme",
};

/**
 * Cuántos días antes de que termine el mes se recuerda un control que
 * toca ese mes y sigue sin registro. El primer aviso sale cuando empieza
 * el mes; este es el segundo y el último antes de que venza.
 */
export const DIAS_AVISO_CIERRE_CONTROL = 7;

/** Cuánto tiene que decir la observación cuando el resultado no es conforme. */
export const LARGO_MINIMO_OBSERVACION = 10;

/**
 * Cómo está un período del cronograma.
 *
 * - `ejecutado`: tiene su registro.
 * - `vencido`: el mes ya terminó y no se registró nada.
 * - `en_curso`: es el mes actual y todavía no se registró.
 * - `programado`: es un mes que todavía no llegó.
 */
export type EstadoPeriodo = "ejecutado" | "vencido" | "en_curso" | "programado";

export const ETIQUETAS_ESTADO_PERIODO: Record<EstadoPeriodo, string> = {
  ejecutado: "Ejecutado",
  vencido: "Vencido",
  en_curso: "Toca este mes",
  programado: "Programado",
};

export const VARIANTE_ESTADO_PERIODO: Record<
  EstadoPeriodo,
  "exito" | "peligro" | "advertencia" | "neutra"
> = {
  ejecutado: "exito",
  vencido: "peligro",
  en_curso: "advertencia",
  programado: "neutra",
};

export const NOMBRES_MES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export const NOMBRES_MES_CORTO = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

export function esFrecuencia(valor: number): valor is FrecuenciaControl {
  return (FRECUENCIAS_CONTROL as readonly number[]).includes(valor);
}

export function esResultadoControl(valor: string): valor is ResultadoControl {
  return (RESULTADOS_CONTROL as readonly string[]).includes(valor);
}

/** «2026-11-17» o «2026-11» → «2026-11-01». */
export function periodoDe(fecha: string): string {
  return `${fecha.slice(0, 7)}-01`;
}

/** Cuántos meses hay de un período a otro. Negativo si el segundo es anterior. */
export function mesesEntre(desde: string, hasta: string): number {
  const anioDesde = Number(desde.slice(0, 4));
  const mesDesde = Number(desde.slice(5, 7));
  const anioHasta = Number(hasta.slice(0, 4));
  const mesHasta = Number(hasta.slice(5, 7));
  return (anioHasta - anioDesde) * 12 + (mesHasta - mesDesde);
}

/** Suma meses a un período y devuelve otro período. */
export function sumarMesesAPeriodo(periodo: string, meses: number): string {
  const total = Number(periodo.slice(0, 4)) * 12 + (Number(periodo.slice(5, 7)) - 1) + meses;
  const anio = Math.floor(total / 12);
  const mes = (total % 12) + 1;
  return `${anio}-${String(mes).padStart(2, "0")}-01`;
}

/** «2026-11-01» → «Noviembre 2026». */
export function describirPeriodo(periodo: string): string {
  return `${NOMBRES_MES[Number(periodo.slice(5, 7)) - 1]} ${periodo.slice(0, 4)}`;
}

/** Si el control toca en ese período. */
export function tocaEnPeriodo(
  control: { primer_periodo: string; frecuencia_meses: number },
  periodo: string,
): boolean {
  const distancia = mesesEntre(control.primer_periodo, periodo);
  return distancia >= 0 && distancia % control.frecuencia_meses === 0;
}

/** Los períodos programados de un año, de enero a diciembre. */
export function periodosDelAnio(
  control: { primer_periodo: string; frecuencia_meses: number },
  anio: number,
): string[] {
  const periodos: string[] = [];
  for (let mes = 1; mes <= 12; mes += 1) {
    const periodo = `${anio}-${String(mes).padStart(2, "0")}-01`;
    if (tocaEnPeriodo(control, periodo)) periodos.push(periodo);
  }
  return periodos;
}

/**
 * El estado de un período, contra el día de hoy en Asunción.
 *
 * Un mes no vence el día 1 sino al terminar: un control mensual se
 * puede hacer cualquier día del mes que le toca.
 */
export function estadoDelPeriodo(
  periodo: string,
  ejecutado: boolean,
  hoy: string,
): EstadoPeriodo {
  if (ejecutado) return "ejecutado";
  const actual = periodoDe(hoy);
  if (periodo < actual) return "vencido";
  if (periodo === actual) return "en_curso";
  return "programado";
}

/**
 * Los períodos que se pueden registrar: los que ya vencieron o están en
 * curso y todavía no tienen ejecución.
 *
 * Se mira desde el primer período del control, así un vencido de hace
 * meses sigue ofreciéndose hasta que alguien lo registre: dejarlo caer
 * de la lista sería esconder justo lo que la auditoría va a preguntar.
 */
export function periodosPendientes(
  control: { primer_periodo: string; frecuencia_meses: number },
  periodosEjecutados: Set<string>,
  hoy: string,
): string[] {
  const actual = periodoDe(hoy);
  const pendientes: string[] = [];
  let periodo = control.primer_periodo;
  while (periodo <= actual) {
    if (!periodosEjecutados.has(periodo)) pendientes.push(periodo);
    periodo = sumarMesesAPeriodo(periodo, control.frecuencia_meses);
  }
  return pendientes;
}

/** El próximo período sin ejecutar, contando el actual. Null si no hay. */
export function proximoPeriodo(
  control: { primer_periodo: string; frecuencia_meses: number },
  periodosEjecutados: Set<string>,
  hoy: string,
): string | null {
  const pendientes = periodosPendientes(control, periodosEjecutados, hoy);
  if (pendientes.length > 0) return pendientes[0];

  // Todo lo pasado está hecho: el siguiente es el primero del futuro.
  const actual = periodoDe(hoy);
  let periodo = control.primer_periodo;
  while (periodo <= actual) {
    periodo = sumarMesesAPeriodo(periodo, control.frecuencia_meses);
  }
  return periodo;
}
