import { esWord } from "@/lib/extraer-texto";

/**
 * Convierte un `.docx` a HTML para poder leerlo en pantalla.
 *
 * POR QUE EXISTE. Un formulario de Word terminaba en un cartel que decía
 * «este formato no se puede ver en el navegador. Descárguelo». Es cierto
 * —el navegador no sabe dibujar un `.docx`— pero para la persona es un
 * callejón sin salida: toca un documento y no puede leerlo sin bajarlo,
 * abrirlo en Word y después acordarse de borrarlo.
 *
 * SOLO `.docx`. El `.doc` anterior a 2007 es otro formato, binario, que
 * esta biblioteca no lee. Las planillas y las presentaciones tampoco:
 * siguen con el cartel y el botón de descarga, que para eso sirve.
 *
 * ES UNA VISTA, NO EL DOCUMENTO. La conversión pierde cosas: encabezados,
 * pies de página, el salto de páginas, algunos cuadros. Sirve para leer y
 * para buscar; el archivo que rige es el que se descarga. La pantalla lo
 * dice.
 */

export { esWord };

export interface VistaDeWord {
  html: string;
  /** Avisos de la conversión, para saber qué se perdió. */
  advertencias: string[];
}

export async function convertirWordAHtml(contenido: ArrayBuffer): Promise<VistaDeWord | null> {
  try {
    const mammoth = await import("mammoth");
    const { value, messages } = await mammoth.convertToHtml({
      buffer: Buffer.from(contenido),
    });

    if (!value.trim()) return null;

    return {
      html: value,
      advertencias: messages.map((m) => m.message).slice(0, 5),
    };
  } catch {
    // Un archivo mal armado no puede tumbar la pantalla del documento: se
    // cae al cartel de siempre, con su botón de descarga.
    return null;
  }
}

/**
 * La hoja de estilos que acompaña al HTML convertido.
 *
 * Va acá y no en `globals.css` porque el HTML se muestra dentro de un
 * marco aislado, que no comparte los estilos de la aplicación. Se
 * reciben los colores del tema por parámetro para que la vista no quede
 * blanca sobre fondo oscuro.
 */
export function estilosDeLaVista(): string {
  return `
    :root { color-scheme: light dark; }
    body {
      margin: 0;
      padding: 24px;
      font-family: Inter, system-ui, -apple-system, sans-serif;
      font-size: 14px;
      line-height: 1.65;
      color: #14161B;
      background: #FFFFFF;
      overflow-wrap: break-word;
    }
    h1, h2, h3, h4 { line-height: 1.3; margin: 1.4em 0 .5em; }
    h1 { font-size: 20px; } h2 { font-size: 17px; } h3 { font-size: 15px; }
    p { margin: 0 0 .8em; }
    ul, ol { margin: 0 0 .8em; padding-left: 1.4em; }
    img { max-width: 100%; height: auto; }
    table { border-collapse: collapse; width: 100%; margin: 0 0 1em; font-size: 13px; }
    th, td { border: 1px solid #D9DCE3; padding: 6px 8px; text-align: left; vertical-align: top; }
    th { background: #F4F5F7; font-weight: 600; }
    @media (prefers-color-scheme: dark) {
      body { color: #E7E9EE; background: #14161B; }
      th, td { border-color: #2A2E38; }
      th { background: #1C1F27; }
    }
  `;
}

/** Arma el documento completo que se le entrega al marco aislado. */
export function documentoDeLaVista(html: string, titulo: string): string {
  const tituloSeguro = titulo
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<!doctype html><html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${tituloSeguro}</title><style>${estilosDeLaVista()}</style></head>
<body>${html}</body></html>`;
}
