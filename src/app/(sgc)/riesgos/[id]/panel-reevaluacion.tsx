"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { reevaluarRiesgo, cambiarEstadoRiesgo } from "@/app/(sgc)/riesgos/acciones";
import {
  ESCALA_SEVERIDAD,
  ESCALA_PROBABILIDAD,
  ETIQUETAS_ESTADO_RIESGO,
  ETIQUETAS_NIVEL_RIESGO,
} from "@/lib/constantes";
import { CLASES_NIVEL_RIESGO, diasReevaluacion, etiquetaNivelRiesgo } from "@/lib/riesgos";
import { cn } from "@/lib/utilidades";
import type { EstadoRiesgo } from "@/lib/tipos";

/**
 * Reevaluacion del riesgo inherente, y su estado.
 *
 * EL RESIDUAL NO SE CARGA DESDE ACA. Tiene su propia tarjeta,
 * «Medicion del riesgo», que lo habilita recien cuando llega la fecha en
 * que se acordo medirlo. Estaba acá como una casilla —«registrar como
 * riesgo residual»— y eso permitia cargarlo el mismo dia que se
 * planifico la accion, que es justo lo que Calidad hizo cerrar el 5 de
 * octubre.
 */
export function PanelReevaluacion({
  riesgoId,
  probabilidadActual,
  severidadActual,
  estado,
  puedeEditar,
}: {
  riesgoId: string;
  probabilidadActual: number;
  severidadActual: number;
  estado: EstadoRiesgo;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [probabilidad, definirProbabilidad] = React.useState(probabilidadActual);
  const [severidad, definirSeveridad] = React.useState(severidadActual);
  const [comentario, definirComentario] = React.useState("");
  const [procesando, definirProcesando] = React.useState(false);

  const nivel = probabilidad * severidad;
  const etiqueta = etiquetaNivelRiesgo(nivel)!;

  async function reevaluar() {
    definirProcesando(true);
    const resultado = await reevaluarRiesgo(riesgoId, probabilidad, severidad, comentario, false);
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
        <p className="text-xs font-semibold">Reevaluar</p>
        <p className="mb-3 mt-0.5 text-[11px] leading-relaxed text-atenuado-contraste">
          Corrige la valoración inherente, la del riesgo sin considerar el tratamiento. El riesgo
          residual se evalúa en «Medición del riesgo».
        </p>

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

          <GrupoCampo etiqueta="Severidad" htmlFor="severidad-reev">
            <Seleccion
              id="severidad-reev"
              value={severidad}
              onChange={(evento) => definirSeveridad(Number(evento.target.value))}
            >
              {ESCALA_SEVERIDAD.map((opcion) => (
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
