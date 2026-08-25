"use client";

import * as React from "react";
import { formatearMes, formatearNumero } from "@/lib/formato";

export interface PuntoTendencia {
  periodo: string;
  valor: number;
  meta: number | null;
  cumple: boolean | null;
}

/**
 * Tendencia de un indicador: una sola serie (el valor real) contra la meta,
 * que se dibuja como linea de referencia y no como segunda serie.
 *
 * Decisiones de lectura:
 *  · Un unico eje. Nunca dos escalas: la meta y el valor comparten unidad.
 *  · La meta va en gris neutro y con trazo discontinuo porque es un umbral,
 *    no una identidad; el color queda reservado para el dato.
 *  · Se rotula solo el ultimo punto. Un numero sobre cada punto no se lee.
 *  · Los colores salen de las variables del tema, de modo que el grafico
 *    funciona igual en modo claro y en oscuro.
 */
export function GraficoTendencia({
  puntos,
  unidad,
  altura = 260,
}: {
  puntos: PuntoTendencia[];
  unidad: string;
  altura?: number;
}) {
  const [activo, definirActivo] = React.useState<number | null>(null);

  if (puntos.length === 0) {
    return (
      <p className="py-10 text-center text-xs text-atenuado-contraste">
        Todavía no hay mediciones cargadas para este indicador.
      </p>
    );
  }

  const ANCHO = 720;
  const MARGEN = { arriba: 18, derecha: 74, abajo: 34, izquierda: 48 };
  const anchoUtil = ANCHO - MARGEN.izquierda - MARGEN.derecha;
  const altoUtil = altura - MARGEN.arriba - MARGEN.abajo;

  const valores = puntos.map((punto) => punto.valor);
  const metas = puntos.map((punto) => punto.meta).filter((meta): meta is number => meta !== null);
  const todos = [...valores, ...metas];

  const crudoMin = Math.min(...todos);
  const crudoMax = Math.max(...todos);
  const margen = (crudoMax - crudoMin) * 0.2 || Math.max(Math.abs(crudoMax) * 0.2, 1);

  // Escala redondeada a valores limpios, para que las marcas del eje se lean.
  const paso = calcularPaso(crudoMax + margen - Math.max(0, crudoMin - margen));
  const minimo = Math.max(0, Math.floor((crudoMin - margen) / paso) * paso);
  const maximo = Math.ceil((crudoMax + margen) / paso) * paso;
  const rango = maximo - minimo || 1;

  const x = (indice: number) =>
    MARGEN.izquierda +
    (puntos.length === 1 ? anchoUtil / 2 : (indice / (puntos.length - 1)) * anchoUtil);
  const y = (valor: number) =>
    MARGEN.arriba + altoUtil - ((valor - minimo) / rango) * altoUtil;

  const marcas: number[] = [];
  for (let valor = minimo; valor <= maximo + 0.0001; valor += paso) marcas.push(valor);

  // Si el paso es menor que uno, las marcas necesitan decimales: redondear
  // a entero repetiria el mismo numero en filas contiguas.
  const decimalesEje = paso < 0.1 ? 2 : paso < 1 ? 1 : 0;

  const linea = puntos.map((punto, indice) => `${x(indice)},${y(punto.valor)}`).join(" ");
  const area =
    `${MARGEN.izquierda},${MARGEN.arriba + altoUtil} ` +
    linea +
    ` ${x(puntos.length - 1)},${MARGEN.arriba + altoUtil}`;

  const metaVigente = puntos[puntos.length - 1]?.meta ?? metas[metas.length - 1] ?? null;
  const ultimo = puntos[puntos.length - 1];
  const seleccionado = activo !== null ? puntos[activo] : null;

  return (
    <div className="w-full">
      {/* Referencia: con dos trazos distintos, la leyenda es obligatoria. */}
      <div className="mb-2 flex flex-wrap items-center gap-4 text-[11px] text-atenuado-contraste">
        <span className="flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden="true">
            <line
              x1="1" y1="4" x2="17" y2="4"
              stroke="hsl(var(--primario))" strokeWidth="2" strokeLinecap="round"
            />
          </svg>
          Valor real
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden="true">
            <line
              x1="1" y1="4" x2="17" y2="4"
              stroke="hsl(var(--atenuado-contraste))" strokeWidth="2"
              strokeDasharray="4 3" strokeLinecap="round"
            />
          </svg>
          Meta
        </span>
      </div>

      <div className="relative w-full overflow-x-auto">
        <svg
          viewBox={`0 0 ${ANCHO} ${altura}`}
          className="h-auto w-full min-w-[32rem]"
          role="img"
          aria-label={`Tendencia del indicador en ${unidad}, ${puntos.length} períodos medidos.`}
          onMouseLeave={() => definirActivo(null)}
        >
          {/* Cuadricula: fina, continua y discreta */}
          {marcas.map((marca) => (
            <g key={marca}>
              <line
                x1={MARGEN.izquierda}
                y1={y(marca)}
                x2={ANCHO - MARGEN.derecha}
                y2={y(marca)}
                stroke="hsl(var(--borde))"
                strokeWidth="1"
              />
              <text
                x={MARGEN.izquierda - 8}
                y={y(marca) + 3.5}
                textAnchor="end"
                className="fill-[hsl(var(--atenuado-contraste))] text-[10px]"
              >
                {formatearNumero(marca, decimalesEje)}
              </text>
            </g>
          ))}

          {/* Meta: umbral, no serie */}
          {metaVigente !== null ? (
            <>
              <line
                x1={MARGEN.izquierda}
                y1={y(metaVigente)}
                x2={ANCHO - MARGEN.derecha}
                y2={y(metaVigente)}
                stroke="hsl(var(--atenuado-contraste))"
                strokeWidth="2"
                strokeDasharray="4 3"
                strokeLinecap="round"
              />
              <text
                x={ANCHO - MARGEN.derecha + 8}
                y={y(metaVigente) + 3.5}
                className="fill-[hsl(var(--atenuado-contraste))] text-[10px] font-medium"
              >
                Meta {formatearNumero(metaVigente, decimalesEje)}
              </text>
            </>
          ) : null}

          <polygon points={area} fill="hsl(var(--primario))" opacity="0.1" />

          <polyline
            points={linea}
            fill="none"
            stroke="hsl(var(--primario))"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />

          {/* Puntos con anillo del color de la superficie, para que no se pisen */}
          {puntos.map((punto, indice) => (
            <g key={punto.periodo}>
              <circle
                cx={x(indice)}
                cy={y(punto.valor)}
                r={activo === indice ? 5.5 : 4}
                fill="hsl(var(--primario))"
                stroke="hsl(var(--tarjeta))"
                strokeWidth="2"
              />
              {/* Area de contacto mas generosa que el punto */}
              <rect
                x={x(indice) - anchoUtil / Math.max(puntos.length, 1) / 2}
                y={MARGEN.arriba}
                width={anchoUtil / Math.max(puntos.length, 1)}
                height={altoUtil}
                fill="transparent"
                onMouseEnter={() => definirActivo(indice)}
              />
            </g>
          ))}

          {/* Se rotula solo el ultimo valor */}
          {ultimo ? (
            <text
              x={x(puntos.length - 1) + 10}
              y={y(ultimo.valor) - 8}
              className="fill-[hsl(var(--texto))] text-[11px] font-semibold"
            >
              {formatearNumero(ultimo.valor, 1)}
            </text>
          ) : null}

          {/* Eje horizontal: primero, medio y ultimo periodo */}
          {puntos.map((punto, indice) => {
            const mostrar =
              indice === 0 ||
              indice === puntos.length - 1 ||
              indice === Math.floor((puntos.length - 1) / 2);
            if (!mostrar) return null;
            return (
              <text
                key={`eje-${punto.periodo}`}
                x={x(indice)}
                y={altura - 12}
                textAnchor={indice === 0 ? "start" : indice === puntos.length - 1 ? "end" : "middle"}
                className="fill-[hsl(var(--atenuado-contraste))] text-[10px]"
              >
                {formatearMes(punto.periodo)}
              </text>
            );
          })}
        </svg>

        {/* Detalle del punto señalado */}
        {seleccionado ? (
          <div
            className="pointer-events-none absolute left-1/2 top-1 -translate-x-1/2 rounded-md
                       border border-borde bg-emergente px-3 py-2 text-[11px] shadow-lg"
          >
            <p className="font-semibold">{formatearMes(seleccionado.periodo)}</p>
            <p className="mt-0.5">
              Real: <span className="font-medium">{formatearNumero(seleccionado.valor)} {unidad}</span>
            </p>
            {seleccionado.meta !== null ? (
              <p>
                Meta: <span className="font-medium">{formatearNumero(seleccionado.meta)} {unidad}</span>
              </p>
            ) : null}
            {seleccionado.cumple !== null ? (
              <p
                className={
                  seleccionado.cumple ? "mt-0.5 text-semaforo-bajo" : "mt-0.5 text-semaforo-critico"
                }
              >
                {seleccionado.cumple ? "En meta" : "Fuera de meta"}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Paso de la escala redondeado a 1, 2 o 5 por potencia de diez. */
function calcularPaso(rango: number): number {
  const bruto = rango / 4;
  const magnitud = Math.pow(10, Math.floor(Math.log10(Math.max(bruto, 1e-6))));
  const normalizado = bruto / magnitud;
  const escalon = normalizado <= 1 ? 1 : normalizado <= 2 ? 2 : normalizado <= 5 ? 5 : 10;
  return escalon * magnitud;
}
