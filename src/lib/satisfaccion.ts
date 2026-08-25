/**
 * Reglas de satisfaccion del cliente compartidas entre servidor y
 * cliente. Viven aca y no en las acciones porque un archivo
 * "use server" solo puede exportar funciones asincronas.
 *
 * El calculo del NPS es el estandar: porcentaje de promotores menos
 * porcentaje de detractores, sobre el total de respuestas. Los pasivos
 * no suman ni restan, pero cuentan en el denominador.
 */

import type { TipoEncuesta } from "@/lib/tipos";

export const ETIQUETAS_TIPO_ENCUESTA: Record<TipoEncuesta, string> = {
  nps: "NPS",
  csat: "Satisfacción (CSAT)",
  ces: "Esfuerzo (CES)",
  personalizada: "Personalizada",
};

/** Canales por los que llega una respuesta. */
export const CANALES_RESPUESTA = ["correo", "whatsapp", "telefono", "presencial", "web"];

/**
 * Meta de NPS acordada con Direccion. Es un umbral, no una serie: en el
 * grafico va en gris y con trazo discontinuo.
 */
export const META_NPS = 50;

/** Respuestas minimas para que un NPS mensual sea representativo. */
export const RESPUESTAS_MINIMAS_NPS = 5;

export interface ResumenNps {
  total: number;
  promotores: number;
  pasivos: number;
  detractores: number;
  nps: number | null;
}

export function resumirNps(puntajes: number[]): ResumenNps {
  const promotores = puntajes.filter((puntaje) => puntaje >= 9).length;
  const detractores = puntajes.filter((puntaje) => puntaje <= 6).length;
  const total = puntajes.length;

  return {
    total,
    promotores,
    pasivos: total - promotores - detractores,
    detractores,
    nps: total > 0 ? Math.round(((promotores - detractores) / total) * 100) : null,
  };
}

export function etiquetaCategoriaNps(categoria: string): string {
  if (categoria === "promotor") return "Promotor";
  if (categoria === "pasivo") return "Pasivo";
  return "Detractor";
}

export function varianteCategoriaNps(categoria: string): "exito" | "advertencia" | "peligro" {
  if (categoria === "promotor") return "exito";
  if (categoria === "pasivo") return "advertencia";
  return "peligro";
}

/**
 * Tono del semaforo para un NPS. Los cortes son los de uso corriente:
 * negativo es malo, 0 a 30 aceptable, 30 a 50 bueno, 50 o mas excelente.
 */
export function tonoNps(nps: number | null): "neutro" | "exito" | "advertencia" | "peligro" {
  if (nps === null) return "neutro";
  if (nps < 0) return "peligro";
  if (nps < 30) return "advertencia";
  return "exito";
}
