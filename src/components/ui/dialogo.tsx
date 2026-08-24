"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utilidades";

const Dialogo = DialogPrimitive.Root;
const DialogoDisparador = DialogPrimitive.Trigger;
const DialogoCierre = DialogPrimitive.Close;

const DialogoContenido = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay
      className="fixed inset-0 z-50 bg-black/60 data-[state=open]:animate-in
                 data-[state=closed]:animate-out data-[state=closed]:fade-out-0
                 data-[state=open]:fade-in-0"
    />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        "fixed left-1/2 top-1/2 z-50 grid w-[calc(100vw-2rem)] max-w-lg -translate-x-1/2 " +
          "-translate-y-1/2 gap-4 border border-borde bg-fondo p-5 shadow-xl duration-150 " +
          "rounded-lg max-h-[90vh] overflow-y-auto data-[state=open]:animate-in " +
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 " +
          "data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
    >
      {children}
      <DialogPrimitive.Close
        className="absolute right-4 top-4 rounded-sm opacity-60 transition-opacity
                   hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-anillo"
      >
        <X className="size-4" />
        <span className="sr-only">Cerrar</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
DialogoContenido.displayName = "DialogoContenido";

function DialogoCabecera({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 pr-6", className)} {...props} />;
}

const DialogoTitulo = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-base font-semibold leading-tight", className)}
    {...props}
  />
));
DialogoTitulo.displayName = "DialogoTitulo";

const DialogoDescripcion = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-xs text-atenuado-contraste", className)}
    {...props}
  />
));
DialogoDescripcion.displayName = "DialogoDescripcion";

function DialogoPie({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)}
      {...props}
    />
  );
}

export {
  Dialogo,
  DialogoDisparador,
  DialogoCierre,
  DialogoContenido,
  DialogoCabecera,
  DialogoTitulo,
  DialogoDescripcion,
  DialogoPie,
};
