/**
 * Imágenes de las publicaciones del inicio.
 *
 * El muro es lo primero que ve la gente al entrar y una foto cambia por
 * completo cómo se lee: un reconocimiento con la cara de la persona es un
 * reconocimiento, y sin foto es un párrafo más.
 *
 * Las imágenes van al mismo bucket privado que los adjuntos, no a uno
 * público. El muro tiene fotos del personal —bienvenidas,
 * reconocimientos, cumpleaños— y un bucket público las deja legibles para
 * cualquiera que adivine la dirección. Se entregan con enlaces firmados
 * que se generan en el servidor en cada carga de la página.
 */

import { BUCKET_DOCUMENTOS, describirTamano, extensionDe } from "@/lib/adjuntos";

export { BUCKET_DOCUMENTOS as BUCKET_IMAGENES };

/**
 * Tope de una imagen del muro: 3 MB.
 *
 * Es más bajo que el de los adjuntos —20 MB— a propósito. Un adjunto se
 * baja cuando alguien lo pide; una imagen del muro la cargan las
 * cuarenta y nueve personas cada vez que entran, varias desde el celular
 * en el piso de venta. Una foto de 20 MB ahí es una pantalla que tarda.
 */
export const TAMANO_MAXIMO_IMAGEN = 3 * 1024 * 1024;

export const EXTENSIONES_IMAGEN = [".png", ".jpg", ".jpeg", ".webp"];

/** Lo que el selector de archivos ofrece filtrar. */
export const ACEPTA_IMAGEN = EXTENSIONES_IMAGEN.join(",");

/**
 * Controla la imagen. Devuelve el motivo del rechazo, o null si sirve.
 */
export function motivoDeRechazoImagen(
  nombreArchivo: string,
  tamanoBytes: number,
): string | null {
  if (tamanoBytes === 0) return "El archivo está vacío.";

  if (tamanoBytes > TAMANO_MAXIMO_IMAGEN) {
    return (
      `La imagen pesa ${describirTamano(tamanoBytes)} y el máximo es ` +
      `${describirTamano(TAMANO_MAXIMO_IMAGEN)}. Achíquela antes de subirla: ` +
      "el muro lo abren cuarenta y nueve personas por día, varias desde el celular."
    );
  }

  const extension = extensionDe(nombreArchivo);
  if (!EXTENSIONES_IMAGEN.includes(extension)) {
    return `Un archivo ${extension || "sin extensión"} no es una imagen. Use PNG, JPG o WebP.`;
  }

  return null;
}

/** Ruta de la imagen dentro del bucket. */
export function rutaDeImagen(publicacionId: string, nombreArchivo: string): string {
  return `publicaciones/${publicacionId}/${Date.now()}${extensionDe(nombreArchivo)}`;
}

/**
 * `url_imagen` admite las dos cosas y hay que saber cuál es cuál.
 *
 * La columna nació para una dirección externa —una imagen alojada en otro
 * lado— y ahora también guarda la ruta de un archivo del bucket. Se
 * distinguen por el prefijo: lo que empieza con http se usa tal cual, y
 * lo demás es una ruta que hay que firmar antes de mostrar.
 */
export function esRutaDelBucket(urlImagen: string | null): boolean {
  return Boolean(urlImagen) && !urlImagen!.startsWith("http");
}

/**
 * Cuánto dura el enlace firmado de una imagen del muro: una hora.
 *
 * Más que los cinco minutos de un adjunto, porque acá el enlace no es
 * para descargar una vez sino para que la imagen siga viéndose mientras
 * la pestaña esté abierta. Menos que un día, porque sigue siendo un
 * enlace que da acceso a un archivo privado.
 */
export const DURACION_ENLACE_IMAGEN = 60 * 60;
