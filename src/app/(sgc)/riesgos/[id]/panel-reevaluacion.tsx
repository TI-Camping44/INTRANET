"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { reevaluarRiesgo, cambiarEstadoRiesgo } from "@/app/(sgc)/riesgos/acciones";
import {
  ESCALA_IMPACTO,
  ESCALA_PROBABILIDAD,
  ETIQUETAS_ESTADO_RIESGO,
  ETIQUETAS_NIVEL_RIESGO,
} from "@/lib/constantes";
import { CLASES_NIVEL_RIESGO, diasReevaluacion, etiquetaNivelRiesgo } from "@/lib/riesgos";
import { cn } from "@/lib/utilidades";
import type { EstadoRiesgo } from "@/lib/tipos";

/**
 * Reevaluacion del riesgo. Permite ajustar la evaluacion inherente o
 * cargar la residual, que es la que queda despues de aplicar las acciones
 * de tratamiento.
 */
export function PanelReevaluacion({
  riesgoId,
  probabilidadActual,
  impactoActual,
  estado,
  puedeEditar,
}: {
  riesgoId: string;
  probabilidadActual: number;
  impactoActual: number;
  estado: EstadoRiesgo;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [probabilidad, definirProbabilidad] = React.useState(probabilidadActual);
  const [impacto, definirImpacto] = React.useState(impactoActual);
  const [comentario, definirComentario] = React.useState("");
  const [esResidual, definirEsResidual] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);

  const nivel = probabilidad * impacto;
  const etiqueta = etiquetaNivelRiesgo(nivel)!;

  async function reevaluar() {
    definirProcesando(true);
    const resultado = await reevaluarRiesgo(
      riesgoId,
      probabilidad,
      impacto,
      comentario,
      esResidual,
    );
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Reevaluación registrada.");
      definirComentario("");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function cambiar(nuevoEstado: EstadoRiesgo) {
    definirProcesando(true);
    const resultado = await cambiarEstadoRiesgo(riesgoId, nuevoEstado);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Estado actualizado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  if (!puedeEditar) return null;

  return (
    <div className="space-y-4">
      <GrupoCampo etiqueta="Estado" htmlFor="estado-riesgo">
        <Seleccion
          id="estado-riesgo"
          value={estado}
          disabled={procesando}
          onChange={(evento) => cambiar(evento.target.value as EstadoRiesgo)}
        >
          {Object.entries(ETIQUETAS_ESTADO_RIESGO).map(([valor, texto]) => (
            <option key={valor} value={valor}>
              {texto}
            </option>
          ))}
        </Seleccion>
      </GrupoCampo>

      <div className="border-t border-borde pt-4">
        <p className="mb-3 text-xs font-semibold">Reevaluar</p>

        <label className="mb-3 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            className="size-3.5 accent-[#E01E37]"
            checked={esResidual}
            onChange={(evento) => definirEsResidual(evento.target.checked)}
          />
          Registrar como riesgo residual (posterior al tratamiento)
        </label>

        <div className="grid gap-3 sm:grid-cols-2">
          <GrupoCampo etiqueta="Probabilidad" htmlFor="probabilidad-reev">
            <Seleccion
              id="probabilidad-reev"
              value={probabilidad}
              onChange={(evento) => definirProbabilidad(Number(evento.target.value))}
            >
              {ESCALA_PROBABILIDAD.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.valor} · {opcion.etiqueta}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Impacto" htmlFor="impacto-reev">
            <Seleccion
              id="impacto-reev"
              value={impacto}
              onChange={(evento) => definirImpacto(Number(evento.target.value))}
            >
              {ESCALA_IMPACTO.map((opcion) => (
                <option key={opcion.valor} value={opcion.valor}>
                  {opcion.valor} · {opcion.etiqueta}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>
        </div>

        <div
          className={cn(
            "mt-3 flex items-center justify-between gap-2 rounded-md border p-2.5",
            CLASES_NIVEL_RIESGO[etiqueta],
          )}
        >
          <span className="text-xs font-semibold tabular">
            Nivel {nivel} · {ETIQUETAS_NIVEL_RIESGO[etiqueta]}
          </span>
          <span className="text-[11px] opacity-90">Revisión cada {diasReevaluacion(nivel)} días</span>
        </div>

        <GrupoCampo etiqueta="Comentario" htmlFor="comentario-reev" className="mt-3">
          <AreaTexto
            id="comentario-reev"
            rows={2}
            value={comentario}
            onChange={(evento) => definirComentario(evento.target.value)}
            placeholder="Motivo del cambio de evaluación."
          />
        </GrupoCampo>

        <div className="mt-3 flex justify-end">
          <Boton tamano="pequeno" onClick={reevaluar} disabled={procesando}>
            <RefreshCw /> Registrar reevaluación
          </Boton>
        </div>
      </div>
    </div>
  );
}
