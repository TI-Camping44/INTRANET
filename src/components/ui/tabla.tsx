import * as React from "react";
import { cn } from "@/lib/utilidades";

/** Tabla densa: la interfaz se mira en pantalla grande y prioriza el dato. */
const Tabla = React.forwardRef<HTMLTableElement, React.HTMLAttributes<HTMLTableElement>>(
  ({ className, ...props }, ref) => (
    <div className="w-full overflow-x-auto">
      <table ref={ref} className={cn("w-full caption-bottom text-sm", className)} {...props} />
    </div>
  ),
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
