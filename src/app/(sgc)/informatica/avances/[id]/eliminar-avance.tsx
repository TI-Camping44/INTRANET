"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { eliminarAvance } from "@/app/(sgc)/informatica/avances/acciones";

/**
 * Elimina un registro cargado por error, con confirmación.
 *
 * Existe para el duplicado o la prueba. Un cambio que se revirtió no se
 * borra: se registra la reversión como otro avance, así queda que el
 * cambio existió y que se volvió atrás.
 */
export function EliminarAvance({ avanceId, titulo }: { avanceId: string; titulo: string }) {
  const router = useRouter();
  const [borrando, definirBorrando] = React.useState(false);

  async function eliminar() {
    if (
      !confirm(
        `¿Seguro que desea eliminar «${titulo}»?\n\n` +
          "Úselo solo para un registro cargado por error. Si el cambio se revirtió, " +
          "registre la reversión como un avance nuevo: así queda que existió.\n\n" +
          "Esta acción no se puede deshacer; la bitácora conserva lo que se borró.",
      )
    ) {
      return;
    }

    definirBorrando(true);
    const resultado = await eliminarAvance(avanceId);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Registro eliminado.");
      router.push("/informatica/avances");
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
