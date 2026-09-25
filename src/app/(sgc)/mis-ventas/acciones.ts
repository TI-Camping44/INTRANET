"use server";

import { revalidatePath } from "next/cache";

import { crearClienteServidor } from "@/lib/supabase/servidor";
import { requerirRol } from "@/lib/sesion";
import { sincronizarVentas } from "@/lib/sincronizar-ventas";
import type { ResultadoAccion } from "@/lib/tipos";

/**
 * Trae la planilla comercial en el momento, sin esperar al trabajo de la
 * madrugada.
 *
 * Misma idea que «Reindexar» en Documentación: la lógica es la del
 * trabajo programado, compartida, para que no haya dos maneras de traer
 * lo mismo que puedan dar resultados distintos.
 *
 * CORRE CON LA SESIÓN, no con la clave de servicio: la clave de servicio
 * nunca atiende una petición de la interfaz. Que solo pueda el
 * Administrador SGC lo decide la política de la tabla; acá se comprueba
 * además para poder decirlo en castellano en vez de devolver una fila
 * vacía sin explicación.
 */
export async function sincronizarVentasAhora(): Promise<ResultadoAccion> {
  await requerirRol(["administrador_sgc"]);

  try {
    const resumen = await sincronizarVentas(crearClienteServidor());
    revalidatePath("/mis-ventas");

    return {
      exito: true,
      mensaje:
        `Planilla traída: ${resumen.vendedores} vendedores, ${resumen.filas} filas, ` +
        `${resumen.vinculados} vinculadas a una persona.`,
    };
  } catch (error) {
    return {
      exito: false,
      error:
        error instanceof Error
          ? `No se pudo traer la planilla: ${error.message}`
          : "No se pudo traer la planilla.",
    };
  }
}
