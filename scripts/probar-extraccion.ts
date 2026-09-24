import { readFileSync } from "node:fs";
import { extraerTexto } from "@/lib/extraer-texto";

const ruta = process.argv[2];
const bytes = readFileSync(ruta);
const buffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);

async function principal() {
  const pdf = await extraerTexto(buffer as ArrayBuffer, "ejemplo.pdf", "application/pdf");
  console.log("PDF  →", JSON.stringify(pdf, null, 2));
  const otro = await extraerTexto(buffer as ArrayBuffer, "planilla.xlsx", null);
  console.log("XLSX →", otro, "(null es lo correcto: no se indexa)");
}

principal().catch((e) => {
  console.error("FALLO:", e);
  process.exit(1);
});
