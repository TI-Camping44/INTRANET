/**
 * Reglas de los archivos del sistema documental.
 *
 * Hasta el 24 de septiembre el formato estaba atado al tipo: PDF para lo
 * que rige, editable para lo que se completa. La idea era evitar que un
 * procedimiento en .docx circule por correo y termine en tres versiones
 * distintas. Calidad pidio retirarla: en la practica hay documentos
 * legitimos en otros formatos —una planilla de calculo que es el
 * procedimiento, un instructivo con capturas— y el sistema los rechazaba
 * sin que nadie pudiera hacer nada.
 *
 * Queda el control que si importa: el tamano maximo y la lista de
 * formatos conocidos. Un ejecutable no entra.
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
  explicacion:
    "Se admiten PDF, Word, planillas, presentaciones, imágenes y texto. " +
    "Hasta 20 MB por archivo.",
};

/**
 * Que formato admite cada tipo de documento: todos, el mismo.
 *
 * El mapa se conserva —en vez de borrarlo— porque la interfaz lo
 * consulta para explicar la regla y para armar el `accept` del selector,
 * y porque si Calidad vuelve a atar el formato al tipo, se cambia acá y
 * en ningun otro lado.
 */
export const FORMATO_POR_TIPO: Record<TipoDocumento, FormatoAdmitido> = {
  manual: LIBRE,
  instructivo: LIBRE,
  protocolo: LIBRE,
  politica: LIBRE,
  procedimiento: LIBRE,
  plan: LIBRE,
  formulario: LIBRE,
  registro: LIBRE,
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
      `No se admiten archivos ${extension || "sin extensión"}. ` + formato.explicacion
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

// ---------------------------------------------------------------------
// Evidencias de un hallazgo de auditoria
// ---------------------------------------------------------------------
// «Evidencia objetiva» era solo texto. Un auditor describe lo que vio,
// pero lo que sostiene el hallazgo ante una auditoria de certificacion es
// la foto de la estanteria, el registro incompleto, la captura del
// sistema. Sin poder adjuntarlos, esos archivos terminaban en el
// WhatsApp del auditor.
//
// El formato es amplio a proposito: una evidencia puede ser una foto, un
// PDF firmado o una planilla. Lo que no cambia es el tope de 20 MB y que
// el bucket sigue siendo privado.

export const EXTENSIONES_EVIDENCIA = [
  ".pdf",
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".doc",
  ".docx",
  ".xls",
  ".xlsx",
  ".csv",
];

/** Lo que el selector de archivos ofrece filtrar. */
export const ACEPTA_EVIDENCIA = EXTENSIONES_EVIDENCIA.join(",");

/** Controla la evidencia. Devuelve el motivo del rechazo, o null. */
export function motivoDeRechazoEvidencia(
  nombreArchivo: string,
  tamanoBytes: number,
): string | null {
  if (tamanoBytes === 0) return "El archivo está vacío.";

  if (tamanoBytes > TAMANO_MAXIMO_ADJUNTO) {
    return (
      `El archivo pesa ${describirTamano(tamanoBytes)} y el máximo es ` +
      `${describirTamano(TAMANO_MAXIMO_ADJUNTO)}.`
    );
  }

  const extension = extensionDe(nombreArchivo);
  if (!EXTENSIONES_EVIDENCIA.includes(extension)) {
    return (
      `Un archivo ${extension || "sin extensión"} no se puede adjuntar como evidencia. ` +
      "Use PDF, una imagen o un archivo de Office."
    );
  }

  return null;
}

/** Ruta de la evidencia dentro del bucket. */
export function rutaDeEvidencia(hallazgoId: string, nombreArchivo: string): string {
  return `hallazgos/${hallazgoId}/${Date.now()}${extensionDe(nombreArchivo)}`;
}

/**
 * Repara el nombre de un archivo que llegó mal decodificado.
 *
 * «Política de Calidad.pdf» se guardaba como «PolÃ­tica de Calidad.pdf».
 * No es culpa del navegador: el nombre viaja en la cabecera del envío
 * como bytes UTF-8 crudos, y el lector de formularios del servidor los
 * interpreta como Latin-1, que es un byte por letra. Cada acento sale
 * partido en dos caracteres.
 *
 * Se deshace el daño al revés: se vuelven a tomar los caracteres como
 * bytes y se leen como UTF-8. La comprobación de seguridad es que el
 * resultado sea UTF-8 válido —un nombre que ya estaba bien no lo es, y
 * se devuelve tal cual—, así que la función nunca rompe un nombre
 * correcto.
 *
 * Se aplica al guardar. La ruta dentro del bucket no la usa: esa se
 * arma con la fecha y la extensión, así que ningún archivo ya subido
 * quedó inaccesible por esto.
 */
export function nombreDeArchivoLegible(nombre: string): string {
  // Sin caracteres en el rango alto no hay nada que reparar.
  if (!/[\u0080-ÿ]/.test(nombre)) return nombre;

  try {
    const bytes = Uint8Array.from(Array.from(nombre, (letra) => letra.charCodeAt(0) & 0xff));
    const leido = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return leido;
  } catch {
    // No era UTF-8 mal leído: el nombre ya estaba bien.
    return nombre;
  }
}
