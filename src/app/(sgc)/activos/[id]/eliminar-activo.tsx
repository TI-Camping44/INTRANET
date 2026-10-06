"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Boton } from "@/components/ui/boton";
import { eliminarActivo } from "@/app/(sgc)/activos/acciones";

/**
 * Elimina el activo, con confirmación.
 *
 * Solo lo ve el Administrador SGC, que es quien puede. Existe para lo
 * que no debería haberse cargado —una prueba, un duplicado—: un activo
 * real que se retira se pasa a «Dado de baja», que es justamente el
 * estado que Dirección pidió para eso, y así queda en la tabla como
 * historial.
 */
export function EliminarActivo({
  activoId,
  codigo,
  mantenimientos,
}: {
  activoId: string;
  codigo: string;
  mantenimientos: number;
}) {
  const router = useRouter();
  const [borrando, definirBorrando] = React.useState(false);

  async function eliminar() {
    const seLleva =
      mantenimientos > 0
        ? `Se borran también sus ${mantenimientos} ${
            mantenimientos === 1 ? "mantenimiento" : "mantenimientos"
          }. `
        : "";

    if (
      !confirm(
        `¿Seguro que desea eliminar ${codigo}?\n\n` +
          seLleva +
          "Esta acción no se puede deshacer.\n\n" +
          "Si el activo es real y se retiró, páselo a «Dado de baja» en vez de borrarlo: " +
          "así queda en la tabla como historial.",
      )
    ) {
      return;
    }

    definirBorrando(true);
    const resultado = await eliminarActivo(activoId);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Activo eliminado.");
      router.push("/activos");
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
