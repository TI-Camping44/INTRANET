"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Boton } from "@/components/ui/boton";
import { eliminarIndicador } from "@/app/(sgc)/indicadores/acciones";

/**
 * Elimina el indicador, con confirmación.
 *
 * Solo lo ve el Administrador SGC, que es quien puede. Existe para lo
 * que no debería haberse cargado —una prueba, un duplicado—: un
 * indicador que se deja de medir se saca del objetivo, no se borra,
 * porque su serie de mediciones es la evidencia de cómo se midió.
 *
 * El aviso dice qué se lleva por delante y que no se puede deshacer,
 * porque no se puede: las mediciones caen con él, y el vínculo con los
 * objetivos de la calidad también.
 */
export function EliminarIndicador({
  indicadorId,
  codigo,
  mediciones,
  objetivos,
}: {
  indicadorId: string;
  codigo: string;
  mediciones: number;
  objetivos: number;
}) {
  const router = useRouter();
  const [borrando, definirBorrando] = React.useState(false);

  async function eliminar() {
    const piezas: string[] = [];
    if (mediciones > 0) {
      piezas.push(`sus ${mediciones} ${mediciones === 1 ? "medición" : "mediciones"}`);
    }
    if (objetivos > 0) {
      piezas.push(
        `el vínculo con ${objetivos} ${objetivos === 1 ? "objetivo" : "objetivos"} de la calidad`,
      );
    }

    if (
      !confirm(
        `¿Seguro que desea eliminar ${codigo}?\n\n` +
          (piezas.length > 0 ? `Se borran también ${piezas.join(" y ")}. ` : "") +
          "Esta acción no se puede deshacer.\n\n" +
          "Si el indicador dejó de usarse, sáquelo del objetivo en vez de borrarlo: " +
          "así se conserva su serie de mediciones, que es la evidencia de cómo se midió.",
      )
    ) {
      return;
    }

    definirBorrando(true);
    const resultado = await eliminarIndicador(indicadorId);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Indicador eliminado.");
      router.push("/indicadores");
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
