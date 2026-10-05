import * as React from "react";
import { cn } from "@/lib/utilidades";
import { DesplazamientoDoble } from "@/components/ui/desplazamiento-doble";

interface PropiedadesTabla extends React.HTMLAttributes<HTMLTableElement> {
  /**
   * Agrega una segunda barra de desplazamiento horizontal arriba de la
   * tabla. Se usa en los listados anchos —riesgos, oportunidades—, donde
   * llegar a la barra de abajo obliga a recorrer todas las filas.
   */
  barraSuperior?: boolean;
}

/** Tabla densa: la interfaz se mira en pantalla grande y prioriza el dato. */
const Tabla = React.forwardRef<HTMLTableElement, PropiedadesTabla>(
  ({ className, barraSuperior, ...props }, ref) => {
    const tabla = (
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    );

    if (barraSuperior) return <DesplazamientoDoble className="w-full">{tabla}</DesplazamientoDoble>;

    // `desplazable-x` pone la sombra del borde cuando la tabla sigue mas
    // alla de la pantalla. Ver la utilidad en `globals.css`.
    return <div className="desplazable-x w-full overflow-x-auto">{tabla}</div>;
  },
);
Tabla.displayName = "Tabla";

const TablaCabecera = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn("[&_tr]:border-b", className)} {...props} />
));
TablaCabecera.displayName = "TablaCabecera";

const TablaCuerpo = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody ref={ref} className={cn("[&_tr:last-child]:border-0", className)} {...props} />
));
TablaCuerpo.displayName = "TablaCuerpo";

const TablaFila = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn("border-b border-borde transition-colors hover:bg-acento/60", className)}
    {...props}
  />
));
TablaFila.displayName = "TablaFila";

const TablaEncabezado = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    className={cn(
      "h-9 px-3 text-left align-middle text-[11px] font-semibold uppercase tracking-wide " +
        "text-atenuado-contraste",
      className,
    )}
    {...props}
  />
));
TablaEncabezado.displayName = "TablaEncabezado";

const TablaCelda = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td ref={ref} className={cn("px-3 py-2 align-middle", className)} {...props} />
));
TablaCelda.displayName = "TablaCelda";

export { Tabla, TablaCabecera, TablaCuerpo, TablaFila, TablaEncabezado, TablaCelda };
