import type { Metadata } from "next";
import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Logotipo } from "@/components/comunes/logotipo";
import { DOMINIO_AUTORIZADO } from "@/lib/constantes";

export const metadata: Metadata = { title: "Sin acceso" };

const MOTIVOS: Record<string, { titulo: string; detalle: string }> = {
  dominio: {
    titulo: "Cuenta fuera del dominio autorizado",
    detalle:
      `El sistema solo admite cuentas corporativas del dominio ${DOMINIO_AUTORIZADO}. ` +
      "Cierre la sesión de Google y vuelva a ingresar con su cuenta de trabajo.",
  },
  permisos: {
    titulo: "No tiene permisos para esta sección",
    detalle:
      "Su rol dentro del sistema de gestión no habilita esta pantalla. " +
      "Si necesita acceso, solicítelo al Administrador SGC.",
  },
  inactivo: {
    titulo: "Usuario inactivo",
    detalle:
      "Su usuario figura como inactivo en el sistema. Comuníquese con el Administrador SGC " +
      "para reactivarlo.",
  },
};

export default function PaginaSinAcceso({
  searchParams,
}: {
  searchParams: { motivo?: string };
}) {
  const motivo = MOTIVOS[searchParams.motivo ?? ""] ?? MOTIVOS.permisos;

  return (
    <main className="flex min-h-dvh items-center justify-center bg-fondo px-4 py-10">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <Logotipo tamano={40} />
        </div>
        <div className="rounded-lg border border-borde bg-tarjeta p-8">
          <ShieldX className="mx-auto size-8 text-primario" />
          <h1 className="mt-4 text-base font-semibold">{motivo.titulo}</h1>
          <p className="mt-2 text-xs leading-relaxed text-atenuado-contraste">{motivo.detalle}</p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
            <Boton comoHijo>
              <Link href="/panel">Volver al panel</Link>
            </Boton>
            <Boton variante="contorno" comoHijo>
              <a href="/auth/salir">Cerrar sesión</a>
            </Boton>
          </div>
        </div>
      </div>
    </main>
  );
}
