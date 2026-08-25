/**
 * Reglas de las publicaciones internas, compartidas entre servidor y
 * cliente. Viven aca y no en las acciones porque un archivo "use server"
 * solo puede exportar funciones asincronas.
 */

import type { EstadoPublicacion, TipoPublicacion } from "@/lib/tipos";

export const ETIQUETAS_TIPO_PUBLICACION: Record<TipoPublicacion, string> = {
  anuncio: "Anuncio",
  novedad_producto: "Novedad de producto",
  logro: "Logro",
  reconocimiento: "Reconocimiento",
  bienvenida: "Bienvenida",
  evento: "Evento",
};

export const ETIQUETAS_ESTADO_PUBLICACION: Record<EstadoPublicacion, string> = {
  borrador: "Borrador",
  publicada: "Publicada",
  archivada: "Archivada",
};

/**
 * Icono de lucide-react por tipo. Se nombra aca para que la tarjeta y el
 * filtro no elijan cada uno el suyo y terminen distintos.
 */
export const ICONOS_TIPO_PUBLICACION: Record<TipoPublicacion, string> = {
  anuncio: "Megaphone",
  novedad_producto: "PackagePlus",
  logro: "Trophy",
  reconocimiento: "Award",
  bienvenida: "UserPlus",
  evento: "CalendarDays",
};

/**
 * Cantidad maxima de publicaciones que se dibujan en el inicio. Un muro
 * es para enterarse de lo reciente, no para hacer arqueologia: lo viejo
 * se busca desde el listado con filtros.
 */
export const PUBLICACIONES_EN_INICIO = 12;

/** Longitud a la que se recorta el cuerpo cuando no hay resumen cargado. */
export const LARGO_RESUMEN = 180;

/**
 * El resumen es opcional: si no se cargo, se recorta el cuerpo. Vale
 * mas un resumen automatico que una tarjeta vacia.
 */
export function resumirPublicacion(cuerpo: string, resumen: string | null): string {
  if (resumen && resumen.trim()) return resumen.trim();

  const plano = cuerpo.replace(/\s+/g, " ").trim();
  if (plano.length <= LARGO_RESUMEN) return plano;

  // Se corta en el ultimo espacio para no partir una palabra al medio.
  const recorte = plano.slice(0, LARGO_RESUMEN);
  const corte = recorte.lastIndexOf(" ");
  return `${recorte.slice(0, corte > 0 ? corte : LARGO_RESUMEN)}…`;
}

/** Una publicacion vencida deja de aparecer en el inicio, sin borrarse. */
export function estaVigente(fechaVencimiento: string | null, hoy: string): boolean {
  return fechaVencimiento === null || fechaVencimiento >= hoy;
}
