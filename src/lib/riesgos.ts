import type { NivelRiesgo, TratamientoRiesgo } from "@/lib/tipos";

/**
 * Las reglas del instructivo de valoración de Calidad, versión 01.
 *
 * Están también en la base de datos —`etiqueta_nivel_riesgo`,
 * `dias_reevaluacion_riesgo`, `etiqueta_prioridad_oportunidad`— y si
 * cambian, cambian en los dos lados. La base es la que manda: la
 * interfaz calcula para mostrar el resultado mientras la persona
 * completa el formulario, no para decidir.
 */

export function nivelDeRiesgo(probabilidad: number, severidad: number): number {
  return probabilidad * severidad;
}

/**
 * El semáforo del instructivo: 1-3 bajo, 4-8 medio, 9-14 alto, 15-25
 * crítico.
 *
 * El corte entre bajo y medio importa más de lo que parece: «bajo» se
 * asume y solo se vigila, «medio» exige acción planificada con
 * responsable y plazo. Un nivel 4 —probabilidad 2 por severidad 2, o
 * probabilidad 4 por severidad 1— ya pide plan.
 */
export function etiquetaNivelRiesgo(nivel: number | null | undefined): NivelRiesgo | null {
  if (nivel === null || nivel === undefined) return null;
  if (nivel <= 3) return "bajo";
  if (nivel <= 8) return "medio";
  if (nivel <= 14) return "alto";
  return "critico";
}

/** Qué decide cada nivel, con las palabras del instructivo. */
export const DECISION_POR_NIVEL: Record<NivelRiesgo, string> = {
  bajo: "Se asume. Solo se mantiene bajo vigilancia; no requiere acción planificada.",
  medio: "Requiere acción planificada con responsable y plazo, dentro del ciclo anual.",
  alto: "Requiere acción prioritaria, con plazo definido y seguimiento en el comité de calidad.",
  critico:
    "Requiere acción inmediata y aprobación de la alta dirección. Se revisa en la primera reunión disponible.",
};

/**
 * ¿Requiere acciones? Medio, alto y critico si; bajo no.
 *
 * El corte es el del semaforo del proyecto: 1-4 es bajo. Lo fijo Calidad
 * el 5 de octubre de 2026, y cambio lo que el instructivo decia antes
 * —«de nivel 4 para arriba hace falta plan»—, que dejaba un riesgo de
 * nivel 4, bajo, pidiendo plan.
 *
 * LA MISMA REGLA ESTA EN LA BASE, en la columna generada
 * `riesgos.requiere_accion`. Si cambia, cambia en los dos lados.
 */
export function requiereAcciones(nivel: number | null | undefined): boolean {
  return nivel !== null && nivel !== undefined && nivel >= 5;
}

/** Clases de Tailwind para el semaforo, con contraste suficiente en ambos temas. */
export const CLASES_NIVEL_RIESGO: Record<NivelRiesgo, string> = {
  bajo: "bg-semaforo-bajo/15 text-semaforo-bajo border-semaforo-bajo/30",
  medio: "bg-semaforo-medio/15 text-semaforo-medio border-semaforo-medio/30",
  alto: "bg-semaforo-alto/15 text-semaforo-alto border-semaforo-alto/30",
  critico: "bg-semaforo-critico/15 text-semaforo-critico border-semaforo-critico/30",
};

/** Los cuatro niveles del semaforo, de menor a mayor. */
export const NIVELES_RIESGO: NivelRiesgo[] = ["bajo", "medio", "alto", "critico"];

/**
 * Colores del semaforo ya resueltos, para los graficos.
 *
 * Salen de las variables del tema y no de un hexadecimal: asi el grafico
 * funciona igual en modo claro y oscuro, que es regla del proyecto.
 */
export const COLOR_NIVEL_RIESGO: Record<NivelRiesgo, string> = {
  bajo: "hsl(var(--semaforo-bajo))",
  medio: "hsl(var(--semaforo-medio))",
  alto: "hsl(var(--semaforo-alto))",
  critico: "hsl(var(--semaforo-critico))",
};

/**
 * Colores del estado del riesgo.
 *
 * No es un semaforo: es el recorrido del riesgo. «Materializado» va en
 * rojo porque es el unico estado que significa que algo salio mal;
 * «controlado» en verde porque es donde se lo quiere; los demas en
 * neutro, que es lo que son.
 */
