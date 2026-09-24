"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { departe, notificar, notificarAVarios } from "@/lib/notificaciones";
import { PREFIJO_CODIGO_DOCUMENTO } from "@/lib/constantes";
import {
  BUCKET_DOCUMENTOS,
  motivoDeRechazo,
  nombreDeArchivoLegible,
  rutaDeArchivo,
} from "@/lib/adjuntos";
import { extraerTexto } from "@/lib/extraer-texto";
import { indexarDocumentosPendientes, resumirIndexacion } from "@/lib/indexar-documentos";
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
  const tipo = String(datos.get("tipo") ?? "manual") as TipoDocumento;
  // El alta pide lo minimo: tipo, codigo, titulo y el archivo. Calidad
  // pidio sacar del formulario la descripcion, el proceso asociado, la
  // norma, el responsable y la periodicidad. Los tres ultimos tienen
  // valor por defecto —quien carga es el responsable, doce meses de
  // revision— y se corrigen despues en la ficha; los dos primeros quedan
  // vacios. Cargar un documento tiene que costar treinta segundos.
  const responsableId = usuario.id;
  const periodicidad = 12;

  // Los documentos de contexto y las politicas no llevan codigo
  // controlado. La columna admite vacio; lo que se agrega es poder
  // decirlo, en vez de dejar el campo en blanco y que parezca un olvido.
  const sinCodigo = datos.get("sin_codigo") === "on";

  if (!sinCodigo && (!codigo || !FORMATO_CODIGO.test(codigo))) {
    return {
      exito: false,
      error:
        "El código no cumple el formato controlado. Use por ejemplo MP-SOP-01 o F-COM-01-02, " +
        "o marque «No aplica» si este documento va sin código.",
    };
  }
  if (titulo.length < 4) {
    return { exito: false, error: "El título debe tener al menos 4 caracteres." };
  }
  if (!Number.isInteger(periodicidad) || periodicidad < 1 || periodicidad > 60) {
    return { exito: false, error: "La periodicidad de revisión debe estar entre 1 y 60 meses." };
  }

  const categoria = String(datos.get("categoria") ?? "").trim() || null;

  // La posicion que ya tiene esa categoria en el listado, si existe. En
  // SQL `categoria = null` no es falso sino nulo y no alcanza ninguna
  // fila, asi que «Sin categoria» se consulta con `is`.
  let consultaHermanos = supabase
    .from("documentos")
    .select("orden_categoria")
    .not("orden_categoria", "is", null)
    .limit(1);

  consultaHermanos =
    categoria === null
      ? consultaHermanos.is("categoria", null)
      : consultaHermanos.eq("categoria", categoria);

  const { data: hermanos } = await consultaHermanos;

  const posicionDeCategoria =
    ((hermanos as { orden_categoria: number }[] | null) ?? [])[0]?.orden_categoria ?? null;

  const { data: documento, error } = await supabase
    .from("documentos")
    .insert({
      empresa_id: usuario.empresa_id,
      codigo: sinCodigo ? null : codigo,
      titulo,
      tipo,
      categoria: categoria,
      // Hereda la posicion de su categoria. Sin esto el documento nuevo
      // queda con la posicion en nulo y se va al principio del listado,
      // fuera de la carpeta a la que pertenece.
      orden_categoria: posicionDeCategoria,
      proceso_id: String(datos.get("proceso_id") ?? "") || null,
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

  // El archivo viaja en el mismo envio del alta. Antes habia que crear el
  // documento, entrar a la ficha y recien ahi subirlo, y quedaban
  // documentos con codigo y sin contenido: la mitad de los cargados no
  // tenia archivo. Si la subida falla, el documento igual quedo creado y
  // el mensaje lo dice, porque perder el alta seria peor.
  const archivo = datos.get("archivo");
  if (archivo instanceof File && archivo.size > 0) {
    const resultado = await subirArchivoDocumento(documento.id, datos);
    if (!resultado.exito) {
      return {
        exito: true,
        id: documento.id,
        mensaje:
          `El documento ${codigo} se creó, pero el archivo no se pudo subir: ` +
          `${resultado.error} Puede cargarlo desde la ficha.`,
      };
    }
  }

  revalidatePath("/documentos");
  return { exito: true, id: documento.id, mensaje: `Documento ${codigo} creado en borrador.` };
}

/** Edicion de los datos de cabecera del documento. */
export async function actualizarDocumento(
  id: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite editar documentos." };
  }

  const supabase = crearClienteServidor();

  const titulo = String(datos.get("titulo") ?? "").trim();
  if (titulo.length < 4) {
    return { exito: false, error: "El título debe tener al menos 4 caracteres." };
  }

  const sinCodigo = datos.get("sin_codigo") === "on";
  const codigo = String(datos.get("codigo") ?? "").trim().toUpperCase();

  if (!sinCodigo && codigo && !FORMATO_CODIGO.test(codigo)) {
    return {
      exito: false,
      error:
        "El código no cumple el formato controlado. Use por ejemplo MP-SOP-01 o F-COM-01-02, " +
        "o marque «No aplica» si este documento va sin código.",
    };
  }

  const categoria = String(datos.get("categoria") ?? "").trim() || null;

  // Si cambia de categoria, hereda la posicion de la nueva: si no,
  // quedaria con la posicion de la carpeta de la que salio y apareceria
  // en un lugar que no le corresponde.
  let consultaHermanos = supabase
    .from("documentos")
    .select("orden_categoria")
    .not("orden_categoria", "is", null)
    .neq("id", id)
    .limit(1);

  consultaHermanos =
    categoria === null
      ? consultaHermanos.is("categoria", null)
      : consultaHermanos.eq("categoria", categoria);

  const { data: hermanos } = await consultaHermanos;
  const posicionDeCategoria =
    ((hermanos as { orden_categoria: number }[] | null) ?? [])[0]?.orden_categoria ?? null;

  const cambios: Record<string, unknown> = {
    titulo,
    codigo: sinCodigo || !codigo ? null : codigo,
    tipo: String(datos.get("tipo") ?? "manual"),
    categoria,
    proceso_id: String(datos.get("proceso_id") ?? "") || null,
    responsable_id: String(datos.get("responsable_id") ?? "") || null,
    periodicidad_revision_meses: Number(datos.get("periodicidad_revision_meses") ?? 12),
  };

  if (posicionDeCategoria !== null) cambios.orden_categoria = posicionDeCategoria;

  const { error } = await supabase.from("documentos").update(cambios).eq("id", id);

  if (error) {
    if (error.code === "23505") {
      return { exito: false, error: `Ya existe otro documento con el código ${codigo}.` };
    }
    return { exito: false, error: `No se pudo actualizar: ${error.message}` };
  }

  revalidatePath(`/documentos/${id}`);
  revalidatePath("/documentos");
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
/**
 * Manda el borrador a validar y aprobar.
 *
 * Calidad lo pidio asi: dos personas, una valida el contenido y otra lo
 * aprueba, y pueden ser la misma sin ninguna traba —en un documento
 * chico suele serlo, y obligar a poner dos nombres distintos termina en
 * un nombre puesto de relleno—.
 *
 * Reemplaza a la lista de revisores. Revisar era una lista de gente que
 * opinaba; validar y aprobar son dos cargos con nombre y apellido, que
 * es lo que despues se firma.
 */
export async function enviarAValidacion(
  versionId: string,
  validadorId: string,
  aprobadorId: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  if (!validadorId || !aprobadorId) {
    return { exito: false, error: "Elija quién valida y quién aprueba." };
  }

  const { data: version } = await supabase
    .from("documento_versiones")
    .select("id, version, documento_id, estado")
    .eq("id", versionId)
    .maybeSingle();

  if (!version) return { exito: false, error: "La versión no existe." };
  if (version.estado !== "borrador") {
    return { exito: false, error: "Solo se puede enviar una versión en borrador." };
  }

  const { error } = await supabase
    .from("documento_versiones")
    .update({ estado: "en_revision" })
    .eq("id", versionId);

  if (error) return { exito: false, error: `No se pudo enviar: ${error.message}` };

  // Quien valida y quien aprueba quedan en el documento, no en la
  // version: son el circuito del documento y no cambian en cada vuelta.
  // Se limpia la validacion anterior, si la habia: es una vuelta nueva.
  await supabase
    .from("documentos")
    .update({
      validador_id: validadorId,
      aprobador_id: aprobadorId,
      fecha_validacion: null,
      estado: "en_revision",
    })
    .eq("id", version.documento_id)
    .neq("estado", "vigente");

  const { data: documento } = await supabase
    .from("documentos")
    .select("id, codigo, titulo")
    .eq("id", version.documento_id)
    .maybeSingle();

  // Si valida y aprueba la misma persona, un solo aviso.
  const destinatarios = Array.from(new Set([validadorId, aprobadorId]));

  const { data: personas } = await supabase
    .from("usuarios")
    .select("id, correo")
    .in("id", destinatarios);

  await notificarAVarios(supabase, (personas ?? []) as { id: string; correo: string }[], {
    tipo: "revision_solicitada",
    deParteDe: departe(usuario),
    titulo: `Documento para validar y aprobar: ${documento?.codigo ?? documento?.titulo ?? ""}`,
    mensaje:
      `${documento?.titulo ?? ""} está listo para su validación y aprobación. ` +
      `Versión v${String(version.version).padStart(2, "0")}.`,
    enlace: `/documentos/${version.documento_id}`,
    entidad: "documentos",
    entidadId: version.documento_id,
  });

  revalidatePath(`/documentos/${version.documento_id}`);
  revalidatePath("/documentos");
  return { exito: true, mensaje: "El documento quedó a la espera de validación y aprobación." };
}

/**
 * Registra la validacion del contenido.
 *
 * La hace quien fue designado validador, o Calidad. Es el paso previo a
 * la aprobacion: sin esto, `aprobarYPublicar` se niega.
 */
export async function validarDocumento(documentoId: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: documento } = await supabase
    .from("documentos")
    .select("id, codigo, titulo, validador_id, aprobador_id, fecha_validacion")
    .eq("id", documentoId)
    .maybeSingle();

  if (!documento) return { exito: false, error: "El documento no existe o no tiene acceso." };
  if (documento.fecha_validacion) {
    return { exito: false, error: "Este documento ya fue validado." };
  }

  const esCalidad = usuario.rol === "administrador_sgc";
  if (documento.validador_id !== usuario.id && !esCalidad) {
    return {
      exito: false,
      error: "La validación la registra quien fue designado validador, o Calidad.",
    };
  }

  const { error } = await supabase
    .from("documentos")
    .update({ fecha_validacion: hoyEnAsuncion(), validador_id: documento.validador_id ?? usuario.id })
    .eq("id", documentoId);

  if (error) return { exito: false, error: `No se pudo registrar la validación: ${error.message}` };

  // Se avisa a quien aprueba, que es quien sigue. Si es la misma persona
  // que acaba de validar, no se avisa: ya lo sabe.
  if (documento.aprobador_id && documento.aprobador_id !== usuario.id) {
    const { data: aprobador } = await supabase
      .from("usuarios")
      .select("id, correo")
      .eq("id", documento.aprobador_id)
      .maybeSingle();

    if (aprobador) {
      await notificar(supabase, {
        usuarioId: aprobador.id,
        correoDestino: aprobador.correo,
        deParteDe: departe(usuario),
        tipo: "revision_solicitada",
        titulo: `Validado, listo para aprobar: ${documento.codigo ?? documento.titulo}`,
        mensaje: `${documento.titulo} fue validado y queda a la espera de su aprobación.`,
        enlace: `/documentos/${documentoId}`,
        entidad: "documentos",
        entidadId: documentoId,
      });
    }
  }

  revalidatePath(`/documentos/${documentoId}`);
  return { exito: true, mensaje: "Validación registrada. Queda a la espera de la aprobación." };
}

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
    deParteDe: departe(usuario),
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
          deParteDe: departe(usuario),
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

  // Sin validacion no hay aprobacion: es el circuito que fijo Calidad.
  const { data: documento } = await supabase
    .from("documentos")
    .select("id, validador_id, aprobador_id, fecha_validacion")
    .eq("id", version.documento_id)
    .maybeSingle();

  const esCalidad = usuario.rol === "administrador_sgc";

  if (documento?.validador_id && !documento.fecha_validacion) {
    return {
      exito: false,
      error: "Falta la validación del contenido. Primero tiene que validarse, después aprobarse.",
    };
  }

  if (documento?.aprobador_id && documento.aprobador_id !== usuario.id && !esCalidad) {
    return {
      exito: false,
      error: "La aprobación la registra quien fue designado aprobador, o Calidad.",
    };
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

/**
 * Guarda el texto del archivo para que el buscador pueda mirar adentro.
 *
 * Nunca lanza. Es deliberado: esto es un indice, no el documento. Si el
 * archivo es un escaneado sin texto, o un formato que no se sabe leer, o
 * PDF.js se cae con un archivo mal armado, la subida tiene que terminar
 * bien igual. El trabajo programado vuelve a intentarlo despues.
 *
 * No esta exportada a proposito: un archivo «use server» solo puede
 * exportar funciones asincronas que sean acciones de verdad, y esta es
 * interna.
 */
async function indexarTextoDelArchivo(
  documentoId: string,
  adjuntoId: string,
  archivo: File,
): Promise<void> {
  try {
    const extraido = await extraerTexto(
      await archivo.arrayBuffer(),
      archivo.name,
      archivo.type || null,
    );
    if (!extraido) return;

    const supabase = crearClienteServidor();
    await supabase.from("documento_texto").upsert(
      {
        documento_id: documentoId,
        adjunto_id: adjuntoId,
        texto: extraido.texto,
        paginas: extraido.paginas,
        extraido_en: new Date().toISOString(),
      },
      { onConflict: "documento_id" },
    );
  } catch {
    // A proposito en silencio. Ver el comentario de arriba.
  }
}

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

  const { data: adjunto, error } = await supabase
    .from("adjuntos")
    .insert({
      empresa_id: usuario.empresa_id,
      entidad: "documentos",
      entidad_id: documentoId,
      nombre_archivo: nombreDeArchivoLegible(archivo.name),
      ruta,
      bucket: BUCKET_DOCUMENTOS,
      tamano_bytes: archivo.size,
      tipo_mime: archivo.type || null,
      subido_por: usuario.id,
    })
    .select("id")
    .single();

  if (error || !adjunto) {
    // El archivo ya esta arriba: si no se pudo registrar, se retira para
    // no dejar un huerfano en el bucket que nadie sabe de quien es.
    await supabase.storage.from(BUCKET_DOCUMENTOS).remove([ruta]);
    return {
      exito: false,
      error: `No se pudo registrar el archivo: ${error?.message ?? "sin detalle"}`,
    };
  }

  // Se lee el texto para que el buscador pueda mirar adentro. NO CORTA LA
  // SUBIDA si falla: el archivo ya esta guardado y registrado, que es lo
  // que la persona pidio. Lo que no se indexe aca lo levanta el trabajo
  // programado, que busca justamente lo que le falta.
  await indexarTextoDelArchivo(documentoId, adjunto.id, archivo);

  revalidatePath(`/documentos/${documentoId}`);
  return { exito: true, mensaje: `${archivo.name} quedó adjunto al documento.` };
}

