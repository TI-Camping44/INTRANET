"use server";

import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { ResultadoAccion } from "@/lib/tipos";

/**
 * Acciones del organigrama.
 *
 * La linea de reporte se corrige arrastrando una caja sobre otra. El
 * cambio se guarda en `personas_nomina.lider_manual_id`, que es lo unico
 * que sobrevive a la proxima carga del padron desde Odoo.
 */

/** De `usuario:<uuid>` o `nomina:<uuid>` a la fila del padron. */
async function filaDelPadron(
  supabase: ReturnType<typeof crearClienteServidor>,
  clave: string,
): Promise<{ id: string; nombre_completo: string } | null> {
  const [tipo, id] = clave.split(":");
  if (!id) return null;

  const consulta = supabase.from("personas_nomina").select("id, nombre_completo").eq("activo", true);

  const { data } =
    tipo === "usuario"
      ? await consulta.eq("usuario_id", id).maybeSingle()
      : await consulta.eq("id", id).maybeSingle();

  return (data as { id: string; nombre_completo: string } | null) ?? null;
}

/**
 * Cuelga a una persona de otra, o la deja sin lider.
 *
 * `nuevoJefe` en `null` la saca del arbol: queda en el panel de sueltos
 * hasta que alguien la vuelva a colocar. Es una decision explicita y se
 * guarda como tal, por eso existe `lider_manual_fijado`: sin esa marca,
 * la persona volveria a caer bajo el gerente que declara Odoo, que es
 * justamente lo que se quiso corregir.
 *
 * CORTA LOS CICLOS ANTES DE ESCRIBIR. Si alguien arrastra a un jefe
 * debajo de su propio subordinado, el arbol se vuelve infinito y la
 * pantalla deja de dibujarse. Se sube por la cadena del nuevo jefe: si
 * en el camino aparece la persona que se esta moviendo, se rechaza.
 */
export async function moverEnOrganigrama(
  clavePersona: string,
  claveNuevoJefe: string | null,
): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (usuario.rol !== "administrador_sgc") {
    return { exito: false, error: "Solo el Administrador SGC puede cambiar el organigrama." };
  }

  const supabase = crearClienteServidor();

  const persona = await filaDelPadron(supabase, clavePersona);
  if (!persona) {
    return {
      exito: false,
      error: "Esa persona no está en el padrón de la nómina, así que no se le puede fijar un líder.",
    };
  }

  let jefeId: string | null = null;

  if (claveNuevoJefe) {
    const jefe = await filaDelPadron(supabase, claveNuevoJefe);
    if (!jefe) {
      return { exito: false, error: "Esa persona no está en el padrón de la nómina." };
    }
    if (jefe.id === persona.id) {
      return { exito: false, error: "Nadie puede ser su propio líder." };
    }
    jefeId = jefe.id;

    // La cadena hacia arriba desde el nuevo jefe. Si aparece quien se
    // esta moviendo, el cambio cerraria un circulo.
    const { data: todos } = await supabase
      .from("personas_nomina")
      .select("id, nombre_completo, gerente_nombre, lider_manual_id, lider_manual_fijado")
      .eq("activo", true);

    const filas =
      (todos as
        | {
            id: string;
            nombre_completo: string;
            gerente_nombre: string | null;
            lider_manual_id: string | null;
            lider_manual_fijado: boolean;
          }[]
        | null) ?? [];

    const normalizar = (valor: string | null) =>
      (valor ?? "")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .trim()
        .toLowerCase();

    const porId = new Map(filas.map((fila) => [fila.id, fila]));
    const porNombre = new Map(filas.map((fila) => [normalizar(fila.nombre_completo), fila]));

    const jefeDe = (fila: (typeof filas)[number]): string | null => {
      // El mismo orden de precedencia que la vista. Se simula el cambio
      // que se esta por hacer, para no escribir y despues arrepentirse.
      if (fila.id === persona.id) return jefeId;
      if (fila.lider_manual_fijado) return fila.lider_manual_id;
      return porNombre.get(normalizar(fila.gerente_nombre))?.id ?? null;
    };

    let actual: string | null = jefeId;
    const recorridos = new Set<string>();
    while (actual) {
      if (actual === persona.id) {
        return {
          exito: false,
          error:
            `No se puede: «${persona.nombre_completo}» quedaría dependiendo de alguien que ya ` +
            "depende de ella. Primero mueva a esa persona.",
        };
      }
      if (recorridos.has(actual)) break; // ciclo previo: no lo agrava
      recorridos.add(actual);
      const fila = porId.get(actual);
      actual = fila ? jefeDe(fila) : null;
    }
  }

  const { error } = await supabase
    .from("personas_nomina")
    .update({ lider_manual_id: jefeId, lider_manual_fijado: true })
    .eq("id", persona.id);

  if (error) {
    return { exito: false, error: `No se pudo guardar el cambio: ${error.message}` };
  }

  revalidatePath("/directorio");
  revalidatePath("/administracion/padron");

  return {
    exito: true,
    mensaje: claveNuevoJefe
      ? `«${persona.nombre_completo}» ahora depende de su nuevo líder.`
      : `«${persona.nombre_completo}» quedó sin líder.`,
  };
}

/**
 * Deshace la correccion y vuelve a lo que dice Odoo.
 *
 * Hace falta porque `lider_manual_fijado` es pegajoso a proposito: una
 * vez que alguien movio a una persona, el padron deja de mandar sobre
 * ella. Esto es la forma de devolverla.
 */
export async function restaurarLiderDeOdoo(clavePersona: string): Promise<ResultadoAccion> {
  const usuario = await requerirUsuario();
  if (usuario.rol !== "administrador_sgc") {
    return { exito: false, error: "Solo el Administrador SGC puede cambiar el organigrama." };
  }

  const supabase = crearClienteServidor();
  const persona = await filaDelPadron(supabase, clavePersona);
  if (!persona) return { exito: false, error: "Esa persona no está en el padrón de la nómina." };

  const { error } = await supabase
    .from("personas_nomina")
    .update({ lider_manual_id: null, lider_manual_fijado: false })
    .eq("id", persona.id);

  if (error) return { exito: false, error: `No se pudo restaurar: ${error.message}` };

  revalidatePath("/directorio");
  return { exito: true, mensaje: `«${persona.nombre_completo}» vuelve a la jerarquía de Odoo.` };
}
