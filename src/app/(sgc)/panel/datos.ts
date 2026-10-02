import "server-only";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { hoyEnAsuncion, sumarDias } from "@/lib/formato";
import { DIAS_AVISO_REVISION_DOCUMENTO, ESTADOS_NC_ABIERTOS } from "@/lib/constantes";
import {
  estaFueraDePlazo,
  ESTADOS_RECLAMO_ABIERTOS,
  type PlazosDelCaso,
} from "@/lib/reclamos";
import type { Usuario } from "@/lib/tipos";

/**
 * Consultas del tablero de inicio. Se resuelven en paralelo y usan
 * `head: true` cuando solo se necesita el conteo, para no traer filas.
 */

export interface ResumenPanel {
  ncAbiertas: number;
  ncVencidas: number;
  riesgosAltos: number;
  riesgosPorReevaluar: number;
  documentosPorRevisar: number;
  documentosVigentes: number;
  auditoriasTotales: number;
  auditoriasCerradas: number;
  indicadoresFueraDeMeta: number;
  indicadoresMedidos: number;
  accionesVencidas: number;
  misAccionesPendientes: number;
  reclamosAbiertos: number;
  reclamosFueraDePlazo: number;
  cambiosEnAprobacion: number;
  proveedoresPorReevaluar: number;
  proveedoresActivos: number;
}

export async function obtenerResumenPanel(usuario: Usuario): Promise<ResumenPanel> {
  const supabase = crearClienteServidor();
  const hoy = hoyEnAsuncion();
  const limiteRevision = sumarDias(hoy, DIAS_AVISO_REVISION_DOCUMENTO);
  const anioActual = Number(hoy.slice(0, 4));

  const [
    ncAbiertas,
    ncVencidas,
    riesgosAltos,
    riesgosPorReevaluar,
    documentosPorRevisar,
    documentosVigentes,
    auditorias,
    auditoriasCerradas,
    accionesVencidas,
    misAcciones,
    mediciones,
    reclamos,
    cambiosEnAprobacion,
    proveedoresPorReevaluar,
    proveedoresActivos,
  ] = await Promise.all([
    supabase
      .from("no_conformidades")
      .select("id", { count: "exact", head: true })
      .in("estado", ESTADOS_NC_ABIERTOS),
    supabase
      .from("no_conformidades")
      .select("id", { count: "exact", head: true })
      .in("estado", ESTADOS_NC_ABIERTOS)
      .not("fecha_limite_cierre", "is", null)
      .lt("fecha_limite_cierre", hoy),
    supabase
      .from("riesgos")
      .select("id", { count: "exact", head: true })
      .gte("nivel", 10)
      .in("estado", ["identificado", "en_tratamiento", "materializado"]),
    supabase
      .from("riesgos")
      .select("id", { count: "exact", head: true })
      .lte("fecha_proxima_revision", hoy)
      .in("estado", ["identificado", "en_tratamiento"]),
    supabase
      .from("documentos")
      .select("id", { count: "exact", head: true })
      .eq("estado", "vigente")
      .lte("fecha_proxima_revision", limiteRevision),
    supabase
      .from("documentos")
      .select("id", { count: "exact", head: true })
      .eq("estado", "vigente"),
    supabase
      .from("auditorias")
      .select("id", { count: "exact", head: true })
      .gte("fecha_planificada", `${anioActual}-01-01`),
    supabase
      .from("auditorias")
      .select("id", { count: "exact", head: true })
      .gte("fecha_planificada", `${anioActual}-01-01`)
      .eq("estado", "cerrada"),
    supabase
      .from("nc_acciones")
      .select("id", { count: "exact", head: true })
      .in("estado", ["pendiente", "en_curso"])
      .lt("fecha_limite", hoy),
    supabase
      .from("nc_acciones")
      .select("id", { count: "exact", head: true })
      .eq("responsable_id", usuario.id)
      .in("estado", ["pendiente", "en_curso"]),
    supabase
      .from("vista_indicadores_looker")
      .select("cumple_meta")
      .not("cumple_meta", "is", null)
      .gte("periodo", `${anioActual}-01-01`),
    // LOS RECLAMOS SE TRAEN EN FILAS Y NO EN UN CONTEO. Es a proposito:
    // «fuera de plazo» tiene una sola definicion, `estaFueraDePlazo`, que
    // contempla la suspension por tramite ante la DIGEMABEL. Escribirla
    // otra vez como filtro de la consulta seria tenerla en dos lugares, y
    // el dia que cambie una el panel y el listado van a decir distinto.
    // Son pocas filas y solo las abiertas.
    supabase
      .from("reclamos")
      .select(
        "estado, tramite_digemabel, fecha_limite_contacto, fecha_contacto, " +
          "fecha_limite_resolucion, fecha_resolucion",
      )
      .in("estado", ESTADOS_RECLAMO_ABIERTOS),
    supabase
      .from("cambios")
      .select("id", { count: "exact", head: true })
      .eq("estado", "en_aprobacion"),
    supabase
      .from("proveedores")
      .select("id", { count: "exact", head: true })
      .lte("fecha_proxima_evaluacion", hoy)
      .in("estado", ["aprobado", "condicional"]),
    supabase
      .from("proveedores")
      .select("id", { count: "exact", head: true })
      .in("estado", ["aprobado", "condicional", "en_evaluacion"]),
  ]);

  const filasMediciones = (mediciones.data as { cumple_meta: boolean }[] | null) ?? [];
  const filasReclamos = (reclamos.data as PlazosDelCaso[] | null) ?? [];

  return {
    ncAbiertas: ncAbiertas.count ?? 0,
    ncVencidas: ncVencidas.count ?? 0,
    riesgosAltos: riesgosAltos.count ?? 0,
    riesgosPorReevaluar: riesgosPorReevaluar.count ?? 0,
    documentosPorRevisar: documentosPorRevisar.count ?? 0,
    documentosVigentes: documentosVigentes.count ?? 0,
    auditoriasTotales: auditorias.count ?? 0,
    auditoriasCerradas: auditoriasCerradas.count ?? 0,
    indicadoresFueraDeMeta: filasMediciones.filter((fila) => fila.cumple_meta === false).length,
    indicadoresMedidos: filasMediciones.length,
    accionesVencidas: accionesVencidas.count ?? 0,
    misAccionesPendientes: misAcciones.count ?? 0,
    reclamosAbiertos: filasReclamos.length,
    reclamosFueraDePlazo: filasReclamos.filter((caso) => estaFueraDePlazo(caso)).length,
    cambiosEnAprobacion: cambiosEnAprobacion.count ?? 0,
    proveedoresPorReevaluar: proveedoresPorReevaluar.count ?? 0,
    proveedoresActivos: proveedoresActivos.count ?? 0,
  };
}
