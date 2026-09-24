/**
 * Copia el trabajador de PDF.js a `public/`.
 *
 * PDF.js dibuja el documento en un hilo aparte para no congelar la
 * pantalla, y ese hilo se carga desde una dirección propia. Se copia en
 * vez de empaquetarlo porque así la versión del archivo servido y la del
 * paquete instalado son siempre la misma: las dos salen de
 * `node_modules` en el momento de compilar.
 *
 * Corre antes de `dev` y de `build`, así que nadie tiene que acordarse.
 */
import { copyFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
// La compilacion «legacy» y no la moderna: la moderna usa funciones de
// JavaScript que los navegadores recientes tienen y los de hace dos años
// no —`Map.getOrInsertComputed`, entre otras—, y en esos el visor no
// dibuja nada. Acá hay 49 personas con equipos de distinta edad; el
// documento tiene que abrirse en todos.
const origen = join(
  dirname(require.resolve("pdfjs-dist/package.json")),
  "legacy",
  "build",
  "pdf.worker.min.mjs",
);
const destino = join(process.cwd(), "public", "pdf.worker.min.mjs");

mkdirSync(dirname(destino), { recursive: true });
copyFileSync(origen, destino);
console.log(`Visor de PDF: copiado ${origen} → ${destino}`);
