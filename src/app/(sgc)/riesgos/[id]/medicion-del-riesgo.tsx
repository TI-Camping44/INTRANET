"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarClock, Lock, RefreshCw } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { definirFechaMedicionRiesgo, reevaluarRiesgo } from "@/app/(sgc)/riesgos/acciones";
import {
  ESCALA_PROBABILIDAD,
  ESCALA_SEVERIDAD,
  ETIQUETAS_NIVEL_RIESGO,
} from "@/lib/constantes";
import { CLASES_NIVEL_RIESGO, etiquetaNivelRiesgo } from "@/lib/riesgos";
import { formatearFecha, hoyEnAsuncion } from "@/lib/formato";
import { cn } from "@/lib/utilidades";

/**
 * Cuándo se mide el riesgo, y la evaluación del residual cuando esa
 * fecha llega.
 *
 * LAS DOS COSAS VAN JUNTAS Y EN ESTE ORDEN porque la segunda depende de
 * la primera. Lo pidió Calidad el 5 de octubre: primero se fija la fecha
 * en que se va a medir el riesgo, y el campo para evaluar el residual
 * queda cerrado hasta que esa fecha llegue.
 *
 * No es una formalidad. El riesgo residual es lo que queda después de
 * que las acciones tuvieron tiempo de actuar; cargarlo el mismo día que
 * se definió el tratamiento es declarar un resultado que todavía no
 * existe, y en una auditoría eso es un número sin respaldo.
 *
 * El candado de la pantalla es comodidad: el control está en
 * `reevaluarRiesgo`, que rechaza el residual antes de la fecha aunque la
 * petición no venga de acá.
 */
