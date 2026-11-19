"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { obtenerPermisos, requerirUsuario } from "@/lib/sesion";
import { formatearFecha, hoyEnAsuncion } from "@/lib/formato";
import { ETIQUETAS_ROL } from "@/lib/constantes";
import { MODULOS_ODOO, esEmpresaOdoo, esNivelDeModulo } from "@/lib/accesos";
import type { ResultadoAccion, RolUsuario } from "@/lib/tipos";

const RUTA = "/informatica/accesos";

async function exigirEdicion(): Promise<string | null> {
  const permisos = await obtenerPermisos();
  return permisos.informatica.editar
    ? null
    : "Su rol no permite modificar la matriz de accesos.";
}

/**
 * Guarda lo que recibe un puesto en cada sistema.
 *
 * CAMBIAR UNA FILA VALIDADA LA VUELVE A PROPUESTA. La validación es la
 * firma del jefe de área sobre esos accesos, no sobre el puesto: si los
 * accesos cambian, lo que firmó ya no es lo que está escrito.
 */
export async function guardarAccesosDelPuesto(
  puestoId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  const rolCrudo = String(datos.get("intranet_rol") ?? "");
  if (rolCrudo && !Object.keys(ETIQUETAS_ROL).includes(rolCrudo)) {
    return { exito: false, error: "Elija un rol de la Intranet de la lista." };
  }

  const empresaCruda = String(datos.get("odoo_empresas") ?? "");
  if (empresaCruda && !esEmpresaOdoo(empresaCruda)) {
    return { exito: false, error: "Elija en qué empresa de Odoo trabaja el puesto." };
  }
  const odooEmpresas = empresaCruda || null;

  const niveles: Record<string, string> = {};
  for (const modulo of MODULOS_ODOO) {
    const valor = String(datos.get(modulo.columna) ?? "sin_acceso");
    if (!esNivelDeModulo(modulo, valor)) {
      return { exito: false, error: `El nivel elegido para ${modulo.nombre} no existe en Odoo.` };
    }
    niveles[modulo.columna] = odooEmpresas ? valor : "sin_acceso";
  }

  const tieneAlgunModulo = Object.values(niveles).some((nivel) => nivel !== "sin_acceso");
  if (odooEmpresas && !tieneAlgunModulo) {
    return {
      exito: false,
      error:
        "Un puesto con usuario de Odoo tiene que tener al menos un módulo. Si no lo necesita, " +
        "deje la empresa en «Sin usuario de Odoo».",
    };
  }

  const fila = {
    empresa_id: usuario.empresa_id,
    puesto_id: puestoId,
    google_workspace: datos.get("google_workspace") === "on",
    intranet_rol: (rolCrudo || null) as RolUsuario | null,
    odoo_empresas: odooEmpresas,
    ...niveles,
    otros_accesos: String(datos.get("otros_accesos") ?? "").trim() || null,
    observaciones: String(datos.get("observaciones") ?? "").trim() || null,
    estado: "propuesta",
    validado_por: null,
    validado_en: null,
    creado_por: usuario.id,
  };

  const supabase = crearClienteServidor();
  const { error } = await supabase
    .from("accesos_por_puesto")
    .upsert(fila, { onConflict: "puesto_id" });

  if (error) {
    return {
      exito: false,
      error: "No se pudieron guardar los accesos del puesto. Intente de nuevo.",
    };
  }

  revalidatePath(RUTA);
  revalidatePath(`${RUTA}/${puestoId}`);
  return { exito: true, mensaje: "Accesos guardados. Quedan como propuesta hasta validarlos." };
}

/**
 * Marca los accesos del puesto como validados por su jefe de área. La
 * validación la registra quien tiene la matriz a cargo, con el nombre de
 * quien la confirmó en las observaciones: el jefe de área no tiene por
 * qué tener permiso de edición en Informática.
 */
export async function validarAccesosDelPuesto(
  puestoId: string,
  datos: FormData,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  const sinPermiso = await exigirEdicion();
  if (sinPermiso) return { exito: false, error: sinPermiso };

  const quienValido = String(datos.get("quien_valido") ?? "").trim();
  if (quienValido.length < 5) {
    return { exito: false, error: "Indique quién validó los accesos y cómo (correo, reunión…)." };
  }

  const supabase = crearClienteServidor();
  const { data: actual } = await supabase
    .from("accesos_por_puesto")
    .select("observaciones")
    .eq("puesto_id", puestoId)
    .maybeSingle();

  if (!actual) return { exito: false, error: "Primero cargue los accesos del puesto." };

  const hoy = hoyEnAsuncion();
  const anterior = (actual as { observaciones: string | null }).observaciones;
  const constancia = `Validado el ${formatearFecha(hoy)}: ${quienValido}.`;

  const { error } = await supabase
    .from("accesos_por_puesto")
    .update({
      estado: "validada",
      validado_por: usuario.id,
      validado_en: hoy,
      observaciones: anterior ? `${anterior}\n${constancia}` : constancia,
    })
    .eq("puesto_id", puestoId);

  if (error) return { exito: false, error: "No se pudo registrar la validación. Intente de nuevo." };

  revalidatePath(RUTA);
  revalidatePath(`${RUTA}/${puestoId}`);
  return { exito: true, mensaje: "Accesos validados." };
}
