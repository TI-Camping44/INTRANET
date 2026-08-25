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

/** Cuatro criterios de 1 a 5 escalados a una nota de 0 a 100. */
export const FACTOR_PUNTAJE = 5;

/**
 * Resultado que corresponde al puntaje obtenido:
 *   80 a 100 -> aprobado
 *   60 a  79 -> condicional
 *   menos de 60 -> rechazado
 *
 * La misma escala esta declarada en la columna generada `puntaje` de
 * `proveedor_evaluaciones`. Si cambia, cambia en los dos lados.
 */
export function resultadoSugerido(puntaje: number): EstadoProveedor {
  if (puntaje >= 80) return "aprobado";
  if (puntaje >= 60) return "condicional";
  return "rechazado";
}