export const COLOR_ESTADO_RIESGO: Record<string, string> = {
  identificado: "hsl(var(--primario))",
  en_tratamiento: "hsl(var(--semaforo-medio))",
  controlado: "hsl(var(--semaforo-bajo))",
  materializado: "hsl(var(--semaforo-critico))",
  cerrado: "hsl(var(--atenuado-contraste))",
};

/** Relleno solido para las celdas de la matriz. */
export const RELLENO_NIVEL_RIESGO: Record<NivelRiesgo, string> = {
  bajo: "bg-semaforo-bajo/25 hover:bg-semaforo-bajo/40",
  medio: "bg-semaforo-medio/25 hover:bg-semaforo-medio/40",
  alto: "bg-semaforo-alto/30 hover:bg-semaforo-alto/45",
  critico: "bg-semaforo-critico/30 hover:bg-semaforo-critico/45",
};

/** Periodicidad de reevaluacion en dias, segun nivel. */
export function diasReevaluacion(nivel: number | null | undefined): number {
  const etiqueta = etiquetaNivelRiesgo(nivel);
  switch (etiqueta) {
    case "critico":
      return 30;
    case "alto":
      return 90;
    case "medio":
      return 180;
    default:
      return 365;
  }
}

/** Un riesgo alto o critico exige atencion en el tablero de Direccion. */
export function esRiesgoRelevante(nivel: number | null | undefined): boolean {
  const etiqueta = etiquetaNivelRiesgo(nivel);
  return etiqueta === "alto" || etiqueta === "critico";
}

// ---------------------------------------------------------------------
// El residual
// ---------------------------------------------------------------------

/**
 * Qué factor puede bajar según la opción de tratamiento elegida.
 *
 * Es el apartado 5.2 del instructivo y es la regla que más se
 * incumple en la práctica: una capacitación baja la probabilidad, no la
 * severidad —si alguien se equivoca igual, la consecuencia es la misma—
 * y un plan de contingencia baja la severidad, no la probabilidad, porque
 * no evita que el evento ocurra.
 */
export const EFECTO_DEL_TRATAMIENTO: Record<
  TratamientoRiesgo,
  { baja: "probabilidad" | "severidad" | "ambas" | "ninguna"; explicacion: string }
> = {
  eliminar_fuente: {
    baja: "probabilidad",
    explicacion:
      "La probabilidad baja a 1. En muchos casos el riesgo deja de existir y la fila se cierra sin residual.",
  },
  cambiar_probabilidad: {
    baja: "probabilidad",
    explicacion:
      "Baja la probabilidad; la severidad se mantiene. Mantenimiento, capacitación, verificación doble, redundancia.",
  },
  cambiar_consecuencia: {
    baja: "severidad",
    explicacion:
      "Baja la severidad; la probabilidad se mantiene. Contingencia, stock de respaldo, protocolo de respuesta rápida.",
  },
  compartir: {
    baja: "severidad",
    explicacion:
      "Baja la severidad, casi siempre solo en lo económico. La probabilidad no cambia. Seguros o traslado contractual.",
  },
  evitar: {
    baja: "ninguna",
    explicacion: "Se discontinúa la actividad que lo genera. No se valora residual: la fila se cierra.",
  },
  asumir: {
    baja: "ninguna",
    explicacion:
      "El residual es igual al inherente. Debe registrarse quién tomó la decisión y con qué fundamento.",
  },
  mitigar: { baja: "ambas", explicacion: "Opción retirada. Reemplácela por una de las siete vigentes." },
  transferir: { baja: "ambas", explicacion: "Opción retirada. Reemplácela por «Compartir el riesgo»." },
  aceptar: {
    baja: "ninguna",
    explicacion:
      "Mantener el riesgo es no actuar sobre él: el residual tiene que quedar igual que el inherente. Lo que cambia es que la decisión queda escrita.",
  },
  explotar: { baja: "ambas", explicacion: "Opción retirada. Era para oportunidades, que ya no usan tratamiento." },
};

/**
 * Controla el residual contra la opción de tratamiento elegida.
 * Devuelve la advertencia, o null si la valoración es coherente.
 *
 * No bloquea: avisa. El instructivo pide que el residual se pueda
 * explicar con un hecho verificable, y quien valora puede tener una
 * razón que el sistema no conoce. Lo que no puede pasar es que se cargue
 * sin darse cuenta.
 */
