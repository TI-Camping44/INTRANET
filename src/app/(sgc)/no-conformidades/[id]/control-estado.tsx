"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, GrupoCampo, Seleccion } from "@/components/ui/campo";
import {
  cambiarEstadoNoConformidad,
  registrarEficacia,
} from "@/app/(sgc)/no-conformidades/acciones";
import { ETIQUETAS_EFICACIA, ETIQUETAS_ESTADO_NC } from "@/lib/constantes";
import type { EstadoNoConformidad, ResultadoEficacia } from "@/lib/tipos";

/** Cambio de estado del ciclo de tratamiento y verificacion de eficacia. */
export function ControlEstado({
  noConformidadId,
  estado,
  eficacia,
  observacionEficacia,
  puedeGestionar,
}: {
  noConformidadId: string;
  estado: EstadoNoConformidad;
  eficacia: ResultadoEficacia;
  observacionEficacia: string | null;
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);
  const [eficaciaElegida, definirEficaciaElegida] = React.useState<ResultadoEficacia>(eficacia);
  const [observacion, definirObservacion] = React.useState(observacionEficacia ?? "");

  async function cambiar(nuevoEstado: EstadoNoConformidad) {
    definirProcesando(true);
    const resultado = await cambiarEstadoNoConformidad(noConformidadId, nuevoEstado);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Estado actualizado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function guardarEficacia() {
    definirProcesando(true);
    const resultado = await registrarEficacia(noConformidadId, eficaciaElegida, observacion);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Eficacia registrada.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  if (!puedeGestionar) return null;

  return (
    <div className="space-y-4">
      <GrupoCampo
        etiqueta="Estado del tratamiento"
        htmlFor="estado-nc"
        ayuda="Para cerrar, todas las acciones del plan deben estar ejecutadas o verificadas."
      >
        <Seleccion
          id="estado-nc"
          value={estado}
          disabled={procesando}
          onChange={(evento) => cambiar(evento.target.value as EstadoNoConformidad)}
        >
          {Object.entries(ETIQUETAS_ESTADO_NC).map(([valor, etiqueta]) => (
            <option key={valor} value={valor}>
              {etiqueta}
            </option>
          ))}
        </Seleccion>
      </GrupoCampo>

      <div className="border-t border-borde pt-4">
        <GrupoCampo
          etiqueta="Verificación de eficacia"
          htmlFor="eficacia-nc"
          ayuda="Se registra después de comprobar que la causa raíz no volvió a producir la desviación."
        >
          <Seleccion
            id="eficacia-nc"
            value={eficaciaElegida}
            onChange={(evento) =>
              definirEficaciaElegida(evento.target.value as ResultadoEficacia)
            }
          >
            {Object.entries(ETIQUETAS_EFICACIA).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </Seleccion>
        </GrupoCampo>

        <GrupoCampo etiqueta="Observación" htmlFor="observacion-eficacia" className="mt-3">
          <AreaTexto
            id="observacion-eficacia"
            rows={3}
            value={observacion}
            onChange={(evento) => definirObservacion(evento.target.value)}
            placeholder="Se verificaron dos conteos posteriores sin diferencias."
          />
        </GrupoCampo>

        <div className="mt-3 flex justify-end">
          <Boton tamano="pequeno" onClick={guardarEficacia} disabled={procesando}>
            <Save /> Guardar verificación
          </Boton>
        </div>
      </div>
    </div>
  );
}
