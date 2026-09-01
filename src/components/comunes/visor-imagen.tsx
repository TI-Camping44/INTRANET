"use client";

import * as React from "react";
import { Download, X } from "lucide-react";
import * as PrimitivaDialogo from "@radix-ui/react-dialog";
import { Boton } from "@/components/ui/boton";

/**
 * Vista previa de una imagen del muro.
 *
 * La miniatura de la tarjeta está limitada en alto para que una circular
 * vertical no empuje el resto del muro dos pantallas hacia abajo. Pero
 * limitada es ilegible: una captura de texto a 350 px de alto no se lee.
 * Acá se abre entera, del tamaño que dé la pantalla.
 *
 * No usa el `Dialogo` del proyecto porque ese trae su propia caja con
 * relleno, borde y ancho máximo, pensada para un formulario. Una imagen
 * quiere lo contrario: todo el espacio disponible y nada alrededor.
 */
export function VisorImagen({
  src,
  titulo,
  children,
}: {
  src: string;
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <PrimitivaDialogo.Root>
      <PrimitivaDialogo.Trigger asChild>{children}</PrimitivaDialogo.Trigger>

      <PrimitivaDialogo.Portal>
        <PrimitivaDialogo.Overlay
          className="fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in
                     data-[state=closed]:animate-out data-[state=closed]:fade-out-0
                     data-[state=open]:fade-in-0"
        />
        <PrimitivaDialogo.Content
          className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 p-4
                     focus:outline-none data-[state=open]:animate-in
                     data-[state=closed]:animate-out data-[state=closed]:fade-out-0
                     data-[state=open]:fade-in-0"
        >
          <PrimitivaDialogo.Title className="sr-only">{titulo}</PrimitivaDialogo.Title>

          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={titulo}
            className="max-h-[calc(100vh-9rem)] max-w-full rounded-md object-contain shadow-2xl"
          />

          <div className="flex items-center gap-2">
            <Boton variante="contorno" tamano="pequeno" comoHijo>
              <a href={src} target="_blank" rel="noopener noreferrer">
                <Download /> Abrir en una pestaña
              </a>
            </Boton>
            <PrimitivaDialogo.Close asChild>
              <Boton variante="contorno" tamano="pequeno">
                <X /> Cerrar
              </Boton>
            </PrimitivaDialogo.Close>
          </div>
        </PrimitivaDialogo.Content>
      </PrimitivaDialogo.Portal>
    </PrimitivaDialogo.Root>
  );
}
