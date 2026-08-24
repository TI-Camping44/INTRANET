/**
 * =====================================================================
 * Importación única desde Sofidya · Intranet SGC Camping 44 S.A.
 * =====================================================================
 *
 * Sofidya expone su información mediante un API por comandos: cada
 * operación se pide con un parámetro `command` y se autentica con una
 * `SecretKey`. Cada respuesta trae `status` (SUCCESS/ERROR), `code` y los
 * datos.
 *
 * Este script recorre los comandos de listado disponibles y carga las
 * tablas equivalentes del esquema. Es idempotente: se puede volver a
 * ejecutar sin duplicar registros, porque cada tabla se actualiza por su
 * código.
 *
 * Uso:
 *   npm run migrar-sofidya              → importa de verdad
 *   npm run migrar-sofidya -- --ensayo  → muestra qué haría, sin escribir
 *
 * Variables de entorno (ver .env.example):
 *   SUPABASE_SERVICE_ROLE_KEY   obligatoria
 *   NEXT_PUBLIC_SUPABASE_URL    obligatoria
 *   SOFIDYA_API_URL             URL base del API
 *   SOFIDYA_SECRET_KEY          clave de Sofidya
 *   SOFIDYA_ARCHIVO_EJEMPLO     archivo JSON de respaldo
 *
 * La SecretKey NUNCA se escribe en el repositorio. Si no está disponible,
 * el script corre contra scripts/datos-ejemplo-sofidya.json, de modo que
 * la importación se pueda probar de extremo a extremo antes de tener la
 * clave real.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------
// Configuración
// ---------------------------------------------------------------------

const COMANDOS = [
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

type Comando = (typeof COMANDOS)[number];

interface RespuestaSofidya {
  status: "SUCCESS" | "ERROR";
  code: number | string;
  data?: Record<string, unknown>[];
  message?: string;
}

interface ResultadoComando {
  comando: Comando;
  recibidos: number;
  importados: number;
  tablaDestino: string;
  observacion: string;
}

const ENSAYO = process.argv.includes("--ensayo");

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

function texto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  const cadena = String(valor).trim();
  return cadena === "" ? null : cadena;
}

/** Sofidya devuelve los booleanos como "1"/"0" o "S"/"N". */
function booleano(valor: unknown, porDefecto = true): boolean {
  const cadena = texto(valor);
  if (cadena === null) return porDefecto;
  return ["1", "true", "t", "s", "si", "sí", "y"].includes(cadena.toLowerCase());
}

function entero(valor: unknown): number | null {
  const cadena = texto(valor);
  if (cadena === null) return null;
  const numero = Number.parseInt(cadena.replace(/[^0-9-]/g, ""), 10);
  return Number.isNaN(numero) ? null : numero;
}

function fecha(valor: unknown): string | null {
  const cadena = texto(valor);
  if (cadena === null) return null;
  // Se admite tanto aaaa-mm-dd como dd/mm/aaaa.
  if (/^\d{4}-\d{2}-\d{2}/.test(cadena)) return cadena.slice(0, 10);
  const partes = cadena.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  return partes ? `${partes[3]}-${partes[2]}-${partes[1]}` : null;
}

/** Normaliza el tipo de proceso a los valores del esquema. */
function tipoProceso(valor: unknown): "estrategico" | "operativo" | "apoyo" {
  const cadena = (texto(valor) ?? "").toLowerCase();
  if (cadena.startsWith("estrat")) return "estrategico";
  if (cadena.startsWith("apoy") || cadena.startsWith("sopor")) return "apoyo";
  return "operativo";
}

function registrar(mensaje: string) {
  console.log(mensaje);
}

// ---------------------------------------------------------------------
// Origen de datos: API de Sofidya o archivo de ejemplo
// ---------------------------------------------------------------------

class OrigenSofidya {
  private ejemplo: Record<string, RespuestaSofidya> | null = null;

