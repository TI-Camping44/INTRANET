import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { Toaster } from "sonner";
import { ProveedorTema } from "@/components/comunes/proveedor-tema";
import { NOMBRE_EMPRESA, NOMBRE_SISTEMA } from "@/lib/constantes";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--fuente-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: `${NOMBRE_SISTEMA} · ${NOMBRE_EMPRESA}`,
    template: `%s · ${NOMBRE_SISTEMA}`,
  },
  description:
    "Intranet de Camping 44 S.A.: publicaciones y directorio, el Sistema de " +
    "Gestión de Calidad y las aplicaciones de la empresa.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#14161B" },
  ],
};

export default function RaizLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className={`${inter.variable} font-sans antialiased`}>
        <ProveedorTema>
          {children}
          <Toaster position="top-right" richColors closeButton />
        </ProveedorTema>
      </body>
    </html>
  );
}
