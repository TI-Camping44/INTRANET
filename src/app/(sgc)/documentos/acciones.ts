"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { notificar, notificarAVarios } from "@/lib/notificaciones";
import { PREFIJO_CODIGO_DOCUMENTO } from "@/lib/constantes";
import { BUCKET_DOCUMENTOS, motivoDeRechazo, rutaDeArchivo } from "@/lib/adjuntos";
import { hoyEnAsuncion } from "@/lib/formato";
import type { ResultadoAccion, TipoDocumento } from "@/lib/tipos";

const FORMATO_CODIGO = /^[A-Z]{1,4}(-[A-Z0-9]{1,4}){1,4}$/;

/**
 * Propone el siguiente codigo controlado disponible.
 * El usuario puede editarlo: el sistema sugiere, no impone.
 */
export async function sugerirCodigoDocumento(
  tipo: TipoDocumento,
  procesoId: string | null,
): Promise<string> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  let codigoProceso = "GEN";
  if (procesoId) {
    const { data: proceso } = await supabase
      .from("procesos")
      .select("codigo")
      .eq("id", procesoId)
      .maybeSingle();
    if (proceso?.codigo) codigoProceso = proceso.codigo.toUpperCase().slice(0, 4);
  }

  // Los formularios se numeran por proceso (F-COM-01-01); el resto usa el
  // prefijo del tipo de documento (MP-SOP-01).
  const base =
    tipo === "formulario"
      ? `F-${codigoProceso}`
      : PREFIJO_CODIGO_DOCUMENTO[tipo];

  const { data: existentes } = await supabase
    .from("documentos")
    .select("codigo")
    .eq("empresa_id", usuario.empresa_id)
    .ilike("codigo", `${base}-%`);

  const secuencias = (existentes ?? [])
    .map((fila: { codigo: string }) => {
      const resto = fila.codigo.slice(base.length + 1);
      const numero = Number.parseInt(resto.split("-")[0] ?? "", 10);
      return Number.isNaN(numero) ? 0 : numero;
    })
    .filter((numero: number) => numero > 0);

  const siguiente = (secuencias.length ? Math.max(...secuencias) : 0) + 1;
  const correlativo = String(siguiente).padStart(2, "0");

  return tipo === "formulario" ? `${base}-${correlativo}-01` : `${base}-${correlativo}`;
}

/** Alta de un documento junto con su version inicial v00 en borrador. */
export async function crearDocumento(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite crear documentos." };
  }

  const supabase = crearClienteServidor();

  const codigo = String(datos.get("codigo") ?? "").trim().toUpperCase();
  const titulo = String(datos.get("titulo") ?? "").trim();
  const tipo = String(datos.get("tipo") ?? "procedimiento") as TipoDocumento;
  const descripcion = String(datos.get("descripcion") ?? "").trim() || null;
  const procesoId = String(datos.get("proceso_id") ?? "") || null;
  const normaId = String(datos.get("norma_id") ?? "") || null;
  const responsableId = String(datos.get("responsable_id") ?? "") || usuario.id;
  const periodicidad = Number(datos.get("periodicidad_revision_meses") ?? 12);

  if (!codigo || !FORMATO_CODIGO.test(codigo)) {
    return {
      exito: false,
      error:
        "El código no cumple el formato controlado. Use por ejemplo MP-SOP-01 o F-COM-01-02.",
    };
  }
  if (titulo.length < 4) {
    return { exito: false, error: "El título debe tener al menos 4 caracteres." };
  }
  if (!Number.isInteger(periodicidad) || periodicidad < 1 || periodicidad > 60) {
    return { exito: false, error: "La periodicidad de revisión debe estar entre 1 y 60 meses." };
  }

  const { data: documento, error } = await supabase
    .from("documentos")
    .insert({
      empresa_id: usuario.empresa_id,
      codigo,
      titulo,
      tipo,
      descripcion,
      proceso_id: procesoId,
      norma_id: normaId,
      responsable_id: responsableId,
      elaborador_id: usuario.id,
      creado_por: usuario.id,
      periodicidad_revision_meses: periodicidad,
      estado: "borrador",
      version_actual: 0,
    })
    .select("id")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { exito: false, error: `Ya existe un documento con el código ${codigo}.` };
    }
    return { exito: false, error: `No se pudo crear el documento: ${error.message}` };
  }

  // Version inicial v00, en borrador.
  const { error: errorVersion } = await supabase.from("documento_versiones").insert({
    documento_id: documento.id,
    version: 0,
    estado: "borrador",
    resumen_cambios: "Versión inicial.",
    elaborado_por: usuario.id,
  });

  if (errorVersion) {
    return { exito: false, error: `El documento se creó, pero falló la versión inicial: ${errorVersion.message}` };
  }

  revalidatePath("/documentos");
  return { exito: true, id: documento.id, mensaje: `Documento ${codigo} creado en borrador.` };
}

