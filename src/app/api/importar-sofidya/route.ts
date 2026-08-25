import { NextResponse, type NextRequest } from "next/server";
import { nombreDelSecretoEnUso, revisarSecreto } from "@/lib/trabajos-programados";

/**
 * Sondeo del API de Sofidya.
 *
 * Existe por una razón concreta: la pantalla de clave API solo documenta
 * los comandos de «Listados Predefinidos», y hay que saber si el API
 * expone además riesgos, no conformidades, auditorías y personas, que es
 * lo que falta traer. Se pregunta en vez de suponer.
 *
 * La documentación de Sofidya fija tres cosas que conviene no olvidar:
 *
 *   · El endpoint es https://www.sofidya.com/api/api.php
 *   · Los parámetros van codificados en la URL (`command`, `SecretKey`),
 *     no como cuerpo JSON.
 *   · Los comandos están EN INGLÉS: el ejemplo es `get_organizations`.
 *     `scripts/migrar-sofidya.ts` los tiene en español y por lo tanto
 *     mal; este sondeo es lo que va a decir cuáles son los correctos.
 *
 * El código de respuesta es lo que hace útil al sondeo:
 *   1000  el comando existe y devolvió datos
 *   2000  parámetro desconocido: el comando NO existe
 *   3000  no se encontró la clave
 *   3010  clave errónea o usuario inactivo
 *
 * NO ESCRIBE NADA. Ni en Sofidya, ni en la base. Solo pregunta.
 *
 * Uso:
 *   /api/importar-sofidya?secreto=<CRON_SECRET>
 *   /api/importar-sofidya?secreto=<...>&comandos=get_risks,get_audits
 *
 *   Y para los comandos que responden 2010 «falta de parametro»:
 *
 *   /api/importar-sofidya?secreto=<...>&comando=get_procedures
 *   /api/importar-sofidya?secreto=<...>&comando=get_assets&valor=1
 *
 * De cada comando informa el estado, la cantidad de registros y los
 * nombres de los campos, nunca su contenido. La clave sale de la
 * variable de entorno y no aparece en la respuesta.
 *
 * Es temporal: se elimina cuando sepamos qué expone el API.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Candidatos a sondear, agrupados por el módulo que muestra la barra de
 * navegación de Sofidya. Varios nombres por módulo a propósito: no hay
 * índice de comandos publicado, y un comando inexistente solo cuesta un
 * código 2000.
 */
const CANDIDATOS: Record<string, readonly string[]> = {
  organizacion: ["get_organizations", "get_sites", "get_locations"],
  personas: ["get_people", "get_persons", "get_employees", "get_users"],
  puestos: ["get_positions", "get_jobs"],
  procesos: ["get_processes", "get_standards", "get_norms"],
  documentos: ["get_documents"],
  objetivos: ["get_objectives", "get_goals"],
  riesgos: ["get_risks"],
  comunicaciones: ["get_communications"],
  indicadores: ["get_indicators", "get_kpis"],
  no_conformidades: ["get_nonconformities", "get_non_conformities"],
  auditorias: ["get_audits"],
  denuncias: ["get_complaints", "get_reports"],
  proveedores: ["get_suppliers", "get_providers"],
  clientes: ["get_customers", "get_clients"],
  equipamientos: ["get_equipments", "get_assets"],
  listados: ["get_inf_predefined_lists", "get_predefined_lists"],
};

/** Código que Sofidya devuelve cuando el comando no existe. */
const CODIGO_COMANDO_INEXISTENTE = "2000";
const CODIGOS_DE_AUTENTICACION = ["3000", "3010"];

interface Sondeo {
  comando: string;
  modulo: string;
  existe: boolean;
  codigo: string | null;
  estado: string | null;
  registros: number | null;
  campos: string[] | null;
  mensaje: string | null;
}

