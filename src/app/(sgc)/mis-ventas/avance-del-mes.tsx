import {
  alcance,
  CLASES_NIVEL_ALCANCE,
  COLOR_NIVEL_ALCANCE,
  ETIQUETAS_NIVEL_ALCANCE,
  esperadoAHoy,
  faltante,
  nivelDeAlcance,
  nombreDeMes,
  ritmoNecesario,
  type VentaDelMes,
} from "@/lib/ventas";
import { formatearGuaranies } from "@/lib/formato";
import { Tarjeta } from "@/components/ui/tarjeta";
import { cn } from "@/lib/utilidades";

/**
 * El mes en curso, en cuatro tarjetas.
 *
 * Es la fila de arriba de la pantalla: el comercial entra, mira y sabe
 * si va bien. Cada tarjeta contesta una pregunta distinta y ninguna
 * repite a otra: cuanto vendi, cuanto tengo que vender, como voy contra
 * el calendario, y a cuanto por dia tengo que ir de aca al cierre.
 *
 * LA TERCERA ES LA QUE IMPORTA A MITAD DE MES. Un 50% el dia 10 esta
 * bien y el dia 25 esta mal, y el alcance solo no distingue los dos
 * casos; «adelantado» o «atrasado» contra lo que tocaba a hoy, si.
 *
 * La barra se corta en 100 aunque el alcance sea mayor: si alguien hizo
 * el 180%, estirarla al 180 achicaria visualmente la meta y se perderia
 * la referencia. El numero al lado dice el 180.
 *
 * Sin objetivo cargado, las tres ultimas lo dicen en palabras en vez de
 * mostrar un numero inventado. Pasa de verdad: el informe comercial
 * archiva los objetivos del mes en curso y no siempre los anteriores.
 */