export function MedicionDelRiesgo({
  riesgoId,
  fechaMedicion,
  probabilidadResidual,
  severidadResidual,
  puedeEditar,
}: {
  riesgoId: string;
  fechaMedicion: string | null;
  probabilidadResidual: number | null;
  severidadResidual: number | null;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const hoy = hoyEnAsuncion();
  const [guardandoFecha, definirGuardandoFecha] = React.useState(false);
  const [probabilidad, definirProbabilidad] = React.useState(probabilidadResidual ?? 0);
  const [severidad, definirSeveridad] = React.useState(severidadResidual ?? 0);
  const [comentario, definirComentario] = React.useState("");
  const [evaluando, definirEvaluando] = React.useState(false);

  const llego = fechaMedicion !== null && hoy >= fechaMedicion;
  const valorado = probabilidad > 0 && severidad > 0;
  const nivel = valorado ? probabilidad * severidad : 0;
  const etiqueta = valorado ? etiquetaNivelRiesgo(nivel) : null;

  async function guardarFecha(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const fecha = String(new FormData(evento.currentTarget).get("fecha_medicion") ?? "");
    definirGuardandoFecha(true);
    const resultado = await definirFechaMedicionRiesgo(riesgoId, fecha);
    definirGuardandoFecha(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Fecha guardada.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function evaluarResidual() {
    definirEvaluando(true);
    const resultado = await reevaluarRiesgo(riesgoId, probabilidad, severidad, comentario, true);
    definirEvaluando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Riesgo residual evaluado.");
      definirComentario("");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <Tarjeta>
      <TarjetaCabecera>
        <TarjetaTitulo>Medición del riesgo</TarjetaTitulo>
      </TarjetaCabecera>
      <TarjetaContenido className="space-y-4">
        {/* 1 · La fecha. */}
        {puedeEditar ? (
          <form onSubmit={guardarFecha} className="flex flex-wrap items-end gap-2">
            <GrupoCampo
              etiqueta="Fecha en que se va a medir el riesgo"
              htmlFor="fecha_medicion"
              className="min-w-[12rem] flex-1"
            >
              <Entrada
                id="fecha_medicion"
                name="fecha_medicion"
                type="date"
                required
                defaultValue={fechaMedicion ?? ""}
              />
            </GrupoCampo>
            <Boton type="submit" tamano="pequeno" variante="contorno" cargando={guardandoFecha}>
              <CalendarClock /> Guardar
            </Boton>
          </form>
        ) : (
          <p className="text-xs">
            <span className="text-atenuado-contraste">Se mide el: </span>
            <span className="font-medium">
              {fechaMedicion ? formatearFecha(fechaMedicion) : "sin definir"}
            </span>
          </p>
        )}

        {/* 2 · El residual, cerrado hasta que la fecha llegue. */}
        <div className="border-t border-borde pt-4">
          <p className="text-xs font-semibold">Riesgo residual</p>

          {!llego ? (
            <p className="mt-2 flex items-start gap-2 rounded-md border border-dashed border-borde p-3 text-[11px] leading-relaxed text-atenuado-contraste">
              <Lock className="mt-0.5 size-3.5 shrink-0" />
              <span>
                {fechaMedicion
                  ? `Se habilita el ${formatearFecha(fechaMedicion)}. El residual es lo que queda después de que las acciones operaron: antes de esa fecha no hay nada que medir.`
                  : "Primero indique arriba la fecha en que se va a medir el riesgo."}
              </span>
            </p>
          ) : !puedeEditar ? (
            <p className="mt-2 text-[11px] text-atenuado-contraste">
              Su rol no permite evaluar el riesgo residual.
            </p>
          ) : (
            <>
              <p className="mb-3 mt-0.5 text-[11px] leading-relaxed text-atenuado-contraste">
                La fecha de medición llegó. Evalúe el riesgo con el tratamiento ya aplicado.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <GrupoCampo etiqueta="Probabilidad residual" htmlFor="probabilidad-residual">
                  <Seleccion
                    id="probabilidad-residual"
                    value={probabilidad === 0 ? "" : probabilidad}
                    onChange={(evento) => definirProbabilidad(Number(evento.target.value))}
                  >
                    <option value="" disabled>
                      Elija la probabilidad
                    </option>
                    {ESCALA_PROBABILIDAD.map((opcion) => (
                      <option key={opcion.valor} value={opcion.valor}>
                        {opcion.valor} · {opcion.etiqueta}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>

                <GrupoCampo etiqueta="Severidad residual" htmlFor="severidad-residual">
                  <Seleccion
                    id="severidad-residual"
                    value={severidad === 0 ? "" : severidad}
                    onChange={(evento) => definirSeveridad(Number(evento.target.value))}
                  >
                    <option value="" disabled>
                      Elija la severidad
                    </option>
                    {ESCALA_SEVERIDAD.map((opcion) => (
                      <option key={opcion.valor} value={opcion.valor}>
                        {opcion.valor} · {opcion.etiqueta}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>
              </div>

              {etiqueta ? (
                <div
                  className={cn(
                    "mt-3 flex items-center justify-between gap-2 rounded-md border p-2.5",
                    CLASES_NIVEL_RIESGO[etiqueta],
                  )}
                >
                  <span className="text-xs font-semibold tabular">
                    Nivel residual {nivel} · {ETIQUETAS_NIVEL_RIESGO[etiqueta]}
                  </span>
                </div>
              ) : null}

              <GrupoCampo etiqueta="Fundamento" htmlFor="comentario-residual" className="mt-3">
                <AreaTexto
                  id="comentario-residual"
                  rows={2}
                  value={comentario}
                  onChange={(evento) => definirComentario(evento.target.value)}
                  placeholder="Con qué se verificó que el riesgo bajó."
                />
              </GrupoCampo>

              <div className="mt-3 flex justify-end">
                <Boton
                  tamano="pequeno"
                  onClick={evaluarResidual}
                  cargando={evaluando}
                  disabled={!valorado}
                >
                  <RefreshCw /> Registrar el riesgo residual
                </Boton>
              </div>
            </>
          )}
        </div>
      </TarjetaContenido>
    </Tarjeta>
  );
}
