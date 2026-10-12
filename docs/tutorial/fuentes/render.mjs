// Pasa los cuadros .html a .png, a 1920x1080 exactos.
//
// Se usa Chromium directamente y no una captura a pantalla completa: el
// lienzo mide 1920x1080 en `base.css`, asi que lo que hace falta es una
// ventana de ese tamano y una captura del area visible. Con `fullPage`
// cualquier sombra que se pase un pixel cambiaria el alto del cuadro y
// ffmpeg despues no puede encadenarlos.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const EJECUTABLE =
  process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const cuadros = fs
  .readdirSync(AQUI)
  .filter((n) => /^f\d\d\.html$/.test(n))
  .sort();

fs.mkdirSync(path.join(AQUI, "cuadros"), { recursive: true });

const navegador = await chromium.launch({ executablePath: EJECUTABLE });
const contexto = await navegador.newContext({
  viewport: { width: 1920, height: 1080 },
  deviceScaleFactor: 1,
});
const pagina = await contexto.newPage();

for (const cuadro of cuadros) {
  await pagina.goto("file://" + path.join(AQUI, cuadro));
  // La tipografia se carga de un archivo local: sin esperarla, el primer
  // cuadro sale con la de respaldo y los demas con Inter.
  await pagina.evaluate(() => document.fonts.ready);
  const destino = path.join(AQUI, "cuadros", cuadro.replace(".html", ".png"));
  await pagina.screenshot({ path: destino });
  console.log(cuadro, "→", path.basename(destino));
}

await navegador.close();