/**
 * Devuelve un enlace firmado para abrir el archivo.
 *
 * Dura cinco minutos: alcanza para abrirlo y no para dejarlo pegado en un
 * chat y que lo abra cualquiera dentro de un mes.
 */
export async function enlaceDeArchivo(
  adjuntoId: string,
  paraDescargar = true,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: adjunto } = await supabase
    .from("adjuntos")
    .select("bucket, ruta, nombre_archivo")
    .eq("id", adjuntoId)
    .maybeSingle();

  if (!adjunto) return { exito: false, error: "El archivo no existe o no tiene acceso." };

  // Con `download` el navegador guarda el archivo; sin eso lo muestra.
  // Son el mismo objeto y el mismo permiso: lo unico que cambia es la
  // cabecera con la que Storage lo entrega.
  const { data, error } = await supabase.storage
    .from(adjunto.bucket)
    .createSignedUrl(
      adjunto.ruta,
      300,
      paraDescargar ? { download: adjunto.nombre_archivo } : {},
    );

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

/**
 * Elimina un documento entero: su ficha, sus versiones, su difusion y
 * sus archivos del bucket.
 *
 * Existe para lo que no deberia haberse cargado —una prueba, un
 * duplicado, un error de carga—. NO es la forma de retirar un documento
 * que estuvo en uso: para eso esta «Marcar obsoleto», que lo conserva
 * con su historial, que es lo que la norma pide.
 *
 * Solo el Administrador SGC. Es lo que ya decia RLS
 * (`documentos_baja`), y aca se repite para poder dar un mensaje en vez
 * de un borrado que afecta cero filas.
 *
 * La bitacora conserva la constancia: el disparador registra la baja
 * antes de que la fila desaparezca, con quien la hizo y cuando. Sin eso
 * esto no seria aceptable en una auditoria.
 */
