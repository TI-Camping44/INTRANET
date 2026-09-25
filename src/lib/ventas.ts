/**
 * El avance de cada comercial contra su objetivo del mes.
 *
 * DE DONDE SALE EL NUMERO. No de Odoo, y no de un calculo propio. El
 * informe de ventas que la empresa ya usa tiene un Apps Script que arma
 * el resumen por vendedor —meta y venta, por mes y por canal— aplicando
 * reglas de negocio que no son triviales: anticipos, ventas completas,
 * pendientes del cliente. Ese script expone ese mismo resumen y la
 * intranet lo consume tal cual.
 *
 * Es deliberado. Si la intranet replicara esas reglas, el dia que se
 * cambie una en el informe los dos numeros se separarian y nadie sabria
 * cual creer. Un solo lugar donde se calcula, un solo numero.
 *
 * ESTE ARCHIVO NO HACE PEDIDOS DE RED. Define el contrato y las cuentas
 * que la pantalla necesita; el pedido lo hace `ventas-servidor.ts`.
 */

/** Una fila del resumen: un vendedor, en un mes. */
export interface VentaDelMes {
  /** 1 a 12. */
  mes: number;
  anio: number;
  /** Como figura el vendedor en el informe. Es la clave de union. */
  cod: string;
  /** Nombre corto, el que se muestra. */
  vendedor: string;
  canal: string;
  /** En guaraníes. `null` cuando no hay meta cargada, que no es lo mismo que cero. */
  meta: number | null;
  venta: number | null;
}

/** Lo que devuelve el informe de ventas cuando se le pide el resumen. */
export interface ResumenDeVentas {
  /** Cuando se calculo, para que la pantalla pueda decir de cuando es el dato. */
  actualizado: string;
  /**
   * El mes que el informe considera en curso.
   *
   * NO se deduce del calendario: sale de la «Fecha Actual (Corte)» que
   * define quien mantiene el informe. Si el corte todavia esta en agosto,
   * el comercial tiene que ver agosto, no septiembre vacio.
   */
  mesEnCurso: number;
  anioEnCurso: number;
  filas: VentaDelMes[];
}

export const MESES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
] as const;

export function nombreDeMes(mes: number): string {
  return MESES[mes - 1] ?? String(mes);
}

/**
 * El alcance contra la meta, en porcentaje.
 *
 * SE CALCULA ACA Y NO SE TOMA DEL INFORME. El informe trae dos columnas
 * que se llaman igual —«% Alcance»— y se calculan distinto: la general es
 * el DESVIO `(venta - meta) / meta`, y la de marcas es el ALCANCE
 * `venta / meta`. Se comprobo contra los cierres de enero a junio de
 * 2026: un vendedor que hizo el 87% de su meta lee «-13%».
 *
 * Aca siempre es alcance: cuanto de la meta se cumplio. Devuelve `null`
 * cuando no hay meta cargada, y la pantalla lo dice en vez de inventar un
 * porcentaje.
 */
export function alcance(meta: number | null, venta: number | null): number | null {
  if (meta === null || venta === null || meta <= 0) return null;
  return (venta / meta) * 100;
}

/** Cuanto falta para la meta. Negativo significa que ya se supero. */
export function faltante(meta: number | null, venta: number | null): number | null {
  if (meta === null || venta === null || meta <= 0) return null;
  return meta - venta;
}

/**
 * Como se lee un alcance.
 *
 * Los cortes son una decision de Comercial, no de este archivo; viven aca
 * para que la pantalla no los repita en tres lugares.
 */
export type NivelAlcance = "sin_meta" | "lejos" | "en_camino" | "cumplido";

export function nivelDeAlcance(porcentaje: number | null): NivelAlcance {
  if (porcentaje === null) return "sin_meta";
  if (porcentaje >= 100) return "cumplido";
  if (porcentaje >= 70) return "en_camino";
  return "lejos";
}

export const ETIQUETAS_NIVEL_ALCANCE: Record<NivelAlcance, string> = {
  sin_meta: "Sin meta cargada",
  lejos: "Lejos de la meta",
  en_camino: "En camino",
  cumplido: "Meta cumplida",
};

/** Color del semaforo. Sale de las variables del tema, como el resto. */
export const COLOR_NIVEL_ALCANCE: Record<NivelAlcance, string> = {
  sin_meta: "hsl(var(--atenuado-contraste))",
  lejos: "hsl(var(--semaforo-critico))",
  en_camino: "hsl(var(--semaforo-medio))",
  cumplido: "hsl(var(--semaforo-bajo))",
};

export const CLASES_NIVEL_ALCANCE: Record<NivelAlcance, string> = {
  sin_meta: "text-atenuado-contraste",
  lejos: "text-semaforo-critico",
  en_camino: "text-semaforo-medio",
  cumplido: "text-semaforo-bajo",
};

/** Las filas de una persona, de la mas reciente a la mas vieja. */
export function filasDelVendedor(resumen: ResumenDeVentas, cod: string): VentaDelMes[] {
  return resumen.filas
    .filter((f) => f.cod.trim().toLowerCase() === cod.trim().toLowerCase())
    .sort((a, b) => b.anio - a.anio || b.mes - a.mes);
}
