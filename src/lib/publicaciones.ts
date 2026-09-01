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

/**
 * Borrador del anuncio de un documento.
 *
 * Es un punto de partida, no un texto definitivo: quien anuncia lo edita
 * antes de publicar. Se redacta aca y no en el componente porque lo
 * necesitan el servidor —para el valor por defecto— y el cliente —para
 * volver a proponerlo si la persona borra todo.
 *
 * El criterio del titulo: la v00 es un documento que nace, y de la v01 en
 * adelante es uno que cambio. No es lo mismo para quien lo lee, y decirlo
 * distinto ahorra que abra la ficha para averiguarlo.
 */
export function redactarAnuncioDeDocumento(documento: {
  codigo: string | null;
  titulo: string;
  tipo: string;
  version_actual: number;
  fecha_aprobacion: string | null;
}): { titulo: string; cuerpo: string } {
  const identificacion = documento.codigo ? `${documento.codigo} · ` : "";
  const esNuevo = documento.version_actual <= 0;
  const version = `v${String(documento.version_actual).padStart(2, "0")}`;

  const titulo = esNuevo
    ? `Nuevo documento vigente: ${documento.titulo}`
    : `Actualización: ${documento.titulo}`;

  const cuerpo = esNuevo
    ? `Se puso en vigencia ${identificacion}${documento.titulo} (${version}).\n\n` +
      "Está disponible en Documentación, dentro de Calidad · SGC. " +
      "Corresponde leerlo y aplicarlo desde hoy."
    : `Se aprobó una versión nueva de ${identificacion}${documento.titulo} (${version}).\n\n` +
      "La versión anterior queda obsoleta. La vigente está en Documentación, " +
      "dentro de Calidad · SGC.";

  return { titulo, cuerpo };
}
