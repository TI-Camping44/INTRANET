"use server";

import { revalidatePath } from "next/cache";
import { nombreDeArchivoLegible } from "@/lib/adjuntos";
import { quitarAdjunto } from "@/lib/adjuntos-servidor";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import {
  BUCKET_IMAGENES,
  esImagen,
  esRutaDelBucket,
  motivoDeRechazoAdjunto,
  rutaDeAdjuntoPublicacion,
  rutaDeImagen,
} from "@/lib/imagenes";
import type { EstadoPublicacion, ResultadoAccion } from "@/lib/tipos";

export async function crearPublicacion(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite publicar en la intranet." };
  }

  const supabase = crearClienteServidor();

  const titulo = String(datos.get("titulo") ?? "").trim();
  const cuerpo = String(datos.get("cuerpo") ?? "").trim();

  if (titulo.length < 5) {
    return { exito: false, error: "El título debe tener al menos 5 caracteres." };
  }
  if (cuerpo.length < 10) {
    return { exito: false, error: "El cuerpo debe tener al menos 10 caracteres." };
  }

  // Publicar es lo normal; el borrador es para lo que se deja a medias.
  const publicar = datos.get("publicar") === "si";

  const { data: publicacion, error } = await supabase
    .from("publicaciones")
    .insert({
      empresa_id: usuario.empresa_id,
      tipo: String(datos.get("tipo") ?? "anuncio"),
      titulo,
      cuerpo,
      resumen: String(datos.get("resumen") ?? "").trim() || null,
      estado: publicar ? "publicada" : "borrador",
      fijada: publicar && datos.get("fijada") === "si",
      fecha_vencimiento: String(datos.get("fecha_vencimiento") ?? "") || null,
      usuario_referido_id: String(datos.get("usuario_referido_id") ?? "") || null,
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      creado_por: usuario.id,
    })
    .select("id, titulo")
    .single();

  if (error) {
    return { exito: false, error: `No se pudo crear la publicación: ${error.message}` };
  }

  // Los archivos se suben despues de tener la fila: asi la ruta lleva el
  // id de la publicacion y no queda ningun archivo suelto en el bucket si
  // el insert hubiera fallado.
  const { aviso: avisoDeImagen } = await adjuntarArchivos(
    publicacion.id,
    datos.getAll("archivos"),
  );

  revalidatePath("/inicio");
  return {
    exito: true,
    id: publicacion.id,
    mensaje:
      (publicar ? "Publicación visible para todos." : "Guardada como borrador.") +
      (avisoDeImagen ? ` ${avisoDeImagen}` : ""),
  };
}

/**
 * Sube los archivos de una publicacion: la imagen de la tarjeta y los
 * anexos.
 *
 * SE ADMITEN VARIOS, de cualquier tipo de publicacion. Lo pidio Direccion
 * el 5 de octubre. Antes entraba uno solo, que es lo que hacia falta para
 * un anuncio con su foto, pero no para un evento con el programa, el
 * formulario de inscripcion y el mapa.
 *
 * Imagen y documento se separan por destino y no por capricho. La imagen
 * es contenido: se dibuja en la tarjeta, y por eso vive en `url_imagen`.
 * El documento es un anexo: se lista con su nombre y se abre al tocarlo,
 * y por eso va a `adjuntos`, la tabla que ya existe para eso y que guarda
 * el nombre original, el tamano y quien lo subio.
 *
 * LA TARJETA TIENE UNA SOLA IMAGEN —`url_imagen` es una columna, no una
 * lista—, asi que la primera imagen de la tanda es la que se dibuja y las
 * demas quedan como anexos descargables. Rechazar la segunda seria perder
 * un archivo que la persona quiso subir.
 *
 * No devuelve error sino avisos: si un archivo falla, la publicacion ya
 * existe y perderla por un adjunto seria peor. Se avisa y se sigue con
 * los demas.
 */
