"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import {
  ejecutarAccion,
  reabrirAccion,
  reabrirEficacia,
  verificarEficacia,
} from "@/app/(sgc)/acciones/acciones";
import {
  CLASES_PASO_ACCION,
  ejecucionSugerida,
  ETIQUETAS_PASO_ACCION,
  pasoDeAccion,
  textoDePlazoAccion,
  estaEjecutada,
} from "@/lib/acciones";
import { describirVencimiento, formatearFecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import type { EstadoAccion, ResultadoEficacia } from "@/lib/tipos";

export interface TareaPlan {
  id: string;
  descripcion: string;
  estado: EstadoAccion;
  ejecucion_en_plazo: boolean | null;
  fecha_limite: string;
  fecha_ejecucion: string | null;
  creado_en: string;
  responsable: { nombre_completo: string } | null;
}

/**
 * El plan de la acción correctiva: cada tarea con su cierre.
 *
 * Cada una se cierra a mano, como «ejecutada en plazo» o «ejecutada
 * fuera de plazo». No hay paso automático: que venza la fecha límite no
 * significa que la tarea se haya hecho, solo que venció, y eso ya lo
 * dice la columna de la fecha. Mientras nadie la cierre, la tarea queda
 * abierta y la pantalla cuenta desde cuándo.
 *
 * El sistema sugiere cuál de los dos cierres corresponde comparando el
 * día de hoy contra la fecha límite, pero no decide: quien cierra puede
 * saber que la tarea se ejecutó antes y se registra ahora.
 */
export function PanelAcciones({
  tareas,
  puedeGestionar,
}: {
  tareas: TareaPlan[];
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState<string | null>(null);

  async function cerrar(tarea: TareaPlan, enPlazo: boolean) {
    const sugerido = ejecucionSugerida(tarea.fecha_limite);
    if (sugerido !== enPlazo) {
      const corresponde = sugerido ? "en plazo" : "fuera de plazo";
      if (
        !confirm(
          `Por la fecha límite (${formatearFecha(tarea.fecha_limite)}) correspondería ` +
            `«ejecutada ${corresponde}».\n\n¿Cerrarla igual como la eligió?`,
        )
      ) {
        return;
      }
    }

    definirProcesando(tarea.id);
    const resultado = await ejecutarAccion(tarea.id, enPlazo);
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Acción cerrada.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
    definirProcesando(null);
  }

  async function reabrir(tarea: TareaPlan) {
    definirProcesando(tarea.id);
    const resultado = await reabrirAccion(tarea.id);
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Acción reabierta.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
    definirProcesando(null);
  }

  return (
    <ul className="divide-y divide-borde">
      {tareas.map((tarea, indice) => {
        const paso = pasoDeAccion(tarea.estado, tarea.ejecucion_en_plazo);
        const cerrada = estaEjecutada(tarea.estado);
        const sugerido = ejecucionSugerida(tarea.fecha_limite);

        return (
          <li key={tarea.id} className="py-3 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <p className="min-w-0 flex-1 text-xs leading-relaxed">
                <span className="mr-1.5 tabular text-atenuado-contraste">{indice + 1}.</span>
                {tarea.descripcion}
              </p>
              <Insignia className={cn("shrink-0", CLASES_PASO_ACCION[paso])}>
                {ETIQUETAS_PASO_ACCION[paso]}
              </Insignia>
            </div>

            <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-atenuado-contraste">
              <span>
                Responsable:{" "}
                <span className="font-medium text-texto">
                  {tarea.responsable?.nombre_completo ?? "Sin asignar"}
                </span>
              </span>
              <span>
                Fecha límite:{" "}
                <span className="font-medium text-texto">
                  {formatearFecha(tarea.fecha_limite)}
                </span>
                {cerrada ? null : ` · ${describirVencimiento(tarea.fecha_limite)}`}
              </span>
              <span className={cerrada ? undefined : "font-medium text-semaforo-medio"}>
                {textoDePlazoAccion(tarea.creado_en, tarea.fecha_ejecucion, cerrada)}
              </span>
            </div>

            {puedeGestionar ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {cerrada ? (
                  <Boton
                    variante="contorno"
                    tamano="pequeno"
                    cargando={procesando === tarea.id}
                    onClick={() => reabrir(tarea)}
                  >
                    Reabrir
                  </Boton>
                ) : (
                  <>
                    <Boton
                      variante="contorno"
                      tamano="pequeno"
                      disabled={procesando !== null}
                      cargando={procesando === tarea.id}
                      onClick={() => cerrar(tarea, true)}
                      className={cn(
                        "border-semaforo-bajo/40 text-semaforo-bajo hover:bg-semaforo-bajo/10",
                        sugerido && "ring-1 ring-semaforo-bajo",
                      )}
                    >
                      Ejecutada en plazo
                    </Boton>
                    <Boton
                      variante="contorno"
                      tamano="pequeno"
                      disabled={procesando !== null}
                      onClick={() => cerrar(tarea, false)}
                      className={cn(!sugerido && "ring-1 ring-atenuado-contraste")}
                    >
                      Ejecutada fuera de plazo
                    </Boton>
                  </>
                )}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/**
 * El cierre de la acción correctiva: eficaz o no eficaz.
 *
 * Solo cuando todas las tareas están ejecutadas. Es la regla de Calidad
 * y tiene sentido: la eficacia se mide sobre lo que se hizo, y con una
 * tarea abierta todavía no se hizo todo.
 *
 * No cierra la no conformidad. La desviación la cierra el auditor a mano
 * desde su ficha, con el criterio de plazo que ya estaba. Acá se dice si
 * la acción sirvió; allá, si se resolvió a tiempo.
 */
export function CierreEficacia({
  noConformidadId,
  eficacia,
  observacion,
  faltan,
  puedeGestionar,
}: {
  noConformidadId: string;
  eficacia: ResultadoEficacia;
  observacion: string | null;
  /** Cuántas tareas quedan sin ejecutar. */
  faltan: number;
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const [texto, definirTexto] = React.useState("");
  const [procesando, definirProcesando] = React.useState<"eficaz" | "no_eficaz" | "reabrir" | null>(
    null,
  );

  const verificada = eficacia === "eficaz" || eficacia === "no_eficaz";

  async function cerrar(eficaz: boolean) {
    definirProcesando(eficaz ? "eficaz" : "no_eficaz");
    const resultado = await verificarEficacia(noConformidadId, eficaz, texto);
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Registrado.");
      definirTexto("");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
    definirProcesando(null);
  }

  async function reabrir() {
    definirProcesando("reabrir");
    const resultado = await reabrirEficacia(noConformidadId);
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Reabierta.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
    definirProcesando(null);
  }

  if (verificada) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Insignia
            className={
              eficacia === "eficaz"
                ? "bg-semaforo-bajo/15 text-semaforo-bajo border-semaforo-bajo/30"
                : "bg-semaforo-critico/15 text-semaforo-critico border-semaforo-critico/30"
            }
          >
            {eficacia === "eficaz" ? "Eficaz" : "No eficaz"}
          </Insignia>
          {observacion ? (
            <p className="mt-2 whitespace-pre-line text-xs leading-relaxed">{observacion}</p>
          ) : null}
        </div>
        {puedeGestionar ? (
          <Boton
            variante="contorno"
            tamano="pequeno"
            cargando={procesando === "reabrir"}
            onClick={reabrir}
          >
            Volver a evaluar
          </Boton>
        ) : null}
      </div>
    );
  }

  if (faltan > 0) {
    return (
      <p className="text-xs text-atenuado-contraste">
        Quedan <span className="font-medium text-texto tabular">{faltan}</span>{" "}
        {faltan === 1 ? "acción sin ejecutar" : "acciones sin ejecutar"}. La eficacia se
        verifica cuando el plan está completo.
      </p>
    );
  }

  if (!puedeGestionar) {
    return (
      <p className="text-xs text-atenuado-contraste">
        Todas las acciones están ejecutadas. Falta verificar la eficacia.
      </p>
    );
  }

  return (
    <div>
      <p className="mb-2 text-xs text-atenuado-contraste">
        Todas las acciones están ejecutadas. Diga si la acción correctiva sirvió: se compara el
        resultado obtenido contra la desviación que la originó.
      </p>
      <AreaTexto
        value={texto}
        onChange={(evento) => definirTexto(evento.target.value)}
        rows={2}
        placeholder="En qué se basa la verificación: qué se midió, qué se revisó, qué evidencia hay."
        aria-label="Fundamento de la verificación de eficacia"
      />
      <div className="mt-2 flex flex-wrap gap-2">
        <Boton
          variante="contorno"
          tamano="pequeno"
          cargando={procesando === "eficaz"}
          disabled={procesando !== null}
          onClick={() => cerrar(true)}
          className="border-semaforo-bajo/40 text-semaforo-bajo hover:bg-semaforo-bajo/10"
        >
          Eficaz
        </Boton>
        <Boton
          variante="contorno"
          tamano="pequeno"
          cargando={procesando === "no_eficaz"}
          disabled={procesando !== null}
          onClick={() => cerrar(false)}
          className="border-semaforo-critico/40 text-semaforo-critico hover:bg-semaforo-critico/10"
        >
          No eficaz
        </Boton>
      </div>
    </div>
  );
}
