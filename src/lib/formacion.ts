/**
 * Formacion y Competencia: el plan anual de acciones formativas.
 *
 * El segundo submodulo de Personas. Es donde Capital Humano planifica
 * las acciones del año, las reparte en el calendario y despues registra
 * que paso con cada una.
 *
 * LAS REGLAS QUE IMPORTAN, y que estan en los dos lados —acá y en la
 * base— porque son reglas de negocio y no decoracion de pantalla:
 *
 *   · Una formacion de mas de 2 horas exige Evaluacion de Eficacia de la
 *     Formacion. El corte se calcula en `capacitaciones.requiere_eficacia`,
 *     que es una columna generada: la pantalla avisa, la columna manda.
 *
 *   · La eficacia se verifica POR PERSONA y no por curso. Vive en
 *     `capacitacion_participantes.eficacia`. Un curso donde la mitad
 *     aprovecho y la otra mitad no, promediado, no dice nada.
 *
 *   · Una accion que no se ejecuto o que se pospuso lleva motivo. Un
 *     plan anual con acciones caidas y sin explicacion no se puede
 *     revisar, que es lo que la Revision por la Direccion mira.
 */

import type { EstadoCapacitacion, TipoCapacitacion } from "@/lib/tipos";

// ---------------------------------------------------------------------
// Estado de la accion formativa
// ---------------------------------------------------------------------

/**
 * El ciclo que pidio Direccion: nace planificada y se mueve a mano.
 *
 * `en_curso`, `finalizada` y `cancelada` siguen en el enumerado de la
 * base —un valor de enumerado no se puede quitar en PostgreSQL— pero no
 * se ofrecen. Mismo criterio que con los origenes de las no
 * conformidades.
 */
export const ESTADOS_FORMACION_VIGENTES: EstadoCapacitacion[] = [
  "planificada",
  "ejecutada",
  "no_ejecutada",
  "pospuesta",
];

