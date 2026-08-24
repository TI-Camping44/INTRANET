"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utilidades";

const Pestanas = TabsPrimitive.Root;

const PestanasLista = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex h-9 items-center justify-start gap-1 overflow-x-auto rounded-md " +
        "bg-atenuado p-1 text-atenuado-contraste",
      className,
    )}
    {...props}
  />
));
PestanasLista.displayName = "PestanasLista";

const PestanaDisparador = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center whitespace-nowrap rounded px-3 py-1 text-xs " +
        "font-medium transition-all focus-visible:outline-none focus-visible:ring-2 " +
        "focus-visible:ring-anillo disabled:pointer-events-none disabled:opacity-50 " +
        "data-[state=active]:bg-fondo data-[state=active]:text-texto data-[state=active]:shadow-sm",
      className,
    )}
    {...props}
  />
));
PestanaDisparador.displayName = "PestanaDisparador";

const PestanaContenido = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn("mt-4 focus-visible:outline-none", className)}
    {...props}
  />
));
PestanaContenido.displayName = "PestanaContenido";

export { Pestanas, PestanasLista, PestanaDisparador, PestanaContenido };
