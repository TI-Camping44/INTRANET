import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Tarjeta } from "@/components/ui/tarjeta";
import { cn } from "@/lib/utilidades";

/**
 * Tarjeta compacta del tablero: un numero grande, su contexto y el enlace
 * al listado ya filtrado. Direccion las lee de un vistazo en pantalla
 * grande, por eso el dato pesa mas que la decoracion.
 */
export function TarjetaIndicador({
  titulo,
  valor,
  contexto,
  enlace,
  tono = "neutro",
  icono,
}: {
  titulo: string;
  valor: number | string;
  contexto?: string;
  enlace?: string;
  tono?: "neutro" | "exito" | "advertencia" | "atencion" | "peligro";
  icono?: React.ReactNode;
}) {
  const tonos = {
    neutro: "text-texto",
    exito: "text-semaforo-bajo",
    advertencia: "text-semaforo-medio",
    atencion: "text-semaforo-alto",
    peligro: "text-semaforo-critico",
  } as const;

  const contenido = (
    <Tarjeta
      className={cn(
        "h-full p-4 transition-colors",
        enlace ? "hover:border-primario/40 hover:bg-acento/40" : "",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
          {titulo}
        </p>
        {icono ? <span className="text-atenuado-contraste">{icono}</span> : null}
      </div>
      <p className={cn("mt-2 text-3xl font-semibold tabular leading-none", tonos[tono])}>
        {valor}
      </p>
      {contexto ? (
        <p className="mt-2 flex items-center gap-1 text-[11px] text-atenuado-contraste">
          {contexto}
          {enlace ? <ArrowRight className="size-3" /> : null}
        </p>
      ) : null}
    </Tarjeta>
  );

  return enlace ? (
    <Link href={enlace} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-anillo rounded-lg">
      {contenido}
    </Link>
  ) : (
    contenido
  );
}
