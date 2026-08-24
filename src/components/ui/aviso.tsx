import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utilidades";

const variantesAviso = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:size-4 [&>svg]:shrink-0 " +
    "[&>svg]:mt-0.5 flex gap-3",
  {
    variants: {
      variante: {
        informativo: "border-borde bg-atenuado/50 text-texto",
        exito: "border-semaforo-bajo/30 bg-semaforo-bajo/10 text-semaforo-bajo",
        advertencia: "border-semaforo-medio/30 bg-semaforo-medio/10 text-semaforo-medio",
        peligro: "border-semaforo-critico/30 bg-semaforo-critico/10 text-semaforo-critico",
      },
    },
    defaultVariants: { variante: "informativo" },
  },
);

export interface PropiedadesAviso
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof variantesAviso> {}

function Aviso({ className, variante, ...props }: PropiedadesAviso) {
  return <div role="status" className={cn(variantesAviso({ variante }), className)} {...props} />;
}

function AvisoTitulo({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h5 className={cn("mb-0.5 font-semibold leading-tight", className)} {...props} />;
}

function AvisoDescripcion({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <div className={cn("text-xs leading-relaxed opacity-90", className)} {...props} />;
}

export { Aviso, AvisoTitulo, AvisoDescripcion };