/** Edicion de los datos de cabecera del documento. */
export async function actualizarDocumento(
  id: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const titulo = String(datos.get("titulo") ?? "").trim();
  if (titulo.length < 4) {
    return { exito: false, error: "El título debe tener al menos 4 caracteres." };
  }

  const { error } = await supabase
    .from("documentos")
    .update({
      titulo,
      descripcion: String(datos.get("descripcion") ?? "").trim() || null,
      tipo: String(datos.get("tipo") ?? "procedimiento"),
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
      norma_id: String(datos.get("norma_id") ?? "") || null,
      responsable_id: String(datos.get("responsable_id") ?? "") || null,
      periodicidad_revision_meses: Number(datos.get("periodicidad_revision_meses") ?? 12),
    })
    .eq("id", id);

  if (error) return { exito: false, error: `No se pudo actualizar: ${error.message}` };

  revalidatePath(`/documentos/${id}`);
  return { exito: true, mensaje: "Documento actualizado." };
}

/** Crea la siguiente version en borrador sobre un documento ya vigente. */
export async function crearNuevaVersion(
  documentoId: string,
  resumenCambios: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: ultima } = await supabase
    .from("documento_versiones")
    .select("version")
    .eq("documento_id", documentoId)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  const siguiente = (ultima?.version ?? -1) + 1;

  const { error } = await supabase.from("documento_versiones").insert({
    documento_id: documentoId,
    version: siguiente,
    estado: "borrador",
    resumen_cambios: resumenCambios.trim() || "Sin detalle de cambios.",
    elaborado_por: usuario.id,
  });

  if (error) return { exito: false, error: `No se pudo crear la versión: ${error.message}` };

  revalidatePath(`/documentos/${documentoId}`);
  return { exito: true, mensaje: `Versión v${String(siguiente).padStart(2, "0")} creada en borrador.` };
}

/** Envia una version a revision y avisa a los revisores asignados. */
export async function enviarARevision(
  versionId: string,
  revisores: string[],
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  if (revisores.length === 0) {
    return { exito: false, error: "Debe asignar al menos un revisor." };
  }

  const { data: version } = await supabase
    .from("documento_versiones")
    .select("id, version, documento_id, estado")
    .eq("id", versionId)
    .maybeSingle();

  if (!version) return { exito: false, error: "La versión no existe." };
  if (version.estado !== "borrador") {
    return { exito: false, error: "Solo se puede enviar a revisión una versión en borrador." };
  }

  const { error } = await supabase
    .from("documento_versiones")
    .update({ estado: "en_revision" })
    .eq("id", versionId);

  if (error) return { exito: false, error: `No se pudo enviar a revisión: ${error.message}` };

  // Se reemplaza la asignación anterior por la nueva.
  await supabase.from("documento_revisores").delete().eq("version_id", versionId);
  await supabase.from("documento_revisores").insert(
    revisores.map((revisor) => ({
      version_id: versionId,
      usuario_id: revisor,
      estado: "pendiente",
    })),
  );

  const { data: documento } = await supabase
    .from("documentos")
    .select("id, codigo, titulo, estado")
    .eq("id", version.documento_id)
    .maybeSingle();

  // Un documento que aún no está vigente pasa a "en revisión". Si ya lo
  // está, conserva su estado: la versión vigente sigue siendo la aplicable
  // mientras se revisa la siguiente.
  if (documento && documento.estado !== "vigente") {
    await supabase
      .from("documentos")
      .update({ estado: "en_revision" })
      .eq("id", version.documento_id);
  }

  const { data: personas } = await supabase
    .from("usuarios")
    .select("id, correo")
    .in("id", revisores);

  await notificarAVarios(supabase, (personas ?? []) as { id: string; correo: string }[], {
    tipo: "revision_solicitada",
    titulo: `Revisión solicitada: ${documento?.codigo ?? ""}`,
    mensaje:
      `${usuario.nombre_completo} solicita su revisión de la versión ` +
      `v${String(version.version).padStart(2, "0")} de "${documento?.titulo ?? ""}".`,
    enlace: `/documentos/${version.documento_id}`,
    entidad: "documentos",
    entidadId: version.documento_id,
    claveUnicidad: `revision:${versionId}`,
  });

  revalidatePath(`/documentos/${version.documento_id}`);
  return { exito: true, mensaje: "Versión enviada a revisión." };
}

