"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utilidades";

/**
 * Encabezado de columna que ordena al tocarlo.
 *
 * El orden viaja en la dirección, no en el estado del componente: así se
 * puede compartir el enlace, sobrevive a una recarga y el listado se
 * sigue armando en el servidor, que es donde están los datos. Es el mismo
 * criterio que usan los filtros del proyecto.
 *
 * Tres estados por columna: sin ordenar, ascendente y descendente. El
 * tercer toque vuelve al orden natural del listado en vez de quedar
 * girando entre dos: si alguien ordenó por título y quiere volver a como
 * estaba, no tiene que acordarse de cuál era la columna original.
 */
export function EncabezadoOrdenable({
  campo,
  children,
  className,
  alineado = "izquierda",
}: {
  /** Nombre del campo, tal como lo espera la página. */
  campo: string;
  children: React.ReactNode;
  className?: string;
  alineado?: "izquierda" | "derecha";
}) {
  const ruta = usePathname();
  const parametros = useSearchParams();

  const ordenActual = parametros.get("orden");
  const direccionActual = parametros.get("dir") ?? "asc";
  const activo = ordenActual === campo;

  const nuevos = new URLSearchParams(parametros.toString());

  if (!activo) {
    nuevos.set("orden", campo);
    nuevos.set("dir", "asc");
  } else if (direccionActual === "asc") {
    nuevos.set("orden", campo);
    nuevos.set("dir", "desc");
  } else {
    // Tercer toque: se vuelve al orden natural del listado.
    nuevos.delete("orden");
    nuevos.delete("dir");
  }

  const Icono = !activo ? ChevronsUpDown : direccionActual === "asc" ? ArrowUp : ArrowDown;

  return (
    <th
      className={cn(
        "h-9 px-3 align-middle text-[11px] font-semibold uppercase tracking-wide",
        "text-atenuado-contraste",
        alineado === "derecha" ? "text-right" : "text-left",
        className,
      )}
    >
      <Link
        href={`${ruta}?${nuevos.toString()}`}
        scroll={false}
        className={cn(
          "inline-flex items-center gap-1 transition-colors hover:text-texto",
          alineado === "derecha" && "flex-row-reverse",
          activo && "text-texto",
        )}
        title={
          activo && direccionActual === "desc"
            ? "Quitar el orden"
            : `Ordenar por ${String(children).toLowerCase()}`
        }
      >
        {children}
        <Icono className={cn("size-3 shrink-0", !activo && "opacity-40")} />
      </Link>
    </th>
  );
}
