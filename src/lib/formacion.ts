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

import type { EstadoCapacitacion, ResultadoEficacia, TipoCapacitacion } from "@/lib/tipos";

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

// ---------------------------------------------------------------------
// Eficacia de la accion formativa
// ---------------------------------------------------------------------

/**
 * EL RESULTADO DE LA ACCION SE DEDUCE, NO SE ESCRIBE.
 *
 * La eficacia se sigue verificando por persona —esa regla no cambia— y
 * de ahi sale el resultado de la accion, segun la tabla que paso Calidad
 * el 6 de octubre:
 *
 *   1 participante   el de la persona, tal cual
 *   2 a 4            eficaz si todos; parcialmente con uno no eficaz;
 *                    no eficaz con dos o mas
 *   5 o mas          por porcentaje: 80 % o mas eficaz, 60 a 79
 *                    parcialmente, menos de 60 no eficaz
 *
 * La misma regla vive en `eficacia_de_la_accion()` en la base. Si cambia,
 * cambia en los dos lados.
 *
 * No se guarda en ninguna columna a proposito: un resultado guardado se
 * calcula una vez y despues miente. Basta corregir la evaluacion de una
 * persona para que la accion quede diciendo lo de antes.
 */
export type EficaciaDeLaAccion =
  | "eficaz"
  | "eficaz_tras_refuerzo"
  | "parcialmente_eficaz"
  | "no_eficaz"
  | "pendiente";

/** Los cortes de la escala por porcentaje, desde 5 participantes. */
export const PORCENTAJE_EFICAZ = 80;
export const PORCENTAJE_PARCIALMENTE_EFICAZ = 60;

/** Desde cuantos participantes se mide por porcentaje y no por conteo. */
export const PARTICIPANTES_PARA_MEDIR_POR_PORCENTAJE = 5;

export interface EvaluacionDeParticipante {
  eficacia: ResultadoEficacia;
  /** El primer resultado, cuando hubo reevaluacion. */
  eficacia_inicial?: ResultadoEficacia | null;
}

export function eficaciaDeLaAccion(
  participantes: EvaluacionDeParticipante[],
): EficaciaDeLaAccion {
  // Solo cuentan los evaluados. Quien todavia no tiene resultado no
  // suma ni resta: la accion esta pendiente, no a medias.
  const evaluados = participantes.filter(
    (participante) => participante.eficacia !== "pendiente",
  );

  const total = evaluados.length;
  if (total === 0) return "pendiente";

  const eficaces = evaluados.filter(
    (participante) => participante.eficacia === "eficaz",
  ).length;

  if (total === 1) {
    if (eficaces === 0) return "no_eficaz";
    return evaluados[0].eficacia_inicial === "no_eficaz" ? "eficaz_tras_refuerzo" : "eficaz";
  }

  if (total < PARTICIPANTES_PARA_MEDIR_POR_PORCENTAJE) {
    const fallidos = total - eficaces;
    if (fallidos === 0) return "eficaz";
    return fallidos === 1 ? "parcialmente_eficaz" : "no_eficaz";
  }

  // Con enteros, para no arrastrar el redondeo de una division.
  if (eficaces * 100 >= total * PORCENTAJE_EFICAZ) return "eficaz";
  if (eficaces * 100 >= total * PORCENTAJE_PARCIALMENTE_EFICAZ) return "parcialmente_eficaz";
  return "no_eficaz";
}

export const ETIQUETAS_EFICACIA_ACCION: Record<EficaciaDeLaAccion, string> = {
  eficaz: "Eficaz",
  eficaz_tras_refuerzo: "Eficaz tras refuerzo",
  parcialmente_eficaz: "Parcialmente eficaz",
  no_eficaz: "No eficaz",
  pendiente: "Pendiente",
};

/**
 * El orden en que se muestran. «Eficaz tras refuerzo» va junto a
 * «Eficaz» porque termino bien, pero separado porque la primera vez no:
 * es lo que hay que mirar al decidir si se repite esa capacitacion.
 */
export const EFICACIAS_ACCION_EN_ORDEN: EficaciaDeLaAccion[] = [
  "eficaz",
  "eficaz_tras_refuerzo",
  "parcialmente_eficaz",
  "no_eficaz",
  "pendiente",
];

export const COLOR_EFICACIA_ACCION: Record<EficaciaDeLaAccion, string> = {
  eficaz: "hsl(var(--semaforo-bajo))",
  eficaz_tras_refuerzo: "hsl(var(--primario))",
  parcialmente_eficaz: "hsl(var(--semaforo-medio))",
  no_eficaz: "hsl(var(--semaforo-critico))",
  pendiente: "hsl(var(--atenuado-contraste))",
};

export const CLASES_EFICACIA_ACCION: Record<EficaciaDeLaAccion, string> = {
  eficaz: "border-semaforo-bajo/40 bg-semaforo-bajo/10 text-semaforo-bajo",
  eficaz_tras_refuerzo: "border-primario/40 bg-primario/10 text-primario",
  parcialmente_eficaz: "border-semaforo-medio/40 bg-semaforo-medio/10 text-semaforo-medio",
  no_eficaz: "border-semaforo-critico/40 bg-semaforo-critico/10 text-semaforo-critico",
  pendiente: "border-borde text-atenuado-contraste",
};

// ---------------------------------------------------------------------
// El caso de una sola persona
// ---------------------------------------------------------------------

/**
 * CON UN SOLO PARTICIPANTE, UN «NO EFICAZ» NO CONCLUYE NADA TODAVIA.
 *
 * No se puede distinguir si fallo la formacion o fallo la persona, y de
 * eso depende que se corrige: la capacitacion o el acompañamiento. Por
 * eso se pide la causa antes de dar la accion por fallida.
 *
 * Se admite UNA reevaluacion. Si despues del refuerzo la persona resulta
 * eficaz, la accion cierra como «eficaz tras refuerzo» y el primer
 * resultado queda guardado en `eficacia_inicial`: esconder que la
 * primera vez no funciono seria perder el dato que sirve para decidir
 * sobre esa capacitacion el año que viene.
 */
export type CausaNoEficacia = "formacion" | "participante";

export const CAUSAS_NO_EFICACIA: {
  valor: CausaNoEficacia;
  etiqueta: string;
  ejemplos: string;
  queSeHace: string;
}[] = [
  {
    valor: "formacion",
    etiqueta: "La formación",
    ejemplos: "Contenido inadecuado, instructor, modalidad.",
    queSeHace:
      "Acción correctiva sobre la capacitación: rediseñarla o cambiar de proveedor.",
  },
  {
    valor: "participante",
    etiqueta: "El participante",
    ejemplos: "Falta de práctica, no tuvo oportunidad de aplicarlo, dificultades personales.",
    queSeHace: "Refuerzo, acompañamiento en el puesto y reevaluación en un plazo definido.",
  },
];

/** Si ya se reevaluo una vez, no hay otra. */
export function admiteReevaluacion(participante: EvaluacionDeParticipante): boolean {
  return !participante.eficacia_inicial;
}
