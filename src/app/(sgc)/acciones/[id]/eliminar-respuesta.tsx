"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { eliminarRespuesta } from "@/app/(sgc)/acciones/acciones";

/**
 * Elimina la acción correctiva entera, con confirmación.
 *
 * Mismo criterio que en el módulo de no conformidades: sirve para lo que
 * no debería haberse cargado, no para dar por terminada una respuesta
 * real. Solo el Administrador SGC.
 *
 * El aviso dice lo que importa: la desviación vuelve a quedar abierta,
 * porque pasa a ser lo que es, una desviación sin respuesta.
 */
export function EliminarRespuesta({
  noConformidadId,
  codigo,
}: {
  noConformidadId: string;
  codigo: string;
}) {
  const router = useRouter();
  const [borrando, definirBorrando] = React.useState(false);

  async function eliminar() {
    if (
      !confirm(
        `¿Seguro que desea eliminar la acción correctiva de ${codigo}?\n\n` +
          "Se borran el descargo, los cinco porqués y todas las acciones planificadas, " +
          "con su estado de ejecución. Esta acción no se puede deshacer.\n\n" +
          "La no conformidad vuelve a quedar abierta.",
      )
    ) {
      return;
    }

    definirBorrando(true);
    const resultado = await eliminarRespuesta(noConformidadId);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Acción correctiva eliminada.");
      router.push("/acciones");
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
      <Trash2 /> Eliminar Acción Correctiva
    </Boton>
  );
}
