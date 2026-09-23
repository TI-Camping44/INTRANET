"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp } from "lucide-react";
import { moverCategoria } from "@/app/(sgc)/documentos/acciones";

/**
 * Las flechas que suben y bajan una categoría entera.
 *
 * Mueven la carpeta con todo lo que tiene adentro: bajar «Políticas»
 * debajo de «Procesos de soporte» deja los procesos arriba y las
 * políticas abajo, con sus documentos.
 *
 * Son flechas y no arrastrar, al revés que las filas. Las categorías son
 * cuatro o cinco y están lejos unas de otras en la pantalla: arrastrar
 * una carpeta veinte filas hacia abajo es pelear con el desplazamiento
 * para algo que con dos toques ya está.
 *
 * El orden es global, no de la pestaña abierta. Por eso una categoría
 * puede tener la flecha de subir apagada aunque en pantalla se vea
 * segunda: arriba hay otra que en esta pestaña no tiene documentos.
 */
export function MoverCategoria({
  categoria,
  esPrimera,
  esUltima,
}: {
  /** null es «Sin categoría», que también se mueve. */
  categoria: string | null;
  esPrimera: boolean;
  esUltima: boolean;
}) {
  const router = useRouter();
  const [moviendo, definirMoviendo] = React.useState(false);

  async function mover(direccion: "subir" | "bajar") {
    definirMoviendo(true);
    const resultado = await moverCategoria(categoria, direccion);
    if (!resultado.exito) toast.error(resultado.error);
    else router.refresh();
    definirMoviendo(false);
  }

  const nombre = categoria ?? "Sin categoría";

  return (
    <div className="flex items-center gap-0.5">
      <button
        type="button"
        onClick={() => mover("subir")}
        disabled={moviendo || esPrimera}
        aria-label={`Subir la categoría ${nombre}`}
        title={esPrimera ? "Ya es la primera categoría" : `Subir ${nombre}`}
        className="rounded p-0.5 text-atenuado-contraste transition-colors
                   hover:bg-fondo hover:text-texto disabled:opacity-25
                   disabled:hover:bg-transparent"
      >
        <ChevronUp className="size-3.5" />
      </button>
      <button
        type="button"
        onClick={() => mover("bajar")}
        disabled={moviendo || esUltima}
        aria-label={`Bajar la categoría ${nombre}`}
        title={esUltima ? "Ya es la última categoría" : `Bajar ${nombre}`}
        className="rounded p-0.5 text-atenuado-contraste transition-colors
                   hover:bg-fondo hover:text-texto disabled:opacity-25
                   disabled:hover:bg-transparent"
      >
        <ChevronDown className="size-3.5" />
      </button>
    </div>
  );
}
