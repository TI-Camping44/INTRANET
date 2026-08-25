/**
 * Importación desde Sofidya.
 *
 * Vive en `lib` y no en el script porque hay dos lugares que la usan: el
 * script de línea de comandos y una ruta temporal de la aplicación. La
 * ruta existe por una razón práctica: el entorno donde se desarrolla no
 * tiene salida hacia sofidya.com y el despliegue de Vercel sí.
 *
 * El contrato del API está en `docs/api-sofidya.md`. Lo esencial:
 *
 *   · Endpoint https://www.sofidya.com/api/api.php
 *   · Parámetros codificados en la URL: `command` y `SecretKey`
 *   · Comandos en inglés, diez de listado
 *   · Sedes, procesos y activos se piden encadenados:
 *       organización → sede → procesos y activos
 *
 * NO trae documentos, objetivos, riesgos, indicadores, no conformidades,
 * auditorías, comunicaciones ni denuncias: el API no los expone.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Prefijo de los códigos que se generan acá.
 *
 * Sofidya no le pone código a los puestos, clientes ni proveedores, pero
 * el esquema lo exige. Antes que inventar uno con pinta de código real
 * de Calidad, se deriva del identificador interno de Sofidya y se marca
 * de dónde salió. Cuando Calidad los codifique, se reemplazan.
 */
const PREFIJO = "SOF";

export const ENTIDADES = [
  "normas",
  "sedes",
  "puestos",
  "proveedores",
  "clientes",
  "activos",
  "procesos",
  "personas",
] as const;

export type Entidad = (typeof ENTIDADES)[number];

/** Las que se escriben. Solo los procesos se informan sin escribirse. */
export const ENTIDADES_QUE_SE_IMPORTAN: readonly Entidad[] = [
  "normas",
  "sedes",
  "puestos",
  "proveedores",
  "clientes",
  "activos",
  "personas",
];

export interface Resultado {
  entidad: Entidad;
  recibidos: number;
  importados: number;
  tabla: string;
  observacion: string;
}

type Fila = Record<string, unknown>;

interface RespuestaSofidya {
  status?: "SUCCESS" | "ERROR";
  code?: string | number;
  data?: unknown;
  message?: string;
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
export function tipoProceso(valor: unknown): "estrategico" | "operativo" | "apoyo" {
  const cadena = (texto(valor) ?? "").toLowerCase();
  if (cadena.startsWith("estrat")) return "estrategico";
  if (cadena.startsWith("sopor") || cadena.startsWith("apoy")) return "apoyo";
  return "operativo";
}

// ---------------------------------------------------------------------
// Cliente del API
// ---------------------------------------------------------------------

export class ClienteSofidya {
  constructor(
    private readonly url: string,
    private readonly clave: string,
  ) {}

