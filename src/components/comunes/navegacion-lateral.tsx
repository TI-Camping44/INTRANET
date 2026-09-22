"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icono } from "@/components/comunes/icono";
import { cn } from "@/lib/utilidades";
import type { GrupoNavegacion } from "@/lib/navegacion";

/**
 * Menu en arbol, para el cajon de pantalla chica.
 *
 * En pantalla grande el menu es la barra horizontal; este es su otra
 * forma, y sale de la misma estructura de `lib/navegacion.ts`.
 *
 * Los atajos de segundo nivel se muestran solo del modulo en el que se
 * esta. Mostrarlos todos convierte el cajon en una lista de cuarenta
 * filas donde no se encuentra nada, y mostrarlos de ninguno obliga a
 * entrar al modulo para recien ahi ver sus vistas.
 */
export function NavegacionLateral({
  grupos,
  alNavegar,
}: {
  grupos: GrupoNavegacion[];
  alNavegar?: () => void;
}) {
  const rutaActual = usePathname();

  return (
    <nav className="flex flex-col gap-5 px-3 py-4" aria-label="Navegación principal">
      {grupos.map((grupo) => (
        <div key={grupo.titulo} className="flex flex-col gap-1">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-atenuado-contraste">
            {grupo.titulo}
          </p>
          {grupo.entradas.map((entrada) => {
            const activa =
              rutaActual === entrada.ruta || rutaActual.startsWith(`${entrada.ruta}/`);

            const subentradas = activa ? (entrada.subentradas ?? []) : [];

            return (
              <div key={entrada.ruta}>
                <Link
                  href={entrada.ruta}
                  onClick={alNavegar}
                  aria-current={activa ? "page" : undefined}
                  className={cn(
                    "group flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors",
                    activa
                      ? "bg-primario/10 font-medium text-primario"
                      : "text-texto/80 hover:bg-acento hover:text-acento-contraste",
                  )}
                >
                  <Icono nombre={entrada.icono} className="size-4 shrink-0" />
                  <span className="flex-1 truncate">{entrada.titulo}</span>
                  {entrada.fase === "en_construccion" ? (
                    <span
                      title="Módulo en construcción"
                      className="size-1.5 shrink-0 rounded-full bg-semaforo-medio"
                    />
                  ) : null}
                </Link>

                {subentradas.length > 0 ? (
                  <div className="ml-6 mt-0.5 flex flex-col border-l border-borde pl-2">
                    {subentradas.map((sub) => (
                      <Link
                        key={sub.ruta + sub.titulo}
                        href={sub.ruta}
                        onClick={alNavegar}
                        className="truncate rounded-md px-2 py-1 text-xs text-texto/70
                                   transition-colors hover:bg-acento hover:text-acento-contraste"
                      >
                        {sub.titulo}
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