export async function eliminarDocumento(documentoId: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();

  if (usuario.rol !== "administrador_sgc") {
    return {
      exito: false,
      error: "Solo el Administrador SGC puede eliminar un documento. Puede marcarlo obsoleto.",
    };
  }

  const supabase = crearClienteServidor();

  const { data: documento } = await supabase
    .from("documentos")
    .select("id, codigo, titulo")
    .eq("id", documentoId)
    .maybeSingle();

  if (!documento) return { exito: false, error: "El documento no existe o no tiene acceso." };

  // Primero los archivos del bucket. Si se borrara la fila antes, las
  // rutas se perderian y los objetos quedarian huerfanos, ocupando lugar
  // y sin nadie que sepa de que eran.
  const { data: adjuntos } = await supabase
    .from("adjuntos")
    .select("id, bucket, ruta")
    .eq("entidad", "documentos")
    .eq("entidad_id", documentoId);

  const porBucket = new Map<string, string[]>();
  for (const adjunto of (adjuntos as { bucket: string; ruta: string }[] | null) ?? []) {
    const rutas = porBucket.get(adjunto.bucket) ?? [];
    rutas.push(adjunto.ruta);
    porBucket.set(adjunto.bucket, rutas);
  }

  for (const [bucket, rutas] of Array.from(porBucket.entries())) {
    await supabase.storage.from(bucket).remove(rutas);
  }

  await supabase.from("adjuntos").delete().eq("entidad", "documentos").eq("entidad_id", documentoId);

  // Las versiones y la difusion se van solas: su clave foranea cascadea.
  const { error } = await supabase.from("documentos").delete().eq("id", documentoId);

  if (error) return { exito: false, error: `No se pudo eliminar: ${error.message}` };

  revalidatePath("/documentos");
  return {
    exito: true,
    mensaje: `${documento.codigo ?? ""} ${documento.titulo} se eliminó junto con sus archivos.`,
  };
}


