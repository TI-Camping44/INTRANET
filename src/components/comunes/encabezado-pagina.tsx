import * as React from "react";
import { cn } from "@/lib/utilidades";

/** Encabezado uniforme de cada pantalla: titulo, descripcion y acciones. */
export function EncabezadoPagina({
  titulo,
  descripcion,
  acciones,
  className,
}: {
  titulo: string;
  descripcion?: string;
  acciones?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "mb-5 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        <h1 className="text-lg font-semibold tracking-tight">{titulo}</h1>
        {descripcion ? (
          <p className="mt-0.5 text-xs leading-relaxed text-atenuado-contraste">{descripcion}</p>
        ) : null}
      </div>
      {/* En el celular los botones SALTAN DE LINEA; en pantalla grande se
          quedan en una sola fila y no se encogen.

          Antes era `flex shrink-0` a secas: los tres botones de
          Documentacion —Categorias, Reindexar, Nuevo documento— no
          entraban en 360 px, no podian saltar, y «Nuevo documento»
          quedaba cortado contra el borde. `shrink-0` empeoraba lo que
          `flex-wrap` habria resuelto solo. */}
      {acciones ? (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0">{acciones}</div>
      ) : null}
    </div>
  );
}
