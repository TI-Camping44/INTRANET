import "server-only";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import {
  consolidar,
  porcentajeDeCumplimiento,
  semaforoDeCumplimiento,
  type Consolidacion,
  type NivelObjetivo,
  type Semaforo,
} from "@/lib/objetivos";
import type { FrecuenciaMedicion, SentidoIndicador } from "@/lib/tipos";

/**
 * Los datos del F-EST-01-05, «Objetivos de la calidad e indicadores».
 *
 * Una fila por indicador, con su objetivo al lado, los doce meses del
 * año y el cierre calculado. Es la hoja de Calidad tal cual: si alguien
 * la tiene abierta en el Drive y abre esta pantalla, tiene que reconocer
 * las mismas columnas en el mismo orden.
 *
 * Son tres consultas y el cruce se hace acá. Con treinta objetivos y
 * seis indicadores, pedirle a la base un agrupamiento por mes cuesta más
 * que traer las mediciones del año y repartirlas.
 *
 * Un objetivo sin indicador también aparece: la hoja tiene esas filas y
 * son justamente las que hay que completar. Lo contrario —un indicador
 * sin objetivo— también, porque hoy la mayoría está así.
 */

export interface FilaHoja {
  /** El número de orden de la hoja. */
  numero: number;
  objetivoId: string | null;
  objetivo: string;
  nivel: NivelObjetivo | null;
  ambito: string | null;
  indicadorId: string | null;
  indicador: string | null;
  codigo: string | null;
  formula: string | null;
  unidad: string | null;
  lineaBase: number | null;
  meta: number | null;
  sentido: SentidoIndicador | null;
  consolidacion: Consolidacion | null;
  frecuencia: FrecuenciaMedicion | null;
  fuenteDato: string | null;
  responsable: string | null;
  /** Doce posiciones: enero a diciembre. `null` es un mes sin cargar. */
  meses: (number | null)[];
  resultado: number | null;
  cumplimiento: number | null;
  semaforo: Semaforo | null;
  observaciones: string | null;
}

export interface Hoja {
  anio: number;
  filas: FilaHoja[];
}

