import { NextResponse, type NextRequest } from "next/server";

/**
 * Sondeo del API de Sofidya.
 *
 * Existe por una razón concreta: la pantalla de clave API de Sofidya solo
 * documenta los comandos de «Listados Predefinidos», y el script de
 * importación asume diez comandos más. Antes de apostar la migración al
 * API hay que saber cuáles responden de verdad.
 *
 * Esto es lo que hace `npm run migrar-sofidya -- --ensayo`, pero servido
 * como página, porque el entorno donde se desarrolla no tiene salida
 * hacia sofidya.com y el despliegue de Vercel sí.
 *
 * NO ESCRIBE NADA. Ni en Sofidya, ni en la base. Solo pregunta y reporta.
 *
 * Uso:
 *   /api/importar-sofidya?secreto=<CRON_SECRETO>
 *
 * La clave de Sofidya sale de la variable de entorno y nunca se devuelve
 * en la respuesta: de cada comando se informa el estado, la cantidad de
 * registros y los nombres de los campos, jamás su contenido.
 *
 * Es temporal. Una vez que sepamos qué expone el API, se elimina.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Los diez comandos que asume `scripts/migrar-sofidya.ts`, más los que
 * se deducen de los módulos que Sofidya muestra en su propia barra de
 * navegación. Los segundos son tentativos a propósito: la gracia del
 * sondeo es descubrir cuáles existen.
 */
const COMANDOS_CONOCIDOS = [
  "get_organizaciones",
  "get_sedes",
  "get_normas",
  "get_procesos",
  "get_activos",
  "get_puestos",
  "get_personas",
  "get_clientes",
  "get_proveedores",
  "get_inf_listados_predef",
] as const;

const COMANDOS_TENTATIVOS = [
  "get_documentos",
  "get_objetivos",
  "get_riesgos",
  "get_comunicaciones",
  "get_indicadores",
  "get_no_conformidades",
  "get_noconformidades",
  "get_auditorias",
  "get_denuncias",
  "get_equipamientos",
] as const;

interface Sondeo {
  comando: string;
  responde: boolean;
  estado: string | null;
  codigo: string | number | null;
  registros: number | null;
  campos: string[] | null;
  mensaje: string | null;
}

/** Pide un comando y describe la respuesta sin exponer su contenido. */
async function sondear(url: string, clave: string, comando: string): Promise<Sondeo> {
  const base: Sondeo = {
    comando,
    responde: false,
    estado: null,
    codigo: null,
    registros: null,
    campos: null,
    mensaje: null,
  };

  try {
    const respuesta = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: comando, SecretKey: clave }),
      signal: AbortSignal.timeout(15_000),
    });

    const cuerpo = await respuesta.text();

    if (!respuesta.ok) {
      return {
        ...base,
        codigo: respuesta.status,
        // El principio del cuerpo suele decir más que el código: si el
        // API devuelve HTML, es que la URL no es la del endpoint.
        mensaje: `HTTP ${respuesta.status}. Empieza con: ${cuerpo.slice(0, 120)}`,
      };
    }

    let json: unknown;
    try {
      json = JSON.parse(cuerpo);
    } catch {
      return {
        ...base,
        mensaje:
          "La respuesta no es JSON. Probablemente SOFIDYA_API_URL no apunta al " +
          `endpoint del API. Empieza con: ${cuerpo.slice(0, 120)}`,
      };
    }

    const datos = json as { status?: string; code?: string | number; data?: unknown; message?: string };
    const filas = Array.isArray(datos.data) ? (datos.data as Record<string, unknown>[]) : null;

    return {
      comando,
      responde: datos.status === "SUCCESS",
      estado: datos.status ?? null,
      codigo: datos.code ?? null,
      registros: filas ? filas.length : null,
      // Solo los nombres de las columnas: sirven para mapear al esquema
      // y no revelan ningún dato.
      campos: filas && filas.length > 0 ? Object.keys(filas[0]) : null,
      mensaje: datos.message ?? null,
    };
  } catch (error) {
    return { ...base, mensaje: `No se pudo conectar: ${(error as Error).message}` };
  }
}

export async function GET(peticion: NextRequest) {
  const secreto = process.env.CRON_SECRETO;
  const cabecera = peticion.headers.get("authorization");
  const enlace = peticion.nextUrl.searchParams.get("secreto");

  // Se acepta por cabecera, como el trabajo de alertas, y por parámetro,
  // para poder abrirlo desde el navegador sin herramientas.
  const autorizado =
    Boolean(secreto) && (cabecera === `Bearer ${secreto}` || enlace === secreto);

  if (!autorizado) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const url = process.env.SOFIDYA_API_URL;
  const clave = process.env.SOFIDYA_SECRET_KEY;

  if (!url || !clave) {
    return NextResponse.json(
      {
        error: "Faltan variables de entorno",
        detalle:
          "Cargue SOFIDYA_API_URL y SOFIDYA_SECRET_KEY en Vercel " +
          "(Settings → Environment Variables) y vuelva a desplegar.",
        presentes: { SOFIDYA_API_URL: Boolean(url), SOFIDYA_SECRET_KEY: Boolean(clave) },
      },
      { status: 400 },
    );
  }

  const comandos = [...COMANDOS_CONOCIDOS, ...COMANDOS_TENTATIVOS];
  const sondeos: Sondeo[] = [];

  // En serie y no en paralelo: son veinte pedidos a un sistema ajeno que
  // no conocemos, y no hay apuro.
  for (const comando of comandos) {
    sondeos.push(await sondear(url, clave, comando));
  }

  const responden = sondeos.filter((s) => s.responde);

  return NextResponse.json({
    // Se confirma a qué host se preguntó, sin la ruta ni la clave.
    consultado: new URL(url).host,
    total: sondeos.length,
    responden: responden.length,
    conDatos: responden.filter((s) => (s.registros ?? 0) > 0).map((s) => s.comando),
    vacios: responden.filter((s) => (s.registros ?? 0) === 0).map((s) => s.comando),
    noExisten: sondeos.filter((s) => !s.responde).map((s) => s.comando),
    detalle: sondeos,
  });
}
