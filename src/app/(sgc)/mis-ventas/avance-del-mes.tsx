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
 * El mes en curso, que es lo que el comercial viene a ver.
 *
 * Una barra y tres números, sin gráfico. Un gráfico compara series; acá
 * hay un solo dato contra un solo umbral, y una barra lo dice más rápido
 * que cualquier dibujo.
 *
 * La barra se corta en 100 aunque el alcance sea mayor: si alguien hizo
 * el 180%, estirarla al 180 achicaría visualmente la meta y se perdería
 * la referencia. El número al lado dice el 180.
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

  // Adelantado o atrasado contra lo que tocaba a hoy. Es distinto del
  // alcance: al dia 10 nadie va a estar al 100%, y lo que importa es si
  // va al ritmo o no.
  const contraHoy =
    esperado === null || fila.venta === null ? null : fila.venta - esperado;

  // La marca del esperado en la barra. Se corta en 100 como la barra: si
  // el mes casi termino, la referencia queda al final y no se sale.
  const marcaEsperado =
    esperado === null || fila.meta === null || fila.meta <= 0
      ? null
      : Math.max(0, Math.min((esperado / fila.meta) * 100, 100));

  return (
    <Tarjeta className="p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-medium text-atenuado-contraste">
          {nombreDeMes(fila.mes)} {fila.anio} · {fila.canal}
        </p>
        <p className={cn("text-xs font-semibold", CLASES_NIVEL_ALCANCE[nivel])}>
          {ETIQUETAS_NIVEL_ALCANCE[nivel]}
        </p>
      </div>

      <p className="mt-3 flex flex-wrap items-baseline gap-2">
        <span className="text-3xl font-semibold tabular leading-none">
          {porcentaje === null ? "—" : `${Math.round(porcentaje)}%`}
        </span>
        <span className="text-xs text-atenuado-contraste">de su objetivo del mes</span>
      </p>

      {/* La barra. `aria-*` para que un lector de pantalla diga el valor,
          que si no es un rectángulo de color sin significado. */}
      <div
        className="relative mt-3 h-2.5 w-full overflow-hidden rounded-full bg-acento"
        role="progressbar"
        aria-valuenow={porcentaje === null ? 0 : Math.round(porcentaje)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`Avance de ${nombreDeMes(fila.mes)}`}
      >
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${ancho}%`, backgroundColor: COLOR_NIVEL_ALCANCE[nivel] }}
        />

        {/* Donde tendria que estar hoy. Es un UMBRAL, no una serie: va en
            gris neutro y el color queda para el dato, igual que la meta en
            los graficos del SGC. */}
        {marcaEsperado === null ? null : (
          <span
            aria-hidden
            className="absolute inset-y-0 w-0.5 bg-atenuado-contraste"
            style={{ left: `${marcaEsperado}%` }}
          />
        )}
      </div>

      <dl className="mt-4 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="text-[11px] text-atenuado-contraste">Vendido</dt>
          <dd className="text-sm font-semibold tabular">
            {fila.venta === null ? "—" : formatearGuaranies(fila.venta)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-atenuado-contraste">Objetivo</dt>
          <dd className="text-sm font-semibold tabular">
            {fila.meta === null ? "Sin cargar" : formatearGuaranies(fila.meta)}
          </dd>
        </div>
        <div>
          <dt className="text-[11px] text-atenuado-contraste">
            {falta !== null && falta < 0 ? "Superó la meta en" : "Falta"}
          </dt>
          <dd className="text-sm font-semibold tabular">
            {falta === null ? "—" : formatearGuaranies(Math.abs(falta))}
          </dd>
        </div>
      </dl>

      {/* Lo unico que la persona puede accionar: a cuanto por dia tiene
          que ir de aca al cierre. Sin meta cargada no se muestra nada
          antes que mostrar un numero inventado. */}
      {ritmo === null ? null : (
        <div className="mt-4 rounded-md border border-borde bg-acento/40 p-3">
          <p className="text-[11px] text-atenuado-contraste">
            Para llegar al objetivo, facturar por día hábil
          </p>
          <p className="mt-0.5 text-lg font-semibold tabular leading-none">
            {formatearGuaranies(ritmo)}
          </p>
          <p className="mt-1 text-[11px] text-atenuado-contraste">
            Quedan {formatearDias(diasRestantes)} de {formatearDias(diasMes)} días hábiles.
          </p>
        </div>
      )}

      {contraHoy === null ? null : (
        <p className="mt-3 text-[11px] leading-relaxed text-atenuado-contraste">
          A hoy tendría que llevar {formatearGuaranies(esperado ?? 0)}:{" "}
          <span
            className={cn(
              "font-semibold",
              contraHoy >= 0 ? "text-semaforo-bajo" : "text-semaforo-critico",
            )}
          >
            {contraHoy >= 0 ? "adelantado" : "atrasado"} {formatearGuaranies(Math.abs(contraHoy))}
          </span>
          .
        </p>
      )}

      {fila.devoluciones < 0 ? (
        <p className="mt-2 text-[11px] leading-relaxed text-atenuado-contraste">
          Incluye {formatearGuaranies(Math.abs(fila.devoluciones))} en notas de crédito, ya
          descontados de lo vendido.
        </p>
      ) : null}
    </Tarjeta>
  );
}

/** Los días hábiles llevan medio día el sábado: `21,5`, no `21.5`. */
function formatearDias(dias: number): string {
  return Number.isInteger(dias) ? String(dias) : dias.toFixed(1).replace(".", ",");
}
