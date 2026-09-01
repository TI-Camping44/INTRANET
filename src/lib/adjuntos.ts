/**
 * Reglas de los archivos del sistema documental.
 *
 * Las decidio Calidad y valen para toda la casa: lo que rige se publica
 * en PDF y lo que se completa se publica en su formato editable. La
 * razon es practica, no estetica. Un procedimiento en .docx circulando
 * por correo se edita, y a la semana hay tres versiones distintas de un
 * documento que deberia tener una sola. Un formulario en PDF, al reves,
 * no se puede llenar: se imprime, se completa a mano y se pierde.
 *
 * Vive en `lib/` y no en la accion de servidor porque lo necesitan los
 * dos lados: el navegador para avisar antes de subir, el servidor para
 * controlar de verdad.
 */

import { TAMANO_MAXIMO_ADJUNTO } from "@/lib/constantes";
import type { TipoDocumento } from "@/lib/tipos";

export { TAMANO_MAXIMO_ADJUNTO };

/** El bucket privado donde viven los archivos. */
export const BUCKET_DOCUMENTOS = "adjuntos-sgc";

interface FormatoAdmitido {
  /** Extensiones, en minuscula y con punto. */
  extensiones: string[];
  /** Como se le explica la regla a la persona. */
  explicacion: string;
}

const PDF: FormatoAdmitido = {
  extensiones: [".pdf"],
  explicacion:
    "Los manuales, procedimientos, instructivos, políticas y planes se publican en PDF: " +
    "es lo que evita que circulen copias editadas.",
};

const EDITABLE: FormatoAdmitido = {
  extensiones: [".doc", ".docx", ".xls", ".xlsx", ".csv"],
  explicacion:
    "Los formularios y registros se publican en su formato editable (Word o planilla): " +
    "están hechos para completarse.",
};

const LIBRE: FormatoAdmitido = {
  extensiones: [
    ".pdf",
    ".doc",
    ".docx",
    ".xls",
    ".xlsx",
    ".csv",
    ".ppt",
    ".pptx",
    ".png",
    ".jpg",
    ".jpeg",
    ".webp",
    ".txt",
  ],
  explicacion: "Un documento externo se guarda tal como lo entregó su emisor.",
};

/** Que formato admite cada tipo de documento. */
export const FORMATO_POR_TIPO: Record<TipoDocumento, FormatoAdmitido> = {
  manual: PDF,
  procedimiento: PDF,
  instructivo: PDF,
  politica: PDF,
  plan: PDF,
  formulario: EDITABLE,
  registro: EDITABLE,
  externo: LIBRE,
};

/** La extension de un nombre de archivo, en minuscula y con punto. */
export function extensionDe(nombreArchivo: string): string {
  const punto = nombreArchivo.lastIndexOf(".");
  return punto === -1 ? "" : nombreArchivo.slice(punto).toLowerCase();
}

/**
 * Controla el archivo contra la regla del tipo de documento.
 * Devuelve el motivo del rechazo, o null si el archivo sirve.
 */
export function motivoDeRechazo(
  tipo: TipoDocumento,
  nombreArchivo: string,
  tamanoBytes: number,
): string | null {
  if (tamanoBytes > TAMANO_MAXIMO_ADJUNTO) {
    return `El archivo pesa ${describirTamano(tamanoBytes)} y el máximo es ${describirTamano(
      TAMANO_MAXIMO_ADJUNTO,
    )}.`;
  }

  if (tamanoBytes === 0) {
    return "El archivo está vacío.";
  }

  const formato = FORMATO_POR_TIPO[tipo];
  const extension = extensionDe(nombreArchivo);

  if (!formato.extensiones.includes(extension)) {
    return (
      `Un archivo ${extension || "sin extensión"} no corresponde a este tipo de documento. ` +
      formato.explicacion
    );
  }

  return null;
}

/** El `accept` del selector de archivos, para que el navegador filtre antes. */
export function extensionesAdmitidas(tipo: TipoDocumento): string {
  return FORMATO_POR_TIPO[tipo].extensiones.join(",");
}

/** Tamaño legible: 3,4 MB en lugar de 3565158. */
export function describirTamano(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} kB`;
  return `${(bytes / (1024 * 1024)).toFixed(1).replace(".", ",")} MB`;
}

/**
 * Ruta del archivo dentro del bucket.
 *
 * Se arma con el id del documento y una marca de tiempo, y no con el
 * nombre original: dos personas subiendo "Procedimiento.pdf" el mismo
 * dia no se pisan, y el nombre que ve la persona se guarda aparte en la
 * tabla.
 */
export function rutaDeArchivo(documentoId: string, nombreArchivo: string): string {
  return `documentos/${documentoId}/${Date.now()}${extensionDe(nombreArchivo)}`;
}
