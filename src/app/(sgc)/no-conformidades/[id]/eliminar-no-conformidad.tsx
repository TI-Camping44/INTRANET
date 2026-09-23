"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { eliminarNoConformidad } from "@/app/(sgc)/no-conformidades/acciones";

/**
 * Elimina la no conformidad, con confirmación.
 *
 * Solo lo ve el Administrador SGC, que es quien puede según RLS. Existe
 * para lo que no debería haberse cargado —una prueba, un duplicado—: una
 * desviación real se cierra, no se borra, porque la norma pide conservar
 * el registro con su historial.
 *
 * El aviso dice qué se lleva por delante y que no se puede deshacer,
 * porque no se puede.
 */
export function EliminarNoConformidad({
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
        `¿Seguro que desea eliminar ${codigo}?\n\n` +
          "Se borran también sus acciones correctivas y su análisis de causa raíz. " +
          "Esta acción no se puede deshacer.\n\n" +
          "Si la desviación es real, ciérrela en vez de borrarla: así se conserva con su " +
          "historial, que es lo que pide la norma.",
      )
    ) {
      return;
    }

    definirBorrando(true);
    const resultado = await eliminarNoConformidad(noConformidadId);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "No conformidad eliminada.");
      router.push("/no-conformidades");
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
      <Trash2 /> Eliminar No Conformidad
    </Boton>
  );
}