/** Respuesta de un revisor sobre la version que tiene asignada. */
export async function responderRevision(
  revisionId: string,
  aprueba: boolean,
  comentario: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: revision } = await supabase
    .from("documento_revisores")
    .select("id, version_id, usuario_id")
    .eq("id", revisionId)
    .maybeSingle();

  if (!revision || revision.usuario_id !== usuario.id) {
    return { exito: false, error: "No tiene asignada esta revisión." };
  }

  if (!aprueba && comentario.trim().length < 10) {
    return {
      exito: false,
      error: "Al rechazar debe indicar el motivo, con al menos 10 caracteres.",
    };
  }

  const { error } = await supabase
    .from("documento_revisores")
    .update({
      estado: aprueba ? "aprobado" : "rechazado",
      comentario: comentario.trim() || null,
      fecha_respuesta: new Date().toISOString(),
    })
    .eq("id", revisionId);

  if (error) return { exito: false, error: `No se pudo registrar la revisión: ${error.message}` };

  const { data: version } = await supabase
    .from("documento_versiones")
    .select("documento_id, version, elaborado_por")
    .eq("id", revision.version_id)
    .maybeSingle();

  // Un rechazo devuelve la versión a borrador para su corrección.
  if (!aprueba && version) {
    await supabase
      .from("documento_versiones")
      .update({ estado: "borrador" })
      .eq("id", revision.version_id);

    if (version.elaborado_por) {
      const { data: elaborador } = await supabase
        .from("usuarios")
        .select("id, correo")
        .eq("id", version.elaborado_por)
        .maybeSingle();

      if (elaborador) {
        await notificar(supabase, {
          usuarioId: elaborador.id,
          correoDestino: elaborador.correo,
          tipo: "documento_por_revisar",
          titulo: "Revisión rechazada",
          mensaje: `${usuario.nombre_completo} devolvió la versión con observaciones: ${comentario.trim()}`,
          enlace: `/documentos/${version.documento_id}`,
          entidad: "documentos",
          entidadId: version.documento_id,
        });
      }
    }
  }

  if (version) revalidatePath(`/documentos/${version.documento_id}`);
  return {
    exito: true,
    mensaje: aprueba ? "Revisión aprobada." : "Versión devuelta con observaciones.",
  };
}

/**
 * Aprueba y publica una version. El disparador de la base de datos
 * actualiza la cabecera del documento, calcula la proxima revision y
 * marca las versiones anteriores como obsoletas.
 */
export async function aprobarYPublicar(versionId: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite aprobar documentos." };
  }

  const supabase = crearClienteServidor();

  const { data: version } = await supabase
    .from("documento_versiones")
    .select("id, version, documento_id, estado")
    .eq("id", versionId)
    .maybeSingle();

  if (!version) return { exito: false, error: "La versión no existe." };
  if (version.estado === "vigente") {
    return { exito: false, error: "Esta versión ya está vigente." };
  }

  const { data: revisiones } = await supabase
    .from("documento_revisores")
    .select("estado")
    .eq("version_id", versionId);

  const pendientes = (revisiones ?? []).filter(
    (revision: { estado: string }) => revision.estado !== "aprobado",
  );

  if ((revisiones ?? []).length > 0 && pendientes.length > 0) {
    return {
      exito: false,
      error: `Quedan ${pendientes.length} revisiones sin aprobar. No se puede publicar todavía.`,
    };
  }

  const { error } = await supabase
    .from("documento_versiones")
    .update({
      estado: "vigente",
      aprobado_por: usuario.id,
      fecha_aprobacion: new Date().toISOString(),
    })
    .eq("id", versionId);

  if (error) return { exito: false, error: `No se pudo publicar: ${error.message}` };

  // Aviso a la lista de difusión: es el requisito de comunicar el cambio
  // a los usuarios alcanzados por el documento.
  const { data: alcanzados } = await supabase.rpc("notificar_difusion_documento", {
    p_documento_id: version.documento_id,
  });

  revalidatePath(`/documentos/${version.documento_id}`);
  revalidatePath("/documentos");

  const cantidad = Number(alcanzados ?? 0);
  return {
    exito: true,
    mensaje:
      `Versión v${String(version.version).padStart(2, "0")} publicada.` +
      (cantidad > 0 ? ` Se notificó a ${cantidad} persona${cantidad === 1 ? "" : "s"}.` : ""),
  };
}