export const ETIQUETAS_ESTADO_FORMACION: Record<string, string> = {
  planificada: "Planificada",
  ejecutada: "Ejecutada",
  no_ejecutada: "No ejecutada",
  pospuesta: "Pospuesta",
  // Los tres viejos, por si quedara alguna fila con ellos.
  en_curso: "En curso",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

/**
 * Colores del estado.
 *
 * No es un semaforo de desempeño: es el recorrido de la accion.
 * «No ejecutada» va en rojo porque es la unica que significa que algo
 * quedo sin hacer; «ejecutada» en verde; «pospuesta» en ambar, que es lo
 * que es: todavia puede pasar.
 */
export const CLASES_ESTADO_FORMACION: Record<string, string> = {
  planificada: "border-borde text-atenuado-contraste",
  ejecutada: "border-semaforo-bajo/40 bg-semaforo-bajo/10 text-semaforo-bajo",
  no_ejecutada: "border-semaforo-critico/40 bg-semaforo-critico/10 text-semaforo-critico",
  pospuesta: "border-semaforo-medio/40 bg-semaforo-medio/10 text-semaforo-medio",
  en_curso: "border-borde text-atenuado-contraste",
  finalizada: "border-semaforo-bajo/40 bg-semaforo-bajo/10 text-semaforo-bajo",
  cancelada: "border-borde text-atenuado-contraste",
};

/** Colores ya resueltos para los graficos, de las variables del tema. */
export const COLOR_ESTADO_FORMACION: Record<string, string> = {
  planificada: "hsl(var(--primario))",
  ejecutada: "hsl(var(--semaforo-bajo))",
  no_ejecutada: "hsl(var(--semaforo-critico))",
  pospuesta: "hsl(var(--semaforo-medio))",
};

/**
 * Los dos estados que exigen decir por que.
 *
 * Se usa en la pantalla para habilitar el campo y en la accion de
 * servidor para exigirlo. La pantalla es comodidad; el control es el
 * segundo.
 */
export function exigeMotivo(estado: string): boolean {
  return estado === "no_ejecutada" || estado === "pospuesta";
}

// ---------------------------------------------------------------------
// Modalidad y tipo
// ---------------------------------------------------------------------

export type ModalidadFormacion = "presencial" | "e_learning" | "mixto" | "otros";

export const MODALIDADES: ModalidadFormacion[] = [
  "presencial",
  "e_learning",
  "mixto",
  "otros",
];

export const ETIQUETAS_MODALIDAD: Record<ModalidadFormacion, string> = {
  presencial: "Presencial",
  e_learning: "E-learning",
  mixto: "Mixto",
  otros: "Otros",
};

/**
 * Quien la dicta. Solo dos, como pidio Direccion.
 *
 * `en_linea` e `induccion` siguen en el enumerado de la base y no se
 * ofrecen: la primera es una modalidad, no un tipo, y ahora tiene su
 * propio campo.
 */
export const TIPOS_FORMACION_VIGENTES: TipoCapacitacion[] = ["interna", "externa"];

export const ETIQUETAS_TIPO_FORMACION: Record<string, string> = {
  interna: "Interna",
  externa: "Externa",
  en_linea: "En línea",
  induccion: "Inducción",
};

// ---------------------------------------------------------------------
// Duracion y eficacia
// ---------------------------------------------------------------------

/** El corte de Calidad: mas de 2 horas exige evaluar la eficacia. */
export const HORAS_PARA_EXIGIR_EFICACIA = 2;

/**
 * Horas totales de la accion.
 *
 * LA MISMA CUENTA ESTA EN LA BASE, en la columna generada
 * `capacitaciones.horas_totales`. Si cambia, cambia en los dos lados.
 */
export function horasTotales(
  sesiones: number | null | undefined,
  horasPorSesion: number | null | undefined,
): number {
  return (sesiones ?? 0) * (horasPorSesion ?? 0);
}

export function requiereEvaluacionDeEficacia(
  sesiones: number | null | undefined,
  horasPorSesion: number | null | undefined,
): boolean {
  return horasTotales(sesiones, horasPorSesion) > HORAS_PARA_EXIGIR_EFICACIA;
}

// ---------------------------------------------------------------------
// El calendario
// ---------------------------------------------------------------------

export const MESES_CORTOS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

/**
 * Los meses que ocupa una accion en el calendario del año.
 *
 * Devuelve doce posiciones, una por mes, con `true` donde la accion esta
 * en curso. Una accion de junio a agosto pinta tres celdas.
 *
 * LAS FECHAS SE LEEN DEL TEXTO y no con `new Date`. Las columnas `date`
 * de PostgreSQL llegan como "2026-06-24"; pasarlas por `new Date` las
 * interpreta como UTC y en Asuncion corren un dia, lo que en los dias 1
 * cambia de mes y pinta la celda equivocada.
 */
export function mesesQueOcupa(
  fechaInicio: string | null,
  fechaFin: string | null,
  anio: number,
): boolean[] {
  const meses = Array<boolean>(12).fill(false);

  // Sin ninguna fecha no hay nada que pintar. Con una sola, se pinta ese
  // mes: una accion con solo fecha de finalizacion ocurrio ahi.
  const desde = fechaInicio ?? fechaFin;
  const hasta = fechaFin ?? fechaInicio;
  if (!desde || !hasta) return meses;

  const anioDesde = Number(desde.slice(0, 4));
  const anioHasta = Number(hasta.slice(0, 4));
  if (anioHasta < anio || anioDesde > anio) return meses;

  const primero = anioDesde < anio ? 1 : Number(desde.slice(5, 7));
  const ultimo = anioHasta > anio ? 12 : Number(hasta.slice(5, 7));

  for (let mes = primero; mes <= ultimo; mes += 1) {
    if (mes >= 1 && mes <= 12) meses[mes - 1] = true;
  }

  return meses;
}