async function adjuntarArchivos(
  publicacionId: string,
  archivos: FormDataEntryValue[],
): Promise<{ aviso: string | null; imagenNueva: boolean }> {
  const elegidos = archivos.filter(
    (archivo): archivo is File => archivo instanceof File && archivo.size > 0,
  );

  if (elegidos.length === 0) return { aviso: null, imagenNueva: false };

  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const avisos: string[] = [];
  let imagenNueva = false;

  for (const archivo of elegidos) {
    const motivo = motivoDeRechazoAdjunto(archivo.name, archivo.size);
    if (motivo) {
      avisos.push(`${archivo.name}: ${motivo}`);
      continue;
    }

    // La primera imagen va a la tarjeta; de ahi en mas, todo es anexo.
    const comoImagen = esImagen(archivo.name) && !imagenNueva;
    const ruta = comoImagen
      ? rutaDeImagen(publicacionId, archivo.name)
      : rutaDeAdjuntoPublicacion(publicacionId, archivo.name);

    const { error: errorCarga } = await supabase.storage
      .from(BUCKET_IMAGENES)
      .upload(ruta, archivo, { contentType: archivo.type || undefined, upsert: false });

    if (errorCarga) {
      avisos.push(`${archivo.name}: ${errorCarga.message}`);
      continue;
    }

    const { error } = comoImagen
      ? await supabase.from("publicaciones").update({ url_imagen: ruta }).eq("id", publicacionId)
      : await supabase.from("adjuntos").insert({
          empresa_id: usuario.empresa_id,
          entidad: "publicaciones",
          entidad_id: publicacionId,
          nombre_archivo: nombreDeArchivoLegible(archivo.name),
          ruta,
          bucket: BUCKET_IMAGENES,
          tamano_bytes: archivo.size,
          tipo_mime: archivo.type || null,
          subido_por: usuario.id,
        });

    if (error) {
      await supabase.storage.from(BUCKET_IMAGENES).remove([ruta]);
      avisos.push(`${archivo.name}: no se pudo asociar a la publicación.`);
      continue;
    }

    if (comoImagen) imagenNueva = true;
  }

  return {
    aviso: avisos.length > 0 ? `No entraron: ${avisos.join(" · ")}` : null,
    imagenNueva,
  };
}

/**
 * Quita un anexo de una publicacion.
 *
 * Hace falta desde que se pueden subir varios: sin esto, un archivo
 * subido por error solo se sacaba borrando la publicacion entera.
 */
export async function quitarAnexoDePublicacion(
  adjuntoId: string,
  publicacionId: string,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const resultado = await quitarAdjunto(supabase, adjuntoId, "publicaciones", publicacionId);
  if (!resultado.ok) return { exito: false, error: resultado.error };

  revalidatePath("/inicio");
  return { exito: true, mensaje: `«${resultado.nombre}» eliminado.` };
}

export async function cambiarEstadoPublicacion(
  id: string,
  estado: EstadoPublicacion,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite cambiar publicaciones." };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("publicaciones")
    // Archivar suelta la fijacion: dejar arriba de todo algo archivado es
    // exactamente lo contrario de archivarlo.
    .update(estado === "archivada" ? { estado, fijada: false } : { estado })
    .eq("id", id);
  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };

  revalidatePath("/inicio");

  const mensajes: Record<EstadoPublicacion, string> = {
    publicada: "Publicación visible para todos.",
    borrador: "Vuelve a borrador: deja de verse.",
    archivada: "Archivada. Sigue en el listado, no en el inicio.",
  };
  return { exito: true, mensaje: mensajes[estado] };
}

/**
 * Fijar deja la publicacion arriba de todo. Solo puede haber una: si se
 * fijan cinco cosas, no hay nada destacado y el recurso se gasta.
 */
export async function fijarPublicacion(id: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite destacar publicaciones." };
  }

  const supabase = crearClienteServidor();

  const { data: actual } = await supabase
    .from("publicaciones")
    .select("fijada")
    .eq("id", id)
    .maybeSingle();

  const fijar = !actual?.fijada;

  if (fijar) {
    await supabase
      .from("publicaciones")
      .update({ fijada: false })
      .eq("empresa_id", usuario.empresa_id)
      .eq("fijada", true);
  }

  const { error } = await supabase.from("publicaciones").update({ fijada: fijar }).eq("id", id);
  if (error) return { exito: false, error: `No se pudo destacar: ${error.message}` };

  revalidatePath("/inicio");
  return {
    exito: true,
    mensaje: fijar ? "Queda fijada arriba de todo." : "Ya no está fijada.",
  };
}

