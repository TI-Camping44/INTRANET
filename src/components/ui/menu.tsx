"use client";

import * as React from "react";
import * as DropdownMenuPrimitive from "@radix-ui/react-dropdown-menu";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utilidades";

const Menu = DropdownMenuPrimitive.Root;
const MenuDisparador = DropdownMenuPrimitive.Trigger;

const MenuContenido = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Content>
>(({ className, sideOffset = 6, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[13rem] overflow-hidden rounded-md border border-borde bg-emergente p-1 " +
          "text-emergente-contraste shadow-lg data-[state=open]:animate-in " +
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 " +
          "data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 " +
          "data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
MenuContenido.displayName = "MenuContenido";

const MenuElemento = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Item>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Item
    ref={ref}
    className={cn(
      "relative flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 " +
        "text-sm outline-none transition-colors focus:bg-acento focus:text-acento-contraste " +
        "data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4",
      className,
    )}
    {...props}
  />
));
MenuElemento.displayName = "MenuElemento";

const MenuEtiqueta = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Label>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Label
    ref={ref}
    className={cn("px-2 py-1.5 text-xs font-semibold text-atenuado-contraste", className)}
    {...props}
  />
));
MenuEtiqueta.displayName = "MenuEtiqueta";

/**
 * Submenu de segundo nivel.
 *
 * Se abre al pasar por encima cuando el menu ya esta abierto, y tambien
 * al tocar: Radix lo resuelve con un click en pantalla tactil, asi que
 * funciona igual desde el celular del piso de venta.
 */
const MenuSub = DropdownMenuPrimitive.Sub;

const MenuSubDisparador = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubTrigger>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubTrigger>
>(({ className, children, ...props }, ref) => (
  <DropdownMenuPrimitive.SubTrigger
    ref={ref}
    className={cn(
      "flex cursor-pointer select-none items-center gap-2 rounded-sm px-2 py-1.5 text-sm " +
        "outline-none transition-colors focus:bg-acento focus:text-acento-contraste " +
        "data-[state=open]:bg-acento data-[state=open]:text-acento-contraste [&_svg]:size-4",
      className,
    )}
    {...props}
  >
    {children}
    <ChevronRight className="ml-auto opacity-60" />
  </DropdownMenuPrimitive.SubTrigger>
));
MenuSubDisparador.displayName = "MenuSubDisparador";

const MenuSubContenido = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.SubContent>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.SubContent>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <DropdownMenuPrimitive.Portal>
    <DropdownMenuPrimitive.SubContent
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        "z-50 min-w-[13rem] overflow-hidden rounded-md border border-borde bg-emergente p-1 " +
          "text-emergente-contraste shadow-lg data-[state=open]:animate-in " +
          "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 " +
          "data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 " +
          "data-[state=open]:zoom-in-95",
        className,
      )}
      {...props}
    />
  </DropdownMenuPrimitive.Portal>
));
MenuSubContenido.displayName = "MenuSubContenido";

const MenuSeparador = React.forwardRef<
  React.ElementRef<typeof DropdownMenuPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <DropdownMenuPrimitive.Separator
    ref={ref}
    className={cn("-mx-1 my-1 h-px bg-borde", className)}
    {...props}
  />
));
MenuSeparador.displayName = "MenuSeparador";

export {
  Menu,
  MenuDisparador,
  MenuContenido,
  MenuElemento,
  MenuEtiqueta,
  MenuSeparador,
  MenuSub,
  MenuSubDisparador,
  MenuSubContenido,
};