export async function obtenerHoja(anio: number): Promise<Hoja> {
  const supabase = crearClienteServidor();

  const desde = `${anio}-01-01`;
  const hasta = `${anio}-12-31`;

  const [{ data: objetivos }, { data: indicadores }, { data: mediciones }] = await Promise.all([
    supabase
      .from("objetivos")
      .select(
        "id, codigo, nombre, nivel, observaciones, " +
          "procesos:proceso_id (nombre), responsable:responsable_id (nombre_completo)",
      )
      .eq("anio", anio)
      .order("codigo"),
    supabase
      .from("indicadores")
      .select(
        "id, codigo, nombre, objetivo_id, formula, unidad, linea_base, meta, sentido, " +
          "consolidacion, frecuencia, fuente_dato, " +
          "procesos:proceso_id (nombre), responsable:responsable_id (nombre_completo)",
      )
      .eq("activo", true)
      .order("codigo"),
    supabase
      .from("indicador_mediciones")
      .select("indicador_id, periodo, valor_real")
      .gte("periodo", desde)
      .lte("periodo", hasta),
  ]);

  // Las mediciones del año, repartidas por indicador y por mes.
  const porIndicador = new Map<string, (number | null)[]>();
  for (const medicion of (mediciones as
    | { indicador_id: string; periodo: string; valor_real: number }[]
    | null) ?? []) {
    const meses = porIndicador.get(medicion.indicador_id) ?? Array(12).fill(null);
    // El periodo es una columna `date` y llega como "2026-03-01": el mes
    // se saca del texto y no con `new Date`, que en Asunción correría un
    // día y podría cambiar de mes en los días 1.
    const mes = Number(medicion.periodo.slice(5, 7)) - 1;
    if (mes >= 0 && mes < 12) meses[mes] = Number(medicion.valor_real);
    porIndicador.set(medicion.indicador_id, meses);
  }

  type FilaIndicador = {
    id: string;
    codigo: string;
    nombre: string;
    objetivo_id: string | null;
    formula: string | null;
    unidad: string | null;
    linea_base: number | null;
    meta: number | null;
    sentido: SentidoIndicador;
    consolidacion: Consolidacion;
    frecuencia: FrecuenciaMedicion;
    fuente_dato: string | null;
    procesos: { nombre: string } | null;
    responsable: { nombre_completo: string } | null;
  };

  type FilaObjetivo = {
    id: string;
    codigo: string;
    nombre: string;
    nivel: NivelObjetivo | null;
    observaciones: string | null;
    procesos: { nombre: string } | null;
    responsable: { nombre_completo: string } | null;
  };

  const listaIndicadores = (indicadores as FilaIndicador[] | null) ?? [];
  const listaObjetivos = (objetivos as FilaObjetivo[] | null) ?? [];

  const indicadoresPorObjetivo = new Map<string, FilaIndicador[]>();
  const sueltos: FilaIndicador[] = [];
  for (const indicador of listaIndicadores) {
    if (!indicador.objetivo_id) {
      sueltos.push(indicador);
      continue;
    }
    const suyos = indicadoresPorObjetivo.get(indicador.objetivo_id) ?? [];
    suyos.push(indicador);
    indicadoresPorObjetivo.set(indicador.objetivo_id, suyos);
  }

  const filas: FilaHoja[] = [];

  function armar(
    objetivo: FilaObjetivo | null,
    indicador: FilaIndicador | null,
    repiteObjetivo: boolean,
  ): FilaHoja {
    const meses = indicador ? (porIndicador.get(indicador.id) ?? Array(12).fill(null)) : Array(12).fill(null);

    const resultado = indicador
      ? consolidar(
          meses.filter((valor): valor is number => valor !== null),
          indicador.consolidacion,
        )
      : null;

    const cumplimiento = indicador
      ? porcentajeDeCumplimiento(resultado, indicador.meta, indicador.sentido)
      : null;

    return {
      numero: filas.length + 1,
      objetivoId: objetivo?.id ?? null,
      // Cuando un objetivo tiene dos indicadores, la hoja repite la fila
      // y deja el objetivo en blanco en la segunda. Se hace igual: el ojo
      // ve que son del mismo objetivo sin tener que leer dos veces.
      objetivo: repiteObjetivo ? "" : (objetivo?.nombre ?? "Sin objetivo asociado"),
      nivel: repiteObjetivo ? null : (objetivo?.nivel ?? null),
      ambito: repiteObjetivo
        ? null
        : (objetivo?.procesos?.nombre ?? indicador?.procesos?.nombre ?? null),
      indicadorId: indicador?.id ?? null,
      indicador: indicador?.nombre ?? null,
      codigo: indicador?.codigo ?? objetivo?.codigo ?? null,
      formula: indicador?.formula ?? null,
      unidad: indicador?.unidad ?? null,
      lineaBase: indicador?.linea_base ?? null,
      meta: indicador?.meta ?? null,
      sentido: indicador?.sentido ?? null,
      consolidacion: indicador?.consolidacion ?? null,
      frecuencia: indicador?.frecuencia ?? null,
      fuenteDato: indicador?.fuente_dato ?? null,
      responsable:
        indicador?.responsable?.nombre_completo ?? objetivo?.responsable?.nombre_completo ?? null,
      meses,
      resultado,
      cumplimiento,
      semaforo: semaforoDeCumplimiento(cumplimiento),
      observaciones: repiteObjetivo ? null : (objetivo?.observaciones ?? null),
    };
  }

  for (const objetivo of listaObjetivos) {
    const suyos = indicadoresPorObjetivo.get(objetivo.id) ?? [];

    if (suyos.length === 0) {
      // Objetivo sin indicador: la fila existe y está incompleta, que es
      // exactamente lo que Calidad necesita ver.
      filas.push(armar(objetivo, null, false));
      continue;
    }

    suyos.forEach((indicador, indice) => {
      filas.push(armar(objetivo, indicador, indice > 0));
    });
  }

  // Los indicadores que todavía no cuelgan de ningún objetivo, al final.
  for (const indicador of sueltos) {
    filas.push(armar(null, indicador, false));
  }

  return { anio, filas };
}
