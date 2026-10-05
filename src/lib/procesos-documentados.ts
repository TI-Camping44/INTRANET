/**
 * Los procesos tal como los nombra la informacion documentada.
 *
 * Calidad pidio que el formulario de riesgos no ofrezca una lista de
 * procesos propia, sino la de los documentos cargados en Informacion
 * Documentada. En Camping 44 son la misma cosa: cada uno de los
 * diecinueve procesos del mapa tiene su manual —MP-EST-01 a MP-SOP-08—,
 * con el mismo nombre.
 *
 * Asi la lista no se mantiene en dos lugares. Si Calidad carga el manual
 * de un proceso nuevo, aparece en el desplegable sin tocar codigo; si da
 * de baja un manual, deja de ofrecerse.
 *
 * SE DEVUELVE EL ID DEL PROCESO, no el del documento: `riesgos.proceso_id`
 * apunta a `procesos` y ahi se queda. Lo que cambia es de donde sale la
 * lista y como se la ordena y agrupa, que es lo que la persona ve.
 *
 * El orden y las categorias son los del modulo de documentos —Procesos
 * Estrategicos, Misionales, de Soporte—, para que el desplegable se lea
 * igual que la lista maestra.
 *
 * NO TIENE "use server": recibe el cliente ya creado, con la sesion de la
 * persona, para que RLS se aplique.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

export interface ProcesoDocumentado {
  /** El id de `procesos`, que es lo que se guarda. */
  id: string;
  codigo: string;
  nombre: string;
  /** La categoria del manual: con que se agrupa el desplegable. */
  categoria: string;
}

interface FilaManual {
  categoria: string | null;
  procesos: { id: string; codigo: string | null; nombre: string } | null;
}

const SIN_CATEGORIA = "Otros procesos";

/**
 * Los procesos que tienen manual cargado y vigente, en el orden del
 * modulo de documentos.
 *
 * Se excluyen los anulados: un proceso cuyo manual se anulo no deberia
 * seguir ofreciendose para cargar riesgos nuevos.
 */
export async function procesosDocumentados(
  supabase: SupabaseClient,
): Promise<ProcesoDocumentado[]> {
  const { data } = await supabase
    .from("documentos")
    .select("categoria, orden, orden_categoria, procesos:proceso_id (id, codigo, nombre)")
    .not("proceso_id", "is", null)
    .neq("estado", "anulado")
    .order("orden_categoria", { nullsFirst: true })
    .order("orden", { nullsFirst: true })
    .order("codigo");

  const filas = (data as FilaManual[] | null) ?? [];
  const vistos = new Set<string>();
  const lista: ProcesoDocumentado[] = [];

  for (const fila of filas) {
    const proceso = fila.procesos;
    // Un proceso puede tener mas de un documento. Se toma el primero que
    // aparece, que por el orden de la consulta es el de mas arriba en la
    // lista maestra.
    if (!proceso || vistos.has(proceso.id)) continue;
    vistos.add(proceso.id);
    lista.push({
      id: proceso.id,
      codigo: proceso.codigo ?? "",
      nombre: proceso.nombre,
      categoria: fila.categoria?.trim() || SIN_CATEGORIA,
    });
  }

  return lista;
}

/** Las categorias en el orden en que vienen, con sus procesos. */
export function agruparPorCategoria(
  procesos: ProcesoDocumentado[],
): { categoria: string; procesos: ProcesoDocumentado[] }[] {
  const grupos: { categoria: string; procesos: ProcesoDocumentado[] }[] = [];

  for (const proceso of procesos) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.categoria === proceso.categoria) {
      ultimo.procesos.push(proceso);
    } else {
      const existente = grupos.find((grupo) => grupo.categoria === proceso.categoria);
      if (existente) existente.procesos.push(proceso);
      else grupos.push({ categoria: proceso.categoria, procesos: [proceso] });
    }
  }

  return grupos;
}
