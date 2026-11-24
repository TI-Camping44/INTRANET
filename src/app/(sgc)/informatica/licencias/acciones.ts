"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { obtenerPermisos, requerirUsuario } from "@/lib/sesion";
import { esCicloLicencia, esMoneda, leerImporte } from "@/lib/gastos-ti";
import type { ResultadoAccion } from "@/lib/tipos";

function leerEntero(valor: FormDataEntryValue | null): number | null | "invalido" {
  const texto = String(valor ?? "").trim();
  if (!texto) return null;
  return /^\d+$/.test(texto) ? Number(texto) : "invalido";
}

/**
 * Guarda las cantidades y el costo de una licencia.
 *
 * TOCA SOLO ESAS CINCO COLUMNAS DEL ACTIVO. El resto de la ficha —el
 * vencimiento, el estado, el responsable— se edita en Activos, que es
 * donde vive; esta acción no los recibe y no los puede pisar.
 *
 * Escribe sobre `activos`, así que el permiso que manda es el de ese
 * módulo y no el de Informática: es el que mira la política de la tabla.
 */
export async function actualizarLicencia(id: string, datos: FormData): Promise<ResultadoAccion> {
  await requerirUsuario();
  const permisos = await obtenerPermisos();
  if (!permisos.activos.editar) {
    return { exito: false, error: "Su rol no permite editar los activos." };
  }

  const contratadas = leerEntero(datos.get("cantidad_contratada"));
  const enUso = leerEntero(datos.get("cantidad_en_uso"));
  if (contratadas === "invalido" || enUso === "invalido") {
    return { exito: false, error: "Las cantidades van en números enteros." };
  }
  if (contratadas !== null && enUso !== null && enUso > contratadas) {
    return { exito: false, error: "No puede haber más licencias en uso que contratadas." };
  }

  const textoCosto = String(datos.get("costo_ciclo") ?? "").trim();
  const costo = textoCosto ? leerImporte(textoCosto) : null;
  if (textoCosto && costo === null) {
    return { exito: false, error: "Escriba el costo como número, por ejemplo 308,44 o 1.224.000." };
  }
  const moneda = String(datos.get("moneda_costo") ?? "");
  if (costo !== null && !esMoneda(moneda)) {
    return { exito: false, error: "Elija la moneda del costo." };
  }

  const textoCiclo = String(datos.get("ciclo_meses") ?? "");
  const ciclo = textoCiclo === "" ? null : Number(textoCiclo);
  if (ciclo !== null && !esCicloLicencia(ciclo)) {
    return { exito: false, error: "Elija cada cuánto se paga." };
  }

  const supabase = crearClienteServidor();
  const { error } = await supabase
    .from("activos")
    .update({
      cantidad_contratada: contratadas,
      cantidad_en_uso: enUso,
      costo_ciclo: costo,
      moneda_costo: costo !== null ? moneda : null,
      ciclo_meses: ciclo,
    })
    .eq("id", id);

  if (error) return { exito: false, error: "No se pudo guardar. Revise los datos e intente de nuevo." };

  revalidatePath("/informatica/licencias");
  revalidatePath("/informatica/gastos");
  return { exito: true, mensaje: "Licencia actualizada." };
}