async function sondear(
  urlBase: string,
  clave: string,
  comando: string,
  modulo: string,
): Promise<Sondeo> {
  const base: Sondeo = {
    comando,
    modulo,
    existe: false,
    codigo: null,
    estado: null,
    registros: null,
    campos: null,
    mensaje: null,
  };

  try {
    // Parámetros codificados en la URL, como documenta Sofidya.
    const url = new URL(urlBase);
    url.searchParams.set("command", comando);
    url.searchParams.set("SecretKey", clave);

    const respuesta = await fetch(url, {
      method: "GET",
      signal: AbortSignal.timeout(10_000),
    });

    const cuerpo = await respuesta.text();

    if (!respuesta.ok) {
      return { ...base, mensaje: `HTTP ${respuesta.status}. Empieza con: ${cuerpo.slice(0, 120)}` };
    }

    let json: unknown;
    try {
      json = JSON.parse(cuerpo);
    } catch {
      return {
        ...base,
        mensaje:
          "La respuesta no es JSON, así que la URL no apunta al endpoint. " +
          `Empieza con: ${cuerpo.slice(0, 120)}`,
      };
    }

    const datos = json as {
      status?: string;
      code?: string | number;
      data?: unknown;
      message?: string;
    };
    const codigo = datos.code === undefined || datos.code === null ? null : String(datos.code);
    const filas = Array.isArray(datos.data) ? (datos.data as Record<string, unknown>[]) : null;

    return {
      comando,
      modulo,
      existe: codigo !== CODIGO_COMANDO_INEXISTENTE && datos.status === "SUCCESS",
      codigo,
      estado: datos.status ?? null,
      registros: filas ? filas.length : null,
      // Solo los nombres de las columnas: es lo que hace falta para
      // mapear al esquema y no revela ningún dato de la empresa.
      campos: filas && filas.length > 0 ? Object.keys(filas[0]) : null,
      mensaje: datos.message ?? null,
    };
  } catch (error) {
    return { ...base, mensaje: `No se pudo conectar: ${(error as Error).message}` };
  }
}

/**
 * Nombres candidatos para el parametro que piden los comandos que
 * contestan 2010. Salen de como Sofidya nombra las cosas en el resto del
 * API: `get_users` trae `id_puesto` e `id_sedes`, asi que el prefijo
 * `id_` es la forma mas probable.
 */
const PARAMETROS_CANDIDATOS = [
  "id_organizations",
  "id_organization",
  "organization",
  "id_org",
  "id",
  "id_organizaciones",
  "id_sedes",
  "id_offices",
  "id_processes",
  "id_norms",
  "type",
  "tipo",
] as const;

/** Prueba un comando con un parametro y describe que contesto. */
async function sondearConParametro(
  urlBase: string,
  clave: string,
  comando: string,
  parametro: string,
  valor: string,
): Promise<Sondeo & { parametro: string }> {
  const vacio = {
    comando,
    parametro,
    modulo: "con parametro",
    existe: false,
    codigo: null,
    estado: null,
    registros: null,
    campos: null,
    mensaje: null,
  } as Sondeo & { parametro: string };

  try {
    const url = new URL(urlBase);
    url.searchParams.set("command", comando);
    url.searchParams.set("SecretKey", clave);
    url.searchParams.set(parametro, valor);

    const respuesta = await fetch(url, { method: "GET", signal: AbortSignal.timeout(10_000) });
    const datos = JSON.parse(await respuesta.text()) as {
      status?: string;
      code?: string | number;
      data?: unknown;
      message?: string;
    };
    const codigo = datos.code === undefined || datos.code === null ? null : String(datos.code);
    const filas = Array.isArray(datos.data) ? (datos.data as Record<string, unknown>[]) : null;

    return {
      ...vacio,
      // Cualquier respuesta que no sea «falta de parametro» ni «comando
      // desconocido» significa que el nombre fue aceptado.
      existe: codigo !== "2010" && codigo !== "2000",
      codigo,
      estado: datos.status ?? null,
      registros: filas ? filas.length : null,
      campos: filas && filas.length > 0 ? Object.keys(filas[0]) : null,
      mensaje: datos.message ?? null,
    };
  } catch (error) {
    return { ...vacio, mensaje: `No se pudo conectar: ${(error as Error).message}` };
  }
}

