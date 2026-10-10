/**
 * =====================================================================
 * Importación de la cartera de clientes · Intranet SGC Camping 44 S.A.
 * =====================================================================
 *
 * Lee la exportación de contactos de Odoo (`res.partner`) en CSV y carga
 * `clientes`, que es de donde sale el buscador del alta de un reclamo.
 *
 * SE CORRE EN SU MÁQUINA, NO EN EL SERVIDOR. El archivo tiene la cartera
 * entera —nombres, RUC, correos y teléfonos de clientes— y no pasa por
 * ningún lado más que por su computadora y la base.
 *
 * Uso:
 *   npm run importar-clientes -- --archivo=contactos.csv --ensayo
 *   npm run importar-clientes -- --archivo=contactos.csv
 *   npm run importar-clientes -- --archivo=contactos.csv --solo-clientes
 *
 * `--ensayo` dice qué haría y no escribe nada. Córralo siempre primero.
 *
 * `--solo-clientes` deja afuera los contactos cuyo «Rango del cliente»
 * es 0, que en la exportación son los que nunca compraron. Por omisión
 * entran todos: un reclamo lo puede traer cualquiera, y un contacto de
 * más en el buscador es ruido, pero uno de menos es un reclamo que no se
 * puede registrar.
 *
 * Variables de entorno (ver .env.example):
 *   NEXT_PUBLIC_SUPABASE_URL     obligatoria
 *   SUPABASE_SERVICE_ROLE_KEY    obligatoria
 *
 * VUELVE A CORRER SIN DUPLICAR. La clave es `clientes.codigo`, que
 * guarda el id del contacto en Odoo: lo único que no cambia cuando
 * alguien corrige la razón social o el RUC.
 */

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const ENSAYO = process.argv.includes("--ensayo");
const SOLO_CLIENTES = process.argv.includes("--solo-clientes");

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const CLAVE = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** Cuántas filas van en cada `upsert`. Más que esto y PostgREST corta. */
const TAMANO_TANDA = 500;

function archivoPedido(): string {
  const argumento = process.argv.find((a) => a.startsWith("--archivo="));
  if (!argumento) {
    console.error("✗ Falta --archivo=<ruta del CSV exportado de Odoo>.");
    process.exit(1);
  }
  return argumento.slice("--archivo=".length);
}

/**
 * Un lector de CSV que respeta las comillas.
 *
 * NO ALCANZA CON `split(",")`: la exportación de Odoo trae comas dentro
 * de los campos —«AVENIDA LIBERTAD CASI MARISCAL LOPEZ, SAN PEDRO»— y
 * comillas escritas como dos comillas seguidas, que es como el CSV
 * escribe una comilla de verdad: `"""AMALFI"" SOCIEDAD ANONIMA"`.
 */
function leerCsv(texto: string): string[][] {
  const filas: string[][] = [];
  let fila: string[] = [];
  let campo = "";
  let entreComillas = false;

  // Sin el BOM, que Odoo pone adelante y se pega al primer encabezado.
  const contenido = texto.replace(/^﻿/, "");

  for (let i = 0; i < contenido.length; i += 1) {
    const caracter = contenido[i];

    if (entreComillas) {
      if (caracter === '"') {
        if (contenido[i + 1] === '"') {
          campo += '"';
          i += 1;
        } else {
          entreComillas = false;
        }
      } else {
        campo += caracter;
      }
      continue;
    }

    if (caracter === '"') {
      entreComillas = true;
    } else if (caracter === ",") {
      fila.push(campo);
      campo = "";
    } else if (caracter === "\n") {
      fila.push(campo);
      filas.push(fila);
      fila = [];
      campo = "";
    } else if (caracter !== "\r") {
      campo += caracter;
    }
  }

  if (campo !== "" || fila.length > 0) {
    fila.push(campo);
    filas.push(fila);
  }

  return filas;
}

/** El valor limpio, o null. Odoo escribe «.» y «-» por «no sé». */
function limpio(valor: string | undefined): string | null {
  const texto = (valor ?? "").trim();
  if (texto === "" || texto === "." || texto === "-") return null;
  return texto;
}

/**
 * El teléfono sin el apóstrofo que le pone la planilla.
 *
 * Odoo exporta `'+595 994 306159`: la comilla simple es la marca que usa
 * la hoja de cálculo para que no interprete el número. No es parte del
 * teléfono.
 */
