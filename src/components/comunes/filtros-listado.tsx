"use client";

import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Entrada, Seleccion } from "@/components/ui/campo";

export interface CampoFiltro {
  nombre: string;
  etiqueta: string;
  opciones: { valor: string; etiqueta: string }[];
}

/**
 * Barra de filtros de los listados. Escribe el estado en la URL para que
 * los filtros se puedan compartir y sobrevivan a una recarga.
 */
export function FiltrosListado({
  campos,
  marcadorBusqueda = "Buscar por código o título…",
}: {
  campos: CampoFiltro[];
  marcadorBusqueda?: string;
}) {
  const router = useRouter();
  const ruta = usePathname();
  const parametros = useSearchParams();
  const [texto, definirTexto] = React.useState(parametros.get("q") ?? "");

  function aplicar(nombre: string, valor: string) {
    const nuevos = new URLSearchParams(parametros.toString());
    if (valor) nuevos.set(nombre, valor);
    else nuevos.delete(nombre);
    router.push(`${ruta}?${nuevos.toString()}`);
  }

  function buscar(evento: React.FormEvent) {
    evento.preventDefault();
    aplicar("q", texto.trim());
  }

  const hayFiltros = Array.from(parametros.keys()).length > 0;

  return (
    <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
      <form onSubmit={buscar} className="relative min-w-[16rem] flex-1" role="search">
        <Search
          className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2
                     text-atenuado-contraste"
        />
        <Entrada
          type="search"
          value={texto}
          onChange={(evento) => definirTexto(evento.target.value)}
          placeholder={marcadorBusqueda}
          aria-label="Buscar en el listado"
          className="pl-8"
        />
      </form>

      {campos.map((campo) => (
        <Seleccion
          key={campo.nombre}
          aria-label={campo.etiqueta}
          value={parametros.get(campo.nombre) ?? ""}
          onChange={(evento) => aplicar(campo.nombre, evento.target.value)}
          className="w-auto min-w-[10rem]"
        >
          <option value="">{campo.etiqueta}: todos</option>
          {campo.opciones.map((opcion) => (
            <option key={opcion.valor} value={opcion.valor}>
              {opcion.etiqueta}
            </option>
          ))}
        </Seleccion>
      ))}

      {hayFiltros ? (
        <Boton variante="fantasma" tamano="pequeno" onClick={() => router.push(ruta)}>
          <X /> Limpiar
        </Boton>
      ) : null}
    </div>
  );
}
