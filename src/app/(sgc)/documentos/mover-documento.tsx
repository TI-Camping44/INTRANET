"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import { moverDocumento } from "@/app/(sgc)/documentos/acciones";

/**
 * Las dos flechas para mover un documento dentro de su categoría.
 *
 * Calidad arma la carpeta como le sirve al auditor, y ese orden no es el
 * del código ni el alfabético.
 *
 * Se mueve de a un lugar y no con arrastrar y soltar. Arrastrar en una
 * tabla de sesenta filas dentro de una caja con desplazamiento propio
 * pelea con el scroll, y desde el celular —que es desde donde se mira en
 * depósito— directamente no funciona. Dos flechas andan en todos lados.
 */
export function MoverDocumento({
  documentoId,
  esPrimero,
  esUltimo,
}: {
  documentoId: string;
  esPrimero: boolean;
  esUltimo: boolean;
}) {
  const router = useRouter();
  const [moviendo, definirMoviendo] = React.useState(false);

  async function mover(direccion: "subir" | "bajar") {
    definirMoviendo(true);
    const resultado = await moverDocumento(documentoId, direccion);
    if (!resultado.exito) toast.error(resultado.error);
    else router.refresh();
    definirMoviendo(false);
  }

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => mover("subir")}
        disabled={moviendo || esPrimero}
        aria-label="Subir un lugar"
        title="Subir un lugar"
        className="rounded p-0.5 text-atenuado-contraste transition-colors
                   hover:bg-acento hover:text-texto disabled:opacity-25
                   disabled:hover:bg-transparent"
      >
        <ChevronUp className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => mover("bajar")}
        disabled={moviendo || esUltimo}
        aria-label="Bajar un lugar"
        title="Bajar un lugar"
        className="rounded p-0.5 text-atenuado-contraste transition-colors
                   hover:bg-acento hover:text-texto disabled:opacity-25
                   disabled:hover:bg-transparent"
      >
        <ChevronDown className="size-3.5" />
      </button>
    </div>
  );
}
