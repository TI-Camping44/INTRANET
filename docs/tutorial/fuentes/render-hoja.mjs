// La hoja para imprimir: PNG y PDF desde el mismo HTML.
//
// El PDF se arma con `printBackground` y sin margenes: la hoja ya trae
// los suyos en `.hoja`, y dejarselos tambien al PDF los sumaria dos
// veces.
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const EJECUTABLE =
  process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";

const navegador = await chromium.launch({ executablePath: EJECUTABLE });
const contexto = await navegador.newContext({
  viewport: { width: 1080, height: 1528 },
  deviceScaleFactor: 2,
});
const pagina = await contexto.newPage();
await pagina.goto("file://" + path.join(AQUI, "hoja.html"));
await pagina.evaluate(() => document.fonts.ready);

const alto = await pagina.evaluate(() => document.body.scrollHeight);
console.log("alto de la hoja:", alto);

await pagina.screenshot({
  path: path.join(AQUI, "..", "como-ingresar-a-la-intranet.png"),
  fullPage: true,
});
await pagina.pdf({
  path: path.join(AQUI, "..", "como-ingresar-a-la-intranet.pdf"),
  width: "1080px",
  height: alto + "px",
  printBackground: true,
  margin: { top: "0", right: "0", bottom: "0", left: "0" },
});

await navegador.close();