function telefonoLimpio(valor: string | undefined): string | null {
  const texto = limpio(valor);
  return texto ? texto.replace(/^'/, "").trim() || null : null;
}

/**
 * La razón social sin el RUC pegado atrás.
 *
 * «Nombre en pantalla» viene como `"AMALFI" SOCIEDAD ANÓNIMA - 80084235-9`.
 * El RUC se guarda en su columna y se muestra aparte, así que repetirlo
 * en el nombre solo hace más larga cada línea del buscador.
 */
function razonSocialLimpia(nombre: string, ruc: string | null): string {
  if (!ruc) return nombre;
  const sufijo = ` - ${ruc}`;
  return nombre.endsWith(sufijo) ? nombre.slice(0, -sufijo.length).trim() : nombre;
}

async function principal() {
  // EL ENSAYO NO PIDE CREDENCIALES. Solo lee el archivo y dice qué haría:
  // exigir la clave de servicio para eso obligaría a tenerla a mano
  // antes de saber si el archivo siquiera se entiende.
  if (!ENSAYO && (!URL || !CLAVE)) {
    console.error("✗ Faltan NEXT_PUBLIC_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const ruta = archivoPedido();
  const filas = leerCsv(readFileSync(ruta, "utf8"));

  if (filas.length < 2) {
    console.error(`✗ ${ruta} no tiene filas.`);
    process.exit(1);
  }

  const encabezados = filas[0].map((e) => e.trim());
  const columna = (nombre: string) => encabezados.indexOf(nombre);

  // La exportación trae DOS columnas llamadas «RUC»: la primera sin
  // dígito verificador (80084235) y la segunda con él (80084235-9). La
  // que sirve es la segunda, que es como se escribe en una factura.
  const iRucCorto = columna("RUC");
  const iRucLargo = encabezados.indexOf("RUC", iRucCorto + 1);

  const iNombre = columna("Nombre en pantalla");
  const iId = columna("ID");
  const iCorreo = columna("Correo electrónico");
  const iTelefono = columna("Teléfono");
  const iMovil = columna("Móvil");
  const iCiudad = columna("Ciudad");
  const iRangoCliente = columna("Rango del cliente");

  if (iNombre < 0 || iId < 0) {
    console.error(
      "✗ El archivo no tiene las columnas «Nombre en pantalla» e «ID». " +
        "Exporte desde Odoo → Contactos → Exportar, con esos campos.",
    );
    process.exit(1);
  }

  // `empresa_id` es el inquilino de RLS y siempre vale Camping 44,
  // aunque el cliente le compre a Vitalica: no es «de qué empresa habla
  // el registro».
  const supabase =
    URL && CLAVE ? createClient(URL, CLAVE, { auth: { persistSession: false } }) : null;

  let empresaId = "(se resuelve al cargar)";

  if (supabase) {
    const { data: empresas, error: errorEmpresa } = await supabase
      .from("empresas")
      .select("id, nombre")
      .ilike("nombre", "Camping 44%")
      .limit(1);

    if (errorEmpresa || !empresas || empresas.length === 0) {
      console.error("✗ No se encontró la empresa Camping 44 en `empresas`.");
      process.exit(1);
    }

    empresaId = empresas[0].id as string;
  }

  const vistos = new Set<string>();
  const registros: Record<string, unknown>[] = [];
  let sinNombre = 0;
  let sinCodigo = 0;
  let repetidos = 0;
  let fueraPorRango = 0;

  for (const fila of filas.slice(1)) {
    if (fila.length < encabezados.length - 2) continue;

    const codigo = limpio(fila[iId]);
    const nombre = limpio(fila[iNombre]);

    if (!nombre) {
      sinNombre += 1;
      continue;
    }
    if (!codigo) {
      sinCodigo += 1;
      continue;
    }
    if (vistos.has(codigo)) {
      repetidos += 1;
      continue;
    }

    if (SOLO_CLIENTES && iRangoCliente >= 0) {
      const rango = Number(limpio(fila[iRangoCliente]) ?? "0");
      if (!Number.isFinite(rango) || rango <= 0) {
        fueraPorRango += 1;
        continue;
      }
    }

    vistos.add(codigo);

    const ruc = limpio(iRucLargo >= 0 ? fila[iRucLargo] : undefined) ?? limpio(fila[iRucCorto]);

    registros.push({
      empresa_id: empresaId,
      codigo,
      razon_social: razonSocialLimpia(nombre, ruc),
      ruc,
      correo: limpio(iCorreo >= 0 ? fila[iCorreo] : undefined),
      telefono:
        telefonoLimpio(iTelefono >= 0 ? fila[iTelefono] : undefined) ??
        telefonoLimpio(iMovil >= 0 ? fila[iMovil] : undefined),
      ciudad: limpio(iCiudad >= 0 ? fila[iCiudad] : undefined),
      activo: true,
    });
  }

  console.log(`Archivo     ${ruta}`);
  console.log(`Filas       ${filas.length - 1}`);
  console.log(`A cargar    ${registros.length}`);
  if (sinNombre > 0) console.log(`Sin nombre  ${sinNombre} (se saltean)`);
  if (sinCodigo > 0) console.log(`Sin ID      ${sinCodigo} (se saltean)`);
  if (repetidos > 0) console.log(`Repetidos   ${repetidos} (mismo ID de Odoo)`);
  if (fueraPorRango > 0) console.log(`Sin compras ${fueraPorRango} (--solo-clientes)`);

  const conRuc = registros.filter((r) => r.ruc !== null).length;
  console.log(`Con RUC     ${conRuc} de ${registros.length}`);

  if (ENSAYO || !supabase) {
    console.log("\nEnsayo: no se escribió nada. Las tres primeras filas serían:");
    console.log(JSON.stringify(registros.slice(0, 3), null, 2));
    return;
  }

  let cargados = 0;
  for (let desde = 0; desde < registros.length; desde += TAMANO_TANDA) {
    const tanda = registros.slice(desde, desde + TAMANO_TANDA);
    const { error } = await supabase
      .from("clientes")
      .upsert(tanda, { onConflict: "empresa_id,codigo" });

    if (error) {
      console.error(`✗ Falló la tanda que arranca en ${desde}: ${error.message}`);
      process.exit(1);
    }

    cargados += tanda.length;
    process.stdout.write(`\r${cargados} de ${registros.length}…`);
  }

  console.log(`\n✓ ${cargados} clientes cargados.`);
}

principal().catch((error) => {
  console.error(error);
  process.exit(1);
});