export async function GET(peticion: NextRequest) {
  const enlace = peticion.nextUrl.searchParams.get("secreto");
  const rechazo = revisarSecreto(peticion.headers.get("authorization"), enlace);

  if (rechazo === "sin_secreto") {
    return NextResponse.json(
      {
        error: "CRON_SECRET no está configurada",
        detalle:
          "Cárguela en Vercel (Settings → Environment Variables) y vuelva a " +
          "desplegar. Es la que protege esta ruta: sin ella no se puede entrar.",
      },
      { status: 503 },
    );
  }

  if (rechazo) {
    return NextResponse.json(
      {
        error: "No autorizado",
        detalle:
          "El valor de ?secreto= no coincide con el guardado en Vercel. " +
          "Cópielo de allí tal cual: no es un texto de ejemplo.",
        // El nombre de la variable, no su valor: si acá dice CRON_SECRETO
        // es que CRON_SECRET no existe y está usando la vieja.
        comparadoContra: nombreDelSecretoEnUso(),
        recibioParametro: enlace !== null,
      },
      { status: 401 },
    );
  }

  const url = process.env.SOFIDYA_API_URL;
  const clave = process.env.SOFIDYA_SECRET_KEY;

  if (!url || !clave) {
    return NextResponse.json(
      {
        error: "Faltan variables de entorno",
        detalle:
          "Cargue SOFIDYA_API_URL y SOFIDYA_SECRET_KEY en Vercel " +
          "(Settings → Environment Variables) y vuelva a desplegar: las " +
          "variables nuevas no se toman hasta el despliegue siguiente.",
        presentes: { SOFIDYA_API_URL: Boolean(url), SOFIDYA_SECRET_KEY: Boolean(clave) },
      },
      { status: 400 },
    );
  }

  // Modo «buscar el parámetro»: un solo comando, muchos nombres.
  const comandoUnico = peticion.nextUrl.searchParams.get("comando");

  if (comandoUnico) {
    const valor = peticion.nextUrl.searchParams.get("valor") ?? "1";
    const nombres = peticion.nextUrl.searchParams
      .get("parametros")
      ?.split(",")
      .map((n) => n.trim())
      .filter(Boolean) ?? [...PARAMETROS_CANDIDATOS];

    const intentos: (Sondeo & { parametro: string })[] = [];
    for (let i = 0; i < nombres.length; i += 5) {
      intentos.push(
        ...(await Promise.all(
          nombres.slice(i, i + 5).map((n) => sondearConParametro(url, clave, comandoUnico, n, valor)),
        )),
      );
    }

    return NextResponse.json({
      consultado: new URL(url).host,
      comando: comandoUnico,
      valorProbado: valor,
      aceptados: intentos.filter((i) => i.existe).map((i) => `${i.parametro} (${i.registros ?? 0})`),
      siguenPidiendoParametro: intentos.filter((i) => i.codigo === "2010").map((i) => i.parametro),
      rechazados: intentos.filter((i) => i.codigo === "2000").map((i) => i.parametro),
      detalle: intentos,
    });
  }

  // Permite sondear una lista propia, para cuando ya sepamos por dónde ir.
  const pedidos = peticion.nextUrl.searchParams.get("comandos");
  const lista: { comando: string; modulo: string }[] = pedidos
    ? pedidos
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean)
        .map((comando) => ({ comando, modulo: "a pedido" }))
    : Object.entries(CANDIDATOS).flatMap(([modulo, comandos]) =>
        comandos.map((comando) => ({ comando, modulo })),
      );

  // Canario: si la clave está mal, no tiene sentido hacer treinta
  // pedidos para que fallen todos igual.
  const canario = await sondear(url, clave, lista[0].comando, lista[0].modulo);

  if (canario.codigo && CODIGOS_DE_AUTENTICACION.includes(canario.codigo)) {
    return NextResponse.json(
      {
        error: "Sofidya rechazó la clave",
        codigo: canario.codigo,
        detalle:
          canario.codigo === "3000"
            ? "No se encontró la clave API. Revise que SOFIDYA_SECRET_KEY esté bien copiada."
            : "La clave es errónea o el usuario no está activo. Genere una nueva en Sofidya.",
      },
      { status: 502 },
    );
  }

  // De a cinco: son pedidos a un sistema ajeno y hay un minuto de tope.
  const sondeos: Sondeo[] = [canario];
  const restantes = lista.slice(1);

  for (let i = 0; i < restantes.length; i += 5) {
    const tanda = restantes.slice(i, i + 5);
    sondeos.push(
      ...(await Promise.all(tanda.map((t) => sondear(url, clave, t.comando, t.modulo)))),
    );
  }

  const existen = sondeos.filter((s) => s.existe);
  const modulosConDatos = Array.from(
    new Set(existen.filter((s) => (s.registros ?? 0) > 0).map((s) => s.modulo)),
  );

  return NextResponse.json({
    consultado: new URL(url).host,
    sondeados: sondeos.length,
    existen: existen.length,
    conDatos: existen.filter((s) => (s.registros ?? 0) > 0).map((s) => `${s.comando} (${s.registros})`),
    vacios: existen.filter((s) => (s.registros ?? 0) === 0).map((s) => s.comando),
    noExisten: sondeos.filter((s) => !s.existe).map((s) => s.comando),
    modulosConDatos,
    modulosSinNingunComando: Object.keys(CANDIDATOS).filter(
      (m) => !existen.some((s) => s.modulo === m),
    ),
    detalle: sondeos,
  });
}
