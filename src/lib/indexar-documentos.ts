import type { SupabaseClient } from "@supabase/supabase-js";
import { extraerTexto } from "@/lib/extraer-texto";

/**
 * Lee el texto de los documentos que todavía no lo tienen.
 *
 * Vive acá y no dentro del trabajo programado porque tiene DOS
 * llamadores: el trabajo diario, que corre sin sesión con la clave de
 * servicio, y el botón «Reindexar» del listado, que corre con la sesión
 * del Administrador SGC. Escrito dos veces serían dos versiones que
 * empiezan iguales y se separan en el primer arreglo que se haga en una
 * sola.
 *
 * Recibe el cliente de Supabase en vez de crearlo: así cada llamador trae
 * el suyo y esta función no decide sobre permisos. Con la sesión del
 * Administrador, RLS sigue aplicándose y es lo correcto; con la clave de
 * servicio, no hay sesión que aplicar.
 */

/** Cuántos motivos distintos se devuelven antes de dejar de anotar. */
const MAXIMO_MOTIVOS = 5;

export interface ResumenIndexacion {
  pendientes: number;
  indexados: number;
  sinTexto: number;
  fallados: number;
  seCortoPorTiempo: boolean;
  motivos: string[];
}

interface AdjuntoDeDocumento {
  id: string;
  entidad_id: string;
  bucket: string;
  ruta: string;
  nombre_archivo: string;
  tipo_mime: string | null;
  creado_en: string;
}

export async function indexarDocumentosPendientes(
  supabase: SupabaseClient,
  presupuestoMs: number,
): Promise<ResumenIndexacion> {
  const arranque = Date.now();

  // El archivo que rige es el último que se subió, el mismo criterio que
  // usa la pantalla del documento.
  const { data: adjuntos, error: errorAdjuntos } = await supabase
    .from("adjuntos")
    .select("id, entidad_id, bucket, ruta, nombre_archivo, tipo_mime, creado_en")
    .eq("entidad", "documentos")
    .order("creado_en", { ascending: false });

  if (errorAdjuntos) throw new Error(errorAdjuntos.message);

  const ultimoPorDocumento = new Map<string, AdjuntoDeDocumento>();
  for (const adjunto of (adjuntos as AdjuntoDeDocumento[] | null) ?? []) {
    // Vienen del más nuevo al más viejo: el primero de cada documento gana.
    if (!ultimoPorDocumento.has(adjunto.entidad_id)) {
      ultimoPorDocumento.set(adjunto.entidad_id, adjunto);
    }
  }

  const { data: yaIndexados, error: errorTexto } = await supabase
    .from("documento_texto")
    .select("documento_id, adjunto_id");

  if (errorTexto) throw new Error(errorTexto.message);

  const indexadoDe = new Map(
    ((yaIndexados as { documento_id: string; adjunto_id: string | null }[] | null) ?? []).map(
      (fila) => [fila.documento_id, fila.adjunto_id],
    ),
  );

  // Falta indexar si no hay fila, o si la fila apunta a un archivo que ya
  // no es el vigente: eso pasa al reemplazar el archivo del documento, y
  // es justo cuando hay que volver a leerlo.
  const pendientes = Array.from(ultimoPorDocumento.entries()).filter(
    ([documentoId, adjunto]) => indexadoDe.get(documentoId) !== adjunto.id,
  );

  const resumen: ResumenIndexacion = {
    pendientes: pendientes.length,
    indexados: 0,
    sinTexto: 0,
    fallados: 0,
    seCortoPorTiempo: false,
    motivos: [],
  };

  function anotar(documento: string, motivo: string) {
    if (resumen.motivos.length < MAXIMO_MOTIVOS) {
      resumen.motivos.push(`${documento}: ${motivo}`);
    }
  }

  for (const [documentoId, adjunto] of pendientes) {
    if (Date.now() - arranque > presupuestoMs) {
      resumen.seCortoPorTiempo = true;
      break;
    }

    try {
      const { data: archivo, error: errorDescarga } = await supabase.storage
        .from(adjunto.bucket)
        .download(adjunto.ruta);

      if (errorDescarga || !archivo) {
        resumen.fallados += 1;
        anotar(
          adjunto.nombre_archivo,
          `no se pudo bajar del depósito · ${errorDescarga?.message ?? "sin detalle"}`,
        );
        continue;
      }

      const extraido = await extraerTexto(
        await archivo.arrayBuffer(),
        adjunto.nombre_archivo,
        adjunto.tipo_mime,
      );

      // Sin texto no es un fallo: es un formato que no se indexa, o un
      // PDF escaneado. Se cuenta aparte para poder verlo en el resumen.
      if (!extraido) {
        resumen.sinTexto += 1;
        anotar(adjunto.nombre_archivo, "sin texto · o es un escaneado, o el formato no se indexa");
        continue;
      }

      const { error: errorGuardado } = await supabase.from("documento_texto").upsert(
        {
          documento_id: documentoId,
          adjunto_id: adjunto.id,
          texto: extraido.texto,
          paginas: extraido.paginas,
          extraido_en: new Date().toISOString(),
        },
        { onConflict: "documento_id" },
      );

      if (errorGuardado) {
        resumen.fallados += 1;
        anotar(adjunto.nombre_archivo, `no se pudo guardar · ${errorGuardado.message}`);
      } else {
        resumen.indexados += 1;
      }
    } catch (error) {
      // Un archivo roto no puede cortar la corrida entera: se cuenta, se
      // anota por qué, y se sigue con el siguiente.
      resumen.fallados += 1;
      anotar(
        adjunto.nombre_archivo,
        `excepción · ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return resumen;
}

/**
 * El resumen en una frase, para mostrárselo a la persona.
 *
 * El trabajo programado devuelve números porque lo lee quien administra;
 * el botón lo lee Calidad, y «22 indexados» sin contexto no dice si salió
 * bien o mal.
 */
export function resumirIndexacion(resumen: ResumenIndexacion): string {
  if (resumen.pendientes === 0) return "No había documentos pendientes: ya estaban todos leídos.";

  const partes: string[] = [];
  partes.push(
    resumen.indexados === 1 ? "Se leyó 1 documento" : `Se leyeron ${resumen.indexados} documentos`,
  );
  if (resumen.sinTexto > 0) {
    partes.push(
      resumen.sinTexto === 1
        ? "1 quedó sin texto (es un escaneado o un formato que no se indexa)"
        : `${resumen.sinTexto} quedaron sin texto (escaneados o formatos que no se indexan)`,
    );
  }
  if (resumen.fallados > 0) {
    partes.push(resumen.fallados === 1 ? "1 falló" : `${resumen.fallados} fallaron`);
  }
  if (resumen.seCortoPorTiempo) {
    partes.push("quedaron más para la próxima vez");
  }

  return `${partes.join(", ")}.`;
}
