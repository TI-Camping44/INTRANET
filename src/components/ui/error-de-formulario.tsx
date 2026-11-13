"use client";

import * as React from "react";
import { cn } from "@/lib/utilidades";

/**
 * El mensaje de error de una accion de servidor, al pie del formulario.
 *
 * ERA UN `<p>` SUELTO EN QUINCE FORMULARIOS, y eso tenia dos problemas
 * que no se ven mirando la pantalla:
 *
 * · **No se anunciaba.** Quien usa lector de pantalla apretaba
 *   «Guardar», el servidor rechazaba, el texto aparecia al pie y nada
 *   lo decia. La persona se quedaba esperando a que pasara algo.
 *
 * · **No se llegaba.** El foco quedaba en el boton, y en un formulario
 *   largo —el alta de objetivo son catorce campos— el mensaje podia
 *   estar fuera de la pantalla.
 *
 * `role="alert"` resuelve lo primero: el navegador lo anuncia solo al
 * aparecer. Lo segundo lo resuelve mover el foco al mensaje, que ademas
 * lo trae a la vista en cualquier navegador.
 *
 * SE ENFOCA AL CAMBIAR EL TEXTO, no cada vez que se dibuja: si no, un
 * error que sigue en pantalla le robaria el foco a la persona que ya
 * volvio a editar el formulario.
 *
 * `tabIndex={-1}` para que se pueda enfocar por codigo sin entrar en el
 * recorrido del tabulador: el mensaje no es un control.
 */
export function ErrorDeFormulario({
  error,
  className,
}: {
  error: string | null | undefined;
  className?: string;
}) {
  const referencia = React.useRef<HTMLParagraphElement>(null);

  React.useEffect(() => {
    if (error) referencia.current?.focus();
  }, [error]);

  if (!error) return null;

  return (
    <p
      ref={referencia}
      role="alert"
      tabIndex={-1}
      className={cn(
        "text-xs text-semaforo-critico focus-visible:outline-none",
        "focus-visible:ring-2 focus-visible:ring-anillo focus-visible:ring-offset-2",
        "focus-visible:ring-offset-fondo rounded-sm",
        className,
      )}
    >
      {error}
    </p>
  );
}
