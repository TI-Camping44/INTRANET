"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { cambiarEstadoFormacion } from "@/app/(sgc)/recursos-humanos/formacion/acciones";
import {
  ESTADOS_FORMACION_VIGENTES,
  ETIQUETAS_ESTADO_FORMACION,
  exigeMotivo,
} from "@/lib/formacion";
import { hoyEnAsuncion } from "@/lib/formato";
import type { EstadoCapacitacion } from "@/lib/tipos";

/**
 * Mover la acción de estado.
 *
 * Nace Planificada y se mueve a mano, según la fecha del calendario. Dos
 * de los cuatro destinos piden explicación antes de guardar:
 *
 *   · No ejecutada → por qué no se hizo.
 *   · Pospuesta → por qué, y para cuándo.
 *
 * El campo aparece al elegir el estado, y no antes: pedirlo siempre
 * obligaría a escribir algo también cuando la acción simplemente se
 * ejecutó. Lo exige también la acción de servidor; esto es la comodidad.
 *
 * «Ejecutada» no pide nada acá: la evidencia va en el panel de al lado,
 * que es donde se registra quién asistió y se suben los certificados.
 */
export function PanelEstado({
  formacionId,
  estado,
}: {
  formacionId: string;
  estado: EstadoCapacitacion;
}) {
  const router = useRouter();
  const [elegido, definirElegido] = React.useState<EstadoCapacitacion>(estado);
  const [comentario, definirComentario] = React.useState("");
  const [fechaNueva, definirFechaNueva] = React.useState("");
  const [procesando, definirProcesando] = React.useState(false);

  const pideMotivo = exigeMotivo(elegido);
  const cambio = elegido !== estado;

  async function guardar() {
    definirProcesando(true);
    const resultado = await cambiarEstadoFormacion(
      formacionId,
      elegido,
      comentario,
      fechaNueva || null,
    );
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Estado actualizado.");
      definirComentario("");
      definirFechaNueva("");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="space-y-3 border-t border-borde pt-3">
      <GrupoCampo etiqueta="Cambiar a" htmlFor="estado-formacion">
        <Seleccion
          id="estado-formacion"
          value={elegido}
          onChange={(evento) => definirElegido(evento.target.value as EstadoCapacitacion)}
        >
          {ESTADOS_FORMACION_VIGENTES.map((valor) => (
            <option key={valor} value={valor}>
              {ETIQUETAS_ESTADO_FORMACION[valor]}
            </option>
          ))}
        </Seleccion>
      </GrupoCampo>

      {pideMotivo ? (
        <>
          <GrupoCampo
            etiqueta={elegido === "pospuesta" ? "Por qué se pospone" : "Por qué no se ejecutó"}
            htmlFor="comentario-estado"
            requerido
          >
            <AreaTexto
              id="comentario-estado"
              rows={3}
              value={comentario}
              onChange={(evento) => definirComentario(evento.target.value)}
              placeholder="El motivo queda en el registro: es lo que se revisa al cerrar el plan anual."
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Nueva fecha prevista"
            htmlFor="fecha-nueva"
            requerido={elegido === "pospuesta"}
            ayuda={elegido === "pospuesta" ? undefined : "Opcional."}
          >
            <Entrada
              id="fecha-nueva"
              type="date"
              min={hoyEnAsuncion()}
              value={fechaNueva}
              onChange={(evento) => definirFechaNueva(evento.target.value)}
            />
          </GrupoCampo>
        </>
      ) : null}

      <Boton
        tamano="pequeno"
        className="w-full"
        cargando={procesando}
        disabled={!cambio && !pideMotivo}
        onClick={guardar}
      >
        Guardar el estado
      </Boton>
    </div>
  );
}