/**
 * Elimina varios documentos de una vez.
 *
 * Es el mismo criterio que el borrado individual —sirve para lo que no
 * deberia haberse cargado, no para retirar lo que estuvo en uso— pero
 * hace falta igual: limpiar doce pruebas de a una son doce
 * confirmaciones y doce recargas de pantalla.
 *
 * Se borra uno por uno y no con un `in`, a proposito: cada documento
 * tiene sus archivos en el bucket y hay que sacarlos antes de que
 * desaparezca la fila con las rutas. Si uno falla, los demas igual se
 * borran y el mensaje dice cuales quedaron.
 */
export async function eliminarDocumentos(ids: string[]): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();

  if (usuario.rol !== "administrador_sgc") {
    return { exito: false, error: "Solo el Administrador SGC puede eliminar documentos." };
  }
  if (ids.length === 0) {
    return { exito: false, error: "No seleccionó ningún documento." };
  }

  let eliminados = 0;
  const fallidos: string[] = [];

  for (const id of ids) {
    const resultado = await eliminarDocumento(id);
    if (resultado.exito) eliminados += 1;
    else fallidos.push(resultado.error);
  }

  revalidatePath("/documentos");

  if (fallidos.length > 0) {
    return {
      exito: false,
      error:
        `Se eliminaron ${eliminados} de ${ids.length}. ` +
        `No se pudieron eliminar: ${fallidos.join("; ")}`,
    };
  }

  return {
    exito: true,
    mensaje: `Se eliminaron ${eliminados} documento${eliminados === 1 ? "" : "s"} con sus archivos.`,
  };
}


