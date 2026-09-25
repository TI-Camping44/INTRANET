import type { SupabaseClient } from "@supabase/supabase-js";

import { mismoVendedor } from "@/lib/planilla-ventas";
import { calcularResumen } from "@/lib/resumen-ventas";

/**
 * Lee la planilla del informe comercial y deja el resumen guardado.
 *
 * ES EL UNICO QUE HABLA CON GOOGLE. La pantalla ya no: consulta la tabla
 * y responde al instante. Medido, la hoja `DATA` son 5,5 MB y Google
 * tarda trece segundos en generar su CSV; catorce la de configuracion.
 * Esa espera la paga este trabajo, de madrugada, y no la persona.
 *
 * CORRE CON LA CLAVE DE SERVICIO, que es uno de los dos unicos lugares
 * donde eso esta permitido: no hay sesion de nadie, y las tablas de
 * destino no le dan escritura a la interfaz.
 *
 * ES REINTENTABLE. Mira lo que hay y lo deja igual a la planilla;
 * correrlo dos veces seguidas no duplica ni rompe nada.
 */

export interface ResultadoSincronizacion {
  vendedores: number;
  filas: number;
  vinculados: number;
  eliminadas: number;
  mesEnCurso: number;
  anioEnCurso: number;
  duracionMs: number;
}

/**
 * De que empresa es la planilla.
 *
 * Sale de la gente que esta vinculada a ella: si alguien tiene cargado su
 * nombre del informe comercial, la planilla es de su empresa. Es el unico
 * dato que lo dice sin inventar nada. Si todavia no hay nadie vinculado
 * —al arrancar puede pasar— se usa la primera empresa, que hoy es
 * Camping 44; Vitalica no opera.
 */
async function empresaDeLaPlanilla(supabase: SupabaseClient): Promise<string | null> {
  const { data: vinculados } = await supabase
    .from("usuarios")
    .select("empresa_id")
    .not("vendedor_planilla", "is", null)
    .limit(1);

  const conVinculo = (vinculados as { empresa_id: string }[] | null) ?? [];
  if (conVinculo.length > 0) return conVinculo[0].empresa_id;

  const { data: empresas } = await supabase
    .from("empresas")
    .select("id")
    .order("creado_en", { ascending: true })
    .limit(1);

  return ((empresas as { id: string }[] | null) ?? [])[0]?.id ?? null;
}

export async function sincronizarVentas(
  supabase: SupabaseClient,
): Promise<ResultadoSincronizacion> {
  const arranque = Date.now();
  const marca = new Date().toISOString();

  const empresaId = await empresaDeLaPlanilla(supabase);
  if (!empresaId) throw new Error("No hay ninguna empresa cargada.");

  // Si esto falla, lanza, y el que llama deja anotado el error en
  // `ventas_sincronizacion`: un trabajo que falla en silencio es peor que
  // uno que no corre, porque al menos el segundo se nota.
  const resumen = await calcularResumen();

  // A quien corresponde cada vendedor. La union tolera que el nombre este
  // mas corto en la planilla que en la intranet, y es la misma regla que
  // usa la pantalla: un solo criterio en todo el proyecto.
  const { data: personas } = await supabase
    .from("usuarios")
    .select("id, vendedor_planilla")
    .not("vendedor_planilla", "is", null);

  const vinculos = (personas as { id: string; vendedor_planilla: string }[] | null) ?? [];

  const filas = resumen.filas.map((fila) => {
    const persona = vinculos.find((v) => mismoVendedor(v.vendedor_planilla, fila.cod));
    return {
      empresa_id: empresaId,
      anio: fila.anio,
      mes: fila.mes,
      vendedor: fila.cod,
      usuario_id: persona?.id ?? null,
      canal: fila.canal,
      meta: fila.meta,
      venta: fila.venta ?? 0,
      devoluciones: fila.devoluciones,
      actualizado_en: marca,
    };
  });

  if (filas.length > 0) {
    const { error } = await supabase
      .from("ventas_mensuales")
      .upsert(filas, { onConflict: "empresa_id,anio,mes,vendedor" });

    if (error) throw new Error(`No se pudieron guardar las ventas: ${error.message}`);
  }

  // Lo que ya no esta en la planilla se borra. Sin esto, un vendedor que
  // deja de figurar quedaria para siempre con su ultimo numero, y nadie
  // notaria que ese dato dejo de actualizarse.
  const { data: sobrantes } = await supabase
    .from("ventas_mensuales")
    .delete()
    .eq("empresa_id", empresaId)
    .lt("actualizado_en", marca)
    .select("id");

  const { error: errorEstado } = await supabase.from("ventas_sincronizacion").upsert(
    {
      empresa_id: empresaId,
      mes_en_curso: resumen.mesEnCurso,
      anio_en_curso: resumen.anioEnCurso,
      dias_mes: resumen.diasMes,
      dias_transcurridos: resumen.diasTranscurridos,
      filas: filas.length,
      actualizado_en: marca,
      ultimo_intento_en: marca,
      ultimo_error: null,
    },
    { onConflict: "empresa_id" },
  );

  if (errorEstado) {
    throw new Error(`No se pudo guardar el estado: ${errorEstado.message}`);
  }

  return {
    vendedores: new Set(filas.map((f) => f.vendedor)).size,
    filas: filas.length,
    vinculados: filas.filter((f) => f.usuario_id !== null).length,
    eliminadas: ((sobrantes as { id: string }[] | null) ?? []).length,
    mesEnCurso: resumen.mesEnCurso,
    anioEnCurso: resumen.anioEnCurso,
    duracionMs: Date.now() - arranque,
  };
}

/**
 * Deja anotado que el intento fallo, sin pisar el ultimo dato bueno.
 *
 * La pantalla sigue mostrando lo de ayer con su fecha, que es util,
 * en vez de un error, que no lo es. Pero queda registrado que hoy no se
 * pudo, para que nadie lo descubra tarde.
 */
export async function anotarFalloDeSincronizacion(
  supabase: SupabaseClient,
  motivo: string,
): Promise<void> {
  const empresaId = await empresaDeLaPlanilla(supabase);
  if (!empresaId) return;

  const { data } = await supabase
    .from("ventas_sincronizacion")
    .select("empresa_id")
    .eq("empresa_id", empresaId)
    .maybeSingle();

  if (data) {
    await supabase
      .from("ventas_sincronizacion")
      .update({ ultimo_intento_en: new Date().toISOString(), ultimo_error: motivo })
      .eq("empresa_id", empresaId);
  }
}
