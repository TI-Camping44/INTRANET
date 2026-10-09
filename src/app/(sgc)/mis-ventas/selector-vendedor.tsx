"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Seleccion } from "@/components/ui/campo";

/**
 * De quién se está mirando el detalle.
 *
 * Solo lo ve quien supervisa canales. El vendedor que entra a ver lo
 * suyo no tiene nada que elegir, así que no se le muestra un desplegable
 * con una sola opción.
 *
 * VA POR LA DIRECCIÓN, NO POR ESTADO. Elegir a alguien cambia el
 * `?vendedor=` de la dirección y la página se vuelve a armar en el
 * servidor. Así el jefe puede compartir el enlace de un vendedor, el
 * botón de atrás funciona, y —lo que importa— el filtrado por canal
 * sigue pasando en el servidor: al navegador nunca viaja la fila de
 * alguien que no le corresponde ver.
 */
export function SelectorVendedor({
  opciones,
  elegido,
}: {
  opciones: { cod: string; nombre: string; canal: string }[];
  elegido: string | null;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();
  const [cambiando, definirCambiando] = React.useTransition();

  function elegir(cod: string) {
    const nuevos = new URLSearchParams(parametros.toString());
    if (cod) nuevos.set("vendedor", cod);
    else nuevos.delete("vendedor");

    const cola = nuevos.toString();
    definirCambiando(() =>
      router.replace(cola ? `${ruta}?${cola}` : ruta, { scroll: false }),
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="vendedor" className="text-[11px] text-atenuado-contraste">
        Ver el detalle de
      </label>
      <Seleccion
        id="vendedor"
        value={elegido ?? ""}
        disabled={cambiando}
        onChange={(evento) => elegir(evento.target.value)}
        className="h-8 w-auto min-w-[14rem] py-0 text-xs"
      >
        <option value="">Nadie: solo el resumen del equipo</option>
        {opciones.map((opcion) => (
          <option key={opcion.cod} value={opcion.cod}>
            {opcion.nombre} · {opcion.canal}
          </option>
        ))}
      </Seleccion>
    </div>
  );
}
