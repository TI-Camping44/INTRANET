"use client";

import * as React from "react";
import Link from "next/link";
import { LogOut, User } from "lucide-react";
import { Avatar, AvatarImagen, AvatarRespaldo } from "@/components/ui/avatar";
import {
  Menu,
  MenuContenido,
  MenuDisparador,
  MenuElemento,
  MenuSeparador,
} from "@/components/ui/menu";
import { ETIQUETAS_ROL } from "@/lib/constantes";
import { iniciales } from "@/lib/utilidades";
import type { Usuario } from "@/lib/tipos";

export function MenuUsuario({ usuario }: { usuario: Usuario }) {
  return (
    <Menu>
      <MenuDisparador asChild>
        <button
          type="button"
          className="rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-anillo"
          aria-label="Menú de la cuenta"
        >
          <Avatar>
            {usuario.url_avatar ? (
              <AvatarImagen src={usuario.url_avatar} alt="" />
            ) : null}
            <AvatarRespaldo>{iniciales(usuario.nombre_completo)}</AvatarRespaldo>
          </Avatar>
        </button>
      </MenuDisparador>

      <MenuContenido align="end">
        <div className="px-2 py-1.5">
          <p className="truncate text-sm font-medium">{usuario.nombre_completo}</p>
          <p className="truncate text-[11px] text-atenuado-contraste">{usuario.correo}</p>
          <p className="mt-1 text-[11px] font-medium text-primario">
            {ETIQUETAS_ROL[usuario.rol]}
          </p>
        </div>
        <MenuSeparador />
        <MenuElemento asChild>
          <Link href="/perfil">
            <User /> Mi perfil
          </Link>
        </MenuElemento>
        <MenuSeparador />
        <MenuElemento asChild>
          <a href="/auth/salir">
            <LogOut /> Cerrar sesión
          </a>
        </MenuElemento>
      </MenuContenido>
    </Menu>
  );
}
