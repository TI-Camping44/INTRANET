/**
 * El avance de cada comercial contra su objetivo del mes.
 *
 * DE DONDE SALE EL NUMERO. No de Odoo. El informe comercial que la
 * empresa ya usa baja las facturas a una planilla y su Apps Script deja
 * resuelta la columna `TOTAL GS` aplicando reglas que no son triviales:
 * anticipos, notas de credito, tipo de cambio. La intranet lee esa misma
 * planilla —las mismas dos hojas que lee el tablero de Comercial— y suma.
 *
 * Es deliberado. Si la intranet recalculara esas reglas, el dia que se
 * cambie una en el informe los dos numeros se separarian y nadie sabria
 * cual creer. Un solo lugar donde se calcula, un solo numero.
 *
 * ESTE ARCHIVO NO HACE PEDIDOS DE RED. Define el contrato y las cuentas
 * que la pantalla necesita; el pedido lo hace `ventas-servidor.ts` y las
 * reglas de lectura estan en `planilla-ventas.ts`.
 */

import { mismoVendedor } from "@/lib/planilla-ventas";

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
  /**
   * Cuanto de lo anterior son notas de credito, en negativo.
   *
   * Va aparte porque explica una caida: un mes flojo por poca venta y un
   * mes flojo por una devolucion grande se arreglan de maneras distintas.
   */
  devoluciones: number;
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
  /**
   * Dias habiles del mes de corte y cuantos van.
   *
   * Sirven para decir cuanto DEBERIA llevar facturado hoy, que a mitad de
   * mes es la pregunta real: un 50% el dia 10 esta bien y el dia 25 esta
   * mal, y el porcentaje solo no lo distingue.
   */
  diasMes: number;
  diasTranscurridos: number;
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

/**
 * Las filas de una persona, de la mas reciente a la mas vieja.
 *
 * La union NO es una comparacion de texto: en la planilla la misma
 * persona figura con mas o menos nombres segun la hoja, asi que se usa la
 * regla compartida de `planilla-ventas`. Es la misma que evita que dos
 * «Oscar David» distintos se mezclen.
 */
export function filasDelVendedor(resumen: ResumenDeVentas, nombre: string): VentaDelMes[] {
  return resumen.filas
    .filter((f) => mismoVendedor(f.cod, nombre))
    .sort((a, b) => b.anio - a.anio || b.mes - a.mes);
}

/**
 * Cuanto deberia llevar facturado a hoy, repartiendo la meta por dia habil.
 *
 * `null` sin meta o sin dias cargados: la pantalla lo omite en vez de
 * dibujar una referencia inventada.
 */
export function esperadoAHoy(
  meta: number | null,
  diasMes: number,
  diasTranscurridos: number,
): number | null {
  if (meta === null || meta <= 0 || diasMes <= 0) return null;
  return (meta / diasMes) * diasTranscurridos;
}

/**
 * Cuanto hay que facturar por dia habil restante para llegar a la meta.
 *
 * `null` cuando ya la alcanzo o cuando no hay dias por delante: en el
 * ultimo dia del mes no hay un ritmo que recomendar.
 */
export function ritmoNecesario(
  meta: number | null,
  venta: number | null,
  diasMes: number,
  diasTranscurridos: number,
): number | null {
  const falta = faltante(meta, venta);
  if (falta === null || falta <= 0) return null;
  const restantes = diasMes - diasTranscurridos;
  if (restantes <= 0) return null;
  return falta / restantes;
}
