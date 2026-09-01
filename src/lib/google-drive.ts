/**
 * Selección de archivos desde el Drive de la empresa.
 *
 * Camping 44 ya vive en Workspace: los procedimientos, los formularios y
 * las minutas están en Drive, no en la computadora de nadie. Obligar a
 * bajar un archivo al escritorio para volver a subirlo es pedirle a la
 * gente que haga de intermediaria entre dos sistemas que podrían
 * hablarse.
 *
 * Cómo funciona, y por qué así:
 *
 * El permiso de Drive NO se pide al ingresar. Se pide a quien aprieta el
 * botón, en el momento de apretarlo, y con el alcance más chico que
 * existe: `drive.file` da acceso únicamente a los archivos que la persona
 * elige a mano en el selector. La intranet no puede ver el resto de su
 * Drive, ni siquiera listarlo.
 *
 * El archivo se COPIA, no se enlaza. Un enlace apunta a un archivo vivo:
 * si alguien lo edita, lo mueve o lo borra, el documento aprobado del SGC
 * cambia o desaparece sin que el sistema se entere. Eso es justamente lo
 * que el control documental existe para impedir.
 *
 * Y lo baja el navegador, no el servidor. Así el token de Google nunca
 * sale de la máquina de la persona, y el archivo entra por el mismo
 * camino que uno elegido del disco: mismas validaciones, mismo registro.
 */

import { FORMATO_POR_TIPO } from "@/lib/adjuntos";
import type { TipoDocumento } from "@/lib/tipos";

/** El permiso más acotado: solo los archivos que la persona elige. */
export const ALCANCE_DRIVE = "https://www.googleapis.com/auth/drive.file";

/**
 * Los archivos nativos de Google no son archivos: no tienen bytes que
 * copiar. Un Documento vive en los servidores de Google como una
 * estructura propia, y solo se convierte en algo descargable cuando se
 * lo exporta. Por eso hay que decidir a qué formato.
 */
export const TIPOS_NATIVOS_GOOGLE = {
  documento: "application/vnd.google-apps.document",
  planilla: "application/vnd.google-apps.spreadsheet",
  presentacion: "application/vnd.google-apps.presentation",
} as const;

const PDF = "application/pdf";
const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

/** Extensión que le corresponde a cada formato de exportación. */
const EXTENSION_POR_FORMATO: Record<string, string> = {
  [PDF]: ".pdf",
  [DOCX]: ".docx",
  [XLSX]: ".xlsx",
  [PPTX]: ".pptx",
};

/** Los tipos MIME que corresponden a cada extensión que admitimos. */
const MIME_POR_EXTENSION: Record<string, string> = {
  ".pdf": PDF,
  ".doc": "application/msword",
  ".docx": DOCX,
  ".xls": "application/vnd.ms-excel",
  ".xlsx": XLSX,
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": PPTX,
  ".csv": "text/csv",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".txt": "text/plain",
};

/**
 * A qué formato exportar un archivo nativo de Google, según el tipo de
 * documento del SGC.
 *
 * Sigue la misma regla que ya rige para lo que se sube del disco: lo que
 * manda va en PDF para que no se pueda editar, y lo que se completa va en
 * su formato editable. La conversión no es una excepción a la regla: es
 * la regla aplicada en el momento de traer el archivo.
 */
export function formatoDeExportacion(
  tipoDocumento: TipoDocumento,
  mimeNativo: string,
): { mime: string; extension: string } | null {
  const admitidas = FORMATO_POR_TIPO[tipoDocumento].extensiones;

  // Si el tipo de documento exige PDF, se exporta a PDF y no hay más que
  // discutir: sirve para un Documento, una Hoja de cálculo o una
  // Presentación por igual.
  if (admitidas.includes(".pdf") && admitidas.length === 1) {
    return { mime: PDF, extension: ".pdf" };
  }

  const equivalente: Record<string, string> = {
    [TIPOS_NATIVOS_GOOGLE.documento]: DOCX,
    [TIPOS_NATIVOS_GOOGLE.planilla]: XLSX,
    [TIPOS_NATIVOS_GOOGLE.presentacion]: PPTX,
  };

  const destino = equivalente[mimeNativo];
  if (!destino) return null;

  // El equivalente editable solo sirve si el tipo de documento lo admite.
  // Una presentación no es un formulario: si no entra, se avisa en lugar
  // de convertirla a algo que después el control va a rechazar.
  const extension = EXTENSION_POR_FORMATO[destino];
  if (!admitidas.includes(extension)) return null;

  return { mime: destino, extension };
}

/** Es un archivo nativo de Google, de los que hay que exportar. */
export function esNativoDeGoogle(mime: string): boolean {
  return mime.startsWith("application/vnd.google-apps.");
}

/**
 * Los tipos MIME que el selector debe ofrecer para un tipo de documento.
 *
 * Se incluyen siempre los nativos de Google: son los que más se usan en
 * la empresa, y la exportación los deja en un formato admitido.
 */
export function mimesParaElSelector(tipoDocumento: TipoDocumento): string[] {
  const propios = FORMATO_POR_TIPO[tipoDocumento].extensiones
    .map((extension) => MIME_POR_EXTENSION[extension])
    .filter((mime): mime is string => Boolean(mime));

  const nativos = Object.values(TIPOS_NATIVOS_GOOGLE).filter(
    (nativo) => formatoDeExportacion(tipoDocumento, nativo) !== null,
  );

  return Array.from(new Set([...propios, ...nativos]));
}

/**
 * El nombre con el que se guarda un archivo traído de Drive.
 *
 * Un Documento de Google se llama «Procedimiento de recepción», sin
 * extensión. Al exportarlo hay que ponérsela, o el archivo se descarga
 * después sin que el sistema operativo sepa con qué abrirlo.
 */
export function nombreExportado(nombreEnDrive: string, extension: string): string {
  return nombreEnDrive.toLowerCase().endsWith(extension)
    ? nombreEnDrive
    : `${nombreEnDrive}${extension}`;
}

/** Está configurado el selector de Drive en este despliegue. */
export function selectorDeDriveConfigurado(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID && process.env.NEXT_PUBLIC_GOOGLE_API_KEY,
  );
}
