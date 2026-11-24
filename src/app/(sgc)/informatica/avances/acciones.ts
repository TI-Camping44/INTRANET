"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { obtenerPermisos, requerirUsuario } from "@/lib/sesion";
import { hoyEnAsuncion } from "@/lib/formato";
import {
  LARGO_MINIMO_DESCRIPCION_AVANCE,
  PATRON_TICKET,
  esSistemaAvance,
  esTipoAvance,
  normalizarTicket,
} from "@/lib/avances-ti";
import type { EmpresaDelGrupo } from "@/lib/empresas";
import type { ResultadoAccion } from "@/lib/tipos";

const RUTA = "/informatica/avances";

/**
 * Quién escribe lo decide RLS (`avances_ti_gestion`, que mira
 * `puede_editar('informatica')`). Esto lo vuelve a preguntar antes para
 * devolver un mensaje que se entienda en vez del error crudo de la base.
 */
async function exigirEdicion(): Promise<string | null> {
  const permisos = await obtenerPermisos();
  return permisos.informatica.editar
    ? null
    : "Su rol no permite registrar avances de TI.";
}

/** Los campos que comparten el alta y la edición. */
function leerCampos(datos: FormData) {
  return {
    fecha: String(datos.get("fecha") ?? "").trim(),
    titulo: String(datos.get("titulo") ?? "").trim(),
    tipo: String(datos.get("tipo") ?? ""),
    sistema: String(datos.get("sistema") ?? ""),
    // Vacío quiere decir «del grupo»: vale para las dos empresas.
    empresa_afectada_id: String(datos.get("empresa_afectada_id") ?? "") || null,
    ticket: normalizarTicket(String(datos.get("ticket") ?? "")),
    descripcion: String(datos.get("descripcion") ?? "").trim(),
    impacto: String(datos.get("impacto") ?? "").trim() || null,
  };
}

async function revisarCampos(campos: ReturnType<typeof leerCampos>): Promise<string | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(campos.fecha)) return "Indique la fecha del cambio.";
  if (campos.fecha > hoyEnAsuncion()) {
    return "La fecha no puede ser posterior a hoy: se registra lo que ya se hizo.";
  }
  if (campos.titulo.length < 5) return "El título debe tener al menos 5 caracteres.";
  if (campos.titulo.length > 200) return "El título no puede pasar de 200 caracteres.";
  if (!esTipoAvance(campos.tipo)) return "Elija el tipo de cambio.";
  if (!esSistemaAvance(campos.sistema)) return "Elija el sistema en el que se hizo.";
  if (campos.ticket && !PATRON_TICKET.test(campos.ticket)) {
    return "El ticket va con el formato de la ticketera, por ejemplo TI-0142.";
  }
  if (campos.descripcion.length < LARGO_MINIMO_DESCRIPCION_AVANCE) {
    return "Describa qué se hizo, en al menos 10 caracteres.";
  }

  // La empresa se compara contra `empresas_del_grupo()` y no contra un
  // select a `empresas`: RLS acota esa tabla a la propia y Vitalica
  // volvería vacía, así que se rechazaría una empresa válida.
  if (campos.empresa_afectada_id) {
    const supabase = crearClienteServidor();
    const { data } = await supabase.rpc("empresas_del_grupo");
    const empresas = (data as EmpresaDelGrupo[] | null) ?? [];
    if (!empresas.some((empresa) => empresa.id === campos.empresa_afectada_id)) {
      return "Elija una de las dos empresas del grupo, o «Las dos».";
    }
  }
  return null;
}

export async function crearAvance(datos: FormData): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  const campos = leerCampos(datos);
  const problema = await revisarCampos(campos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();
  const { data, error } = await supabase
    .from("avances_ti")
    .insert({ ...campos, empresa_id: usuario.empresa_id, creado_por: usuario.id })
    .select("id")
    .single();

  if (error || !data) {
    return {
      exito: false,
      error: "No se pudo guardar el registro. Revise los datos e intente de nuevo.",
    };
  }

  revalidatePath(RUTA);
  return { exito: true, mensaje: "Avance registrado.", id: (data as { id: string }).id };
}

export async function actualizarAvance(id: string, datos: FormData): Promise<ResultadoAccion> {
  await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  const campos = leerCampos(datos);
  const problema = await revisarCampos(campos);
  if (problema) return { exito: false, error: problema };

  const supabase = crearClienteServidor();
  const { error } = await supabase.from("avances_ti").update(campos).eq("id", id);

  if (error) {
    return {
      exito: false,
      error: "No se pudo guardar el cambio. Revise los datos e intente de nuevo.",
    };
  }

  revalidatePath(RUTA);
  revalidatePath(`${RUTA}/${id}`);
  return { exito: true, mensaje: "Registro actualizado." };
}

/**
 * Borra un registro cargado por error —un duplicado, una prueba—. Lo que
 * se borró queda en la bitácora, que lo escribe un disparador.
 */
export async function eliminarAvance(id: string): Promise<ResultadoAccion> {
  await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  const supabase = crearClienteServidor();
  const { error } = await supabase.from("avances_ti").delete().eq("id", id);
  if (error) return { exito: false, error: "No se pudo eliminar el registro. Intente de nuevo." };

  revalidatePath(RUTA);
  return { exito: true, mensaje: "Registro eliminado." };
}
