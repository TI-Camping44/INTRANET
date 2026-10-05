"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { esAdministrador, puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { archivosDelFormulario, quitarAdjunto, subirAdjuntos } from "@/lib/adjuntos-servidor";
import type { ResultadoAccion } from "@/lib/tipos";

/**
 * Perfil de Resultados de Puesto.
 *
 * El submodulo quedo reducido a lo que Direccion pidio el 5 de octubre:
 * el puesto con su nombre y su departamento, y el perfil en PDF
 * adjunto. Nada mas. La matriz de competencias se retiro: Calidad
 * definio que no la van a usar.
 *
 * EL PUESTO NO LLEVA CODIGO. Los P-101 en adelante los definio el
 * proyecto y Calidad nunca los confirmo; la columna sigue existiendo
 * para los diecisiete ya cargados, pero el formulario dejo de pedirla.
 */

/** Devuelve el mensaje del primer problema, o null si esta todo bien. */
function revisarCampos(datos: FormData): string | null {
  const nombre = String(datos.get("nombre") ?? "").trim();
  if (nombre.length < 3) {
    return "El nombre del puesto debe tener al menos 3 caracteres.";
  }
  return null;
}

export async function crearPuestoDePerfil(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!esAdministrador(usuario)) {
    return { exito: false, error: "Solo el Administrador SGC puede definir puestos." };
  }

  const problema = revisarCampos(datos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();

  const { data: creado, error } = await supabase
    .from("puestos")
    .insert({
      empresa_id: usuario.empresa_id,
      nombre: String(datos.get("nombre") ?? "").trim(),
      area: String(datos.get("area") ?? "").trim() || null,
      activo: true,
    })
    .select("id, nombre")
    .single();

  if (error) return { exito: false, error: `No se pudo crear el puesto: ${error.message}` };

  // El perfil en PDF, si ya lo tiene a mano.
  const archivos = archivosDelFormulario(datos, "perfil");
  if (archivos.length > 0) {
    await subirAdjuntos(supabase, {
      entidad: "puestos",
      entidadId: creado.id,
      carpeta: "puestos",
      archivos,
      empresaId: usuario.empresa_id,
      usuarioId: usuario.id,
    });
  }

  revalidatePath("/recursos-humanos/puestos");
  return { exito: true, id: creado.id, mensaje: `Puesto «${creado.nombre}» creado.` };
}

export async function actualizarPuesto(id: string, datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!esAdministrador(usuario)) {
    return { exito: false, error: "Solo el Administrador SGC puede editar puestos." };
  }

  const problema = revisarCampos(datos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();

  const { data: actualizado, error } = await supabase
    .from("puestos")
    .update({
      nombre: String(datos.get("nombre") ?? "").trim(),
      area: String(datos.get("area") ?? "").trim() || null,
    })
    .eq("id", id)
    .select("nombre")
    .maybeSingle();

  if (error) return { exito: false, error: `No se pudo guardar: ${error.message}` };
  if (!actualizado) {
    return { exito: false, error: "No se pudo guardar: el puesto no existe o no tiene acceso." };
  }

  revalidatePath("/recursos-humanos/puestos");
  revalidatePath(`/recursos-humanos/puestos/${id}`);
  return { exito: true, mensaje: `Puesto «${actualizado.nombre}» actualizado.` };
}

/**
 * Baja del puesto.
 *
 * NO SE BORRA UN PUESTO CON GENTE ADENTRO. Si se borrara, las personas
 * quedarian con `puesto_id` apuntando a nada o en null de golpe, y en
 * «Personas sin Puesto» aparecerian de un dia para otro sin que nadie
 * hubiera decidido moverlas. Primero se las reasigna.
 */
export async function eliminarPuesto(id: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!esAdministrador(usuario)) {
    return { exito: false, error: "Solo el Administrador SGC puede eliminar puestos." };
  }

  const supabase = crearClienteServidor();

  const { count } = await supabase
    .from("usuarios")
    .select("id", { count: "exact", head: true })
    .eq("puesto_id", id)
    .eq("activo", true);

  if ((count ?? 0) > 0) {
    return {
      exito: false,
      error:
        `No se puede eliminar: hay ${count} persona(s) en este puesto. ` +
        "Reasígnelas primero.",
    };
  }

  // Los archivos del puesto primero: si se borra la fila y despues falla
  // el borrado de los adjuntos, quedan archivos apuntando a un puesto que
  // ya no existe y nadie los va a encontrar para limpiarlos.
  const { data: adjuntos } = await supabase
    .from("adjuntos")
    .select("id")
    .eq("entidad", "puestos")
    .eq("entidad_id", id);

  for (const adjunto of (adjuntos as { id: string }[] | null) ?? []) {
    await quitarAdjunto(supabase, adjunto.id, "puestos", id);
  }

  const { error } = await supabase.from("puestos").delete().eq("id", id);
  if (error) return { exito: false, error: `No se pudo eliminar el puesto: ${error.message}` };

  revalidatePath("/recursos-humanos/puestos");
  return { exito: true, mensaje: "Puesto eliminado." };
}

