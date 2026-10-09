"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

import { Boton } from "@/components/ui/boton";
import { eliminarObjetivo } from "@/app/(sgc)/indicadores/acciones";

/**
 * Elimina el objetivo, con confirmación.
 *
 * EL AVISO DICE QUÉ SE LLEVA POR DELANTE, y es bastante: el plan de
 * acciones del 6.2.2 y el calendario de mediciones del año no existen
 * fuera del objetivo y se borran con él. Un «¿Está seguro?» a secas no
 * alcanza cuando lo que se pierde es la medición de doce meses.
 *
 * Los indicadores NO se borran: si hay alguno colgando, la acción se
 * niega y pide reasignarlo primero. Un indicador sin objetivo mide algo
 * que ya nadie declaró.
 *
 * Existe para lo que no debería haberse cargado —una prueba, un
 * duplicado—. Un objetivo que se deja de perseguir se cierra, no se
 * borra: la hoja de Calidad tiene que poder mostrar qué se propuso y
 * qué pasó.
 */
export function EliminarObjetivo({
  objetivoId,
  codigo,
  acciones,
  mediciones,
  indicadores,
}: {
  objetivoId: string;
  codigo: string;
  acciones: number;
  mediciones: number;
  indicadores: number;
}) {
  const router = useRouter();
  const [borrando, definirBorrando] = React.useState(false);

  async function eliminar() {
    if (indicadores > 0) {
      toast.error(
        `No se puede eliminar: hay ${indicadores} indicador(es) colgando de ${codigo}. ` +
          "Reasígnelos o elimínelos primero.",
      );
      return;
    }

    const piezas: string[] = [];
    if (acciones > 0) {
      piezas.push(`sus ${acciones} ${acciones === 1 ? "acción" : "acciones"} del plan`);
    }
    if (mediciones > 0) {
      piezas.push(
        `${mediciones} ${mediciones === 1 ? "medición cargada" : "mediciones cargadas"} del calendario`,
      );
    }

    if (
      !confirm(
        `¿Seguro que desea eliminar ${codigo}?\n\n` +
          (piezas.length > 0 ? `Se borran también ${piezas.join(" y ")}. ` : "") +
          "Esta acción no se puede deshacer.\n\n" +
          "Si el objetivo dejó de perseguirse, ciérrelo en vez de borrarlo: " +
          "la Revisión por la Dirección tiene que poder ver qué se propuso y qué pasó.",
      )
    ) {
      return;
    }

    definirBorrando(true);
    const resultado = await eliminarObjetivo(objetivoId);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Objetivo eliminado.");
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