export function advertenciaResidual(
  tratamiento: TratamientoRiesgo | null,
  probabilidad: number | null,
  severidad: number | null,
  probabilidadResidual: number | null,
  severidadResidual: number | null,
): string | null {
  if (
    !tratamiento ||
    probabilidad === null ||
    severidad === null ||
    probabilidadResidual === null ||
    severidadResidual === null
  ) {
    return null;
  }

  if (probabilidadResidual * severidadResidual > probabilidad * severidad) {
    return (
      "El residual no puede ser mayor que el inherente. Si al valorar resulta mayor, " +
      "el riesgo cambió de naturaleza y corresponde abrir una ficha nueva."
    );
  }

  const efecto = EFECTO_DEL_TRATAMIENTO[tratamiento];

  if (efecto.baja === "probabilidad" && severidadResidual < severidad) {
    return (
      "Bajó la severidad, y esta opción de tratamiento no la afecta. " + efecto.explicacion
    );
  }

  if (efecto.baja === "severidad" && probabilidadResidual < probabilidad) {
    return (
      "Bajó la probabilidad, y esta opción de tratamiento no la afecta. " + efecto.explicacion
    );
  }

  if (
    efecto.baja === "ninguna" &&
    probabilidadResidual * severidadResidual < probabilidad * severidad
  ) {
    return "Con esta opción el residual no baja. " + efecto.explicacion;
  }

  // Apartado 5.3: una acción rara vez reduce más de dos puntos el factor
  // sobre el que actúa.
  if (probabilidad - probabilidadResidual > 2 || severidad - severidadResidual > 2) {
    return (
      "Bajó más de dos puntos de una sola vez. El instructivo lo admite, pero pide " +
      "justificarlo con evidencia: es la señal más común de una valoración optimista."
    );
  }

  return null;
}

/** Qué se decide con el residual obtenido (apartado 5.5). */
export function decisionResidual(nivelResidual: number | null): string | null {
  if (nivelResidual === null) return null;
  if (nivelResidual <= 3) {
    return "La acción fue eficaz. Se cierra el riesgo y se mantiene bajo vigilancia periódica.";
  }
  if (nivelResidual <= 8) {
    return "Aceptable. El riesgo sigue abierto con el control vigente y se revisa el período próximo.";
  }
  return "La acción no fue suficiente. Se registra como parcialmente eficaz y se planifica otra.";
}

// ---------------------------------------------------------------------
// Oportunidades
// ---------------------------------------------------------------------

export type PrioridadOportunidad = "alta" | "media" | "baja";

export function indiceOportunidad(beneficio: number, factibilidad: number): number {
  return beneficio * factibilidad;
}

/** Prioridad según el índice (apartado 6.3). */
export function prioridadOportunidad(
  indice: number | null | undefined,
): PrioridadOportunidad | null {
  if (indice === null || indice === undefined) return null;
  if (indice >= 15) return "alta";
  if (indice >= 7) return "media";
  return "baja";
}

export const ETIQUETAS_PRIORIDAD: Record<PrioridadOportunidad, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export const DECISION_POR_PRIORIDAD: Record<PrioridadOportunidad, string> = {
  alta: "Se incorpora al plan del período en curso, con recursos asignados.",
  media: "Se evalúa su inclusión según disponibilidad. Puede diferirse con fundamento.",
  baja: "Se registra y se revisa el período siguiente. Normalmente no se aborda.",
};

/**
 * Relleno de las celdas en la matriz de oportunidades.
 *
 * AL REVES QUE EN LA DE RIESGOS: ahi el verde es la esquina tranquila y
 * el rojo la que exige acción. Acá el índice alto es la oportunidad que
 * conviene tomar, así que el verde va arriba a la derecha. Usar la misma
 * escala en las dos matrices haría leer «peligro» donde dice «tómela».
 */
export const RELLENO_PRIORIDAD_OPORTUNIDAD: Record<PrioridadOportunidad, string> = {
  alta: "bg-semaforo-bajo/25 hover:bg-semaforo-bajo/40",
  media: "bg-semaforo-medio/25 hover:bg-semaforo-medio/40",
  baja: "bg-atenuado hover:bg-acento",
};

/**
 * Colores ya resueltos para los graficos de oportunidades.
 *
 * AL REVES QUE EN RIESGOS: ahi el verde es el nivel bajo, el que no
 * preocupa. Aca el verde es la prioridad alta, la que conviene tomar.
 */
export const COLOR_PRIORIDAD: Record<PrioridadOportunidad, string> = {
  alta: "hsl(var(--semaforo-bajo))",
  media: "hsl(var(--semaforo-medio))",
  baja: "hsl(var(--atenuado-contraste))",
};

