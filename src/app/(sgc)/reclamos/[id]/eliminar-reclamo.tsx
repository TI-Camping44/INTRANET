"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Boton } from "@/components/ui/boton";
import { eliminarReclamo } from "@/app/(sgc)/reclamos/acciones";

/**
 * Elimina el caso, con confirmación.
 *
 * Solo lo ve el Administrador SGC, que es quien puede según RLS. Existe
 * para lo que no debería haberse cargado —una prueba, un duplicado—: un
 * reclamo real no se borra, se cierra con el estado final del cliente,
 * porque el procedimiento llama a este módulo «fuente única de
 * trazabilidad del caso» y un caso borrado no deja trazabilidad de nada.
 */
export function EliminarReclamo({
  reclamoId,
  codigo,
}: {
  reclamoId: string;
  codigo: string;
}) {
  const router = useRouter();
  const [borrando, definirBorrando] = React.useState(false);

  async function eliminar() {
    if (
      !confirm(
        `¿Seguro que desea eliminar ${codigo}?\n\n` +
          "Se borran también las acciones de su plan. Esta acción no se puede deshacer.\n\n" +
          "Si el reclamo es real, ciérrelo en vez de borrarlo: así queda con su historial y " +
          "con el estado final del cliente.",
      )
    ) {
      return;
    }

    definirBorrando(true);
    const resultado = await eliminarReclamo(reclamoId);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Reclamo eliminado.");
      router.push("/reclamos");
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
      <Trash2 /> Eliminar
    </Boton>
  );
}
