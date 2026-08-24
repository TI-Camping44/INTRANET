"use client";

import * as React from "react";
import { ThemeProvider } from "next-themes";

/** Habilita el modo claro y oscuro en toda la aplicacion. */
export function ProveedorTema({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      {children}
    </ThemeProvider>
  );
}
