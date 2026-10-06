"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Boton } from "@/components/ui/boton";
import { eliminarProveedor } from "@/app/(sgc)/proveedores/acciones";

/**
 * Elimina el Asociado de Negocio, con confirmación.
 *
 * Solo lo ve el Administrador SGC, que es quien puede. Existe para lo
 * que no debería haberse cargado —una prueba, un duplicado, el registro
 * de ejemplo—: a un Asociado de Negocio real se lo pasa a inactivo, no
 * se lo borra, porque la norma pide conservar la evidencia de cómo se lo
 * evaluó.
 *
 * El aviso dice qué se lleva por delante y que no se puede deshacer,
 * porque no se puede.
 */
export function EliminarAsociado({
  proveedorId,
  codigo,
  evaluaciones,
}: {
  proveedorId: string;
  codigo: string;
  evaluaciones: number;
}) {
  const router = useRouter();
  const [borrando, definirBorrando] = React.useState(false);

  async function eliminar() {
    const seLleva =
      evaluaciones > 0
        ? `Se borran también sus ${evaluaciones} ${
            evaluaciones === 1 ? "evaluación" : "evaluaciones"
          }, con las cartas que salieron de ellas. `
        : "";

    if (
      !confirm(
        `¿Seguro que desea eliminar ${codigo}?\n\n` +
          seLleva +
          "Esta acción no se puede deshacer.\n\n" +
          "Si el Asociado de Negocio es real, páselo a inactivo en vez de borrarlo: " +
          "así se conserva con su historial, que es lo que pide la norma.",
      )
    ) {
      return;
    }

    definirBorrando(true);
    const resultado = await eliminarProveedor(proveedorId);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Asociado de Negocio eliminado.");
      router.push("/proveedores");
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
