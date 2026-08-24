"use client";

import * as React from "react";
import Link from "next/link";
import { Menu as IconoMenu } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import {
  Dialogo,
  DialogoContenido,
  DialogoDisparador,
  DialogoTitulo,
} from "@/components/ui/dialogo";
import { BuscadorGlobal } from "@/components/comunes/buscador-global";
import { CampanaNotificaciones } from "@/components/comunes/campana-notificaciones";
import { LogotipoCompleto } from "@/components/comunes/logotipo";
import { MenuUsuario } from "@/components/comunes/menu-usuario";
import { NavegacionLateral } from "@/components/comunes/navegacion-lateral";
import { SelectorTema } from "@/components/comunes/selector-tema";
import type { GrupoNavegacion } from "@/lib/navegacion";
import type { Notificacion, Usuario } from "@/lib/tipos";

export function Cabecera({
  usuario,
  grupos,
  notificaciones,
  sinLeer,
}: {
  usuario: Usuario;
  grupos: GrupoNavegacion[];
  notificaciones: Notificacion[];
  sinLeer: number;
}) {
  const [menuAbierto, definirMenuAbierto] = React.useState(false);

  return (
    <header
      className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-borde
                 bg-fondo/95 px-3 backdrop-blur supports-[backdrop-filter]:bg-fondo/80 sm:px-4"
    >
      {/* Menú lateral en pantallas chicas: se usa desde el piso de venta. */}
      <Dialogo open={menuAbierto} onOpenChange={definirMenuAbierto}>
        <DialogoDisparador asChild>
          <Boton variante="fantasma" tamano="icono" className="lg:hidden" aria-label="Abrir menú">
            <IconoMenu />
          </Boton>
        </DialogoDisparador>
        <DialogoContenido className="left-0 top-0 h-full max-h-full w-72 max-w-[85vw] translate-x-0 translate-y-0 rounded-none p-0">
          <DialogoTitulo className="sr-only">Navegación</DialogoTitulo>
          <div className="border-b border-borde px-4 py-3">
            <LogotipoCompleto />
          </div>
          <NavegacionLateral grupos={grupos} alNavegar={() => definirMenuAbierto(false)} />
        </DialogoContenido>
      </Dialogo>

      <Link href="/panel" className="lg:hidden">
        <LogotipoCompleto className="[&_span:last-child]:hidden sm:[&_span:last-child]:block" />
      </Link>

      <div className="ml-auto flex flex-1 items-center justify-end gap-1.5 lg:ml-0 lg:justify-between">
        <div className="hidden flex-1 lg:block">
          <BuscadorGlobal />
        </div>
        <div className="flex items-center gap-1">
          <CampanaNotificaciones notificaciones={notificaciones} sinLeer={sinLeer} />
          <SelectorTema />
          <MenuUsuario usuario={usuario} />
        </div>
      </div>
    </header>
  );
}
