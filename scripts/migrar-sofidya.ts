/**
 * =====================================================================
 * Importación desde Sofidya · Intranet SGC Camping 44 S.A.
 * =====================================================================
 *
 * Trae a la intranet lo que Sofidya expone por su API. El contrato está
 * documentado en `docs/api-sofidya.md`; lo esencial:
 *
 *   · Endpoint https://www.sofidya.com/api/api.php
 *   · Parámetros codificados en la URL: `command` y `SecretKey`
 *   · Los comandos son en inglés, y son diez de listado
 *   · Sedes, procesos y activos se piden encadenados:
 *       organización → sede → procesos y activos
 *
 * NO trae documentos, objetivos, riesgos, indicadores, no conformidades,
 * auditorías, comunicaciones ni denuncias: el API no los expone. Eso hay
 * que exportarlo a mano desde la interfaz de Sofidya.
 *
 * Uso:
 *   npm run migrar-sofidya -- --ensayo   muestra qué haría, sin escribir
 *   npm run migrar-sofidya               importa de verdad
 *
 * Variables de entorno (ver .env.example):
 *   NEXT_PUBLIC_SUPABASE_URL     obligatoria
 *   SUPABASE_SERVICE_ROLE_KEY    obligatoria
 *   SOFIDYA_API_URL              endpoint del API
 *   SOFIDYA_SECRET_KEY           clave de Sofidya
 *
 * La clave NUNCA se escribe en el repositorio.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------

const ENSAYO = process.argv.includes("--ensayo");

const URL_API = process.env.SOFIDYA_API_URL ?? "https://www.sofidya.com/api/api.php";
const CLAVE = process.env.SOFIDYA_SECRET_KEY;

/**
 * Prefijo de los códigos que se generan acá.
 *
 * Sofidya no le pone código a los puestos, clientes ni proveedores, pero
 * el esquema lo exige. Antes que inventar uno con pinta de código real
 * de Calidad, se deriva del identificador interno de Sofidya y se marca
 * de dónde salió. Cuando Calidad los codifique de verdad, se reemplazan.
 */
const PREFIJO = "SOF";

interface RespuestaSofidya {
  status?: "SUCCESS" | "ERROR";
  code?: string | number;
  data?: unknown;
  message?: string;
}

type Fila = Record<string, unknown>;

interface Resultado {
  entidad: string;
  recibidos: number;
  importados: number;
  tabla: string;
  observacion: string;
}

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const cadena = String(valor).trim();
  return cadena === "" ? null : cadena;
}

/** Sofidya devuelve los booleanos como "1"/"0". */
function booleano(valor: unknown, porDefecto = true): boolean {
  const cadena = texto(valor);
  if (cadena === null) return porDefecto;
  return ["1", "true", "t", "s", "si", "sí", "y"].includes(cadena.toLowerCase());
}

/**
 * Sofidya clasifica los procesos en Estratégico, Misional y Soporte.
 * «Misional» y «operativo» son el mismo concepto con distinto nombre; se
 * respeta el del enum para no tocar el esquema por una palabra.
 */
function tipoProceso(valor: unknown): "estrategico" | "operativo" | "apoyo" {
  const cadena = (texto(valor) ?? "").toLowerCase();
  if (cadena.startsWith("estrat")) return "estrategico";
  if (cadena.startsWith("sopor") || cadena.startsWith("apoy")) return "apoyo";
  return "operativo";
}

function registrar(mensaje = "") {
  console.log(mensaje);
}

// ---------------------------------------------------------------------
// Cliente del API
// ---------------------------------------------------------------------

class Sofidya {
  constructor(
    private readonly url: string,
    private readonly clave: string,
  ) {}

