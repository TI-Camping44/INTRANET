/**
 * Saca el texto de un archivo, para poder buscar dentro del contenido.
 *
 * Corre SOLO EN EL SERVIDOR. Usa la misma biblioteca que el visor, pero
 * sin dibujar nada: en vez de pintar las páginas, junta las palabras.
 *
 * POR AHORA, SOLO PDF. Es el formato en el que Calidad publica los
 * manuales, procedimientos, instructivos, políticas y planes, que son los
 * documentos sobre los que alguien busca. Los formularios y registros son
 * editables —Word, Excel— y ahí no hay nada que buscar: son plantillas
 * para completar. Si más adelante hace falta, se agrega acá y el resto
 * del sistema no se entera.
 *
 * Devuelve `null` cuando no hay nada que indexar, y eso NO es un error:
 * un formato que no se sabe leer, o un PDF que es una foto escaneada sin
 * texto adentro. Quien llama decide qué hacer; no se rompe la subida por
 * esto.
 */

import { createRequire } from "node:module";
import { dirname } from "node:path";

/** Tope de caracteres que se guardan por documento. */
const MAXIMO_CARACTERES = 500_000;

/**
 * Tope de páginas que se leen.
 *
 * Un manual del SGC tiene decenas de páginas, no miles. El tope está para
 * que un archivo raro no deje la subida esperando: es el mismo criterio
 * que el tope de espera del correo.
 */
const MAXIMO_PAGINAS = 300;

export interface TextoExtraido {
  texto: string;
  paginas: number;
}

/** La carpeta de fuentes base que trae el paquete, como ruta de archivo. */
function ubicacionDeFuentes(): string {
  const require = createRequire(import.meta.url);
  const paquete = require.resolve("pdfjs-dist/package.json");
  return `${dirname(paquete)}/standard_fonts/`;
}

function esPdf(nombre: string, tipoMime: string | null): boolean {
  return tipoMime === "application/pdf" || /\.pdf$/i.test(nombre);
}

export async function extraerTexto(
  contenido: ArrayBuffer,
  nombre: string,
  tipoMime: string | null = null,
): Promise<TextoExtraido | null> {
  if (!esPdf(nombre, tipoMime)) return null;

  // La compilación «legacy», igual que el visor: la moderna usa funciones
  // de JavaScript que no están en todos lados.
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Se guarda la tarea, no solo el documento: `destroy()` es de la tarea,
  // y sin llamarlo queda un trabajador vivo por cada archivo leído.
  const tarea = pdfjs.getDocument({
    data: new Uint8Array(contenido),
    // Acá no hay navegador ni fuentes del sistema, y no hace falta
    // ninguna de las dos cosas: solo se leen las palabras.
    useSystemFonts: false,
    useWorkerFetch: false,
    // Las fuentes base salen del propio paquete. No se usan para nada
    // —no se dibuja—, pero sin esto PDF.js escribe un aviso por cada
    // archivo leído y llena los registros de producción de ruido.
    standardFontDataUrl: ubicacionDeFuentes(),
  });
  const documento = await tarea.promise;

  // Se anota antes de destruir la tarea: despues, consultar el documento
  // puede fallar.
  const totalDePaginas = documento.numPages;
  const paginas = Math.min(totalDePaginas, MAXIMO_PAGINAS);
  const partes: string[] = [];
  let largo = 0;

  for (let numero = 1; numero <= paginas; numero += 1) {
    const pagina = await documento.getPage(numero);
    const contenidoTexto = await pagina.getTextContent();

    const texto = contenidoTexto.items
      .map((elemento) => ("str" in elemento ? elemento.str : ""))
      .join(" ")
      // El PDF trae las palabras sueltas, con los espacios donde el
      // diseño los puso. Se normalizan: si no, «garantía» y «garan tía»
      // son dos palabras distintas para el buscador.
      .replace(/\s+/g, " ")
      .trim();

    if (texto) {
      partes.push(texto);
      largo += texto.length;
      if (largo >= MAXIMO_CARACTERES) break;
    }
  }

  await tarea.destroy();

  const texto = partes.join("\n").slice(0, MAXIMO_CARACTERES).trim();

  // Sin texto es un PDF escaneado: una foto de las hojas. No es un error,
  // pero no hay nada que indexar y guardar una fila vacía solo haría que
  // el reintento lo saltee.
  if (!texto) return null;

  return { texto, paginas: totalDePaginas };
}
