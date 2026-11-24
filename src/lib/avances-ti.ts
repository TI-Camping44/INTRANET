/**
 * Reglas del registro de avances y cambios de TI.
 *
 * Viven acá y no en `acciones.ts` porque las usan los dos lados: la
 * pantalla arma los desplegables y los filtros con ellas y la acción de
 * servidor las vuelve a aplicar antes de escribir. Un archivo
 * `"use server"` solo puede exportar funciones asíncronas.
 *
 * LAS DOS LISTAS ESTÁN TAMBIÉN EN EL `CHECK` DE `avances_ti`. Si cambian,
 * cambian en los dos lados, en una migración nueva.
 */

export const TIPOS_AVANCE = [
  "implementacion",
  "mejora",
  "correccion",
  "configuracion",
  "incidente",
  "mantenimiento",
] as const;
export type TipoAvance = (typeof TIPOS_AVANCE)[number];

export const ETIQUETAS_TIPO_AVANCE: Record<TipoAvance, string> = {
  implementacion: "Implementación",
  mejora: "Mejora",
  correccion: "Corrección",
  configuracion: "Configuración",
  incidente: "Incidente",
  mantenimiento: "Mantenimiento",
};

/** Qué entra en cada tipo, para que dos personas no clasifiquen distinto lo mismo. */
export const DEFINICION_TIPO_AVANCE: Record<TipoAvance, string> = {
  implementacion: "Algo que no existía: una aplicación, una automatización, un módulo",
  mejora: "Cambia cómo funciona algo que ya andaba",
  correccion: "Algo que funcionaba mal y se arregló",
  configuracion: "Permisos, usuarios, parámetros o ajustes de un sistema",
  incidente: "Una caída o falla que hubo que atender",
  mantenimiento: "Trabajo programado: actualizaciones, respaldos, limpieza",
};

/**
 * El color sigue la gravedad: la corrección y el incidente hablan de
 * algo que estuvo mal, el resto es trabajo que suma. NUNCA SOLO EL
 * COLOR: la insignia lleva el tipo escrito.
 */
export const VARIANTE_TIPO_AVANCE: Record<
  TipoAvance,
  "primaria" | "exito" | "advertencia" | "neutra" | "peligro" | "contorno"
> = {
  implementacion: "primaria",
  mejora: "exito",
  correccion: "advertencia",
  configuracion: "neutra",
  incidente: "peligro",
  mantenimiento: "contorno",
};

export const SISTEMAS_AVANCE = [
  "odoo",
  "google_workspace",
  "apps_script",
  "intranet",
  "sitios_web",
  "red_e_infraestructura",
  "equipos",
  "otro",
] as const;
export type SistemaAvance = (typeof SISTEMAS_AVANCE)[number];

export const ETIQUETAS_SISTEMA_AVANCE: Record<SistemaAvance, string> = {
  odoo: "Odoo",
  google_workspace: "Google Workspace",
  apps_script: "Apps Script y planillas",
  intranet: "Intranet",
  sitios_web: "Sitios web",
  red_e_infraestructura: "Red e infraestructura",
  equipos: "Equipos",
  otro: "Otro",
};

/** El formato de la ticketera, el mismo del `CHECK`. */
export const PATRON_TICKET = /^TI-\d{4}$/;

export const LARGO_MINIMO_DESCRIPCION_AVANCE = 10;

export function esTipoAvance(valor: string): valor is TipoAvance {
  return (TIPOS_AVANCE as readonly string[]).includes(valor);
}

export function esSistemaAvance(valor: string): valor is SistemaAvance {
  return (SISTEMAS_AVANCE as readonly string[]).includes(valor);
}

/**
 * El ticket como lo escribe la gente —«ti 142», «TI-142», «0142»— llevado
 * a la forma de la ticketera. Devuelve `null` si viene vacío y la cadena
 * sin tocar si no se puede leer, para que la validación diga qué está mal.
 */
export function normalizarTicket(valor: string): string | null {
  const limpio = valor.trim().toUpperCase();
  if (!limpio) return null;
  const numero = limpio.replace(/^TI[\s-]*/, "");
  return /^\d{1,4}$/.test(numero) ? `TI-${numero.padStart(4, "0")}` : limpio;
}

/**
 * En qué entorno se hizo el cambio. Entró el 24 de noviembre junto con
 * quién lo aprobó, cómo se revierte y cómo se verificó. ESTÁ TAMBIÉN EN
 * EL `CHECK` `avances_ti_entorno`.
 */
export const ENTORNOS_AVANCE = ["produccion", "pruebas"] as const;
export type EntornoAvance = (typeof ENTORNOS_AVANCE)[number];

export const ETIQUETAS_ENTORNO_AVANCE: Record<EntornoAvance, string> = {
  produccion: "Producción",
  pruebas: "Pruebas",
};

export function esEntornoAvance(valor: string): valor is EntornoAvance {
  return (ENTORNOS_AVANCE as readonly string[]).includes(valor);
}
