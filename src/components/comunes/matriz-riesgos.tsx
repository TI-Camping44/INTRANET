import Link from "next/link";
import { cn } from "@/lib/utilidades";
import {
  etiquetaNivelRiesgo,
  prioridadOportunidad,
  RELLENO_NIVEL_RIESGO,
  RELLENO_PRIORIDAD_OPORTUNIDAD,
} from "@/lib/riesgos";
import {
  ESCALA_BENEFICIO,
  ESCALA_FACTIBILIDAD,
  ESCALA_PROBABILIDAD,
  ESCALA_SEVERIDAD,
  ETIQUETAS_NIVEL_RIESGO,
} from "@/lib/constantes";

interface Escalon {
  valor: number;
  etiqueta: string;
}

interface FichaEnMatriz {
  id: string;
  codigo: string;
  titulo: string;
  /** Coordenada vertical: probabilidad en riesgos, beneficio en oportunidades. */
  fila: number | null;
  /** Coordenada horizontal: severidad en riesgos, factibilidad en oportunidades. */
  columna: number | null;
}

/**
 * Mapa de calor 5×5.
 *
 * Sirve a las dos matrices del F-EST-01 porque la forma es la misma y la
 * aritmética también —el valor de la celda es el producto de los dos
 * ejes—, pero NO comparten ni los ejes ni los colores:
 *
 *   · Riesgos: probabilidad × severidad. El rojo arriba a la derecha es
 *     lo que hay que atender.
 *   · Oportunidades: beneficio × factibilidad. El verde arriba a la
 *     derecha es lo que conviene tomar.
 *
 * Pintarlas con la misma escala haría leer «peligro» donde la planilla
 * dice «prioridad alta».
 */