/** El perfil del puesto, en PDF. */
export async function adjuntarPerfilDePuesto(
  puestoId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeGestionar(usuario)) {
    return { exito: false, error: "Su rol no permite subir archivos al puesto." };
  }

  const archivos = archivosDelFormulario(datos, "perfil");
  if (archivos.length === 0) return { exito: false, error: "Elija al menos un archivo." };

  // SOLO PDF. El perfil de puesto es un documento firmado: en formato
  // editable deja de ser evidencia de nada. Lo controla tambien el
  // `accept` del campo, pero eso es comodidad del navegador.
  const noPdf = archivos.filter((archivo) => !archivo.name.toLowerCase().endsWith(".pdf"));
  if (noPdf.length > 0) {
    return {
      exito: false,
      error: `El perfil del puesto se adjunta en PDF. No entraron: ${noPdf
        .map((archivo) => archivo.name)
        .join(", ")}`,
    };
  }

  const supabase = crearClienteServidor();

  const { data: puesto } = await supabase
    .from("puestos")
    .select("id")
    .eq("id", puestoId)
    .maybeSingle();

  if (!puesto) return { exito: false, error: "El puesto no existe o no tiene acceso." };

  const { subidos, fallidos } = await subirAdjuntos(supabase, {
    entidad: "puestos",
    entidadId: puestoId,
    carpeta: "puestos",
    archivos,
    descripcion: String(datos.get("descripcion") ?? "") || null,
    empresaId: usuario.empresa_id,
    usuarioId: usuario.id,
  });

  revalidatePath(`/recursos-humanos/puestos/${puestoId}`);

  if (subidos === 0) return { exito: false, error: `No se pudo subir: ${fallidos.join(" · ")}` };

  return {
    exito: true,
    mensaje:
      fallidos.length > 0
        ? `${subidos} archivo(s) subido(s). No entraron: ${fallidos.join(" · ")}`
        : `${subidos} archivo(s) subido(s).`,
  };
}

export async function eliminarPerfilDePuesto(
  adjuntoId: string,
  puestoId: string,
): Promise<ResultadoAccion> {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const resultado = await quitarAdjunto(supabase, adjuntoId, "puestos", puestoId);
  if (!resultado.ok) return { exito: false, error: resultado.error };

  revalidatePath(`/recursos-humanos/puestos/${puestoId}`);
  return { exito: true, mensaje: `«${resultado.nombre}» eliminado.` };
}

/**
 * Asignar un puesto a una persona, desde «Personas sin Puesto».
 *
 * Es la contraparte del perfil del primer ingreso: la persona carga su
 * nombre y su cumpleaños, y el Administrador SGC le pone el puesto. Una
 * persona no se adjudica el suyo, y el disparador
 * `usuarios_proteger_perfil` lo impide del otro lado aunque alguien lo
 * intente contra la API.
 *
 * Con el puesto vacio se la saca del puesto y vuelve a la lista. Es la
 * forma de liberar un puesto antes de eliminarlo.
 */
export async function asignarPuestoAPersona(
  usuarioId: string,
  puestoId: string | null,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!esAdministrador(usuario)) {
    return { exito: false, error: "Solo el Administrador SGC puede asignar puestos." };
  }

  const supabase = crearClienteServidor();

  const { data: actualizado, error } = await supabase
    .from("usuarios")
    .update({ puesto_id: puestoId })
    .eq("id", usuarioId)
    .select("nombre_completo")
    .maybeSingle();

  if (error) return { exito: false, error: `No se pudo asignar el puesto: ${error.message}` };
  if (!actualizado) {
    return { exito: false, error: "No se pudo guardar: la persona no existe o no tiene acceso." };
  }

  revalidatePath("/recursos-humanos/puestos");
  revalidatePath("/directorio");
  return {
    exito: true,
    mensaje: puestoId
      ? `Puesto asignado a ${actualizado.nombre_completo}.`
      : `${actualizado.nombre_completo} quedó sin puesto.`,
  };
}
