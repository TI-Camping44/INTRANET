import * as React from "react";
import { cn } from "@/lib/utilidades";

const Tarjeta = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("rounded-lg border border-borde bg-tarjeta text-tarjeta-contraste", className)}
      {...props}
    />
  ),
);
Tarjeta.displayName = "Tarjeta";

const TarjetaCabecera = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex flex-col gap-1 p-4", className)} {...props} />
  ),
);
TarjetaCabecera.displayName = "TarjetaCabecera";

const TarjetaTitulo = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <h3
      ref={ref}
      className={cn("text-sm font-semibold leading-tight tracking-tight", className)}
      {...props}
    />
  ),
);
TarjetaTitulo.displayName = "TarjetaTitulo";

const TarjetaDescripcion = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <p ref={ref} className={cn("text-xs text-atenuado-contraste", className)} {...props} />
  ),
);
TarjetaDescripcion.displayName = "TarjetaDescripcion";

const TarjetaContenido = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("p-4 pt-0", className)} {...props} />
  ),
);
TarjetaContenido.displayName = "TarjetaContenido";

const TarjetaPie = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn("flex items-center gap-2 p-4 pt-0", className)} {...props} />
  ),
);
TarjetaPie.displayName = "TarjetaPie";

export {
  Tarjeta,
  TarjetaCabecera,
  TarjetaTitulo,
  TarjetaDescripcion,
  TarjetaContenido,
  TarjetaPie,
};