function Matriz({
  fichas,
  escalaFilas,
  escalaColumnas,
  rotuloFilas,
  rotuloColumnas,
  formula,
  referencia,
  relleno,
}: {
  fichas: FichaEnMatriz[];
  escalaFilas: Escalon[];
  escalaColumnas: Escalon[];
  rotuloFilas: string;
  rotuloColumnas: string;
  formula: string;
  referencia: { etiqueta: string; rango: string; clase: string }[];
  relleno: (valor: number) => string;
}) {
  const celdas = new Map<string, FichaEnMatriz[]>();

  for (const ficha of fichas) {
    // Sin las dos coordenadas no se puede ubicar: se deja fuera y el pie
    // de la matriz lo dice, en lugar de dibujarla en una celda inventada.
    if (ficha.fila === null || ficha.columna === null) continue;
    const clave = `${ficha.fila}-${ficha.columna}`;
    celdas.set(clave, [...(celdas.get(clave) ?? []), ficha]);
  }

  const sinUbicar = fichas.filter((ficha) => ficha.fila === null || ficha.columna === null);
  const filas = [...escalaFilas].reverse();

  return (
    <div className="space-y-4">
      <div className="desplazable-x overflow-x-auto">
        <table className="w-full min-w-[42rem] border-separate border-spacing-1">
          <caption className="sr-only">
            Matriz de 5 por 5: {rotuloFilas} contra {rotuloColumnas}
          </caption>
          <thead>
            <tr>
              <th className="w-28" />
              {escalaColumnas.map((columna) => (
                <th
                  key={columna.valor}
                  scope="col"
                  className="px-1 pb-1 text-center text-[10px] font-semibold uppercase
                             tracking-wide text-atenuado-contraste"
                >
                  {columna.valor} · {columna.etiqueta}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((fila) => (
              <tr key={fila.valor}>
                <th
                  scope="row"
                  className="pr-2 text-right text-[10px] font-semibold uppercase tracking-wide
                             text-atenuado-contraste"
                >
                  {fila.valor} · {fila.etiqueta}
                </th>
                {escalaColumnas.map((columna) => {
                  const valor = fila.valor * columna.valor;
                  const contenido = celdas.get(`${fila.valor}-${columna.valor}`) ?? [];

                  return (
                    <td
                      key={columna.valor}
                      className={cn(
                        "h-20 rounded-md border border-borde/60 p-1 align-top transition-colors",
                        relleno(valor),
                      )}
                    >
                      <span className="block text-right text-[9px] font-semibold opacity-60">
                        {valor}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {contenido.map((ficha) => (
                          <Link
                            key={ficha.id}
                            href={`/riesgos/${ficha.id}`}
                            title={`${ficha.codigo} · ${ficha.titulo}`}
                            className="rounded bg-fondo/85 px-1.5 py-0.5 text-[10px] font-semibold
                                       tabular shadow-sm transition-colors hover:bg-fondo"
                          >
                            {ficha.codigo}
                          </Link>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Referencia del semáforo */}
      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        <span className="font-medium text-atenuado-contraste">{formula}</span>
        {referencia.map((entrada) => (
          <span key={entrada.etiqueta} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded", entrada.clase)} />
            {entrada.etiqueta} ({entrada.rango})
          </span>
        ))}
      </div>

      {sinUbicar.length > 0 ? (
        <p className="text-[11px] text-semaforo-medio">
          {sinUbicar.length} sin evaluar, así que no entran en la matriz:{" "}
          {sinUbicar.map((ficha) => ficha.codigo).join(", ")}.
        </p>
      ) : null}
    </div>
  );
}

/** Matriz de riesgos: probabilidad × severidad. */
export function MatrizRiesgos({
  riesgos,
}: {
  riesgos: {
    id: string;
    codigo: string;
    titulo: string;
    probabilidad: number | null;
    severidad: number | null;
  }[];
}) {
  return (
    <Matriz
      fichas={riesgos.map((riesgo) => ({
        id: riesgo.id,
        codigo: riesgo.codigo,
        titulo: riesgo.titulo,
        fila: riesgo.probabilidad,
        columna: riesgo.severidad,
      }))}
      escalaFilas={ESCALA_PROBABILIDAD}
      escalaColumnas={ESCALA_SEVERIDAD}
      rotuloFilas="probabilidad"
      rotuloColumnas="severidad"
      formula="Nivel = Probabilidad × Severidad"
      relleno={(valor) => RELLENO_NIVEL_RIESGO[etiquetaNivelRiesgo(valor)!]}
      referencia={(
        [
          ["bajo", "1 a 4"],
          ["medio", "5 a 9"],
          ["alto", "10 a 14"],
          ["critico", "15 a 25"],
        ] as const
      ).map(([clave, rango]) => ({
        etiqueta: ETIQUETAS_NIVEL_RIESGO[clave],
        rango,
        clase: RELLENO_NIVEL_RIESGO[clave],
      }))}
    />
  );
}

/**
 * Matriz de oportunidades: beneficio × factibilidad.
 *
 * NO ES LA MISMA MATRIZ CON OTROS REGISTROS. Hasta hoy la pantalla le
 * pasaba a las oportunidades la matriz de riesgos, que ubica cada ficha
 * por `probabilidad` y `severidad`: columnas que una oportunidad tiene
 * en null, porque se evalúa con `beneficio` y `factibilidad`. El
 * resultado era una cuadrícula correcta y vacía, con las once
 * oportunidades cargadas afuera.
 */
export function MatrizOportunidades({
  oportunidades,
}: {
  oportunidades: {
    id: string;
    codigo: string;
    titulo: string;
    beneficio: number | null;
    factibilidad: number | null;
  }[];
}) {
  return (
    <Matriz
      fichas={oportunidades.map((oportunidad) => ({
        id: oportunidad.id,
        codigo: oportunidad.codigo,
        titulo: oportunidad.titulo,
        fila: oportunidad.beneficio,
        columna: oportunidad.factibilidad,
      }))}
      escalaFilas={ESCALA_BENEFICIO}
      escalaColumnas={ESCALA_FACTIBILIDAD}
      rotuloFilas="beneficio"
      rotuloColumnas="factibilidad"
      formula="Índice = Beneficio × Factibilidad"
      relleno={(valor) => RELLENO_PRIORIDAD_OPORTUNIDAD[prioridadOportunidad(valor)!]}
      referencia={(
        [
          ["alta", "15 a 25"],
          ["media", "7 a 14"],
          ["baja", "1 a 6"],
        ] as const
      ).map(([clave, rango]) => ({
        etiqueta: `Prioridad ${clave}`,
        rango,
        clase: RELLENO_PRIORIDAD_OPORTUNIDAD[clave],
      }))}
    />
  );
}
