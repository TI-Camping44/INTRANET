import Link from "next/link";
import { cn } from "@/lib/utilidades";

export interface VistaListado {
  valor: string;
  etiqueta: string;
  cantidad?: number;
}

/**
 * Pestanas de un listado, resueltas por enlace y no por estado de
 * cliente: cada vista es una direccion propia, se puede compartir y
 * sobrevive a una recarga.
 *
 * Son distintas de los filtros. Un filtro acota lo que ya se esta
 * mirando; una pestana cambia el conjunto que se mira. En documentos,
 * los obsoletos no son documentos vigentes filtrados: son otra lista, y
 * mezclarlos es justamente lo que se queria evitar.
 */
export function PestanasListado({
  nombre,
  vistas,
  actual,
  parametros,
  ruta,
}: {
  nombre: string;
  vistas: VistaListado[];
  actual: string;
  parametros: Record<string, string | undefined>;
  ruta: string;
}) {
  function direccion(valor: string) {
    const nuevos = new URLSearchParams();
    for (const [clave, contenido] of Object.entries(parametros)) {
      if (clave !== nombre && contenido) nuevos.set(clave, contenido);
    }
    nuevos.set(nombre, valor);
    return `${ruta}?${nuevos.toString()}`;
  }

  return (
    <div className="mb-4 flex flex-wrap gap-1 border-b border-borde" role="tablist">
      {vistas.map((vista) => {
        const activa = vista.valor === actual;

        return (
          <Link
            key={vista.valor}
            href={direccion(vista.valor)}
            role="tab"
            aria-selected={activa}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-xs font-medium transition-colors",
              activa
                ? "border-primario text-texto"
                : "border-transparent text-atenuado-contraste hover:text-texto",
            )}
          >
            {vista.etiqueta}
            {vista.cantidad !== undefined ? (
              <span className="ml-1.5 tabular text-[10px] opacity-70">{vista.cantidad}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
