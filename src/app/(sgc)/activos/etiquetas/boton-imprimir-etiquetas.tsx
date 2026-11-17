"use client";

import { Printer } from "lucide-react";
import { Boton } from "@/components/ui/boton";

/**
 * Abre el diálogo de impresión del navegador. Lo que sale es esta misma
 * página, con el `@page` del formato elegido: la hoja A4 o la cinta de
 * la etiquetadora.
 */
export function BotonImprimirEtiquetas({ cantidad }: { cantidad: number }) {
  return (
    <Boton tamano="pequeno" onClick={() => window.print()} disabled={cantidad === 0}>
      <Printer aria-hidden /> Imprimir {cantidad} {cantidad === 1 ? "etiqueta" : "etiquetas"}
    </Boton>
  );
}
