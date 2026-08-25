"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { cn } from "@/lib/utilidades";
import { hoyEnAsuncion } from "@/lib/formato";

export interface MantenimientoAgendado {
  id: string;
  activo_id: string;
  tipo: string;
  estado: string;
  fecha_programada: string;
  descripcion: string | null;
  activo_codigo: string;
  activo_nombre: string;
}

const DIAS = ["lun", "mar", "mié", "jue", "vie", "sáb", "dom"];
const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

/**
 * Calendario mensual de mantenimientos programados.
 *
 * Se arma con aritmetica de fechas sobre cadenas "aaaa-mm-dd" y no con
 * objetos Date en zona local: las fechas de la base son fechas sin hora y
 * convertirlas correria el dia en Asuncion.
 */
export function CalendarioMantenimientos({
  mantenimientos,
}: {
  mantenimientos: MantenimientoAgendado[];
}) {
  const hoy = hoyEnAsuncion();

  // Se abre en el mes corriente, salvo que no tenga nada agendado: en ese
  // caso conviene mostrar el mes del proximo mantenimiento, para que el
  // calendario no aparezca vacio al entrar.
  const mesInicial = React.useMemo(() => {
    const corriente = hoy.slice(0, 7);
    if (mantenimientos.some((m) => m.fecha_programada.startsWith(corriente))) return corriente;

    const proximo = mantenimientos
      .filter((m) => m.fecha_programada >= hoy)
      .map((m) => m.fecha_programada)
      .sort()[0];

    return (proximo ?? hoy).slice(0, 7);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mantenimientos]);

  const [anio, definirAnio] = React.useState(Number(mesInicial.slice(0, 4)));
  const [mes, definirMes] = React.useState(Number(mesInicial.slice(5, 7)) - 1);

  const porDia = React.useMemo(() => {
    const mapa = new Map<string, MantenimientoAgendado[]>();
    for (const mantenimiento of mantenimientos) {
      const clave = mantenimiento.fecha_programada.slice(0, 10);
      mapa.set(clave, [...(mapa.get(clave) ?? []), mantenimiento]);
    }
    return mapa;
  }, [mantenimientos]);

  const primerDia = new Date(Date.UTC(anio, mes, 1));
  const diasEnMes = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
  // getUTCDay(): 0 es domingo. La semana arranca en lunes.
  const desplazamiento = (primerDia.getUTCDay() + 6) % 7;

  const celdas: (string | null)[] = [
    ...Array.from({ length: desplazamiento }, () => null),
    ...Array.from(
      { length: diasEnMes },
      (_, indice) =>
        `${anio}-${String(mes + 1).padStart(2, "0")}-${String(indice + 1).padStart(2, "0")}`,
    ),
  ];
  while (celdas.length % 7 !== 0) celdas.push(null);

  function mover(direccion: number) {
    const nuevo = mes + direccion;
    if (nuevo < 0) {
      definirMes(11);
      definirAnio(anio - 1);
    } else if (nuevo > 11) {
      definirMes(0);
      definirAnio(anio + 1);
    } else {
      definirMes(nuevo);
    }
  }

  const delMes = mantenimientos.filter((mantenimiento) =>
    mantenimiento.fecha_programada.startsWith(
      `${anio}-${String(mes + 1).padStart(2, "0")}`,
    ),
  );

  return (
    <div>
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold first-letter:uppercase">
          {MESES[mes]} de {anio}
          <span className="ml-2 font-normal text-atenuado-contraste">
            {delMes.length} mantenimiento{delMes.length === 1 ? "" : "s"}
          </span>
        </p>
        <div className="flex items-center gap-1">
          <Boton
            variante="contorno"
            tamano="iconoPequeno"
            onClick={() => mover(-1)}
            aria-label="Mes anterior"
          >
            <ChevronLeft />
          </Boton>
          <Boton
            variante="contorno"
            tamano="pequeno"
            onClick={() => {
              definirAnio(Number(hoy.slice(0, 4)));
              definirMes(Number(hoy.slice(5, 7)) - 1);
            }}
          >
            Hoy
          </Boton>
          <Boton
            variante="contorno"
            tamano="iconoPequeno"
            onClick={() => mover(1)}
            aria-label="Mes siguiente"
          >
            <ChevronRight />
          </Boton>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[36rem]">
          <div className="grid grid-cols-7 gap-1 pb-1">
            {DIAS.map((dia) => (
              <div
                key={dia}
                className="text-center text-[10px] font-semibold uppercase tracking-wide
                           text-atenuado-contraste"
              >
                {dia}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {celdas.map((fecha, indice) => {
              if (!fecha) return <div key={`vacio-${indice}`} className="min-h-[4.5rem]" />;

              const delDia = porDia.get(fecha) ?? [];
              const esHoy = fecha === hoy;
              const pasado = fecha < hoy;

              return (
                <div
                  key={fecha}
                  className={cn(
                    "min-h-[4.5rem] rounded-md border p-1",
                    esHoy ? "border-primario bg-primario/5" : "border-borde",
                    pasado && !esHoy ? "opacity-70" : "",
                  )}
                >
                  <span
                    className={cn(
                      "block text-right text-[10px] tabular",
                      esHoy ? "font-bold text-primario" : "text-atenuado-contraste",
                    )}
                  >
                    {Number(fecha.slice(8, 10))}
                  </span>

                  <div className="mt-0.5 flex flex-col gap-0.5">
                    {delDia.slice(0, 2).map((mantenimiento) => (
                      <Link
                        key={mantenimiento.id}
                        href={`/activos/${mantenimiento.activo_id}`}
                        title={`${mantenimiento.activo_codigo} · ${mantenimiento.activo_nombre}`}
                        className={cn(
                          "truncate rounded px-1 py-0.5 text-[10px] font-medium transition-colors",
                          mantenimiento.estado === "vencido"
                            ? "bg-semaforo-critico/15 text-semaforo-critico hover:bg-semaforo-critico/25"
                            : mantenimiento.tipo === "correctivo"
                              ? "bg-semaforo-alto/15 text-semaforo-alto hover:bg-semaforo-alto/25"
                              : "bg-primario/10 text-primario hover:bg-primario/20",
                        )}
                      >
                        {mantenimiento.activo_codigo}
                      </Link>
                    ))}
                    {delDia.length > 2 ? (
                      <span className="px-1 text-[10px] text-atenuado-contraste">
                        +{delDia.length - 2} más
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-[11px] text-atenuado-contraste">
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-primario/20" /> Preventivo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-semaforo-alto/25" /> Correctivo
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded bg-semaforo-critico/25" /> Vencido
        </span>
      </div>

      {delMes.length > 0 ? (
        <ul className="mt-4 space-y-1.5 border-t border-borde pt-3">
          {delMes
            .slice()
            .sort((a, b) => a.fecha_programada.localeCompare(b.fecha_programada))
            .map((mantenimiento) => (
              <li key={`lista-${mantenimiento.id}`} className="flex items-start gap-2">
                <span className="w-12 shrink-0 text-[11px] tabular text-atenuado-contraste">
                  {mantenimiento.fecha_programada.slice(8, 10)}/
                  {mantenimiento.fecha_programada.slice(5, 7)}
                </span>
                <Link
                  href={`/activos/${mantenimiento.activo_id}`}
                  className="min-w-0 flex-1 text-[11px] hover:text-primario"
                >
                  <span className="tabular text-atenuado-contraste">
                    {mantenimiento.activo_codigo}
                  </span>{" "}
                  {mantenimiento.activo_nombre}
                  {mantenimiento.descripcion ? (
                    <span className="text-atenuado-contraste"> · {mantenimiento.descripcion}</span>
                  ) : null}
                </Link>
                {mantenimiento.estado === "vencido" ? (
                  <Insignia variante="peligro">Vencido</Insignia>
                ) : null}
              </li>
            ))}
        </ul>
      ) : null}
    </div>
  );
}
