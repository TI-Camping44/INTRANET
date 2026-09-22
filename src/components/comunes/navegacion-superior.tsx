"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { Icono } from "@/components/comunes/icono";
import {
  Menu,
  MenuContenido,
  MenuDisparador,
  MenuElemento,
  MenuSub,
  MenuSubContenido,
  MenuSubDisparador,
} from "@/components/ui/menu";
import { cn } from "@/lib/utilidades";
import type { EntradaNavegacion, GrupoNavegacion } from "@/lib/navegacion";

/**
 * Barra de navegación horizontal.
 *
 * Reemplaza al menú lateral fijo, que se comía 240 px de ancho en todas
 * las pantallas. En un sistema hecho de tablas densas ese ancho no es
 * decoración: son dos o tres columnas más que se leen sin desplazar.
 *
 * Los grupos que tienen un solo destino —Inicio, Directorio— van como
 * enlace directo. Los que agrupan módulos van como menú, y cada módulo
 * con atajos propios abre su segundo nivel. Es la forma del menú que
 * pidió Dirección, y también la que menos clics cuesta: llegar a
 * «Documentos obsoletos» pasa de tres pasos a uno.
 *
 * Se abre al hacer clic y no al pasar por encima. Un menú que se abre
 * solo al pasar el mouse no existe en una pantalla táctil, y esto se usa
 * desde el celular en piso de venta y depósito.
 */

/** Los grupos que se dibujan como enlaces sueltos y no como menú. */
const GRUPOS_PLANOS = ["Intranet"];

export function NavegacionSuperior({ grupos }: { grupos: GrupoNavegacion[] }) {
  const rutaActual = usePathname();

  function estaActiva(entrada: EntradaNavegacion) {
    return rutaActual === entrada.ruta || rutaActual.startsWith(`${entrada.ruta}/`);
  }

  return (
    <nav
      className="hidden border-b border-borde bg-tarjeta lg:block"
      aria-label="Navegación principal"
    >
      <div className="flex items-stretch gap-0.5 overflow-x-auto px-3">
        {grupos.map((grupo) =>
          GRUPOS_PLANOS.includes(grupo.titulo) ? (
            grupo.entradas.map((entrada) => (
              <Link
                key={entrada.ruta}
                href={entrada.ruta}
                aria-current={estaActiva(entrada) ? "page" : undefined}
                className={cn(
                  "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors",
                  estaActiva(entrada)
                    ? "border-primario font-medium text-texto"
                    : "border-transparent text-texto/75 hover:bg-acento/50 hover:text-texto",
                )}
              >
                <Icono nombre={entrada.icono} className="size-4 shrink-0" />
                {entrada.titulo}
              </Link>
            ))
          ) : (
            <MenuDeGrupo
              key={grupo.titulo}
              grupo={grupo}
              hayAlgunaActiva={grupo.entradas.some(estaActiva)}
              estaActiva={estaActiva}
            />
          ),
        )}
      </div>
    </nav>
  );
}

function MenuDeGrupo({
  grupo,
  hayAlgunaActiva,
  estaActiva,
}: {
  grupo: GrupoNavegacion;
  hayAlgunaActiva: boolean;
  estaActiva: (entrada: EntradaNavegacion) => boolean;
}) {
  return (
    <Menu>
      <MenuDisparador
        className={cn(
          "flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm outline-none",
          "transition-colors data-[state=open]:bg-acento/50",
          hayAlgunaActiva
            ? "border-primario font-medium text-texto"
            : "border-transparent text-texto/75 hover:bg-acento/50 hover:text-texto",
        )}
      >
        {grupo.titulo}
        <ChevronDown className="size-3.5 opacity-60" />
      </MenuDisparador>

      <MenuContenido align="start" className="min-w-[16rem]">
        {grupo.entradas.map((entrada) => {
          const activa = estaActiva(entrada);

          // Sin atajos propios, el modulo es un enlace y nada mas. Abrir
          // un submenu de un solo elemento es un clic regalado.
          if (!entrada.subentradas || entrada.subentradas.length === 0) {
            return (
              <MenuElemento key={entrada.ruta} asChild>
                <Link
                  href={entrada.ruta}
                  className={cn(activa && "font-medium text-primario")}
                >
                  <Icono nombre={entrada.icono} className="shrink-0" />
                  {entrada.titulo}
                </Link>
              </MenuElemento>
            );
          }

          return (
            <MenuSub key={entrada.ruta}>
              <MenuSubDisparador className={cn(activa && "font-medium text-primario")}>
                <Icono nombre={entrada.icono} className="shrink-0" />
                {entrada.titulo}
              </MenuSubDisparador>
              <MenuSubContenido>
                {/* El primer elemento lleva al módulo entero. Sin esto,
                    un módulo con submenú deja de tener puerta de entrada:
                    se puede ir a sus partes pero no a él. */}
                <MenuElemento asChild>
                  <Link href={entrada.ruta} className="font-medium">
                    Ir a {entrada.titulo}
                  </Link>
                </MenuElemento>
                {entrada.subentradas.map((sub) => (
                  <MenuElemento key={sub.ruta + sub.titulo} asChild>
                    <Link href={sub.ruta}>{sub.titulo}</Link>
                  </MenuElemento>
                ))}
              </MenuSubContenido>
            </MenuSub>
          );
        })}
      </MenuContenido>
    </Menu>
  );
}
