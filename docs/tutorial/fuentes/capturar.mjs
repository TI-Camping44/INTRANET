// Las capturas de la pantalla de ingreso que usa el tutorial.
//
// SE TOMAN DE LA PANTALLA REAL, no se dibujan: el tutorial le muestra a
// la gente lo que va a ver, y una pantalla dibujada a mano envejece sin
// que nadie se entere. Corre contra el servidor de desarrollo porque
// `/ingresar` es publica y no hace falta sesion:
//
//   npm run dev -- -p 3100
//   node docs/tutorial/fuentes/capturar.mjs
//
// Deja tres archivos en `img/` y escribe las medidas que `generar.py` y
// `hoja.html` necesitan para que el anillo y la elipse caigan sobre el
// boton. Si la pantalla de ingreso cambia, se vuelve a correr esto y se
// copian los numeros que imprime.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const AQUI = path.dirname(fileURLToPath(import.meta.url));
const IMG = path.join(AQUI, "img");
const EJECUTABLE =
  process.env.CHROMIUM ?? "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const DIRECCION = process.env.INTRANET ?? "http://localhost:3100/ingresar";

// El alto del celular no es el de un telefono real a proposito: a 844 px
// la pantalla de ingreso queda con tanto blanco arriba y abajo que
// dentro del marco del video no se lee nada.
const CELULAR = { width: 390, height: 780 };
const ESCRITORIO = { width: 1280, height: 860 };

fs.mkdirSync(IMG, { recursive: true });

const navegador = await chromium.launch({ executablePath: EJECUTABLE });

async function abrir(viewport) {
  const contexto = await navegador.newContext({
    viewport,
    deviceScaleFactor: 2,
    colorScheme: "light",
  });
  const pagina = await contexto.newPage();
  await pagina.goto(DIRECCION, { waitUntil: "networkidle" });
  await pagina.evaluate(() => document.fonts.ready);
  return pagina;
}

// --- Celular ---------------------------------------------------------
const movil = await abrir(CELULAR);
const desborde = await movil.evaluate(() => ({
  ancho: document.documentElement.scrollWidth,
  visible: document.documentElement.clientWidth,
}));
// Si la pantalla se desplazara en horizontal, la captura saldria
// cortada: es exactamente lo que le paso a la primera version.
if (desborde.ancho > desborde.visible) {
  throw new Error(
    `La pantalla de ingreso se desplaza en horizontal a ${CELULAR.width} px ` +
      `(${desborde.ancho} > ${desborde.visible}). La captura saldria cortada.`,
  );
}
await movil.screenshot({ path: path.join(IMG, "celular.png") });

// --- Escritorio ------------------------------------------------------
const escritorio = await abrir(ESCRITORIO);
await escritorio.screenshot({ path: path.join(IMG, "ingreso.png") });

const boton = await escritorio
  .getByRole("button", { name: /Google/i })
  .boundingBox();

// La caja de todo el bloque de ingreso, para recortar la figura de la
// hoja impresa con un margen parejo.
const caja = await escritorio.evaluate(() => {
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const elemento of document.querySelectorAll("main *")) {
    const r = elemento.getBoundingClientRect();
    if (r.width === 0 || r.height === 0 || r.width > 1200) continue;
    x1 = Math.min(x1, r.left); y1 = Math.min(y1, r.top);
    x2 = Math.max(x2, r.right); y2 = Math.max(y2, r.bottom);
  }
  return { x1, y1, x2, y2 };
});

await navegador.close();

// --- El recorte de la hoja, y las medidas -----------------------------
const MARGEN = 40;
const recorte = {
  x: caja.x1 - MARGEN,
  y: caja.y1 - MARGEN,
  ancho: caja.x2 - caja.x1 + MARGEN * 2,
  alto: caja.y2 - caja.y1 + MARGEN * 2,
};

const recortador = await chromium.launch({ executablePath: EJECUTABLE });
const ctx = await recortador.newContext({
  viewport: ESCRITORIO,
  deviceScaleFactor: 2,
  colorScheme: "light",
});
const pagina = await ctx.newPage();
await pagina.goto(DIRECCION, { waitUntil: "networkidle" });
await pagina.evaluate(() => document.fonts.ready);
await pagina.screenshot({
  path: path.join(IMG, "ingreso-recorte.png"),
  clip: { x: recorte.x, y: recorte.y, width: recorte.ancho, height: recorte.alto },
});
await recortador.close();

const centro = { x: boton.x + boton.width / 2, y: boton.y + boton.height / 2 };

console.log("capturas en img/: celular.png, ingreso.png, ingreso-recorte.png");
console.log("");
console.log("generar.py — el centro del boton, en px CSS a %d de ancho:", ESCRITORIO.width);
console.log("  BOTON_CENTRO_X = %s", centro.x.toFixed(1));
console.log("  BOTON_CENTRO_Y = %s", centro.y.toFixed(1));
console.log("");
console.log("hoja.html — donde cae el boton dentro del recorte:");
console.log("  .elipse  left: %s%%   top: %s%%",
  (((centro.x - recorte.x) / recorte.ancho) * 100).toFixed(1),
  (((centro.y - recorte.y) / recorte.alto) * 100).toFixed(1));
console.log("  el boton mide %s x %s px sobre una figura de 620 px de ancho",
  ((boton.width / recorte.ancho) * 620).toFixed(0),
  ((boton.height / recorte.ancho) * 620).toFixed(0));