  /**
   * Pide un comando y devuelve sus filas.
   *
   * Los códigos de Sofidya se traducen a mensajes que digan qué pasó:
   * `2000` es comando inexistente, `2010` parámetro faltante, `3010`
   * clave rechazada. Un error con «ERROR» a secas no ayuda a nadie.
   */
  async listar(comando: string, extra: Record<string, string> = {}): Promise<Fila[]> {
    const url = new URL(this.url);
    url.searchParams.set("command", comando);
    url.searchParams.set("SecretKey", this.clave);
    for (const [nombre, valor] of Object.entries(extra)) url.searchParams.set(nombre, valor);

    const respuesta = await fetch(url, { method: "GET", signal: AbortSignal.timeout(20_000) });
    if (!respuesta.ok) throw new Error(`${comando}: el API respondió HTTP ${respuesta.status}.`);

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
 * Inserta o actualiza por una clave natural. Devuelve el id, que hace
 * falta para encadenar: una sede necesita el suyo para colgarle activos.
 *
 * La clave viene partida en dos a proposito. `filtros` compara por
 * igualdad y es para lo que no es texto libre —`empresa_id`, un uuid—; y
 * `claveTexto` compara sin distinguir mayusculas, que es lo que hace
 * falta para los nombres, porque Sofidya escribe «Vendedor de Salón» y
 * el seed «Vendedor de salón».
 *
 * Estaban juntos y se decidia por `typeof valor === "string"`. Como un
 * uuid tambien es una cadena, `empresa_id` terminaba comparado con
 * `ilike` sobre una columna uuid: la consulta fallaba, el error se
 * descartaba, y la fila existente se leia como inexistente. En las
 * tablas con indice unico eso reventaba; en `sedes` y `clientes`, que no
 * lo tienen, duplicaba en silencio una fila por corrida.
 */
async function guardar(
  supabase: SupabaseClient,
  tabla: string,
  filtros: Record<string, string>,
  claveTexto: { columna: string; valor: string },
  datos: Record<string, unknown>,
  ensayo: boolean,
  /**
   * Campos que se escriben al crear la fila pero NO al actualizarla.
   *
   * Es para el codigo. Los nueve perfiles del R-02-01 ya tienen el suyo,
   * y varios de esos puestos existen tambien en Sofidya con el mismo
   * nombre: sin esta separacion, importar les pisaba el codigo real con
   * uno derivado del identificador interno de Sofidya.
   */
  soloAlCrear: Record<string, unknown> = {},
  /**
   * Codigo derivado del identificador interno de Sofidya, si lo hay.
   *
   * Se busca por aca ANTES que por nombre, porque es la identidad mas
   * firme que tenemos: el nombre de un puesto se corrige y el id de
   * Sofidya no. Buscando solo por nombre, una fila que una corrida
   * anterior habia creado con este codigo no se encontraba, y el insert
   * siguiente chocaba contra el indice unico del codigo.
   */
  codigoDeSofidya?: { columna: string; valor: string },
): Promise<string | null> {
  const buscar = async (columna: string, valor: string, exacto: boolean) => {
    let consulta = supabase.from(tabla).select("id");
    for (const [c, v] of Object.entries(filtros)) consulta = consulta.eq(c, v);
    consulta = exacto ? consulta.eq(columna, valor) : consulta.ilike(columna, valor);

    // `limit(1)` porque en Sofidya hay nombres repetidos —dos «Vendedor
    // de Salón», por ejemplo— y dos filas harian fallar la consulta. La
    // identidad firme es el codigo, que se busca antes; esto es solo el
    // reconocimiento inicial contra lo que ya estaba cargado.
    const { data, error } = await consulta.limit(1).maybeSingle();

    // El error de la busqueda no se ignora: si no se sabe si la fila
    // existe, insertar es exactamente lo que no hay que hacer.
    if (error) {
      throw new Error(
        `${tabla}: no se pudo comprobar si «${valor}» ya existe (${error.message}).`,
      );
    }
    return (data?.id as string) ?? null;
  };

  // Primero por el codigo de Sofidya, que es la identidad firme; si no
  // aparece, por el nombre, que es lo que permite reconocer una fila que
  // ya existia antes de la primera importacion.
  const idExistente =
    (codigoDeSofidya
      ? await buscar(codigoDeSofidya.columna, codigoDeSofidya.valor, true)
      : null) ?? (await buscar(claveTexto.columna, claveTexto.valor, false));

  if (ensayo) return idExistente;

  if (idExistente) {
    // Un campo vacio en Sofidya no es una correccion: es que Sofidya no
    // lo tiene. Escribir ese vacio encima borraria lo que ya cargamos
    // desde el R-02-01 o desde la unidad compartida del SGC.
    //
    // La clave de texto si se actualiza: cuando la fila se encontro por
    // el codigo de Sofidya, un nombre distinto significa que alla lo
    // renombraron, y ese cambio hay que traerlo.
    const aActualizar = Object.fromEntries(
      Object.entries({ ...datos, [claveTexto.columna]: claveTexto.valor }).filter(
        ([, valor]) => valor !== null && valor !== undefined,
      ),
    );

    if (Object.keys(aActualizar).length > 0) {
      const { error } = await supabase.from(tabla).update(aActualizar).eq("id", idExistente);
      if (error) throw new Error(`${tabla}: ${error.message}`);
    }
    return idExistente;
  }

  const { data: creado, error } = await supabase
    .from(tabla)
    .insert({ ...filtros, [claveTexto.columna]: claveTexto.valor, ...soloAlCrear, ...datos })
    .select("id")
    .single();

  if (error) {
    throw new Error(`${tabla}: al crear «${claveTexto.valor}» · ${error.message}`);
  }
  return (creado?.id as string) ?? null;
}

// ---------------------------------------------------------------------
// Importación
// ---------------------------------------------------------------------

export interface OpcionesImportacion {
  /** Qué traer. Por omisión, todo. */
  entidades?: readonly Entidad[];
  /** Si es `true` no escribe nada: solo cuenta qué haría. */
  ensayo: boolean;
}

/**
 * Trae de Sofidya lo pedido y lo deja en la base.
 *
 * Cada entidad se resuelve por separado y su error se anota en lugar de
 * cortar la corrida entera: que falle `get_clients` no es razón para
 * quedarse sin los activos.
 */
export async function importarDesdeSofidya(
  supabase: SupabaseClient,
  sofidya: ClienteSofidya,
  empresaId: string,
  { entidades = ENTIDADES, ensayo }: OpcionesImportacion,
): Promise<Resultado[]> {
  const resultados: Resultado[] = [];
  const pedida = (e: Entidad) => entidades.includes(e);

  // Sedes de Sofidya → sedes nuestras. Hace falta para activos y
  // procesos, aunque no se hayan pedido las sedes en sí.
  const sedes = new Map<string, string | null>();
  const necesitaSedes = pedida("sedes") || pedida("activos") || pedida("procesos");

  const anotar = (
    entidad: Entidad,
    recibidos: number,
    importados: number,
    tabla: string,
    observacion: string,
  ) => resultados.push({ entidad, recibidos, importados, tabla, observacion });

  // ---- Normas -------------------------------------------------------
  if (pedida("normas")) {
    try {
      const filas = await sofidya.listar("get_norms");
      let n = 0;
      for (const fila of filas) {
        const denominacion = texto(fila.denominacion);
        if (!denominacion) continue;
        await guardar(
          supabase,
          "normas",
          {},
          { columna: "codigo", valor: denominacion },
          { nombre: denominacion, descripcion: texto(fila.descripcion), vigente: true },
          ensayo,
        );
        n += 1;
      }
      anotar("normas", filas.length, n, "normas", "Se identifican por su denominación.");
    } catch (error) {
      anotar("normas", 0, 0, "normas", `Falló: ${(error as Error).message}`);
    }
  }

  // ---- Sedes --------------------------------------------------------
  if (necesitaSedes) {
    try {
      const organizaciones = await sofidya.listar("get_organizations");
      let recibidas = 0;
      let n = 0;

      for (const organizacion of organizaciones) {
        const idOrganizacion = texto(organizacion.id);
        if (!idOrganizacion) continue;

        const filas = await sofidya.listar("get_offices", { id_organizacion: idOrganizacion });
        recibidas += filas.length;

        for (const fila of filas) {
          const nombre = texto(fila.denominacion);
          const idSofidya = texto(fila.id);
          if (!nombre || !idSofidya) continue;

          const id = pedida("sedes")
            ? await guardar(
                supabase,
                "sedes",
                { empresa_id: empresaId },
                { columna: "nombre", valor: nombre },
                { direccion: texto(fila.direccion), ciudad: texto(fila.localidad), activa: true },
                ensayo,
              )
            : null;

          sedes.set(idSofidya, id);
          if (pedida("sedes")) n += 1;
        }
      }

      if (pedida("sedes")) {
        anotar(
          "sedes",
          recibidas,
          n,
          "sedes",
          `De ${organizaciones.length} organización(es). Se identifican por nombre.`,
        );
      }
    } catch (error) {
      if (pedida("sedes")) anotar("sedes", 0, 0, "sedes", `Falló: ${(error as Error).message}`);
    }
  }

  // ---- Puestos ------------------------------------------------------
  if (pedida("puestos")) {
    try {
      const filas = await sofidya.listar("get_jobs");
      let n = 0;
      for (const fila of filas) {
        const nombre = texto(fila.denominacion);
        const idSofidya = texto(fila.id);
        if (!nombre || !idSofidya) continue;

        await guardar(
          supabase,
          "puestos",
          { empresa_id: empresaId },
          { columna: "nombre", valor: nombre },
          {
            mision: texto(fila.descripcion),
            responsabilidades_generales: texto(fila.funciones),
            experiencia: texto(fila.requisitos),
            formacion_complementaria: texto(fila.perfil),
            activo: true,
          },
          ensayo,
          { codigo: `${PREFIJO}-P-${idSofidya}` },
          { columna: "codigo", valor: `${PREFIJO}-P-${idSofidya}` },
        );
        n += 1;
      }
      anotar(
        "puestos",
        filas.length,
        n,
        "puestos",
        `Códigos ${PREFIJO}-P-*: Sofidya no los codifica. Calidad los reemplaza.`,
      );
    } catch (error) {
      anotar("puestos", 0, 0, "puestos", `Falló: ${(error as Error).message}`);
    }
  }

  // ---- Proveedores y clientes ---------------------------------------
  for (const [entidad, comando, tabla, sigla] of [
    ["proveedores", "get_providers", "proveedores", "PR"],
    ["clientes", "get_clients", "clientes", "C"],
  ] as const) {
    if (!pedida(entidad)) continue;
    try {
      const filas = await sofidya.listar(comando);
      let n = 0;
      for (const fila of filas) {
        const nombre = texto(fila.nombre);
        const idSofidya = texto(fila.id);
        if (!nombre || !idSofidya) continue;

        const comunes = {
          ruc: texto(fila.nif),
          correo: texto(fila.email),
          telefono: texto(fila.telefono),
          // Si Sofidya lo tiene, es real: deja de ser de demostracion.
          es_demostracion: false,
        };

        await guardar(
          supabase,
          tabla,
          { empresa_id: empresaId },
          { columna: "razon_social", valor: nombre },
          tabla === "proveedores"
            ? {
                ...comunes,
                nombre_comercial: texto(fila.nombre_comercial),
                pais: texto(fila.pais) ?? "Paraguay",
                observaciones: texto(fila.web),
              }
            : { ...comunes, activo: true },
          ensayo,
          { codigo: `${PREFIJO}-${sigla}-${idSofidya}` },
          { columna: "codigo", valor: `${PREFIJO}-${sigla}-${idSofidya}` },
        );
        n += 1;
      }
      anotar(entidad, filas.length, n, tabla, "Se identifican por razón social.");
    } catch (error) {
      anotar(entidad, 0, 0, tabla, `Falló: ${(error as Error).message}`);
    }
  }

  // ---- Activos, por sede --------------------------------------------
  if (pedida("activos")) {
    try {
      let recibidos = 0;
      let n = 0;
      for (const idSede of Array.from(sedes.keys())) {
        const filas = await sofidya.listar("get_assets", { id_sede: idSede });
        recibidos += filas.length;

        for (const fila of filas) {
          const nombre = texto(fila.denominacion);
          const idActivo = texto(fila.id);
          if (!nombre || !idActivo) continue;

          await guardar(
            supabase,
            "activos",
            { empresa_id: empresaId },
            { columna: "codigo", valor: texto(fila.acronimo) ?? `${PREFIJO}-A-${idActivo}` },
            {
              nombre,
              categoria: texto(fila.tipo_activo),
              descripcion: texto(fila.configuracion),
              ubicacion: texto(fila.ubicacion),
              sede_id: sedes.get(idSede) ?? null,
              estado: "operativo",
              es_demostracion: false,
            },
            ensayo,
          );
          n += 1;
        }
      }
      anotar("activos", recibidos, n, "activos", "Se identifican por su acrónimo de Sofidya.");
    } catch (error) {
      anotar("activos", 0, 0, "activos", `Falló: ${(error as Error).message}`);
    }
  }

  // ---- Procesos: se informan, no se escriben ------------------------
  if (pedida("procesos")) {
    try {
      let filas: Fila[] = [];
      for (const idSede of Array.from(sedes.keys())) {
        filas = filas.concat(await sofidya.listar("get_procedures", { id_sede: idSede }));
      }
      const porTipo = filas.reduce<Record<string, number>>((cuenta, fila) => {
        const t = tipoProceso(fila.tipo_proceso);
        cuenta[t] = (cuenta[t] ?? 0) + 1;
        return cuenta;
      }, {});
      anotar(
        "procesos",
        filas.length,
        0,
        "—",
        "No se importan a propósito: el mapa real ya está cargado desde la unidad " +
          "compartida del SGC con sus diecinueve manuales, y ese es el vigente. " +
          `Sofidya trae ${JSON.stringify(porTipo)}. Compare antes de decidir.`,
      );
    } catch (error) {
      anotar("procesos", 0, 0, "—", `Falló: ${(error as Error).message}`);
    }
  }

  // ---- Personas: se informan, no se escriben ------------------------
  if (pedida("personas")) {
    try {
      const filas = await sofidya.listar("get_users");
      let n = 0;

      for (const fila of filas) {
        const idSofidya = texto(fila.id);
        const nombre = [texto(fila.nombre), texto(fila.apellidos)].filter(Boolean).join(" ").trim();
        if (!idSofidya || !nombre) continue;

        // Van a `personas_sofidya`, no a `usuarios`: un usuario no puede
        // existir sin cuenta de Google, porque `usuarios.id` referencia a
        // `auth.users`. Esta tabla es el legajo, y su disparador enlaza a
        // la persona con su usuario en el primer ingreso.
        await guardar(
          supabase,
          "personas_sofidya",
          { empresa_id: empresaId },
          { columna: "codigo_externo", valor: idSofidya },
          {
            nombre_completo: nombre,
            correo: texto(fila.email),
            puesto_nombre: texto(fila.cargo),
            sede_nombre: texto(fila.sede),
            area: texto(fila.organizacion),
            activo: booleano(fila.activo, true),
          },
          ensayo,
        );
        n += 1;
      }

      const activas = filas.filter((f) => booleano(f.activo, false)).length;
      const conCorreo = filas.filter((f) => texto(f.email)).length;
      anotar(
        "personas",
        filas.length,
        n,
        "personas_sofidya",
        `${activas} activas, ${conCorreo} con correo. Van al legajo y no a ` +
          "usuarios: una cuenta no puede existir sin ingreso con Google. " +
          "Cuando cada persona entra, el disparador la enlaza sola.",
      );
    } catch (error) {
      anotar("personas", 0, 0, "personas_sofidya", `Falló: ${(error as Error).message}`);
    }
  }

  return resultados;
}