/**
 * Edicion de una publicacion ya creada.
 *
 * Faltaba, y se notaba: una vez publicado, un anuncio con un error de
 * dedo o una fecha equivocada no habia forma de corregirlo. La unica
 * salida era archivarlo y escribir otro, que deja el error a la vista de
 * todos en el historial.
 *
 * La imagen tiene tres caminos posibles: no tocarla, reemplazarla o
 * sacarla. Son tres y no dos porque "no mandar imagen" y "querer que no
 * haya imagen" son cosas distintas.
 */
export async function editarPublicacion(
  id: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite editar publicaciones." };
  }

  const supabase = crearClienteServidor();

  const titulo = String(datos.get("titulo") ?? "").trim();
  const cuerpo = String(datos.get("cuerpo") ?? "").trim();

  if (titulo.length < 5) {
    return { exito: false, error: "El título debe tener al menos 5 caracteres." };
  }
  if (cuerpo.length < 10) {
    return { exito: false, error: "El cuerpo debe tener al menos 10 caracteres." };
  }

  const { data: actual } = await supabase
    .from("publicaciones")
    .select("url_imagen")
    .eq("id", id)
    .maybeSingle();

  if (!actual) return { exito: false, error: "La publicación no existe." };

  const cambios: Record<string, unknown> = {
    tipo: String(datos.get("tipo") ?? "anuncio"),
    titulo,
    cuerpo,
    resumen: String(datos.get("resumen") ?? "").trim() || null,
    fecha_vencimiento: String(datos.get("fecha_vencimiento") ?? "") || null,
    usuario_referido_id: String(datos.get("usuario_referido_id") ?? "") || null,
    proceso_id: String(datos.get("proceso_id") ?? "") || null,
  };

  if (datos.get("quitar_imagen") === "si") {
    cambios.url_imagen = null;
  }

  const { error } = await supabase.from("publicaciones").update(cambios).eq("id", id);
  if (error) return { exito: false, error: `No se pudo guardar: ${error.message}` };

  // El archivo viejo se borra despues de que la fila dejo de apuntarlo:
  // asi no queda una publicacion mostrando una imagen que ya no existe.
  if (datos.get("quitar_imagen") === "si" && actual.url_imagen) {
    await borrarImagenDelBucket(actual.url_imagen);
  }

  const { aviso, imagenNueva } = await adjuntarArchivos(id, datos.getAll("archivos"));

  // La imagen vieja se borra solo si entro una nueva que la reemplazo.
  // Antes alcanzaba con que viniera un archivo; con varios, uno podia ser
  // un PDF y la imagen quedaba borrada del bucket sin reemplazo.
  if (imagenNueva && actual.url_imagen) await borrarImagenDelBucket(actual.url_imagen);

  revalidatePath("/inicio");
  return { exito: true, mensaje: `Publicación actualizada.${aviso ? ` ${aviso}` : ""}` };
}

/** Elimina la publicacion y su imagen. */
export async function eliminarPublicacion(id: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite eliminar publicaciones." };
  }

  const supabase = crearClienteServidor();

  const { data: publicacion } = await supabase
    .from("publicaciones")
    .select("url_imagen")
    .eq("id", id)
    .maybeSingle();

  // Los adjuntos no tienen clave foranea a publicaciones —la tabla es
  // generica, sirve para cualquier entidad—, asi que no se borran solos.
  const { data: adjuntos } = await supabase
    .from("adjuntos")
    .select("id, ruta")
    .eq("entidad", "publicaciones")
    .eq("entidad_id", id);

  const { error } = await supabase.from("publicaciones").delete().eq("id", id);
  if (error) return { exito: false, error: `No se pudo eliminar: ${error.message}` };

  if (publicacion?.url_imagen) await borrarImagenDelBucket(publicacion.url_imagen);

  for (const adjunto of adjuntos ?? []) {
    await supabase.from("adjuntos").delete().eq("id", adjunto.id);
    await supabase.storage.from(BUCKET_IMAGENES).remove([adjunto.ruta]);
  }

  revalidatePath("/inicio");
  return { exito: true, mensaje: "Publicación eliminada." };
}

/** Saca del bucket una imagen, si es una ruta nuestra y no una direccion externa. */
async function borrarImagenDelBucket(urlImagen: string): Promise<void> {
  if (!esRutaDelBucket(urlImagen)) return;
  const supabase = crearClienteServidor();
  await supabase.storage.from(BUCKET_IMAGENES).remove([urlImagen]);
}