/**
 * Arma una categoria: define que documentos van adentro y cuales salen.
 *
 * La categoria no es una tabla aparte: es una columna de texto en el
 * documento. Una categoria, entonces, es el conjunto de documentos que
 * la llevan escrita, y por eso se crea llenandola y no antes. Crear
 * «Politicas» vacia y cargarla despues serian dos pasos para una sola
 * decision, y una categoria vacia que nadie completa queda dando vueltas
 * en el listado sin decir nada.
 *
 * Se guarda la lista entera de una vez —lo que entra y lo que sale— y no
 * documento por documento: Calidad agrupa la lista maestra en una
 * sentada, no de a uno.
 *
 * Los que entran quedan numerados de diez en diez en el orden en que se
 * los ve. Es el orden inicial de la carpeta; despues se ajusta con las
 * flechas sin volver aca.
 */
export async function guardarCategoria(
  categoria: string,
  dentro: string[],
  fuera: string[],
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite agrupar los documentos en categorías." };
  }

  const nombre = categoria.trim();
  if (nombre.length < 2) {
    return { exito: false, error: "Escriba el nombre de la categoría, de al menos 2 caracteres." };
  }
  if (nombre.length > 60) {
    return { exito: false, error: "El nombre de la categoría no puede pasar de 60 caracteres." };
  }
  if (dentro.length === 0 && fuera.length === 0) {
    return { exito: false, error: "Marque los documentos que van en la categoría." };
  }

  const supabase = crearClienteServidor();

  // Los que salen van al final de «Sin categoría», detras de los que ya
  // estaban ahi: sacarlos de una categoria no es motivo para que
  // aparezcan primeros en otra lista.
  const { data: sueltos } = await supabase
    .from("documentos")
    .select("orden")
    .is("categoria", null)
    .not("orden", "is", null)
    .order("orden", { ascending: false })
    .limit(1);

  const ultimoSuelto = ((sueltos as { orden: number }[] | null) ?? [])[0]?.orden ?? 0;

  // La posicion de la categoria dentro del listado. Si ya existe se
  // respeta la que tiene —guardarla de nuevo no la mueve de lugar— y si
  // es nueva va al final, detras de todas.
  const { data: posiciones } = await supabase
    .from("documentos")
    .select("categoria, orden_categoria");

  const porCategoria = new Map<string | null, number>();
  for (const fila of (posiciones as
    | { categoria: string | null; orden_categoria: number | null }[]
    | null) ?? []) {
    if (fila.orden_categoria === null) continue;
    if (!porCategoria.has(fila.categoria)) porCategoria.set(fila.categoria, fila.orden_categoria);
  }

  const maxima = Math.max(0, ...Array.from(porCategoria.values()));
  const posicionCategoria = porCategoria.get(nombre) ?? maxima + 10;
  const posicionSinCategoria = porCategoria.get(null) ?? 0;

  const cambios = [
    ...dentro.map((id, indice) => ({
      id,
      categoria: nombre,
      orden: (indice + 1) * 10,
      orden_categoria: posicionCategoria,
    })),
    ...fuera.map((id, indice) => ({
      id,
      categoria: null,
      orden: ultimoSuelto + (indice + 1) * 10,
      orden_categoria: posicionSinCategoria,
    })),
  ];

  // De a diez en paralelo. Cada fila lleva su propio `orden`, asi que no
  // hay forma de hacerlo en una sola sentencia desde el cliente; lo que
  // si se puede evitar es esperar cincuenta veces una detras de otra.
  const fallidos: string[] = [];

  for (let desde = 0; desde < cambios.length; desde += 10) {
    const tanda = cambios.slice(desde, desde + 10);
    const resultados = await Promise.all(
      tanda.map((cambio) =>
        supabase
          .from("documentos")
          .update({
            categoria: cambio.categoria,
            orden: cambio.orden,
            orden_categoria: cambio.orden_categoria,
          })
          .eq("id", cambio.id),
      ),
    );

    for (const resultado of resultados) {
      if (resultado.error) fallidos.push(resultado.error.message);
    }
  }

  revalidatePath("/documentos");

  if (fallidos.length > 0) {
    return {
      exito: false,
      error:
        `Se guardaron ${cambios.length - fallidos.length} de ${cambios.length} documentos. ` +
        `El resto no se pudo: ${fallidos[0]}`,
    };
  }

  const cuantos = dentro.length;
  return {
    exito: true,
    mensaje:
      `«${nombre}» quedó con ${cuantos} documento${cuantos === 1 ? "" : "s"}.` +
      (fuera.length > 0
        ? ` Se sacaron ${fuera.length} de la categoría.`
        : ""),
  };
}


