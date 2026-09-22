import "server-only";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { hoyEnAsuncion } from "@/lib/formato";
import {
  AREAS_ORGANIZACIONALES,
  ESTADOS_NC_ABIERTOS,
  ETIQUETAS_ESTADO_ACCION,
  ETIQUETAS_ESTADO_NC,
  ETIQUETAS_ESTADO_RIESGO,
  ETIQUETAS_NIVEL_RIESGO,
  ETIQUETAS_ORIGEN_NC,
  ETIQUETAS_SEVERIDAD_NC,
  ETIQUETAS_TIPO_ACCION,
} from "@/lib/constantes";
import {
  ETIQUETAS_PRIORIDAD,
  etiquetaNivelRiesgo,
  prioridadOportunidad,
} from "@/lib/riesgos";

/**
 * Los datos de la reporteria del SGC.
 *
 * Son cuatro consultas, no cuarenta. En lugar de pedirle a la base un
 * conteo por cada corte —por estado, por area, por origen, por
 * severidad— se traen las columnas minimas de cada tabla y se agrupa
 * aca. Son tablas de cientos de filas, no de millones: el viaje a la
 * base cuesta mas que el recuento.
 *
 * Cada corte se devuelve con su enlace al listado filtrado. Un numero
 * sin forma de llegar al detalle obliga a confiar; con el enlace se
 * puede ir a ver de donde salio, que es lo que una auditoria pregunta.
 */

export interface FilaReporte {
  etiqueta: string;
  cantidad: number;
  /** Listado filtrado que devuelve exactamente estas filas. */
  enlace?: string;
  /** Marca la fila que exige atencion: vencidos, fuera de meta. */
  alerta?: boolean;
}

export interface Reporte {
  titulo: string;
  descripcion: string;
  total: number;
  filas: FilaReporte[];
  /** Ruta del modulo, para el enlace «ver todo». */
  modulo: string;
}

/** Cuenta por clave conservando el orden del catalogo de etiquetas. */
function contarPor<T extends string>(
  filas: { [k: string]: unknown }[],
  columna: string,
  etiquetas: Record<T, string>,
  enlace?: (clave: T) => string,
): FilaReporte[] {
  const cuentas = new Map<string, number>();
  for (const fila of filas) {
    const clave = String(fila[columna] ?? "");
    cuentas.set(clave, (cuentas.get(clave) ?? 0) + 1);
  }

  // Se recorre el catalogo y no el resultado: asi el orden es el de
  // Calidad y no el que devolvio la base, y se ven los ceros. Un estado
  // en cero es informacion: dice que nada quedo ahi.
  return (Object.keys(etiquetas) as T[])
    .map((clave) => ({
      etiqueta: etiquetas[clave],
      cantidad: cuentas.get(clave) ?? 0,
      enlace: enlace?.(clave),
    }))
    .filter((fila) => fila.cantidad > 0);
}

