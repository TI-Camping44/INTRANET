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

/** Los dos estados que mueve quien trata la desviacion. El tercero, cerrada, lo firma Calidad. */
const ESTADOS_EN_TRATAMIENTO: EstadoNoConformidad[] = ["abierta", "en_tratamiento"];

/**
 * Seguimiento de la no conformidad.
 *
 * El ciclo tiene tres pasos y el ultimo no es un estado mas: cerrar
 * certifica que la accion correctiva fue eficaz, lo firma Calidad y no
 * antes de haber registrado esa verificacion. Por eso el cierre esta
 * separado del selector, como una casilla que se tilda a conciencia.
 */
export function ControlEstado({
  noConformidadId,
  estado,
  eficacia,
  observacionEficacia,
  esCalidad,
}: {
  noConformidadId: string;
  estado: EstadoNoConformidad;
  eficacia: ResultadoEficacia;
  observacionEficacia: string | null;
  esCalidad: boolean;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);
  const [eficaciaElegida, definirEficaciaElegida] = React.useState<ResultadoEficacia>(eficacia);
  const [observacion, definirObservacion] = React.useState(observacionEficacia ?? "");

  const cerrada = estado === "cerrada";
  const eficaciaVerificada = eficacia !== "pendiente";

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

  return (
    <div className="space-y-4">
      <GrupoCampo
        etiqueta="Estado del tratamiento"
        htmlFor="estado-nc"
        ayuda="Pasa a «En tratamiento» cuando la acción correctiva quedó completada."
      >
        <Seleccion
          id="estado-nc"
          value={cerrada ? "en_tratamiento" : estado}
          disabled={procesando || cerrada}
          onChange={(evento) => cambiar(evento.target.value as EstadoNoConformidad)}
        >
          {ESTADOS_EN_TRATAMIENTO.map((valor) => (
            <option key={valor} value={valor}>
              {ETIQUETAS_ESTADO_NC[valor]}
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
          <Boton tamano="pequeno" onClick={guardarEficacia} cargando={procesando}>
            <Save /> Guardar verificación
          </Boton>
        </div>
      </div>

      <div className="border-t border-borde pt-4">
        {esCalidad ? (
          <>
            <label className="flex items-start gap-2.5 text-xs leading-relaxed">
              <input
                type="checkbox"
                className="mt-0.5 size-3.5 shrink-0 accent-[#E01E37] disabled:opacity-40"
                checked={cerrada}
                disabled={procesando || (!cerrada && !eficaciaVerificada)}
                onChange={(evento) =>
                  cambiar(evento.target.checked ? "cerrada" : "en_tratamiento")
                }
              />
              <span>
                Verifiqué la eficacia de la acción correctiva y cierro la no conformidad.
              </span>
            </label>

            {!cerrada && !eficaciaVerificada ? (
              <p className="mt-2 pl-6 text-[11px] text-atenuado-contraste">
                Registre antes la verificación de eficacia: sin eso no se puede cerrar.
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-[11px] leading-relaxed text-atenuado-contraste">
            El cierre lo firma Calidad, después de verificar que la acción correctiva fue
            eficaz.
          </p>
        )}
      </div>
    </div>
  );
}
