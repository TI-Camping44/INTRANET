/**
 * =====================================================================
 * Importación desde Sofidya · Intranet SGC Camping 44 S.A.
 * =====================================================================
 *
 * La lógica vive en `src/lib/sofidya.ts`, compartida con la ruta
 * `/api/importar-sofidya`. Acá solo se arma el entorno y se imprime el
 * resultado: son dos maneras de disparar lo mismo.
 *
 * Uso:
 *   npm run migrar-sofidya -- --ensayo              qué haría, sin escribir
 *   npm run migrar-sofidya                          importa de verdad
 *   npm run migrar-sofidya -- --entidades=activos   solo una parte
 *
 * Variables de entorno (ver .env.example):
 *   NEXT_PUBLIC_SUPABASE_URL     obligatoria
 *   SUPABASE_SERVICE_ROLE_KEY    obligatoria
 *   SOFIDYA_API_URL              endpoint del API
 *   SOFIDYA_SECRET_KEY           clave de Sofidya
 *
 * La clave NUNCA se escribe en el repositorio.
 *
 * Lo que el API no expone —documentos, objetivos, riesgos, indicadores,
 * no conformidades, auditorías, comunicaciones y denuncias— hay que
 * exportarlo a mano desde Sofidya. Ver docs/api-sofidya.md.
 */

import { createClient } from "@supabase/supabase-js";
import {
  ClienteSofidya,
  ENTIDADES,
  importarDesdeSofidya,
  type Entidad,
} from "../src/lib/sofidya";

const ENSAYO = process.argv.includes("--ensayo");

const URL_API = process.env.SOFIDYA_API_URL ?? "https://www.sofidya.com/api/api.php";
const CLAVE = process.env.SOFIDYA_SECRET_KEY;

/** `--entidades=activos,puestos` para traer solo una parte. */
function entidadesPedidas(): readonly Entidad[] {
  const argumento = process.argv.find((a) => a.startsWith("--entidades="));
  if (!argumento) return ENTIDADES;

  const pedidas = argumento
    .slice("--entidades=".length)
    .split(",")
    .map((e) => e.trim())
    .filter((e): e is Entidad => (ENTIDADES as readonly string[]).includes(e));

  return pedidas.length > 0 ? pedidas : ENTIDADES;
}

async function principal() {
  if (!CLAVE) {
    console.error("✗ Falta SOFIDYA_SECRET_KEY. Cárguela en .env.local.");
    process.exit(1);
  }

  const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!urlSupabase || !claveServicio) {
    console.error("✗ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(urlSupabase, claveServicio, { auth: { persistSession: false } });

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, nombre")
    .order("creado_en")
    .limit(1)
    .maybeSingle();

  if (!empresa) {
    console.error("✗ No hay ninguna empresa cargada. Aplique el seed primero.");
    process.exit(1);
  }

  const entidades = entidadesPedidas();

  console.log(ENSAYO ? "ENSAYO · no se escribe nada" : "IMPORTACIÓN · se escribe en la base");
  console.log(`Empresa:   ${empresa.nombre}`);
  console.log(`Origen:    ${new URL(URL_API).host}`);
  console.log(`Entidades: ${entidades.join(", ")}`);
  console.log();

  const resultados = await importarDesdeSofidya(
    supabase,
    new ClienteSofidya(URL_API, CLAVE),
    empresa.id,
    { entidades, ensayo: ENSAYO },
  );

  if (!ENSAYO) {
    for (const r of resultados) {
      await supabase.from("importaciones_sofidya").insert({
        comando: r.entidad,
        registros_recibidos: r.recibidos,
        registros_importados: r.importados,
        tabla_destino: r.tabla,
        observacion: r.observacion,
      });
    }
  }

  console.log("Resumen");
  console.log("-".repeat(66));
  for (const r of resultados) {
    console.log(
      `  ${r.entidad.padEnd(13)} ${String(r.recibidos).padStart(5)} → ` +
        `${String(r.importados).padStart(5)}  ${r.tabla}`,
    );
    console.log(`      ${r.observacion}`);
  }
  console.log("-".repeat(66));

  const recibidos = resultados.reduce((suma, r) => suma + r.recibidos, 0);
  const importados = resultados.reduce((suma, r) => suma + r.importados, 0);
  console.log(`  ${recibidos} recibidos, ${importados} importados.`);
  console.log();
  console.log(
    "Riesgos, no conformidades, auditorías, indicadores, objetivos y\n" +
      "documentos NO vienen por el API: hay que exportarlos a mano desde\n" +
      "Sofidya. Ver docs/api-sofidya.md.",
  );
}

principal().catch((error) => {
  console.error("\n✗ La importación falló:", (error as Error).message);
  process.exit(1);
});
