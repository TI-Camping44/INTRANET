import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utilidades";

const variantesBoton = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium " +
    "transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-anillo " +
    "focus-visible:ring-offset-2 focus-visible:ring-offset-fondo disabled:pointer-events-none " +
    "disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variante: {
        primario: "bg-primario text-primario-contraste hover:bg-primario/90",
        secundario: "bg-secundario text-secundario-contraste hover:bg-secundario/80",
        contorno: "border border-borde bg-transparent hover:bg-acento hover:text-acento-contraste",
        fantasma: "hover:bg-acento hover:text-acento-contraste",
        destructivo: "bg-destructivo text-destructivo-contraste hover:bg-destructivo/90",
        enlace: "text-primario underline-offset-4 hover:underline",
      },
      tamano: {
        normal: "h-9 px-4 py-2",
        pequeno: "h-8 rounded-md px-3 text-xs",
        grande: "h-10 rounded-md px-6",
        icono: "h-9 w-9",
        iconoPequeno: "h-8 w-8",
      },
    },
    defaultVariants: { variante: "primario", tamano: "normal" },
  },
);

export interface PropiedadesBoton
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof variantesBoton> {
  comoHijo?: boolean;
}

const Boton = React.forwardRef<HTMLButtonElement, PropiedadesBoton>(
  ({ className, variante, tamano, comoHijo = false, ...props }, ref) => {
    const Componente = comoHijo ? Slot : "button";
    return (
      <Componente
        className={cn(variantesBoton({ variante, tamano }), className)}
        ref={ref}
        {...props}
      />
    );
  },
);
Boton.displayName = "Boton";

export { Boton, variantesBoton };
