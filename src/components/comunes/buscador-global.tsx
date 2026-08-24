"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import { Entrada } from "@/components/ui/campo";

/** Caja de busqueda de la cabecera. Envia a la pantalla de resultados. */
export function BuscadorGlobal({ valorInicial = "" }: { valorInicial?: string }) {
  const router = useRouter();
  const [texto, definirTexto] = React.useState(valorInicial);

  function buscar(evento: React.FormEvent) {
    evento.preventDefault();
    const consulta = texto.trim();
    if (consulta.length < 2) return;
    router.push(`/buscar?q=${encodeURIComponent(consulta)}`);
  }

  return (
    <form onSubmit={buscar} className="relative w-full max-w-md" role="search">
      <Search
        className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2
                   text-atenuado-contraste"
      />
      <Entrada
        type="search"
        value={texto}
        onChange={(evento) => definirTexto(evento.target.value)}
        placeholder="Buscar documentos, NC, riesgos y proveedores…"
        aria-label="Búsqueda global"
        className="h-8 pl-8 text-xs"
      />
    </form>
  );
}
