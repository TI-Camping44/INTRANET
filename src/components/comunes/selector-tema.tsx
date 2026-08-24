"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import {
  Menu,
  MenuContenido,
  MenuDisparador,
  MenuElemento,
  MenuEtiqueta,
} from "@/components/ui/menu";

export function SelectorTema() {
  const { theme: tema, setTheme: definirTema } = useTheme();
  const [montado, definirMontado] = React.useState(false);

  // Evita el desajuste entre servidor y navegador en el primer render.
  React.useEffect(() => definirMontado(true), []);

  return (
    <Menu>
      <MenuDisparador asChild>
        <Boton variante="fantasma" tamano="icono" aria-label="Cambiar tema">
          {montado && tema === "dark" ? <Moon /> : <Sun />}
        </Boton>
      </MenuDisparador>
      <MenuContenido align="end">
        <MenuEtiqueta>Apariencia</MenuEtiqueta>
        <MenuElemento onClick={() => definirTema("light")}>
          <Sun /> Claro
        </MenuElemento>
        <MenuElemento onClick={() => definirTema("dark")}>
          <Moon /> Oscuro
        </MenuElemento>
        <MenuElemento onClick={() => definirTema("system")}>
          <Monitor /> Según el sistema
        </MenuElemento>
      </MenuContenido>
    </Menu>
  );
}
