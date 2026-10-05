/**
 * El mapa de procesos vigente, para los desplegables.
 *
 * HAY DOS MAPAS CONVIVIENDO Y ES A PROPOSITO. Calidad aprobo una version
 * nueva el 5 de octubre de 2026 —la 01, de veintiun procesos— y la
 * intranet tenia cargada la anterior —la 00, de diecinueve—. Los codigos
 * no significan lo mismo en las dos: `EST-01` es «Informacion
 * Documentada» en la 00 y `MP-SOP-01` es ese mismo proceso en la 01,
 * mientras que `MP-EST-01` es «Planificacion y Control del SGC».
 *
 * Carlos pidio expresamente mantener la 00 intacta e independiente: los
 * veintiun documentos de la Lista Maestra cuelgan de ella y recodificarlos
 * es una decision aparte, documento por documento.
 *
 * Entonces: lo nuevo se carga contra la 01 y los documentos siguen contra
 * la 00. Cuando la migracion termine, se da de baja la 00.
 *
 * DOS PROCESOS DE LA 01 NO ESTAN CARGADOS: «MP-EST-05 Marketing» y
 * «MP-SOP-05 Cobranzas» venian marcados en amarillo —en elaboracion— y
 * Carlos indico ignorarlos. Cuando los apruebe, se agregan y los dos
 * indicadores que hoy los nombran en texto se vinculan solos.
 *
 * NO TIENE "use server": recibe el cliente ya creado, con la sesion de la
 * persona, para que RLS se aplique.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

/** La version del mapa que se ofrece al cargar algo nuevo. */
export const VERSION_VIGENTE_DEL_MAPA = "01";

export interface ProcesoDocumentado {
  id: string;
  codigo: string;
  nombre: string;
  /** Con qué se agrupa el desplegable: la banda del mapa. */
  categoria: string;
}

/** Las tres bandas del mapa, en el orden en que se dibuja. */
const CATEGORIA_POR_TIPO: Record<string, string> = {
  estrategico: "Procesos Estratégicos",
  operativo: "Procesos Misionales",
  apoyo: "Procesos de Soporte",
};

const ORDEN_DE_BANDA: Record<string, number> = {
  estrategico: 1,
  operativo: 2,
  apoyo: 3,
};

/**
 * Los procesos del mapa vigente, en el orden del mapa.
 *
 * Estratégicos, misionales y de soporte, y dentro de cada banda por
 * código: es como está dibujado el mapa que aprobó Calidad, y la gente
 * lo busca en ese orden.
 */
export async function procesosDocumentados(
  supabase: SupabaseClient,
): Promise<ProcesoDocumentado[]> {
  const { data } = await supabase
    .from("procesos")
    .select("id, codigo, nombre, tipo")
    .eq("version", VERSION_VIGENTE_DEL_MAPA)
    .eq("activo", true)
    .order("codigo");

  const filas =
    (data as { id: string; codigo: string | null; nombre: string; tipo: string }[] | null) ?? [];

  return filas
    .map((fila) => ({
      id: fila.id,
      codigo: fila.codigo ?? "",
      nombre: fila.nombre,
      categoria: CATEGORIA_POR_TIPO[fila.tipo] ?? "Otros procesos",
      orden: ORDEN_DE_BANDA[fila.tipo] ?? 9,
    }))
    .sort((uno, otro) =>
      uno.orden !== otro.orden ? uno.orden - otro.orden : uno.codigo.localeCompare(otro.codigo),
    )
    .map(({ id, codigo, nombre, categoria }) => ({ id, codigo, nombre, categoria }));
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
      grupos.push({ categoria: proceso.categoria, procesos: [proceso] });
    }
  }

  return grupos;
}
