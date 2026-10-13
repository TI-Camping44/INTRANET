import { esDeVitalica } from "@/lib/empresas";
import { cn } from "@/lib/utilidades";

/**
 * Cómo se muestra de qué empresa del grupo es un registro.
 *
 * Dos formas, según dónde: **el nombre en color** cuando la empresa es
 * una columna de la tabla o un dato de la ficha, y **la palabra suelta**
 * cuando el registro es una caja o una tarjeta y el nombre de la empresa
 * no se escribe —el organigrama y Aplicaciones—.
 *
 * Están las dos acá para que no se separen: si mañana el naranja cambia,
 * cambia en un archivo y no en nueve pantallas.
 */

/** El nombre de la empresa, en naranja si es Vitalica. */
export function NombreDeEmpresa({
  nombre,
  className,
  vacio = "—",
}: {
  nombre: string | null | undefined;
  className?: string;
  /** Qué se escribe cuando el registro no declara empresa. */
  vacio?: string;
}) {
  if (!nombre) return <span className={className}>{vacio}</span>;

  return (
    <span
      className={cn(
        esDeVitalica(nombre) && "font-medium text-vitalica",
        className,
      )}
    >
      {nombre}
    </span>
  );
}

/**
 * La palabra «Vitalica», chica y en naranja.
 *
 * Para las cajas y tarjetas que no escriben el nombre de la empresa. Va
 * acompañada de una franja del mismo color arriba del recuadro: el color
 * solo no alcanza, y quien no distingue bien los tonos necesita leerlo.
 */
export function MarcaVitalica({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "text-[9px] font-semibold uppercase tracking-wide text-vitalica",
        className,
      )}
    >
      Vitalica
    </span>
  );
}