export const CLASES_PRIORIDAD: Record<PrioridadOportunidad, string> = {
  alta: "bg-semaforo-bajo/15 text-semaforo-bajo border-semaforo-bajo/30",
  media: "bg-semaforo-medio/15 text-semaforo-medio border-semaforo-medio/30",
  baja: "bg-atenuado text-atenuado-contraste border-borde",
};

export const ETIQUETAS_ALINEACION: Record<string, string> = {
  alta: "Alta",
  media: "Media",
  baja: "Baja",
};

export const ALINEACIONES = ["alta", "media", "baja"];

/**
 * La alineación estratégica es condición, no puntaje.
 *
 * Una oportunidad de índice alto con alineación baja NO se aborda, y esa
 * decisión se registra. Sumarla al índice la disimularía: quedaría una
 * prioridad media que nadie discute, en vez de un «no» explicado.
 */
export function advertenciaAlineacion(
  indice: number | null,
  alineacion: string | null,
  seDecideAbordar: boolean | null,
): string | null {
  if (indice === null || !alineacion) return null;

  const prioridad = prioridadOportunidad(indice);

  if (alineacion === "baja" && seDecideAbordar === true) {
    return (
      "La alineación con la dirección estratégica es baja. El instructivo dice que una " +
      "oportunidad así no se aborda, cualquiera sea su índice. Si igual se decide hacerlo, " +
      "deje el fundamento escrito."
    );
  }

  if (prioridad === "alta" && alineacion !== "baja" && seDecideAbordar === false) {
    return "Prioridad alta y alineación no baja: si se decide no abordarla, registre el fundamento.";
  }

  return null;
}

/**
 * De dónde puede salir un riesgo, según Calidad.
 *
 * Era un campo de texto libre y pasa a ser lista cerrada. El motivo no
 * es de comodidad: con texto libre, «Queja de cliente», «queja cliente»
 * y «Reclamo» son tres orígenes distintos para la base y uno solo para
 * la realidad, y cualquier conteo por origen queda inservible.
 *
 * Las etiquetas son las que fijó Calidad el 5 de octubre. Antes los dos
 * primeros llevaban el número de la cláusula —«Contexto (4.1)»—; se los
 * sacó porque dentro del sistema nadie los busca por el número.
 *
 * La columna es de texto, así que acá se guarda la etiqueta tal cual.
 * Los riesgos ya cargados con otro texto se siguen leyendo; la lista
 * ordena de acá en adelante.
 */
export const ORIGENES_RIESGO = [
  "Contexto de la Organización",
  "Partes Interesadas",
  // Las dos auditorías van juntas: a Calidad le importa que el riesgo
  // salió de una auditoría, no de cuál de las dos.
  "Auditoría Interna/Externa",
  "No Conformidad",
  "Queja de Cliente",
  "Indicador fuera de meta",
  "Revisión por la Dirección",
  // Lo agrego Calidad el 5 de octubre: su matriz lo usa en dos riesgos
  // —la mora de creditos y los faltantes de caja— y no estaba en la
  // lista. Sin el, esos dos no se podian editar desde el formulario.
  "Análisis de proceso",
  "Otro",
] as const;

export type OrigenRiesgo = (typeof ORIGENES_RIESGO)[number];

export function esOrigenValido(valor: string): valor is OrigenRiesgo {
  return (ORIGENES_RIESGO as readonly string[]).includes(valor);
}

/**
 * De dónde puede salir una oportunidad, según Calidad.
 *
 * Lista propia y no la de riesgos: una oportunidad no nace de una no
 * conformidad ni de una queja, nace de una tecnología que apareció, de
 * un mercado que se movió o de alguien que propuso algo. Compartir una
 * sola lista obligaría a ofrecer en cada pantalla la mitad de las
 * opciones que ahí no aplican.
 *
 * Los dos primeros coinciden con los de riesgos: el contexto y las
 * partes interesadas dan las dos cosas.
 */
export const ORIGENES_OPORTUNIDAD = [
  "Contexto de la Organización",
  "Partes Interesadas",
  "Tecnología emergente",
  "Condiciones del mercado",
  "Requisito reglamentario",
  "Sugerencia de un Colaborador",
  "Retroalimentación de Clientes",
  "Auditoría Interna/Externa",
  "Revisión por la Dirección",
  "Nueva Alianza/Asociación",
  "Otro",
] as const;

export type OrigenOportunidad = (typeof ORIGENES_OPORTUNIDAD)[number];

export function esOrigenDeOportunidadValido(valor: string): valor is OrigenOportunidad {
  return (ORIGENES_OPORTUNIDAD as readonly string[]).includes(valor);
}