  /**
   * Pide un comando y devuelve sus filas.
   *
   * Los códigos de error de Sofidya se traducen a mensajes que digan qué
   * pasó: `2000` es comando inexistente, `2010` parámetro faltante,
   * `3010` clave rechazada. Un `throw` con «ERROR» a secas no ayuda a
   * nadie a las once de la noche.
   */
  async listar(comando: string, extra: Record<string, string> = {}): Promise<Fila[]> {
    const url = new URL(this.url);
    url.searchParams.set("command", comando);
    url.searchParams.set("SecretKey", this.clave);
    for (const [nombre, valor] of Object.entries(extra)) url.searchParams.set(nombre, valor);

    const respuesta = await fetch(url, { method: "GET", signal: AbortSignal.timeout(30_000) });
    if (!respuesta.ok) {
      throw new Error(`${comando}: el API respondió HTTP ${respuesta.status}.`);
    }

    const cuerpo = await respuesta.text();
    let datos: RespuestaSofidya;
    try {
      datos = JSON.parse(cuerpo) as RespuestaSofidya;
    } catch {
      throw new Error(
        `${comando}: la respuesta no es JSON. Revise SOFIDYA_API_URL. ` +
          `Empieza con: ${cuerpo.slice(0, 100)}`,
      );
    }

    const codigo = String(datos.code ?? "");
    if (codigo === "2000") throw new Error(`${comando}: el comando no existe en el API.`);
    if (codigo === "2010") throw new Error(`${comando}: falta un parámetro obligatorio.`);
    if (codigo === "3000" || codigo === "3010") {
      throw new Error("Sofidya rechazó la clave. Regenérela y actualice SOFIDYA_SECRET_KEY.");
    }
    if (datos.status !== "SUCCESS") {
      throw new Error(`${comando}: ${datos.message ?? `respuesta ${codigo}`}.`);
    }

    return Array.isArray(datos.data) ? (datos.data as Fila[]) : [];
  }
}

// ---------------------------------------------------------------------
// Escritura
// ---------------------------------------------------------------------

/**
 * Inserta o actualiza por una clave natural. Devuelve el id del
 * registro, que hace falta para encadenar (una sede necesita saber su
 * propio id para colgarle los activos).
 */
async function guardar(
  supabase: SupabaseClient,
  tabla: string,
  clave: Record<string, unknown>,
  datos: Record<string, unknown>,
): Promise<string | null> {
  let consulta = supabase.from(tabla).select("id");
  for (const [columna, valor] of Object.entries(clave)) {
    consulta = typeof valor === "string" ? consulta.ilike(columna, valor) : consulta.eq(columna, valor);
  }

  const { data: existente } = await consulta.maybeSingle();

  if (ENSAYO) return existente?.id ?? null;

  if (existente) {
    await supabase.from(tabla).update(datos).eq("id", existente.id);
    return existente.id;
  }

  const { data: creado, error } = await supabase
    .from(tabla)
    .insert({ ...clave, ...datos })
    .select("id")
    .single();

  if (error) throw new Error(`${tabla}: ${error.message}`);
  return creado?.id ?? null;
}

// ---------------------------------------------------------------------
// Importación
// ---------------------------------------------------------------------

