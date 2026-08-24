import * as React from "react";
import * as LabelPrimitive from "@radix-ui/react-label";
import { cn } from "@/lib/utilidades";

const Etiqueta = React.forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-xs font-medium leading-none text-atenuado-contraste " +
        "peer-disabled:cursor-not-allowed peer-disabled:opacity-70",
      className,
    )}
    {...props}
  />
));
Etiqueta.displayName = "Etiqueta";

const Entrada = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-9 w-full rounded-md border border-entrada bg-transparent px-3 py-1 text-sm " +
          "shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm " +
          "file:font-medium placeholder:text-atenuado-contraste focus-visible:outline-none " +
          "focus-visible:ring-2 focus-visible:ring-anillo disabled:cursor-not-allowed " +
          "disabled:opacity-50",
        className,
      )}
      {...props}
    />
  ),
);
Entrada.displayName = "Entrada";

const AreaTexto = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[80px] w-full rounded-md border border-entrada bg-transparent px-3 py-2 " +
        "text-sm shadow-sm placeholder:text-atenuado-contraste focus-visible:outline-none " +
        "focus-visible:ring-2 focus-visible:ring-anillo disabled:cursor-not-allowed " +
        "disabled:opacity-50",
      className,
    )}
    {...props}
  />
));
AreaTexto.displayName = "AreaTexto";

/**
 * Selector nativo. Se prefiere sobre un componente propio porque en el
 * celular abre el selector del sistema operativo, que es lo que espera
 * quien carga datos desde el piso de venta o el deposito.
 */
const Seleccion = React.forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement>
>(({ className, children, ...props }, ref) => (
  <select
    ref={ref}
    className={cn(
      "flex h-9 w-full rounded-md border border-entrada bg-fondo px-3 py-1 text-sm shadow-sm " +
        "transition-colors focus-visible:outline-none focus-visible:ring-2 " +
        "focus-visible:ring-anillo disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...props}
  >
    {children}
  </select>
));
Seleccion.displayName = "Seleccion";

/** Agrupa etiqueta, control y mensaje de ayuda o error. */
function GrupoCampo({
  etiqueta,
  htmlFor,
  ayuda,
  error,
  requerido,
  className,
  children,
}: {
  etiqueta: string;
  htmlFor?: string;
  ayuda?: string;
  error?: string;
  requerido?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Etiqueta htmlFor={htmlFor}>
        {etiqueta}
        {requerido ? <span className="ml-0.5 text-primario">*</span> : null}
      </Etiqueta>
      {children}
      {error ? (
        <p className="text-xs text-semaforo-critico">{error}</p>
      ) : ayuda ? (
        <p className="text-xs text-atenuado-contraste">{ayuda}</p>
      ) : null}
    </div>
  );
}

export { Etiqueta, Entrada, AreaTexto, Seleccion, GrupoCampo };
