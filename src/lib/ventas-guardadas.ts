import type { SupabaseClient } from "@supabase/supabase-js";

import type { ResumenDeVentas, VentaDelMes } from "@/lib/ventas";

/**
 * El resumen de ventas, leido de la tabla que deja el trabajo programado.
 *
 * LA PANTALLA YA NO HABLA CON GOOGLE. Antes leia las dos hojas publicadas
 * en el momento de dibujarse y esperaba catorce segundos. Ahora consulta
 * una tabla chica y responde al instante, y si Google se cae se sigue
 * viendo el ultimo dato bueno con su fecha, en vez de un error.
 *
 * QUIEN VE QUE LO DECIDE RLS, no este archivo. La politica de
 * `ventas_mensuales` deja pasar la fila propia, las de los canales
 * asignados y, para Direccion, todas. Lo que llega aca ya viene filtrado,
 * que es donde el proyecto dice que tienen que resolverse los permisos.
 */

export type FalloDeVentas = "sin_datos" | "sin_respuesta";

export type LecturaDeVentas =
  | { ok: true; resumen: ResumenDeVentas }
  | { ok: false; motivo: FalloDeVentas; detalle?: string };

interface FilaGuardada {
  anio: number;
  mes: number;
  vendedor: string;
  canal: string;
  meta: number | null;
  venta: number | null;
  devoluciones: number | null;
}

interface EstadoGuardado {
  mes_en_curso: number;
  anio_en_curso: number;
  dias_mes: number;
  dias_transcurridos: number;
  actualizado_en: string;
}

export async function leerResumenGuardado(
  supabase: SupabaseClient,
): Promise<LecturaDeVentas> {
  const [{ data: filas, error }, { data: estado }] = await Promise.all([
    supabase
      .from("ventas_mensuales")
      .select("anio, mes, vendedor, canal, meta, venta, devoluciones")
      .order("anio", { ascending: false })
      .order("mes", { ascending: false }),
    supabase
      .from("ventas_sincronizacion")
      .select("mes_en_curso, anio_en_curso, dias_mes, dias_transcurridos, actualizado_en")
      .maybeSingle(),
  ]);

  if (error) return { ok: false, motivo: "sin_respuesta", detalle: error.message };

  const sincronizacion = estado as EstadoGuardado | null;

  // Sin estado, el trabajo nunca corrio: no hay dato que mostrar, y
  // decirlo es mejor que dibujar ceros que parecen reales.
  if (!sincronizacion) return { ok: false, motivo: "sin_datos" };

  const guardadas = (filas as FilaGuardada[] | null) ?? [];

  const convertidas: VentaDelMes[] = guardadas.map((fila) => ({
    mes: fila.mes,
    anio: fila.anio,
    cod: fila.vendedor,
    vendedor: fila.vendedor,
    canal: fila.canal,
    // `null` es «sin meta cargada», que no es lo mismo que cero, y la
    // pantalla lo dice en vez de inventar un porcentaje.
    meta: fila.meta === null ? null : Number(fila.meta),
    venta: fila.venta === null ? null : Number(fila.venta),
    devoluciones: Number(fila.devoluciones ?? 0),
  }));

  return {
    ok: true,
    resumen: {
      actualizado: sincronizacion.actualizado_en,
      mesEnCurso: sincronizacion.mes_en_curso,
      anioEnCurso: sincronizacion.anio_en_curso,
      diasMes: Number(sincronizacion.dias_mes),
      diasTranscurridos: Number(sincronizacion.dias_transcurridos),
      filas: convertidas,
    },
  };
}