  constructor(
    private readonly url: string | undefined,
    private readonly clave: string | undefined,
    private readonly archivoEjemplo: string,
  ) {
    if (!this.url || !this.clave) {
      const ruta = resolve(process.cwd(), this.archivoEjemplo);
      this.ejemplo = JSON.parse(readFileSync(ruta, "utf8"));
      registrar(
        `⚠  Sin SOFIDYA_API_URL o SOFIDYA_SECRET_KEY. Se usa el archivo de ejemplo ${this.archivoEjemplo}.`,
      );
    } else {
      registrar(`→ Origen: API de Sofidya en ${this.url}`);
    }
  }

  get esEjemplo(): boolean {
    return this.ejemplo !== null;
  }

  async obtener(comando: Comando): Promise<RespuestaSofidya> {
    if (this.ejemplo) {
      return (
        this.ejemplo[comando] ?? {
          status: "ERROR",
          code: 404,
          message: `El archivo de ejemplo no incluye ${comando}.`,
        }
      );
    }

    const respuesta = await fetch(this.url!, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ command: comando, SecretKey: this.clave }),
    });

    if (!respuesta.ok) {
      return {
        status: "ERROR",
        code: respuesta.status,
        message: `El API respondió ${respuesta.status} ${respuesta.statusText}.`,
      };
    }

    return (await respuesta.json()) as RespuestaSofidya;
  }
}

// ---------------------------------------------------------------------
// Importadores por comando
// ---------------------------------------------------------------------

/**
 * Cada importador recibe las filas crudas y devuelve cuántas cargó.
 * Todos resuelven las referencias por código o por nombre, porque
 * Sofidya no comparte los identificadores internos de este sistema.
 */
type Importador = (
  supabase: SupabaseClient,
  filas: Record<string, unknown>[],
  empresaId: string,
) => Promise<{ importados: number; tabla: string; observacion: string }>;