export async function obtenerReportes(): Promise<Reporte[]> {
  const supabase = crearClienteServidor();
  const hoy = hoyEnAsuncion();
  const anio = Number(hoy.slice(0, 4));

  const [
    { data: noConformidades },
    { data: acciones },
    { data: riesgos },
    { data: objetivos },
  ] = await Promise.all([
    supabase
      .from("no_conformidades")
      .select("estado, area, origen, severidad, fecha_limite_cierre"),
    supabase.from("nc_acciones").select("estado, tipo, fecha_limite, nivel_escalamiento"),
    supabase.from("riesgos").select("tipo, estado, nivel, indice"),
    supabase.from("objetivos").select("estado, avance_porcentaje, anio").eq("anio", anio),
  ]);

  const nc = (noConformidades ?? []) as {
    estado: string;
    area: string | null;
    origen: string;
    severidad: string;
    fecha_limite_cierre: string | null;
  }[];

  const acc = (acciones ?? []) as {
    estado: string;
    tipo: string;
    fecha_limite: string;
    nivel_escalamiento: number;
  }[];

  const rie = (riesgos ?? []) as {
    tipo: string;
    estado: string;
    nivel: number | null;
    indice: number | null;
  }[];
  const obj = (objetivos ?? []) as { estado: string; avance_porcentaje: number }[];

  const ncVencidas = nc.filter(
    (fila) =>
      ESTADOS_NC_ABIERTOS.includes(fila.estado as never) &&
      fila.fecha_limite_cierre !== null &&
      fila.fecha_limite_cierre < hoy,
  ).length;

  const ncSinArea = nc.filter((fila) => !fila.area).length;

  const accionesVencidas = acc.filter(
    (fila) => ["pendiente", "en_curso"].includes(fila.estado) && fila.fecha_limite < hoy,
  ).length;

  const accionesEscaladas = acc.filter((fila) => fila.nivel_escalamiento > 0).length;

  const soloRiesgos = rie.filter((fila) => fila.tipo === "riesgo");
  const soloOportunidades = rie.filter((fila) => fila.tipo === "oportunidad");

  /**
   * Riesgos agrupados por nivel del semaforo, no por su numero.
   *
   * Solo el nivel critico lleva enlace. El listado filtra por `nivel=altos`
   * con un mayor o igual a 10, que devuelve los altos Y los criticos: si
   * se enlazara la fila "Alto" a eso, el numero de la fila y el del
   * listado no coincidirian. Un enlace que lleva a otro recuento es peor
   * que no tener enlace.
   */
  function porNivel(filas: { nivel: number | null }[], tipo: string): FilaReporte[] {
    const cuentas = new Map<string, number>();
    for (const fila of filas) {
      const clave = etiquetaNivelRiesgo(fila.nivel);
      if (clave) cuentas.set(clave, (cuentas.get(clave) ?? 0) + 1);
    }
    return (Object.keys(ETIQUETAS_NIVEL_RIESGO) as (keyof typeof ETIQUETAS_NIVEL_RIESGO)[])
      .map((clave) => ({
        etiqueta: ETIQUETAS_NIVEL_RIESGO[clave],
        cantidad: cuentas.get(clave) ?? 0,
        enlace: clave === "critico" ? `/riesgos?tipo=${tipo}&nivel=criticos` : undefined,
        alerta: clave === "alto" || clave === "critico",
      }))
      .filter((fila) => fila.cantidad > 0);
  }

  /**
   * Oportunidades agrupadas por prioridad.
   *
   * No por nivel: una oportunidad no tiene probabilidad ni severidad.
   * Su indice es Beneficio x Factibilidad y su prioridad sale de ahi,
   * con cortes distintos a los del semaforo de riesgos. Mezclarlas en
   * la misma escala era el error que el instructivo vino a corregir.
   */
  function porPrioridad(filas: { indice: number | null }[]): FilaReporte[] {
    const cuentas = new Map<string, number>();
    for (const fila of filas) {
      const clave = prioridadOportunidad(fila.indice);
      if (clave) cuentas.set(clave, (cuentas.get(clave) ?? 0) + 1);
    }
    return (Object.keys(ETIQUETAS_PRIORIDAD) as (keyof typeof ETIQUETAS_PRIORIDAD)[])
      .map((clave) => ({
        etiqueta: `Prioridad ${ETIQUETAS_PRIORIDAD[clave].toLowerCase()}`,
        cantidad: cuentas.get(clave) ?? 0,
        enlace: `/oportunidades?prioridad=${clave}`,
      }))
      .filter((fila) => fila.cantidad > 0);
  }

  const cumplidos = obj.filter((fila) => fila.estado === "cumplido").length;
  const sinAvance = obj.filter((fila) => Number(fila.avance_porcentaje) === 0).length;

  return [
    {
      titulo: "No conformidades por estado",
      descripcion: "En qué punto del ciclo está cada desviación registrada.",
      total: nc.length,
      modulo: "/no-conformidades",
      filas: [
        ...contarPor(nc, "estado", ETIQUETAS_ESTADO_NC, (clave) =>
          `/no-conformidades?estado=${clave}`,
        ),
        ...(ncVencidas > 0
          ? [
              {
                etiqueta: "Fuera de plazo",
                cantidad: ncVencidas,
                enlace: "/no-conformidades?estado=abiertas",
                alerta: true,
              },
            ]
          : []),
      ],
    },
    {
      titulo: "No conformidades por área",
      descripcion: "Cuáles son las desviaciones de cada departamento.",
      total: nc.length,
      modulo: "/no-conformidades",
      filas: [
        ...contarPor(nc, "area", AREAS_ORGANIZACIONALES, (clave) =>
          `/no-conformidades?area=${clave}`,
        ),
        ...(ncSinArea > 0
          ? [{ etiqueta: "Sin clasificar", cantidad: ncSinArea, alerta: true }]
          : []),
      ],
    },
    {
      titulo: "No conformidades por origen y severidad",
      descripcion: "De dónde salen las desviaciones y con qué peso.",
      total: nc.length,
      modulo: "/no-conformidades",
      filas: [
        ...contarPor(nc, "origen", ETIQUETAS_ORIGEN_NC, (clave) =>
          `/no-conformidades?origen=${clave}`,
        ),
        ...contarPor(nc, "severidad", ETIQUETAS_SEVERIDAD_NC, (clave) =>
          `/no-conformidades?severidad=${clave}`,
        ),
      ],
    },
    {
      titulo: "Acciones correctivas",
      descripcion: "El plan de acción de todas las no conformidades, junto.",
      total: acc.length,
      modulo: "/acciones?vista=todas",
      filas: [
        ...contarPor(
          acc,
          "estado",
          ETIQUETAS_ESTADO_ACCION,
          (clave) => `/acciones?vista=todas&estado=${clave}`,
        ),
        ...contarPor(
          acc,
          "tipo",
          ETIQUETAS_TIPO_ACCION,
          (clave) => `/acciones?vista=todas&tipo=${clave}`,
        ),
        ...(accionesVencidas > 0
          ? [
              {
                etiqueta: "Vencidas sin ejecutar",
                cantidad: accionesVencidas,
                enlace: "/acciones?vista=pendientes&filtro=vencidas",
                alerta: true,
              },
            ]
          : []),
        ...(accionesEscaladas > 0
          ? [{ etiqueta: "Escaladas al líder", cantidad: accionesEscaladas, alerta: true }]
          : []),
      ],
    },
    {
      titulo: "Riesgos",
      descripcion: "La matriz por nivel del semáforo y por estado de tratamiento.",
      total: soloRiesgos.length,
      modulo: "/riesgos",
      filas: [
        ...porNivel(soloRiesgos, "riesgo"),
        ...contarPor(
          soloRiesgos,
          "estado",
          ETIQUETAS_ESTADO_RIESGO,
          (clave) => `/riesgos?tipo=riesgo&estado=${clave}`,
        ),
      ],
    },
    {
      titulo: "Oportunidades",
      descripcion: "Por prioridad —Beneficio × Factibilidad— y por estado de tratamiento.",
      total: soloOportunidades.length,
      modulo: "/oportunidades",
      filas: [
        ...porPrioridad(soloOportunidades),
        ...contarPor(
          soloOportunidades,
          "estado",
          ETIQUETAS_ESTADO_RIESGO,
          (clave) => `/oportunidades?estado=${clave}`,
        ),
      ],
    },
    {
      titulo: `Objetivos de calidad ${anio}`,
      descripcion: "El avance del plan del año en curso.",
      total: obj.length,
      modulo: "/indicadores",
      filas: [
        { etiqueta: "Cumplidos", cantidad: cumplidos },
        { etiqueta: "En curso", cantidad: obj.length - cumplidos },
        ...(sinAvance > 0
          ? [{ etiqueta: "Sin avance cargado", cantidad: sinAvance, alerta: true }]
          : []),
      ].filter((fila) => fila.cantidad > 0),
    },
  ];
}