/**
 * Cambia el nombre de una categoria en todos sus documentos.
 *
 * Como la categoria es texto repetido en cada fila, renombrarla a mano
 * seria editar documento por documento y basta con equivocarse en uno
 * para terminar con dos carpetas casi iguales.
 */
export async function renombrarCategoria(
  anterior: string,
  nueva: string,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite renombrar categorías." };
  }

  const nombre = nueva.trim();
  if (nombre.length < 2) {
    return { exito: false, error: "Escriba el nombre nuevo, de al menos 2 caracteres." };
  }
  if (nombre === anterior) {
    return { exito: false, error: "El nombre nuevo es igual al anterior." };
  }

  const supabase = crearClienteServidor();

  const { error } = await supabase
    .from("documentos")
    .update({ categoria: nombre })
    .eq("categoria", anterior);

  if (error) return { exito: false, error: `No se pudo renombrar: ${error.message}` };

  revalidatePath("/documentos");
  return { exito: true, mensaje: `«${anterior}» ahora se llama «${nombre}».` };
}


/**
 * Reordena de una vez todos los documentos de una categoria.
 *
 * Es lo que deja el arrastrar y soltar: mover una fila de la posicion
 * dos a la diez cambia la posicion de las ocho del medio, asi que no
 * alcanza con intercambiar dos como hacen las flechas.
 *
 * Llega la lista completa de la categoria en el orden en que quedo en
 * pantalla y se numera de diez en diez. Se reescribe entera y no solo lo
 * que cambio: son tres o cuatro decenas de filas y la cuenta que hay que
 * hacer para saber cuales se movieron cuesta mas que escribirlas todas.
 *
 * El hueco de diez se conserva para que las flechas puedan seguir
 * intercalando sin renumerar.
 */