const IMPORTADORES: Record<Comando, Importador> = {
  // -------------------------------------------------------------------
  get_organizaciones: async (supabase, filas) => {
    let importados = 0;

    for (const fila of filas) {
      const nombre = texto(fila.nombre) ?? texto(fila.razon_social);
      if (!nombre) continue;

      const { data: existente } = await supabase
        .from("empresas")
        .select("id")
        .ilike("nombre", nombre)
        .maybeSingle();

      if (existente) {
        await supabase
          .from("empresas")
          .update({
            razon_social: texto(fila.razon_social) ?? nombre,
            ruc: texto(fila.ruc),
          })
          .eq("id", existente.id);
      } else {
        await supabase.from("empresas").insert({
          nombre,
          razon_social: texto(fila.razon_social) ?? nombre,
          ruc: texto(fila.ruc),
          activa: booleano(fila.activo),
        });
      }
      importados += 1;
    }

    return {
      importados,
      tabla: "empresas",
      observacion: "Las organizaciones se actualizan por nombre.",
    };
  },

  // -------------------------------------------------------------------
  get_sedes: async (supabase, filas, empresaId) => {
    let importados = 0;

    for (const fila of filas) {
      const nombre = texto(fila.nombre);
      if (!nombre) continue;

      const { data: existente } = await supabase
        .from("sedes")
        .select("id")
        .eq("empresa_id", empresaId)
        .ilike("nombre", nombre)
        .maybeSingle();

      const datos = {
        empresa_id: empresaId,
        nombre,
        direccion: texto(fila.direccion),
        ciudad: texto(fila.ciudad),
        telefono: texto(fila.telefono),
        activa: booleano(fila.activo),
      };

      if (existente) await supabase.from("sedes").update(datos).eq("id", existente.id);
      else await supabase.from("sedes").insert(datos);

      importados += 1;
    }

    return { importados, tabla: "sedes", observacion: "Se identifican por nombre." };
  },

  // -------------------------------------------------------------------
  get_normas: async (supabase, filas) => {
    let importados = 0;

    for (const fila of filas) {
      const codigo = texto(fila.codigo);
      if (!codigo) continue;

      const { error } = await supabase.from("normas").upsert(
        {
          codigo,
          nombre: texto(fila.nombre) ?? codigo,
          version: texto(fila.version),
          descripcion: texto(fila.descripcion),
          vigente: booleano(fila.activo),
        },
        { onConflict: "codigo" },
      );

      if (!error) importados += 1;
    }

    return { importados, tabla: "normas", observacion: "Se identifican por código." };
  },

  // -------------------------------------------------------------------
  get_procesos: async (supabase, filas, empresaId) => {
    let importados = 0;

    for (const fila of filas) {
      const codigo = texto(fila.codigo);
      if (!codigo) continue;

      const { data: existente } = await supabase
        .from("procesos")
        .select("id")
        .eq("empresa_id", empresaId)
        .ilike("codigo", codigo)
        .maybeSingle();

      const datos = {
        empresa_id: empresaId,
        codigo,
        nombre: texto(fila.nombre) ?? codigo,
        tipo: tipoProceso(fila.tipo),
        descripcion: texto(fila.descripcion),
        activo: booleano(fila.activo),
      };

      if (existente) await supabase.from("procesos").update(datos).eq("id", existente.id);
      else await supabase.from("procesos").insert(datos);

      importados += 1;
    }

    return {
      importados,
      tabla: "procesos",
      observacion: "El responsable de cada proceso se asigna después, desde la aplicación.",
    };
  },

  // -------------------------------------------------------------------
  get_puestos: async (supabase, filas, empresaId) => {
    const procesos = await mapaPorCodigo(supabase, "procesos", empresaId);
    let importados = 0;

    for (const fila of filas) {
      const codigo = texto(fila.codigo);
      if (!codigo) continue;

      const { data: existente } = await supabase
        .from("puestos")
        .select("id")
        .eq("empresa_id", empresaId)
        .ilike("codigo", codigo)
        .maybeSingle();

      const datos = {
        empresa_id: empresaId,
        codigo,
        nombre: texto(fila.nombre) ?? codigo,
        area: texto(fila.area),
        proceso_id: procesos.get((texto(fila.proceso_codigo) ?? "").toLowerCase()) ?? null,
        mision: texto(fila.mision),
        activo: booleano(fila.activo),
      };

      if (existente) await supabase.from("puestos").update(datos).eq("id", existente.id);
      else await supabase.from("puestos").insert(datos);

      importados += 1;
    }

    return { importados, tabla: "puestos", observacion: "El proceso se resuelve por código." };
  },

  // -------------------------------------------------------------------
  get_personas: async (supabase, filas, empresaId) => {
    let importados = 0;

    for (const fila of filas) {
      const codigoExterno = texto(fila.codigo) ?? texto(fila.id);
      if (!codigoExterno) continue;

      const nombre =
        texto(fila.nombre_completo) ??
        [texto(fila.nombre), texto(fila.apellido)].filter(Boolean).join(" ");

      if (!nombre) continue;

      const { error } = await supabase.from("personas_sofidya").upsert(
        {
          empresa_id: empresaId,
          codigo_externo: codigoExterno,
          nombre_completo: nombre,
          correo: texto(fila.email) ?? texto(fila.correo),
          documento: texto(fila.documento),
          puesto_nombre: texto(fila.puesto_nombre) ?? texto(fila.puesto),
          sede_nombre: texto(fila.sede_nombre) ?? texto(fila.sede),
          area: texto(fila.area),
          activo: booleano(fila.activo),
        },
        { onConflict: "empresa_id,codigo_externo" },
      );

      if (!error) importados += 1;
    }

    // Si la persona ya ingresó al sistema, se vincula por correo.
    const { data: pendientes } = await supabase
      .from("personas_sofidya")
      .select("id, correo")
      .is("usuario_id", null)
      .not("correo", "is", null);

    let vinculados = 0;
    for (const persona of pendientes ?? []) {
      const { data: usuario } = await supabase
        .from("usuarios")
        .select("id")
        .ilike("correo", persona.correo as string)
        .maybeSingle();

      if (usuario) {
        await supabase
          .from("personas_sofidya")
          .update({ usuario_id: usuario.id })
          .eq("id", persona.id);
        vinculados += 1;
      }
    }

    return {
      importados,
      tabla: "personas_sofidya",
      observacion:
        `Las personas no se cargan directamente en usuarios: ese identificador nace en el ` +
        `primer ingreso con Google. Quedan en espera y se vinculan por correo (${vinculados} vinculadas en esta corrida).`,
    };
  },

  // -------------------------------------------------------------------
  get_clientes: async (supabase, filas, empresaId) => {
    let importados = 0;

    for (const fila of filas) {
      const razonSocial = texto(fila.razon_social) ?? texto(fila.nombre);
      if (!razonSocial) continue;

      const codigo = texto(fila.codigo);
      const { data: existente } = codigo
        ? await supabase
            .from("clientes")
            .select("id")
            .eq("empresa_id", empresaId)
            .ilike("codigo", codigo)
            .maybeSingle()
        : { data: null };

      const datos = {
        empresa_id: empresaId,
        codigo,
        razon_social: razonSocial,
        ruc: texto(fila.ruc),
        correo: texto(fila.email) ?? texto(fila.correo),
        telefono: texto(fila.telefono),
        ciudad: texto(fila.ciudad),
        activo: booleano(fila.activo),
        es_demostracion: false,
      };

      if (existente) await supabase.from("clientes").update(datos).eq("id", existente.id);
      else await supabase.from("clientes").insert(datos);

      importados += 1;
    }

    return { importados, tabla: "clientes", observacion: "Se identifican por código." };
  },

  // -------------------------------------------------------------------
  get_proveedores: async (supabase, filas, empresaId) => {
    let importados = 0;

    for (const fila of filas) {
      const codigo = texto(fila.codigo);
      const razonSocial = texto(fila.razon_social) ?? texto(fila.nombre);
      if (!codigo || !razonSocial) continue;

      const { data: existente } = await supabase
        .from("proveedores")
        .select("id")
        .eq("empresa_id", empresaId)
        .ilike("codigo", codigo)
        .maybeSingle();

      const datos = {
        empresa_id: empresaId,
        codigo,
        razon_social: razonSocial,
        nombre_comercial: texto(fila.nombre_comercial),
        ruc: texto(fila.ruc),
        rubro: texto(fila.rubro),
        critico: booleano(fila.critico, false),
        correo: texto(fila.email) ?? texto(fila.correo),
        telefono: texto(fila.telefono),
        ciudad: texto(fila.ciudad),
        pais: texto(fila.pais) ?? "Paraguay",
        // El estado real depende de la evaluación, que se hace en el SGC.
        estado: booleano(fila.activo) ? "en_evaluacion" : "inactivo",
        es_demostracion: false,
      };

      if (existente) await supabase.from("proveedores").update(datos).eq("id", existente.id);
      else await supabase.from("proveedores").insert(datos);

      importados += 1;
    }

    return {
      importados,
      tabla: "proveedores",
      observacion:
        "Ingresan como 'en evaluación': la calificación se genera al cargar la primera evaluación en el SGC.",
    };
  },

  // -------------------------------------------------------------------
  get_activos: async (supabase, filas, empresaId) => {
    const sedes = await mapaPorNombre(supabase, "sedes", empresaId);
    let importados = 0;

    for (const fila of filas) {
      const codigo = texto(fila.codigo);
      if (!codigo) continue;

      const { data: existente } = await supabase
        .from("activos")
        .select("id")
        .eq("empresa_id", empresaId)
        .ilike("codigo", codigo)
        .maybeSingle();

      const frecuencia = entero(fila.frecuencia_mantenimiento_dias);
      const requiere = booleano(fila.requiere_mantenimiento, false);

      const datos = {
        empresa_id: empresaId,
        codigo,
        nombre: texto(fila.nombre) ?? codigo,
        categoria: texto(fila.categoria),
        descripcion: texto(fila.descripcion),
        sede_id: sedes.get((texto(fila.sede_nombre) ?? "").toLowerCase()) ?? null,
        ubicacion: texto(fila.ubicacion),
        numero_serie: texto(fila.numero_serie),
        marca: texto(fila.marca),
        modelo: texto(fila.modelo),
        estado: estadoActivo(fila.estado),
        fecha_adquisicion: fecha(fila.fecha_adquisicion),
        valor_gs: entero(fila.valor),
        requiere_mantenimiento: requiere,
        frecuencia_mantenimiento_dias: requiere ? frecuencia : null,
        es_demostracion: false,
      };

      if (existente) await supabase.from("activos").update(datos).eq("id", existente.id);
      else await supabase.from("activos").insert(datos);

      importados += 1;
    }

    return {
      importados,
      tabla: "activos",
      observacion: "La sede se resuelve por nombre; los montos se toman en guaraníes.",
    };
  },

  // -------------------------------------------------------------------
  get_inf_listados_predef: async () => ({
    importados: 0,
    tabla: "importaciones_sofidya",
    observacion:
      "Listados propios de Sofidya sin equivalente en este esquema. Se conservan en crudo para consulta.",
  }),
};

