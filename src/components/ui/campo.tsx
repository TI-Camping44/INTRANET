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

/**
 * Entrada de texto.
 *
 * `autocomplete="off"` POR OMISION, y se pisa donde corresponde. Casi
 * todos los campos del sistema son de negocio —titulo, codigo, valor,
 * plazo— y ahi el autocompletado del navegador no tiene nada util que
 * ofrecer: lo unico que hace es disparar al gestor de contrasenas sobre
 * un formulario de no conformidad. Los pocos campos de datos personales
 * —nombre, telefono, correo, ciudad— declaran su propio valor y ese
 * gana, porque va despues en el reparto de propiedades.
 */
const Entrada = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      autoComplete="off"
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
 *
 * EL FONDO VA EXPLICITO —`bg-fondo`— y no heredado: en el modo oscuro
 * de Windows, un `select` sin color propio se dibuja con la paleta del
 * sistema y queda texto oscuro sobre fondo oscuro.
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

/**
 * Agrupa etiqueta, control y mensaje de ayuda o error.
 *
 * EL ERROR Y LA AYUDA SE ATAN AL CONTROL, no se dibujan al lado y ya.
 * Cuando se pasa `htmlFor`, el mensaje recibe un `id` derivado y el
 * control queda apuntado por `aria-describedby`; si es un error, ademas
 * se marca `aria-invalid`. Sin eso, quien usa lector de pantalla llega
 * al campo y no escucha por que fue rechazado: el texto existe en la
 * pantalla pero no pertenece a nada.
 *
 * El atado se hace clonando el control en vez de pedirle a cada
 * formulario que repita los tres atributos. Son 122 campos en el
 * sistema: repetirlos a mano garantiza que falten en la mitad.
 *
 * EL MENSAJE DE ERROR SE ANUNCIA al aparecer, por `role="alert"`. La
 * ayuda no: es texto que ya estaba cuando la persona llego al campo.
 */
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
  const idMensaje = htmlFor ? `${htmlFor}-${error ? "error" : "ayuda"}` : undefined;
  const hayMensaje = Boolean(error || ayuda);

  // Solo se clona un elemento de React; cualquier otra cosa se deja
  // pasar tal cual para no romper los bloques que envuelven varios
  // controles a la vez.
  const control =
    idMensaje && hayMensaje && React.isValidElement(children)
      ? React.cloneElement(children as React.ReactElement<Record<string, unknown>>, {
          "aria-describedby":
            [
              (children.props as Record<string, unknown>)["aria-describedby"],
              idMensaje,
            ]
              .filter(Boolean)
              .join(" ") || undefined,
          "aria-invalid": error ? true : undefined,
        })
      : children;

  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Etiqueta htmlFor={htmlFor}>
        {etiqueta}
        {requerido ? (
          <>
            {/* El asterisco es decoracion: lo que marca el campo como
                obligatorio para la tecnologia de apoyo es el `required`
                del control, no este simbolo. */}
            <span aria-hidden className="ml-0.5 text-primario">
              *
            </span>
            <span className="sr-only"> (obligatorio)</span>
          </>
        ) : null}
      </Etiqueta>
      {control}
      {error ? (
        <p id={idMensaje} role="alert" className="text-xs text-semaforo-critico">
          {error}
        </p>
      ) : ayuda ? (
        <p id={idMensaje} className="text-xs text-atenuado-contraste">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}

export { Etiqueta, Entrada, AreaTexto, Seleccion, GrupoCampo };