/** Retira un documento de circulacion. */
export async function marcarObsoleto(documentoId: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite dar de baja documentos." };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("documentos")
    .update({ estado: "obsoleto" })
    .eq("id", documentoId);

  if (error) return { exito: false, error: `No se pudo marcar como obsoleto: ${error.message}` };

  await supabase
    .from("documento_versiones")
    .update({ estado: "obsoleto" })
    .eq("documento_id", documentoId)
    .neq("estado", "obsoleto");

  revalidatePath(`/documentos/${documentoId}`);
  return { exito: true, mensaje: "Documento marcado como obsoleto." };
}

/** Define la lista de difusion: personas y procesos alcanzados. */
export async function definirDifusion(
  documentoId: string,
  usuarios: string[],
  procesos: string[],
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  await supabase.from("documento_difusion").delete().eq("documento_id", documentoId);

  const filas = [
    ...usuarios.map((id) => ({ documento_id: documentoId, usuario_id: id, proceso_id: null })),
    ...procesos.map((id) => ({ documento_id: documentoId, usuario_id: null, proceso_id: id })),
  ];

  if (filas.length > 0) {
    const { error } = await supabase.from("documento_difusion").insert(filas);
    if (error) return { exito: false, error: `No se pudo guardar la difusión: ${error.message}` };
  }

  revalidatePath(`/documentos/${documentoId}`);
  return { exito: true, mensaje: "Lista de difusión actualizada." };
}

/** Registra que el documento fue revisado sin cambios de contenido. */
export async function confirmarRevisionSinCambios(
  documentoId: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite confirmar revisiones." };
  }

  const supabase = crearClienteServidor();

  const { data: documento } = await supabase
    .from("documentos")
    .select("periodicidad_revision_meses")
    .eq("id", documentoId)
    .maybeSingle();

  const meses = documento?.periodicidad_revision_meses ?? 12;
  const hoy = hoyEnAsuncion();
  const proxima = new Date(`${hoy}T12:00:00`);
  proxima.setMonth(proxima.getMonth() + meses);

  const { error } = await supabase
    .from("documentos")
    .update({ fecha_proxima_revision: proxima.toISOString().slice(0, 10) })
    .eq("id", documentoId);

  if (error) return { exito: false, error: `No se pudo registrar la revisión: ${error.message}` };

  revalidatePath(`/documentos/${documentoId}`);
  return { exito: true, mensaje: "Revisión registrada sin cambios de contenido." };
}

// ---------------------------------------------------------------------
// Archivos del documento
// ---------------------------------------------------------------------
// La intranet pasa a guardar el archivo, no solo a enlazarlo. Es lo que
// pidio Calidad para dejar de depender del Drive: si el archivo vive
// aca, la version que la gente abre es la que el sistema dice que rige.
//
// El bucket es privado. Nada se entrega por URL directa: cada descarga
// pide un enlace firmado que dura minutos.

/** Sube el archivo del documento y lo deja registrado en `adjuntos`. */
export async function subirArchivoDocumento(
  documentoId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite subir archivos al sistema documental." };
  }

  const archivo = datos.get("archivo");
  if (!(archivo instanceof File)) {
    return { exito: false, error: "Elija un archivo para subir." };
  }

  const supabase = crearClienteServidor();

  const { data: documento } = await supabase
    .from("documentos")
    .select("id, tipo, codigo, titulo")
    .eq("id", documentoId)
    .maybeSingle();

  if (!documento) return { exito: false, error: "El documento no existe." };

  // La regla de formato por tipo se controla aca, no en el navegador: el
  // "accept" del selector es comodidad, no control.
  const motivo = motivoDeRechazo(documento.tipo as TipoDocumento, archivo.name, archivo.size);
  if (motivo) return { exito: false, error: motivo };

  const ruta = rutaDeArchivo(documentoId, archivo.name);

  const { error: errorCarga } = await supabase.storage
    .from(BUCKET_DOCUMENTOS)
    .upload(ruta, archivo, { contentType: archivo.type || undefined, upsert: false });

  if (errorCarga) {
    return { exito: false, error: `No se pudo subir el archivo: ${errorCarga.message}` };
  }

  const { error } = await supabase.from("adjuntos").insert({
    empresa_id: usuario.empresa_id,
    entidad: "documentos",
    entidad_id: documentoId,
    nombre_archivo: archivo.name,
    ruta,
    bucket: BUCKET_DOCUMENTOS,
    tamano_bytes: archivo.size,
    tipo_mime: archivo.type || null,
    subido_por: usuario.id,
  });

  if (error) {
    // El archivo ya esta arriba: si no se pudo registrar, se retira para
    // no dejar un huerfano en el bucket que nadie sabe de quien es.
    await supabase.storage.from(BUCKET_DOCUMENTOS).remove([ruta]);
    return { exito: false, error: `No se pudo registrar el archivo: ${error.message}` };
  }

  revalidatePath(`/documentos/${documentoId}`);
  return { exito: true, mensaje: `${archivo.name} quedó adjunto al documento.` };
}