/** Estado del activo normalizado a los valores del esquema. */
function estadoActivo(valor: unknown): string {
  const cadena = (texto(valor) ?? "").toLowerCase();
  if (cadena.includes("manten")) return "en_mantenimiento";
  if (cadena.includes("baja")) return "dado_de_baja";
  if (cadena.includes("fuera")) return "fuera_de_servicio";
  return "operativo";
}

async function mapaPorCodigo(
  supabase: SupabaseClient,
  tabla: string,
  empresaId: string,
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from(tabla)
    .select("id, codigo")
    .eq("empresa_id", empresaId);

  return new Map(
    (data ?? []).map((fila: { id: string; codigo: string }) => [
      fila.codigo.toLowerCase(),
      fila.id,
    ]),
  );
}

async function mapaPorNombre(
  supabase: SupabaseClient,
  tabla: string,
  empresaId: string,
): Promise<Map<string, string>> {
  const { data } = await supabase
    .from(tabla)
    .select("id, nombre")
    .eq("empresa_id", empresaId);

  return new Map(
    (data ?? []).map((fila: { id: string; nombre: string }) => [
      fila.nombre.toLowerCase(),
      fila.id,
    ]),
  );
}

// ---------------------------------------------------------------------
// Proceso principal
// ---------------------------------------------------------------------

