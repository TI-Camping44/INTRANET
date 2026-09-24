"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { eliminarRiesgo } from "@/app/(sgc)/riesgos/acciones";

/**
 * Elimina el riesgo, con confirmación.
 *
 * Solo lo ve el Administrador SGC, que es quien puede. Existe para lo
 * que no debería haberse cargado —una prueba, un duplicado—: un riesgo
 * real se cierra, no se borra, porque la norma pide conservar el
 * registro con su historial de evaluaciones.
 *
 * El aviso dice qué se lleva por delante y que no se puede deshacer,
 * porque no se puede.
 */
export function EliminarRiesgo({
  riesgoId,
  codigo,
  esOportunidad,
}: {
  riesgoId: string;
  codigo: string;
  esOportunidad?: boolean;
}) {
  const router = useRouter();
  const [borrando, definirBorrando] = React.useState(false);
  const cosa = esOportunidad ? "la oportunidad" : "el riesgo";

  async function eliminar() {
    if (
      !confirm(
        `¿Seguro que desea eliminar ${codigo}?\n\n` +
          "Se borran también su historial de evaluaciones y sus acciones de tratamiento. " +
          "Esta acción no se puede deshacer.\n\n" +
          `Si ${cosa} es real, ciérrelo en vez de borrarlo: así se conserva con su ` +
          "historial, que es lo que pide la norma.",
      )
    ) {
      return;
    }

    definirBorrando(true);
    const resultado = await eliminarRiesgo(riesgoId);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Riesgo eliminado.");
      router.push(esOportunidad ? "/oportunidades" : "/riesgos");
      router.refresh();
    } else {
      toast.error(resultado.error);
      definirBorrando(false);
    }
  }

  return (
    <Boton
      variante="contorno"
      tamano="pequeno"
      cargando={borrando}
      onClick={eliminar}
      className="border-semaforo-critico/40 text-semaforo-critico hover:bg-semaforo-critico/10"
    >
      <Trash2 /> Eliminar {esOportunidad ? "Oportunidad" : "Riesgo"}
    </Boton>
  );
}
