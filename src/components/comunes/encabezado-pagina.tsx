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
      {acciones ? <div className="flex shrink-0 items-center gap-2">{acciones}</div> : null}
    </div>
  );
}