async function principal() {
  registrar("");
  registrar("Importación desde Sofidya · Intranet SGC Camping 44 S.A.");
  registrar("=".repeat(62));

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !clave) {
    console.error(
      "\n✗ Faltan NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY.\n" +
        "  Complete el archivo .env.local antes de ejecutar la importación.\n",
    );
    process.exit(1);
  }

  const supabase = createClient(url, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const origen = new OrigenSofidya(
    process.env.SOFIDYA_API_URL,
    process.env.SOFIDYA_SECRET_KEY,
    process.env.SOFIDYA_ARCHIVO_EJEMPLO ?? "scripts/datos-ejemplo-sofidya.json",
  );

  if (ENSAYO) registrar("→ Modo ensayo: no se escribe nada en la base de datos.");

  // Empresa de destino: la primera empresa activa del sistema.
  const { data: empresa, error: errorEmpresa } = await supabase
    .from("empresas")
    .select("id, nombre")
    .eq("activa", true)
    .order("creado_en")
    .limit(1)
    .maybeSingle();

  if (errorEmpresa || !empresa) {
    console.error(
      "\n✗ No hay ninguna empresa activa en la base de datos.\n" +
        "  Aplique las migraciones y el seed antes de importar.\n",
    );
    process.exit(1);
  }

  registrar(`→ Empresa de destino: ${empresa.nombre}`);
  registrar("");

  const resultados: ResultadoComando[] = [];

  for (const comando of COMANDOS) {
    process.stdout.write(`  ${comando.padEnd(26)}`);

    let respuesta: RespuestaSofidya;
    try {
      respuesta = await origen.obtener(comando);
    } catch (error) {
      registrar(`✗ error de conexión: ${(error as Error).message}`);
      resultados.push({
        comando,
        recibidos: 0,
        importados: 0,
        tablaDestino: "—",
        observacion: `Error de conexión: ${(error as Error).message}`,
      });
      continue;
    }

    if (respuesta.status !== "SUCCESS") {
      registrar(`✗ ${respuesta.code} ${respuesta.message ?? "respuesta con error"}`);
      resultados.push({
        comando,
        recibidos: 0,
        importados: 0,
        tablaDestino: "—",
        observacion: `Sofidya respondió ERROR ${respuesta.code}: ${respuesta.message ?? ""}`,
      });
      continue;
    }

    const filas = respuesta.data ?? [];

    if (ENSAYO) {
      registrar(`· ${filas.length} registros recibidos (ensayo, sin escribir)`);
      resultados.push({
        comando,
        recibidos: filas.length,
        importados: 0,
        tablaDestino: "—",
        observacion: "Modo ensayo.",
      });
      continue;
    }

    try {
      const { importados, tabla, observacion } = await IMPORTADORES[comando](
        supabase,
        filas,
        empresa.id,
      );

      registrar(`✓ ${filas.length} recibidos → ${importados} en ${tabla}`);

      resultados.push({
        comando,
        recibidos: filas.length,
        importados,
        tablaDestino: tabla,
        observacion,
      });

      await supabase.from("importaciones_sofidya").insert({
        comando,
        registros_recibidos: filas.length,
        registros_importados: importados,
        tabla_destino: tabla,
        observacion,
        // Los listados sin equivalente se conservan en crudo.
        datos_crudos: comando === "get_inf_listados_predef" ? filas : null,
      });
    } catch (error) {
      registrar(`✗ ${(error as Error).message}`);
      resultados.push({
        comando,
        recibidos: filas.length,
        importados: 0,
        tablaDestino: "—",
        observacion: `Error al importar: ${(error as Error).message}`,
      });
    }
  }

  // Informe final
  registrar("");
  registrar("Resumen de la importación");
  registrar("-".repeat(62));

  for (const resultado of resultados) {
    registrar(
      `  ${resultado.comando.padEnd(26)} ${String(resultado.recibidos).padStart(4)} → ` +
        `${String(resultado.importados).padStart(4)}  ${resultado.tablaDestino}`,
    );
    if (resultado.observacion) registrar(`      ${resultado.observacion}`);
  }

  const totalRecibidos = resultados.reduce((suma, fila) => suma + fila.recibidos, 0);
  const totalImportados = resultados.reduce((suma, fila) => suma + fila.importados, 0);

  registrar("-".repeat(62));
  registrar(`  Total: ${totalRecibidos} registros recibidos, ${totalImportados} importados.`);

  if (origen.esEjemplo) {
    registrar("");
    registrar(
      "⚠  Se usó el archivo de ejemplo. Para importar de verdad, defina\n" +
        "   SOFIDYA_API_URL y SOFIDYA_SECRET_KEY en .env.local.",
    );
  }

  registrar("");
}

principal().catch((error) => {
  console.error("\n✗ La importación falló:", error);
  process.exit(1);
});
