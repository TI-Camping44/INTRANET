"use server";

import { revalidatePath } from "next/cache";
import { puedeEditarElOrganigrama, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { ResultadoAccion } from "@/lib/tipos";

/**
 * Acciones del organigrama.
 *
 * La línea de reporte se corrige arrastrando una caja sobre otra. El
 * cambio se guarda en `personas_nomina.lider_manual_id`, que es lo único
 * que sobrevive a la próxima carga del padrón desde Odoo.
 *
 * LA ESCRITURA LA HACE LA BASE, NO ESTA ACCIÓN. `personas_nomina` es
 * solo del Administrador SGC —ahí están la cédula, el teléfono y la
 * fecha de ingreso— y Dirección también tiene que poder mover el
 * organigrama sin que se le abra el resto del padrón. Por eso va
 * `mover_en_organigrama()`, que es `SECURITY DEFINER` y escribe
 * únicamente las dos columnas del organigrama.
 *
 * Y MOVER FIJA LA JERARQUÍA, NO EL DIBUJO. La misma función sincroniza
 * `usuarios.superior_id`, que es lo que lee el escalamiento de acciones
 * vencidas. Sin eso quedaban dos jerarquías: la que se ve y la que
 * manda el correo.
 */

/**
 * El nombre de la persona, para el mensaje que ve quien mueve.
 *
 * Sale de `vista_directorio`, que la lee cualquiera. El padrón no: es
 * solo del Administrador SGC, y Dirección también mueve el organigrama.
 */
async function nombreDe(
  supabase: ReturnType<typeof crearClienteServidor>,
  clave: string,
): Promise<string | null> {
  const { data } = await supabase
    .from("vista_directorio")
    .select("nombre_completo")
    .eq("clave", clave)
    .maybeSingle();

  return (data as { nombre_completo: string } | null)?.nombre_completo ?? null;
}

/** Traduce el error crudo de PostgreSQL al que lee la persona. */
function mensajeDelError(mensaje: string, nombre: string): string {
  if (mensaje.includes("circulo de reporte")) {
    return (
      `No se puede: «${nombre}» quedaría dependiendo de alguien que ya depende de ella. ` +
      "Primero mueva a esa persona."
    );
  }
  if (mensaje.includes("su propio lider")) return "Nadie puede ser su propio líder.";
  if (mensaje.includes("padron de la nomina")) {
    return "Esa persona no está en el padrón de la nómina, así que no se le puede fijar un líder.";
  }
  if (mensaje.includes("Solo Calidad o Direccion")) {
    return "Solo Calidad o Dirección pueden mover el organigrama.";
  }
  return `No se pudo guardar el cambio: ${mensaje}`;
}

/**
 * Cuelga a una persona de otra, o la deja sin líder.
 *
 * `claveNuevoJefe` en `null` la saca del árbol: queda en el panel de
 * sueltos hasta que alguien la vuelva a colocar. Es una decisión
 * explícita y se guarda como tal, por eso existe `lider_manual_fijado`:
 * sin esa marca, la persona volvería a caer bajo el gerente que declara
 * Odoo, que es justamente lo que se quiso corregir.
 */
export async function moverEnOrganigrama(
  clavePersona: string,
  claveNuevoJefe: string | null,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeEditarElOrganigrama(usuario)) {
    return { exito: false, error: "Solo Calidad o Dirección pueden mover el organigrama." };
  }

  const supabase = crearClienteServidor();
  const nombre = (await nombreDe(supabase, clavePersona)) ?? "La persona";

  // La clave viaja tal cual: quién es en el padrón lo resuelve la
  // función de la base, que es la única que puede leerlo.
  const { error } = await supabase.rpc("mover_en_organigrama", {
    p_clave_persona: clavePersona,
    p_clave_jefe: claveNuevoJefe,
  });

  if (error) return { exito: false, error: mensajeDelError(error.message, nombre) };

  revalidatePath("/directorio");
  revalidatePath("/administracion/padron");
  revalidatePath("/administracion/usuarios");

  return {
    exito: true,
    mensaje: claveNuevoJefe
      ? `«${nombre}» ahora depende de su nuevo líder.`
      : `«${nombre}» quedó sin líder.`,
  };
}

/**
 * Deshace la corrección y vuelve a lo que dice Odoo.
 *
 * Hace falta porque `lider_manual_fijado` es pegajoso a propósito: una
 * vez que alguien movió a una persona, el padrón deja de mandar sobre
 * ella. Esto es la forma de devolverla.
 */
export async function restaurarLiderDeOdoo(clavePersona: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (!puedeEditarElOrganigrama(usuario)) {
    return { exito: false, error: "Solo Calidad o Dirección pueden mover el organigrama." };
  }

  const supabase = crearClienteServidor();
  const nombre = (await nombreDe(supabase, clavePersona)) ?? "La persona";

  const { error } = await supabase.rpc("restaurar_lider_de_odoo", {
    p_clave_persona: clavePersona,
  });
  if (error) return { exito: false, error: mensajeDelError(error.message, nombre) };

  revalidatePath("/directorio");
  return { exito: true, mensaje: `«${nombre}» vuelve a la jerarquía de Odoo.` };
}