async function principal() {
  if (!CLAVE) {
    registrar("✗ Falta SOFIDYA_SECRET_KEY. Cárguela en .env.local y vuelva a intentar.");
    process.exit(1);
  }

  const urlSupabase = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const claveServicio = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!urlSupabase || !claveServicio) {
    registrar("✗ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.");
    process.exit(1);
  }

  const supabase = createClient(urlSupabase, claveServicio, {
    auth: { persistSession: false },
  });
  const sofidya = new Sofidya(URL_API, CLAVE);

  const { data: empresa } = await supabase
    .from("empresas")
    .select("id, nombre")
    .order("creado_en")
    .limit(1)
    .maybeSingle();

  if (!empresa) {
    registrar("✗ No hay ninguna empresa cargada. Aplique el seed primero.");
    process.exit(1);
  }

  registrar(ENSAYO ? "ENSAYO · no se escribe nada" : "IMPORTACIÓN · se escribe en la base");
  registrar(`Empresa: ${empresa.nombre}`);
  registrar(`Origen:  ${new URL(URL_API).host}`);
  registrar();

  const resultados: Resultado[] = [];
  const anotar = (r: Resultado) => {
    resultados.push(r);
    registrar(`  ${r.recibidos} recibidos → ${r.importados} en ${r.tabla}`);
  };

  // -------------------------------------------------------------------
  // Normas
  // -------------------------------------------------------------------
  registrar("· Normas");
  const normas = await sofidya.listar("get_norms");
  let n = 0;
  for (const fila of normas) {
    const denominacion = texto(fila.denominacion);
    if (!denominacion) continue;
    await guardar(
      supabase,
      "normas",
      { codigo: denominacion },
      { nombre: denominacion, descripcion: texto(fila.descripcion), vigente: true },
    );
    n += 1;
  }
  anotar({
    entidad: "normas",
    recibidos: normas.length,
    importados: n,
    tabla: "normas",
    observacion: "Se identifican por su denominación, que hace de código.",
  });

  // -------------------------------------------------------------------
  // Organizaciones y sedes
  // -------------------------------------------------------------------
  registrar("· Organizaciones y sedes");
  const organizaciones = await sofidya.listar("get_organizations");
  const sedesPorIdSofidya = new Map<string, string>();
  let s = 0;
  let totalSedes = 0;

  for (const organizacion of organizaciones) {
    const idOrganizacion = texto(organizacion.id);
    if (!idOrganizacion) continue;

    const sedes = await sofidya.listar("get_offices", { id_organizacion: idOrganizacion });
    totalSedes += sedes.length;

    for (const fila of sedes) {
      const nombre = texto(fila.denominacion);
      if (!nombre) continue;

      const id = await guardar(
        supabase,
        "sedes",
        { empresa_id: empresa.id, nombre },
        {
          direccion: texto(fila.direccion),
          ciudad: texto(fila.localidad),
          activa: true,
        },
      );
      const idSofidya = texto(fila.id);
      if (id && idSofidya) sedesPorIdSofidya.set(idSofidya, id);
      s += 1;
    }
  }
  anotar({
    entidad: "sedes",
    recibidos: totalSedes,
    importados: s,
    tabla: "sedes",
    observacion: `De ${organizaciones.length} organización(es). Se identifican por nombre.`,
  });

  // -------------------------------------------------------------------
  // Puestos
  // -------------------------------------------------------------------
  registrar("· Puestos");
  const puestos = await sofidya.listar("get_jobs");
  let p = 0;
  for (const fila of puestos) {
    const nombre = texto(fila.denominacion);
    const idSofidya = texto(fila.id);
    if (!nombre || !idSofidya) continue;

    await guardar(
      supabase,
      "puestos",
      { empresa_id: empresa.id, nombre },
      {
        // Solo se completa si el puesto es nuevo: los nueve perfiles del
        // R-02-01 ya tienen su código real y no hay que pisarlo.
        codigo: `${PREFIJO}-P-${idSofidya}`,
        mision: texto(fila.descripcion),
        responsabilidades_generales: texto(fila.funciones),
        experiencia: texto(fila.requisitos),
        formacion_complementaria: texto(fila.perfil),
        activo: true,
      },
    );
    p += 1;
  }
  anotar({
    entidad: "puestos",
    recibidos: puestos.length,
    importados: p,
    tabla: "puestos",
    observacion: `Códigos ${PREFIJO}-P-*: Sofidya no los codifica. Calidad los reemplaza.`,
  });

  // -------------------------------------------------------------------
  // Proveedores y clientes
  // -------------------------------------------------------------------
  for (const [comando, tabla, columnaNombre] of [
    ["get_providers", "proveedores", "razon_social"],
    ["get_clients", "clientes", "razon_social"],
  ] as const) {
    registrar(`· ${tabla}`);
    let filas: Fila[] = [];
    try {
      filas = await sofidya.listar(comando);
    } catch (error) {
      anotar({
        entidad: tabla,
        recibidos: 0,
        importados: 0,
        tabla,
        observacion: `No se pudo traer: ${(error as Error).message}`,
      });
      continue;
    }

    let c = 0;
    for (const fila of filas) {
      const nombre = texto(fila.nombre);
      const idSofidya = texto(fila.id);
      if (!nombre || !idSofidya) continue;

      const comunes = {
        ruc: texto(fila.nif),
        correo: texto(fila.email),
        telefono: texto(fila.telefono),
      };

      await guardar(
        supabase,
        tabla,
        { empresa_id: empresa.id, [columnaNombre]: nombre },
        tabla === "proveedores"
          ? {
              ...comunes,
              codigo: `${PREFIJO}-PR-${idSofidya}`,
              nombre_comercial: texto(fila.nombre_comercial),
              pais: texto(fila.pais) ?? "Paraguay",
              observaciones: texto(fila.web),
            }
          : { ...comunes, codigo: `${PREFIJO}-C-${idSofidya}`, activo: true },
      );
      c += 1;
    }
    anotar({
      entidad: tabla,
      recibidos: filas.length,
      importados: c,
      tabla,
      observacion: "Se identifican por razón social.",
    });
  }

  // -------------------------------------------------------------------
  // Activos, por sede
  // -------------------------------------------------------------------
  registrar("· Activos");
  let a = 0;
  let totalActivos = 0;
  for (const idSofidya of Array.from(sedesPorIdSofidya.keys())) {
    const activos = await sofidya.listar("get_assets", { id_sede: idSofidya });
    totalActivos += activos.length;

    for (const fila of activos) {
      const nombre = texto(fila.denominacion);
      const idActivo = texto(fila.id);
      if (!nombre || !idActivo) continue;

      await guardar(
        supabase,
        "activos",
        { empresa_id: empresa.id, codigo: texto(fila.acronimo) ?? `${PREFIJO}-A-${idActivo}` },
        {
          nombre,
          categoria: texto(fila.tipo_activo),
          descripcion: texto(fila.configuracion),
          ubicacion: texto(fila.ubicacion),
          sede_id: sedesPorIdSofidya.get(idSofidya) ?? null,
          estado: "operativo",
        },
      );
      a += 1;
    }
  }
  anotar({
    entidad: "activos",
    recibidos: totalActivos,
    importados: a,
    tabla: "activos",
    observacion: "Se identifican por su acrónimo de Sofidya.",
  });

  // -------------------------------------------------------------------
  // Procesos y personas: se informan, no se escriben
  // -------------------------------------------------------------------
  registrar("· Procesos y personas (solo informe)");

  let procesos: Fila[] = [];
  for (const idSofidya of Array.from(sedesPorIdSofidya.keys())) {
    procesos = procesos.concat(await sofidya.listar("get_procedures", { id_sede: idSofidya }));
  }
  const porTipo = procesos.reduce<Record<string, number>>((cuenta, fila) => {
    const t = tipoProceso(fila.tipo_proceso);
    cuenta[t] = (cuenta[t] ?? 0) + 1;
    return cuenta;
  }, {});
  anotar({
    entidad: "procesos",
    recibidos: procesos.length,
    importados: 0,
    tabla: "—",
    observacion:
      `No se importan a propósito. El mapa real ya está cargado desde la unidad ` +
      `compartida del SGC, con sus diecinueve manuales, y ese es el vigente. ` +
      `Sofidya trae ${JSON.stringify(porTipo)}. Compare antes de decidir.`,
  });

  const personas = await sofidya.listar("get_users");
  const activas = personas.filter((f) => booleano(f.activo, false)).length;
  const conCorreo = personas.filter((f) => texto(f.email)).length;
  anotar({
    entidad: "personas",
    recibidos: personas.length,
    importados: 0,
    tabla: "—",
    observacion:
      `${activas} activas, ${conCorreo} con correo. No se importan porque ` +
      `usuarios.id referencia a auth.users: un perfil no puede existir sin ` +
      `cuenta de Google. Hace falta una tabla de legajo aparte.`,
  });

  // -------------------------------------------------------------------
  // Informe
  // -------------------------------------------------------------------
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

  registrar();
  registrar("Resumen");
  registrar("-".repeat(66));
  for (const r of resultados) {
    registrar(
      `  ${r.entidad.padEnd(14)} ${String(r.recibidos).padStart(5)} → ` +
        `${String(r.importados).padStart(5)}  ${r.tabla}`,
    );
    registrar(`      ${r.observacion}`);
  }
  registrar("-".repeat(66));

  const recibidos = resultados.reduce((suma, r) => suma + r.recibidos, 0);
  const importados = resultados.reduce((suma, r) => suma + r.importados, 0);
  registrar(`  ${recibidos} registros recibidos, ${importados} importados.`);
  registrar();
  registrar(
    "Recuerde: riesgos, no conformidades, auditorías, indicadores, objetivos\n" +
      "y documentos NO vienen por el API. Hay que exportarlos a mano desde\n" +
      "Sofidya. Ver docs/api-sofidya.md.",
  );
  registrar();
}

principal().catch((error) => {
  console.error("\n✗ La importación falló:", (error as Error).message);
  process.exit(1);
});
