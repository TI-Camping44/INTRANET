"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Ban, RotateCcw } from "lucide-react";

import { Boton } from "@/components/ui/boton";
import { cambiarEstadoProveedor } from "@/app/(sgc)/proveedores/acciones";
import { resultadoSugerido } from "@/lib/proveedores";
import type { EstadoProveedor } from "@/lib/tipos";

/**
 * Da de baja al Asociado de Negocio, o lo vuelve a activar.
 *
 * ES LA ALTERNATIVA A BORRARLO, y la que corresponde cuando el Asociado
 * es real: se deja de comprarle pero el registro queda, con su historial
 * de evaluaciones y las cartas que salieron de el. La norma pide
 * conservar esa evidencia; borrar es solo para lo que no deberia
 * haberse cargado.
 *
 * AL REACTIVARLO NO SE INVENTA UN ESTADO: vuelve al que le corresponde
 * por su ultima evaluacion. Si nunca se lo evaluo, vuelve a «En
 * evaluacion». Dejarlo en «Aprobado» a mano seria poner una calificacion
 * sin evaluacion detras.
 */
export function EstadoDelAsociado({
  proveedorId,
  estado,
  calificacion,
}: {
  proveedorId: string;
  estado: EstadoProveedor;
  calificacion: number | null;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);

  const inactivo = estado === "inactivo";

  async function cambiar() {
    const destino: EstadoProveedor = inactivo
      ? calificacion === null
        ? "en_evaluacion"
        : resultadoSugerido(calificacion)
      : "inactivo";

    if (
      !inactivo &&
      !confirm(
        "¿Declarar inactivo a este Asociado de Negocio?\n\n" +
          "Deja de contar entre los activos y no se le agenda reevaluación. " +
          "El registro y su historial de evaluaciones se conservan, y puede volver " +
          "a activarlo cuando quiera.",
      )
    ) {
      return;
    }

    definirProcesando(true);
    const resultado = await cambiarEstadoProveedor(proveedorId, destino);

    if (resultado.exito) {
      toast.success(inactivo ? "Asociado de Negocio reactivado." : "Asociado de Negocio inactivo.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
    definirProcesando(false);
  }

  return (
    <Boton
      variante="contorno"
      tamano="pequeno"
      cargando={procesando}
      onClick={cambiar}
      className="w-full"
    >
      {inactivo ? (
        <>
          <RotateCcw /> Volver a activar
        </>
      ) : (
        <>
          <Ban /> Declarar inactivo
        </>
      )}
    </Boton>
  );
}
