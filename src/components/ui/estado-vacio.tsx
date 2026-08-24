import * as React from "react";
import { cn } from "@/lib/utilidades";

/** Estado vacio uniforme para listados sin resultados. */
export function EstadoVacio({
  icono,
  titulo,
  descripcion,
  accion,
  className,
}: {
  icono?: React.ReactNode;
  titulo: string;
  descripcion?: string;
  accion?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed " +
          "border-borde px-6 py-12 text-center",
        className,
      )}
    >
      {icono ? <div className="text-atenuado-contraste">{icono}</div> : null}
      <p className="text-sm font-medium">{titulo}</p>
      {descripcion ? (
        <p className="max-w-md text-xs text-atenuado-contraste">{descripcion}</p>
      ) : null}
      {accion ? <div className="mt-2">{accion}</div> : null}
    </div>
  );
}