export function AvanceDelMes({
  fila,
  diasMes,
  diasTranscurridos,
}: {
  fila: VentaDelMes;
  diasMes: number;
  diasTranscurridos: number;
}) {
  const porcentaje = alcance(fila.meta, fila.venta);
  const nivel = nivelDeAlcance(porcentaje);
  const falta = faltante(fila.meta, fila.venta);
  const ancho = porcentaje === null ? 0 : Math.max(0, Math.min(porcentaje, 100));

  const esperado = esperadoAHoy(fila.meta, diasMes, diasTranscurridos);
  const ritmo = ritmoNecesario(fila.meta, fila.venta, diasMes, diasTranscurridos);
  const diasRestantes = diasMes - diasTranscurridos;

  const contraHoy = esperado === null || fila.venta === null ? null : fila.venta - esperado;

  // La marca del esperado en la barra. Se corta en 100 como la barra: si
  // el mes casi termino, la referencia queda al final y no se sale.
  const marcaEsperado =
    esperado === null || fila.meta === null || fila.meta <= 0
      ? null
      : Math.max(0, Math.min((esperado / fila.meta) * 100, 100));

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {/* 1 · Lo vendido, con la barra contra el objetivo. */}
      <Tarjeta className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
          Vendido en el mes
        </p>
        <p className="mt-1.5 text-2xl font-semibold leading-none tabular">
          {fila.venta === null ? "—" : formatearGuaranies(fila.venta)}
        </p>

        <div
          className="relative mt-3 h-2 w-full overflow-hidden rounded-full bg-acento"
          role="progressbar"
          aria-valuenow={porcentaje === null ? 0 : Math.round(porcentaje)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`Avance de ${nombreDeMes(fila.mes)}`}
        >
          <div
            className="h-full rounded-full"
            style={{ width: `${ancho}%`, backgroundColor: COLOR_NIVEL_ALCANCE[nivel] }}
          />

          {/* Donde tendria que estar hoy. Es un UMBRAL, no una serie: va
              en gris neutro y el color queda para el dato, igual que la
              meta en los graficos del SGC. */}
          {marcaEsperado === null ? null : (
            <span
              aria-hidden
              className="absolute inset-y-0 w-0.5 bg-atenuado-contraste"
              style={{ left: `${marcaEsperado}%` }}
            />
          )}
        </div>

        <p className="mt-2 text-[11px] text-atenuado-contraste">
          {porcentaje === null ? (
            <span className={CLASES_NIVEL_ALCANCE[nivel]}>
              {ETIQUETAS_NIVEL_ALCANCE[nivel]}
            </span>
          ) : (
            <>
              <span className={cn("font-semibold", CLASES_NIVEL_ALCANCE[nivel])}>
                {Math.round(porcentaje)} % del objetivo
              </span>
              {diasRestantes > 0
                ? ` · quedan ${formatearDias(diasRestantes)} días hábiles`
                : " · mes cerrado"}
            </>
          )}
        </p>
      </Tarjeta>

      {/* 2 · El objetivo y lo que falta. */}
      <Tarjeta className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
          Objetivo del mes
        </p>
        <p className="mt-1.5 text-2xl font-semibold leading-none tabular">
          {fila.meta === null ? "Sin cargar" : formatearGuaranies(fila.meta)}
        </p>
        <p className="mt-3 text-[11px] text-atenuado-contraste">
          {falta === null ? (
            "El informe comercial no archivó el objetivo de este mes."
          ) : falta <= 0 ? (
            <>
              Superó la meta en{" "}
              <span className="font-semibold text-semaforo-bajo">
                {formatearGuaranies(Math.abs(falta))}
              </span>
            </>
          ) : (
            <>Faltan {formatearGuaranies(falta)}</>
          )}
        </p>
      </Tarjeta>

      {/* 3 · Contra el calendario, no contra el total. */}
      <Tarjeta className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
          Contra lo que tocaba a hoy
        </p>
        <p
          className={cn(
            "mt-1.5 text-2xl font-semibold leading-none tabular",
            contraHoy === null
              ? ""
              : contraHoy >= 0
                ? "text-semaforo-bajo"
                : "text-semaforo-critico",
          )}
        >
          {contraHoy === null
            ? "—"
            : `${contraHoy >= 0 ? "+" : "−"} ${formatearGuaranies(Math.abs(contraHoy))}`}
        </p>
        <p className="mt-3 text-[11px] text-atenuado-contraste">
          {contraHoy === null ? (
            "Sin objetivo cargado no hay con qué comparar."
          ) : (
            <>
              {contraHoy >= 0 ? "Adelantado" : "Atrasado"}. A hoy tendría que llevar{" "}
              {formatearGuaranies(esperado ?? 0)}
            </>
          )}
        </p>
      </Tarjeta>

      {/* 4 · Lo unico accionable: cuanto por dia de aca al cierre. */}
      <Tarjeta className="p-4">
        <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
          Para llegar, por día hábil
        </p>
        <p className="mt-1.5 text-2xl font-semibold leading-none tabular">
          {ritmo === null ? "—" : formatearGuaranies(ritmo)}
        </p>
        <p className="mt-3 text-[11px] text-atenuado-contraste">
          {ritmo !== null ? (
            <>
              Quedan {formatearDias(diasRestantes)} de {formatearDias(diasMes)} días hábiles
            </>
          ) : falta !== null && falta <= 0 ? (
            <span className="font-semibold text-semaforo-bajo">Objetivo alcanzado</span>
          ) : diasRestantes <= 0 ? (
            "El mes ya cerró: no hay ritmo que recomendar."
          ) : (
            "Sin objetivo cargado no hay ritmo que calcular."
          )}
        </p>
      </Tarjeta>

      {/* Las notas de credito explican una caida: un mes flojo por poca
          venta y uno flojo por una devolucion grande no se arreglan
          igual. Ocupa la fila entera porque es una aclaracion del
          numero de arriba, no un indicador mas. */}
      {fila.devoluciones < 0 ? (
        <p className="text-[11px] leading-relaxed text-atenuado-contraste sm:col-span-2 xl:col-span-4">
          Lo vendido ya tiene descontados {formatearGuaranies(Math.abs(fila.devoluciones))} en
          notas de crédito de {nombreDeMes(fila.mes)}.
        </p>
      ) : null}
    </div>
  );
}

/** Los días hábiles llevan medio día el sábado: `21,5`, no `21.5`. */
function formatearDias(dias: number): string {
  return Number.isInteger(dias) ? String(dias) : dias.toFixed(1).replace(".", ",");
}