/**
 * Devuelve un enlace firmado para abrir el archivo.
 *
 * Dura cinco minutos: alcanza para abrirlo y no para dejarlo pegado en un
 * chat y que lo abra cualquiera dentro de un mes.
 */
export async function enlaceDeArchivo(adjuntoId: string): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: adjunto } = await supabase
    .from("adjuntos")
    .select("bucket, ruta, nombre_archivo")
    .eq("id", adjuntoId)
    .maybeSingle();

  if (!adjunto) return { exito: false, error: "El archivo no existe o no tiene acceso." };

  const { data, error } = await supabase.storage
    .from(adjunto.bucket)
    .createSignedUrl(adjunto.ruta, 300, { download: adjunto.nombre_archivo });

  if (error || !data) {
    return { exito: false, error: `No se pudo generar el enlace: ${error?.message ?? ""}` };
  }

  return { exito: true, mensaje: data.signedUrl };
}

/** Quita un archivo del documento: primero el registro, despues el objeto. */
export async function eliminarArchivoDocumento(
  adjuntoId: string,
  documentoId: string,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: adjunto } = await supabase
    .from("adjuntos")
    .select("bucket, ruta")
    .eq("id", adjuntoId)
    .maybeSingle();

  if (!adjunto) return { exito: false, error: "El archivo no existe o no tiene acceso." };

  const { error } = await supabase.from("adjuntos").delete().eq("id", adjuntoId);
  if (error) return { exito: false, error: `No se pudo eliminar el archivo: ${error.message}` };

  await supabase.storage.from(adjunto.bucket).remove([adjunto.ruta]);

  revalidatePath(`/documentos/${documentoId}`);
  return { exito: true, mensaje: "Archivo eliminado." };
}

// ---------------------------------------------------------------------
// Anunciar el documento en el inicio
// ---------------------------------------------------------------------
// Poner un procedimiento en vigencia no sirve de nada si la gente no se
// entera. La difusion notifica a una lista; el muro del inicio es lo que
// se mira todos los dias sin que nadie lo pida. Son complementarios.
//
// El texto se propone, no se impone: llega redactado a la pantalla y
// quien anuncia lo edita antes de publicar.

/** Publica el documento como anuncio en el muro del inicio. */
export async function anunciarDocumento(
  documentoId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite publicar en la intranet." };
  }

  const supabase = crearClienteServidor();

  const { data: documento } = await supabase
    .from("documentos")
    .select("id, codigo, titulo, estado, proceso_id")
    .eq("id", documentoId)
    .maybeSingle();

  if (!documento) return { exito: false, error: "El documento no existe." };

  if (documento.estado !== "vigente") {
    return {
      exito: false,
      error:
        "Solo se anuncia un documento vigente. Anunciar un borrador es pedirle a la " +
        "gente que aplique algo que todavía puede cambiar.",
    };
  }

  const titulo = String(datos.get("titulo") ?? "").trim();
  const cuerpo = String(datos.get("cuerpo") ?? "").trim();

  if (titulo.length < 5) {
    return { exito: false, error: "El título debe tener al menos 5 caracteres." };
  }
  if (cuerpo.length < 10) {
    return { exito: false, error: "El texto del anuncio debe tener al menos 10 caracteres." };
  }

  const { data: publicacion, error } = await supabase
    .from("publicaciones")
    .insert({
      empresa_id: usuario.empresa_id,
      tipo: "anuncio",
      titulo,
      cuerpo,
      estado: "publicada",
      fecha_publicacion: new Date().toISOString(),
      fijada: datos.get("fijada") === "si",
      fecha_vencimiento: String(datos.get("fecha_vencimiento") ?? "") || null,
      // El anuncio hereda el proceso del documento: asi queda claro de qué
      // área es sin que nadie lo vuelva a elegir.
      proceso_id: documento.proceso_id,
      documento_id: documento.id,
      creado_por: usuario.id,
    })
    .select("id")
    .single();

  if (error) {
    return { exito: false, error: `No se pudo publicar el anuncio: ${error.message}` };
  }

  revalidatePath("/inicio");
  revalidatePath(`/documentos/${documentoId}`);

  return {
    exito: true,
    id: publicacion.id,
    mensaje: `${documento.codigo ?? documento.titulo} anunciado en el inicio.`,
  };
}