export async function reordenarDocumentos(ids: string[]): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite reordenar los documentos." };
  }
  if (ids.length === 0) return { exito: true };

  const supabase = crearClienteServidor();
  const fallidos: string[] = [];

  for (let desde = 0; desde < ids.length; desde += 10) {
    const tanda = ids.slice(desde, desde + 10);
    const resultados = await Promise.all(
      tanda.map((id, indice) =>
        supabase
          .from("documentos")
          .update({ orden: (desde + indice + 1) * 10 })
          .eq("id", id),
      ),
    );
    for (const resultado of resultados) {
      if (resultado.error) fallidos.push(resultado.error.message);
    }
  }

  revalidatePath("/documentos");

  if (fallidos.length > 0) {
    return { exito: false, error: `No se pudo guardar el orden: ${fallidos[0]}` };
  }

  return { exito: true };
}


/**
 * Sube o baja una categoria entera dentro del listado.
 *
 * Se intercambia la posicion con la categoria vecina, y como la posicion
 * vive en cada documento, se escribe en todos los de las dos categorias.
 * Son dos escrituras masivas y no una por fila: se filtra por categoria,
 * no por id.
 *
 * «Sin categoria» cuenta como una categoria mas y tambien se mueve. Por
 * eso el parametro admite null, y por eso las consultas usan `is` en vez
 * de `eq` cuando corresponde: en SQL, `categoria = null` no es falso, es
 * nulo, y no alcanza ninguna fila.
 *
 * El orden es global y no por pestaña. Una categoria que hoy solo tiene
 * borradores igual ocupa su lugar en «Vigentes» el dia que uno se
 * publique, y que el orden cambiara segun la pestaña abierta seria
 * imposible de entender.
 */
export async function moverCategoria(
  categoria: string | null,
  direccion: "subir" | "bajar",
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite reordenar las categorías." };
  }

  const supabase = crearClienteServidor();

  // Todas las categorias con su posicion. Son unas pocas y hace falta la
  // lista entera para saber cual es la vecina.
  const { data, error: errorLectura } = await supabase
    .from("documentos")
    .select("categoria, orden_categoria");

  if (errorLectura) {
    return { exito: false, error: `No se pudo leer el orden: ${errorLectura.message}` };
  }

  const filas = (data as { categoria: string | null; orden_categoria: number | null }[]) ?? [];

  const posiciones = new Map<string | null, number>();
  for (const fila of filas) {
    if (fila.orden_categoria === null) continue;
    if (!posiciones.has(fila.categoria)) posiciones.set(fila.categoria, fila.orden_categoria);
  }

  const ordenadas = Array.from(posiciones.entries()).sort((una, otra) => una[1] - otra[1]);
  const indice = ordenadas.findIndex(([nombre]) => nombre === categoria);

  if (indice === -1) {
    return { exito: false, error: "Esta categoría todavía no tiene posición asignada." };
  }

  const vecino = ordenadas[direccion === "subir" ? indice - 1 : indice + 1];

  if (!vecino) {
    return {
      exito: false,
      error:
        direccion === "subir" ? "Ya es la primera categoría." : "Ya es la última categoría.",
    };
  }

  const miPosicion = ordenadas[indice][1];
  const [nombreVecino, posicionVecino] = vecino;

  const escribir = (nombre: string | null, posicion: number) => {
    const consulta = supabase.from("documentos").update({ orden_categoria: posicion });
    return nombre === null ? consulta.is("categoria", null) : consulta.eq("categoria", nombre);
  };

  const { error: errorUno } = await escribir(categoria, posicionVecino);
  if (errorUno) return { exito: false, error: `No se pudo mover: ${errorUno.message}` };

  const { error: errorDos } = await escribir(nombreVecino, miPosicion);
  if (errorDos) {
    // Se deshace la primera, para no dejar dos categorias en el mismo
    // lugar y un orden que nadie entiende.
    await escribir(categoria, miPosicion);
    return { exito: false, error: `No se pudo mover: ${errorDos.message}` };
  }

  revalidatePath("/documentos");
  return { exito: true };
}


