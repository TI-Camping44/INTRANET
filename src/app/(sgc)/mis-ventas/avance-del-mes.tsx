import {
  alcance,
  CLASES_NIVEL_ALCANCE,
  COLOR_NIVEL_ALCANCE,
  ETIQUETAS_NIVEL_ALCANCE,
  faltante,
  nivelDeAlcance,
  nombreDeMes,
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
export function AvanceDelMes({ fila }: { fila: VentaDelMes }) {
  const porcentaje = alcance(fila.meta, fila.venta);
  const nivel = nivelDeAlcance(porcentaje);
  const falta = faltante(fila.meta, fila.venta);
  const ancho = porcentaje === null ? 0 : Math.max(0, Math.min(porcentaje, 100));

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
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-acento"
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
    </Tarjeta>
  );
}
