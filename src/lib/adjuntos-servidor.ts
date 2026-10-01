/**
 * Subir y quitar archivos adjuntos, desde el servidor.
 *
 * ES EL MISMO BAILE EN TODOS LOS MODULOS: controlar el archivo, subirlo
 * al bucket, registrar la fila en `adjuntos` y, si la fila falla, retirar
 * el objeto que ya se habia subido para no dejar un huerfano. Estaba
 * copiado en documentos, en la evidencia de los hallazgos y en las no
 * conformidades, con tres variantes del mismo manejo de error. Acá queda
 * una vez.
 *
 * NO TIENE "use server": no es un archivo de acciones, es una funcion que
 * las acciones usan. Recibe el cliente de Supabase ya creado, con la
 * sesion de la persona, para que RLS se aplique igual que en cualquier
 * otra escritura.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import {
  BUCKET_DOCUMENTOS,
  motivoDeRechazoEvidencia,
  nombreDeArchivoLegible,
  rutaDeAdjunto,
} from "@/lib/adjuntos";

export interface ResultadoDeCarga {
  subidos: number;
  /** Un texto por archivo rechazado, listo para mostrar. */
  fallidos: string[];
}

/**
 * Sube los archivos de un formulario y los registra.
 *
 * Un archivo que falla no detiene a los demas: se devuelve la cuenta de
 * los que entraron y el motivo de cada uno que no. Que la persona pierda
 * la subida entera porque una foto estaba en un formato raro es peor que
 * subir las otras tres y decirle cual falto.
 */
export async function subirAdjuntos(
  supabase: SupabaseClient,
  opciones: {
    /** El nombre de la tabla a la que pertenece, como queda en `adjuntos.entidad`. */
    entidad: string;
    entidadId: string;
    /** La carpeta dentro del bucket. */
    carpeta: string;
    archivos: File[];
    descripcion?: string | null;
    empresaId: string;
    usuarioId: string;
  },
): Promise<ResultadoDeCarga> {
  const fallidos: string[] = [];
  let subidos = 0;

  for (const archivo of opciones.archivos) {
    const motivo = motivoDeRechazoEvidencia(archivo.name, archivo.size);
    if (motivo) {
      fallidos.push(`${archivo.name}: ${motivo}`);
      continue;
    }

    const ruta = rutaDeAdjunto(opciones.carpeta, opciones.entidadId, archivo.name);

    const { error: errorCarga } = await supabase.storage
      .from(BUCKET_DOCUMENTOS)
      .upload(ruta, archivo, { contentType: archivo.type || undefined, upsert: false });

    if (errorCarga) {
      fallidos.push(`${archivo.name}: ${errorCarga.message}`);
      continue;
    }

    const { error: errorRegistro } = await supabase.from("adjuntos").insert({
      empresa_id: opciones.empresaId,
      entidad: opciones.entidad,
      entidad_id: opciones.entidadId,
      nombre_archivo: nombreDeArchivoLegible(archivo.name),
      ruta,
      bucket: BUCKET_DOCUMENTOS,
      tamano_bytes: archivo.size,
      tipo_mime: archivo.type || null,
      descripcion: opciones.descripcion?.trim() || null,
      subido_por: opciones.usuarioId,
    });

    if (errorRegistro) {
      // El archivo ya esta arriba: si no se pudo registrar, se retira
      // para no dejar un huerfano que nadie sabe de quien es.
      await supabase.storage.from(BUCKET_DOCUMENTOS).remove([ruta]);
      fallidos.push(`${archivo.name}: ${errorRegistro.message}`);
      continue;
    }

    subidos += 1;
  }

  return { subidos, fallidos };
}

/**
 * Lee los archivos de un formulario bajo un nombre de campo.
 *
 * Descarta los vacios: un `<input type="file">` sin elegir nada igual
 * manda una entrada con tamaño cero.
 */
export function archivosDelFormulario(datos: FormData, campo: string): File[] {
  return datos
    .getAll(campo)
    .filter((archivo): archivo is File => archivo instanceof File && archivo.size > 0);
}

/**
 * Quita un adjunto: primero la fila, despues el objeto.
 *
 * En ese orden a proposito. Si se borrara primero el objeto y despues
 * fallara el borrado de la fila, quedaria un archivo listado que al
 * abrirlo da error, que es la peor de las dos fallas posibles.
 *
 * Se exige la entidad y su id para que un id de adjunto de otro modulo no
 * se pueda borrar desde acá. Quien puede borrar lo decide RLS
 * (`adjuntos_baja`): quien lo subio, o Calidad.
 */
export async function quitarAdjunto(
  supabase: SupabaseClient,
  adjuntoId: string,
  entidad: string,
  entidadId: string,
): Promise<{ ok: true; nombre: string } | { ok: false; error: string }> {
  const { data } = await supabase
    .from("adjuntos")
    .select("bucket, ruta, nombre_archivo")
    .eq("id", adjuntoId)
    .eq("entidad", entidad)
    .eq("entidad_id", entidadId)
    .maybeSingle();

  const adjunto = data as { bucket: string; ruta: string; nombre_archivo: string } | null;
  if (!adjunto) return { ok: false, error: "El archivo no existe o no tiene acceso." };

  const { error } = await supabase.from("adjuntos").delete().eq("id", adjuntoId);
  if (error) {
    return {
      ok: false,
      error:
        "No se pudo eliminar el archivo. Solo puede quitarlo quien lo subió o el " +
        "Administrador SGC.",
    };
  }

  await supabase.storage.from(adjunto.bucket).remove([adjunto.ruta]);
  return { ok: true, nombre: adjunto.nombre_archivo };
}
