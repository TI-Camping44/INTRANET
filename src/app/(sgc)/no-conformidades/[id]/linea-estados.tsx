"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { cerrarNoConformidad, reabrirNoConformidad } from "@/app/(sgc)/no-conformidades/acciones";
import {
  CLASES_PASO_NC,
  ETIQUETAS_PASO_NC,
  PASOS_NO_CONFORMIDAD,
  type PasoNoConformidad,
} from "@/lib/no-conformidades";
import { formatearFecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";

/**
 * La línea de estados de la no conformidad.
 *
 * Cuatro pasos en horizontal, con el actual resaltado. Los dos primeros
 * son automáticos y por eso no se pueden tocar: se abre al registrarla y
 * pasa a proceso cuando se le carga la primera acción correctiva.
 *
 * Los dos cierres son botones, y son excluyentes: se cierra en plazo o
 * fuera de plazo, nunca las dos cosas. El sistema marca cuál corresponde
 * según las fechas —«Sugerido»— pero no elige por la persona: puede
 * haber una razón que el sistema no conoce, y en una auditoría lo que
 * vale es que alguien lo haya decidido y quede registrado.
 *
 * Sin acción correctiva cargada los dos botones están apagados, con el
 * motivo escrito. Es la regla de Calidad: no se cierra una desviación
 * que no tiene acción.
 */
export function LineaEstados({
  noConformidadId,
  paso,
  puedeCerrar,
  tieneAccion,
  sugerencia,
  fechaCierre,
}: {
  noConformidadId: string;
  paso: PasoNoConformidad;
  puedeCerrar: boolean;
  tieneAccion: boolean;
  /** Qué cierre corresponde según las fechas, y en cuántos días llegó la AC. */
  sugerencia: { enPlazo: boolean; dias: number } | null;
  fechaCierre: string | null;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState<PasoNoConformidad | "reabrir" | null>(
    null,
  );

  const indiceActual = PASOS_NO_CONFORMIDAD.indexOf(paso);
  const cerrada = paso === "cerrado_en_plazo" || paso === "cerrado_fuera_de_plazo";

  async function cerrar(enPlazo: boolean) {
    const aviso = enPlazo
      ? "Se cierra la no conformidad como CERRADA EN PLAZO."
      : "Se cierra la no conformidad como CERRADA FUERA DE PLAZO.";

    if (sugerencia && sugerencia.enPlazo !== enPlazo) {
      const contrario = sugerencia.enPlazo ? "en plazo" : "fuera de plazo";
      if (
        !confirm(
          `${aviso}\n\nPor las fechas correspondería «${contrario}»: la acción correctiva ` +
            `se cargó a los ${sugerencia.dias} días de la detección.\n\n¿Cerrar igual?`,
        )
      ) {
        return;
      }
    }

    definirProcesando(enPlazo ? "cerrado_en_plazo" : "cerrado_fuera_de_plazo");
    const resultado = await cerrarNoConformidad(noConformidadId, enPlazo);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "No conformidad cerrada.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
    definirProcesando(null);
  }

  async function reabrir() {
    if (
      !confirm(
        "Se reabre la no conformidad y se borra la fecha de cierre.\n\n" +
          "Vuelve al estado que le corresponda según sus acciones correctivas. ¿Continuar?",
      )
    ) {
      return;
    }

    definirProcesando("reabrir");
    const resultado = await reabrirNoConformidad(noConformidadId);
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "No conformidad reabierta.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
    definirProcesando(null);
  }

  return (
    <div>
      {/* La línea. En pantalla chica se apila: cuatro rótulos en
          horizontal a 360 px no entran sin cortar las palabras. */}
      <ol className="flex flex-col gap-1.5 sm:flex-row sm:items-stretch sm:gap-1">
        {PASOS_NO_CONFORMIDAD.map((suyo, indice) => {
          const esActual = suyo === paso;
          // Los dos cierres son alternativos: si se cerró en plazo, el
          // otro no es un paso pendiente, es un camino que no se tomó.
          const esOtroCierre = cerrada && indice >= 2 && !esActual;
          const alcanzado = indice < indiceActual && !esOtroCierre;

          return (
            <li key={suyo} className="flex-1">
              <div
                className={cn(
                  "flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium",
                  esActual && CLASES_PASO_NC[suyo],
                  !esActual && alcanzado && "bg-acento text-texto",
                  !esActual && !alcanzado && "bg-acento/40 text-atenuado-contraste",
                  esOtroCierre && "opacity-40",
                )}
              >
                {alcanzado ? <Check className="size-3 shrink-0" /> : null}
                <span className="tabular opacity-70">{indice + 1}</span>
                <span className="truncate">{ETIQUETAS_PASO_NC[suyo]}</span>
              </div>
            </li>
          );
        })}
      </ol>

      {cerrada ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <p className="text-[11px] text-atenuado-contraste">
            Cerrada el {formatearFecha(fechaCierre)}.
          </p>
          {puedeCerrar ? (
            <Boton
              variante="contorno"
              tamano="pequeno"
              cargando={procesando === "reabrir"}
              onClick={reabrir}
            >
              Reabrir
            </Boton>
          ) : null}
        </div>
      ) : puedeCerrar ? (
        <div className="mt-3">
          <p className="mb-2 text-[11px] text-atenuado-contraste">
            {tieneAccion
              ? sugerencia
                ? `La acción correctiva se cargó a los ${sugerencia.dias} ${
                    sugerencia.dias === 1 ? "día" : "días"
                  } de la detección: correspondería cerrar ${
                    sugerencia.enPlazo ? "en plazo" : "fuera de plazo"
                  }.`
                : "Elija cómo se cierra."
              : "Para cerrarla hace falta al menos una acción correctiva cargada."}
          </p>
          <div className="flex flex-wrap gap-2">
            <Boton
              tamano="pequeno"
              variante="contorno"
              disabled={!tieneAccion || procesando !== null}
              cargando={procesando === "cerrado_en_plazo"}
              onClick={() => cerrar(true)}
              className={cn(
                "border-semaforo-bajo/40 text-semaforo-bajo hover:bg-semaforo-bajo/10",
                sugerencia?.enPlazo === true && "ring-1 ring-semaforo-bajo",
              )}
            >
              Cerrar en plazo
            </Boton>
            <Boton
              tamano="pequeno"
              variante="contorno"
              disabled={!tieneAccion || procesando !== null}
              cargando={procesando === "cerrado_fuera_de_plazo"}
              onClick={() => cerrar(false)}
              className={cn(sugerencia?.enPlazo === false && "ring-1 ring-atenuado-contraste")}
            >
              Cerrar fuera de plazo
            </Boton>
          </div>
        </div>
      ) : null}
    </div>
  );
}
