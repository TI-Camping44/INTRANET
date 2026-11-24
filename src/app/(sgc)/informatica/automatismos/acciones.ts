"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { obtenerPermisos, requerirUsuario } from "@/lib/sesion";
import { PATRON_CLAVE_AUTOMATISMO } from "@/lib/automatismos-ti";
import type { ResultadoAccion } from "@/lib/tipos";

const RUTA = "/informatica/automatismos";

async function exigirEdicion(): Promise<string | null> {
  const permisos = await obtenerPermisos();
  return permisos.informatica.editar ? null : "Su rol no permite administrar los automatismos.";
}

function leerCampos(datos: FormData) {
  const frecuencia = String(datos.get("frecuencia_horas") ?? "").trim();
  return {
    clave: String(datos.get("clave") ?? "").trim().toLowerCase(),
    nombre: String(datos.get("nombre") ?? "").trim(),
    donde_vive: String(datos.get("donde_vive") ?? "").trim() || null,
    descripcion: String(datos.get("descripcion") ?? "").trim() || null,
    frecuencia_horas: frecuencia ? Number(frecuencia) : null,
    vigente: datos.get("vigente") !== "no",
    responsable_id: String(datos.get("responsable_id") ?? "") || null,
  };
}

function revisarCampos(campos: ReturnType<typeof leerCampos>): string | null {
  if (!PATRON_CLAVE_AUTOMATISMO.test(campos.clave)) {
    return "La clave va en minúsculas, sin espacios ni tildes, de 3 a 80 caracteres: por ejemplo ticketera.revisar-sla.";
  }
  if (campos.nombre.length < 3) return "Escriba el nombre del automatismo.";
  if (campos.nombre.length > 160) return "El nombre no puede pasar de 160 caracteres.";
  if (
    campos.frecuencia_horas !== null &&
    (!Number.isInteger(campos.frecuencia_horas) ||
      campos.frecuencia_horas < 1 ||
      campos.frecuencia_horas > 8784)
  ) {
    return "La frecuencia va en horas enteras, entre 1 y 8784 (un año).";
  }
  return null;
}

export async function crearAutomatismo(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  const campos = leerCampos(datos);
  const problema = revisarCampos(campos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();
  const { data, error } = await supabase
    .from("automatismos_ti")
    .insert({ ...campos, empresa_id: usuario.empresa_id, creado_por: usuario.id })
    .select("id")
    .single();

  if (error || !data) {
    return {
      exito: false,
      error:
        error?.code === "23505"
          ? "Ya hay un automatismo con esa clave. Use otra o edite el existente."
          : "No se pudo guardar el automatismo. Revise los datos e intente de nuevo.",
    };
  }

  revalidatePath(RUTA);
  return { exito: true, mensaje: "Automatismo registrado.", id: (data as { id: string }).id };
}

/**
 * La clave no se edita: es con lo que el script se identifica, y
 * cambiarla acá dejaría al script avisando por una clave que ya no
 * existe —que se volvería a crear sola, vacía, al lado de esta—.
 */
export async function actualizarAutomatismo(id: string, datos: FormData): Promise<ResultadoAccion> {
  await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  const campos = leerCampos(datos);
  const problema = revisarCampos(campos);
  if (problema) return { exito: false, error: problema };

  const editables = {
    nombre: campos.nombre,
    donde_vive: campos.donde_vive,
    descripcion: campos.descripcion,
    frecuencia_horas: campos.frecuencia_horas,
    vigente: campos.vigente,
    responsable_id: campos.responsable_id,
  };
  const supabase = crearClienteServidor();
  const { error } = await supabase.from("automatismos_ti").update(editables).eq("id", id);
  if (error) return { exito: false, error: "No se pudo guardar el cambio. Intente de nuevo." };

  revalidatePath(RUTA);
  revalidatePath(`${RUTA}/${id}`);
  return { exito: true, mensaje: "Automatismo actualizado." };
}

/** Para el que se retiró de verdad. Uno que se pausa se marca «no vigente». */
export async function eliminarAutomatismo(id: string): Promise<ResultadoAccion> {
  await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  const supabase = crearClienteServidor();
  const { error } = await supabase.from("automatismos_ti").delete().eq("id", id);
  if (error) return { exito: false, error: "No se pudo eliminar el automatismo. Intente de nuevo." };

  revalidatePath(RUTA);
  return { exito: true, mensaje: "Automatismo eliminado." };
}