/**
 * Reordena todas las categorias de una vez.
 *
 * Es lo que deja el arrastrar y soltar sobre el renglon de una
 * categoria: llevar «Politicas» del primer lugar al cuarto corre las
 * tres del medio, asi que no alcanza con intercambiar dos como hacen las
 * flechas.
 *
 * Llega la lista completa en el orden en que quedo en pantalla y se
 * numera de diez en diez. Cada categoria se escribe con una sola
 * sentencia —filtra por categoria, no por id— asi que son tantas
 * escrituras como categorias, no como documentos.
 */
export async function reordenarCategorias(
  nombres: (string | null)[],
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite reordenar las categorías." };
  }
  if (nombres.length === 0) return { exito: true };

  const supabase = crearClienteServidor();

  const resultados = await Promise.all(
    nombres.map((nombre, indice) => {
      const consulta = supabase
        .from("documentos")
        .update({ orden_categoria: (indice + 1) * 10 });
      // En SQL `categoria = null` no es falso, es nulo, y no alcanza
      // ninguna fila: «Sin categoria» se filtra con `is`.
      return nombre === null
        ? consulta.is("categoria", null)
        : consulta.eq("categoria", nombre);
    }),
  );

  const fallido = resultados.find((resultado) => resultado.error);
  if (fallido?.error) {
    return { exito: false, error: `No se pudo guardar el orden: ${fallido.error.message}` };
  }

  revalidatePath("/documentos");
  return { exito: true };
}

/**
 * Vuelve a leer el texto de los documentos que quedaron sin indexar.
 *
 * El trabajo diario ya hace esto solo. El boton existe para no esperar
 * hasta manana: despues de cargar un lote de documentos, o cuando algo
 * fallo, Calidad lo aprieta y listo. Es reintentable —mira que falta y
 * hace eso—, asi que apretarlo dos veces no duplica nada.
 *
 * Corre CON LA SESION de la persona, no con la clave de servicio. Es una
 * peticion de la interfaz y ahi la clave de servicio no se usa nunca: RLS
 * decide, y el Administrador SGC puede gestionar todos los documentos, asi
 * que alcanza.
 *
 * El presupuesto es mas corto que el del trabajo diario porque acá hay
 * alguien esperando frente a la pantalla. Si no llega a todos, lo dice y
 * el resto lo levanta el trabajo de la noche.
 */
const PRESUPUESTO_REINDEXADO_MS = 25_000;

export async function reindexarDocumentos(): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();

  if (usuario.rol !== "administrador_sgc") {
    return { exito: false, error: "Solo el Administrador SGC puede reindexar los documentos." };
  }

  try {
    const resumen = await indexarDocumentosPendientes(
      crearClienteServidor(),
      PRESUPUESTO_REINDEXADO_MS,
    );

    revalidatePath("/documentos");
    revalidatePath("/buscar");

    // Los motivos van en el mensaje solo si hubo fallas: si salio todo
    // bien, la frase alcanza y el detalle tecnico sobra.
    const detalle =
      resumen.fallados > 0 && resumen.motivos.length > 0 ? ` · ${resumen.motivos[0]}` : "";

    return { exito: true, mensaje: `${resumirIndexacion(resumen)}${detalle}` };
  } catch (error) {
    return {
      exito: false,
      error: `No se pudo reindexar: ${error instanceof Error ? error.message : "error desconocido"}`,
    };
  }
}
