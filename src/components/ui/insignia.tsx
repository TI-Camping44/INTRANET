import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utilidades";

const variantesInsignia = cva(
  "inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-medium leading-5 " +
    "whitespace-nowrap transition-colors",
  {
    variants: {
      variante: {
        neutra: "border-borde bg-atenuado text-atenuado-contraste",
        primaria: "border-primario/30 bg-primario/10 text-primario",
        exito: "border-semaforo-bajo/30 bg-semaforo-bajo/15 text-semaforo-bajo",
        advertencia: "border-semaforo-medio/30 bg-semaforo-medio/15 text-semaforo-medio",
        atencion: "border-semaforo-alto/30 bg-semaforo-alto/15 text-semaforo-alto",
        peligro: "border-semaforo-critico/30 bg-semaforo-critico/15 text-semaforo-critico",
        contorno: "border-borde text-texto",
      },
    },
    defaultVariants: { variante: "neutra" },
  },
);

export interface PropiedadesInsignia
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof variantesInsignia> {}

function Insignia({ className, variante, ...props }: PropiedadesInsignia) {
  return <span className={cn(variantesInsignia({ variante }), className)} {...props} />;
}

export { Insignia, variantesInsignia };
