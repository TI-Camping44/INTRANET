"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { reabrirNoConformidad } from "@/app/(sgc)/no-conformidades/acciones";
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
  fechaCierre,
}: {
  noConformidadId: string;
  paso: PasoNoConformidad;
  puedeCerrar: boolean;
  tieneAccion: boolean;
  /** Qué cierre corresponde según las fechas, y en cuántos días llegó la AC. */
  fechaCierre: string | null;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState<PasoNoConformidad | "reabrir" | null>(
    null,
  );

  const indiceActual = PASOS_NO_CONFORMIDAD.indexOf(paso);
  const cerrada = paso === "cerrado_en_plazo" || paso === "cerrado_fuera_de_plazo";

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
                {/* Sin numerar: el «4» de «Cerrado fuera de plazo» se leia
                    como un cuarto paso que hay que recorrer, y los dos
                    cierres son alternativos, no consecutivos. */}
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
      ) : (
        /* EL CIERRE YA NO SE ELIGE. La desviación se cierra sola cuando
           todas sus acciones correctivas están ejecutadas, y queda «en
           plazo» o «fuera de plazo» según se hayan ejecutado dentro de su
           fecha o no. Lo decide un disparador de la base, así que vale
           igual se cierre la acción desde donde se cierre. */
        <p className="mt-3 text-[11px] leading-relaxed text-atenuado-contraste">
          {tieneAccion
            ? "Se cierra sola cuando todas las acciones correctivas estén ejecutadas: en plazo si todas se ejecutaron dentro de su fecha, fuera de plazo si alguna se pasó."
            : "Todavía no tiene acciones correctivas. Se cierra sola cuando todas las que se carguen estén ejecutadas."}
        </p>
      )}
    </div>
  );
}
