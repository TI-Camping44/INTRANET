"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { GrupoCampo, Seleccion } from "@/components/ui/campo";
import { cambiarEstadoRiesgo } from "@/app/(sgc)/riesgos/acciones";
import { ETIQUETAS_ESTADO_RIESGO } from "@/lib/constantes";
import type { EstadoRiesgo } from "@/lib/tipos";

/**
 * El seguimiento del riesgo: su estado, y nada más.
 *
 * TENÍA UN BLOQUE «REEVALUAR» Y SALIÓ el 10 de octubre. Corregía la
 * probabilidad y la severidad desde la ficha, con su comentario, y era
 * un tercer lugar donde se tocaba la valoración —el alta, la edición y
 * acá—. La valoración se carga una vez; el riesgo residual, que es la
 * otra medición que existe, tiene su propia tarjeta: «Medición del
 * riesgo», que se habilita recién cuando llega la fecha en que se
 * acordó medirlo.
 *
 * `reevaluarRiesgo()` queda en `acciones.ts` y hoy no la llama nada.
 */
export function PanelReevaluacion({
  riesgoId,
  estado,
  puedeEditar,
}: {
  riesgoId: string;
  estado: EstadoRiesgo;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);

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
  );
}
