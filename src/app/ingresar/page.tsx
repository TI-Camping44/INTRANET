import type { Metadata } from "next";
import { FormularioIngreso } from "@/app/ingresar/formulario-ingreso";
import { Logotipo } from "@/components/comunes/logotipo";
import { DOMINIO_AUTORIZADO, NOMBRE_EMPRESA, NOMBRE_SISTEMA } from "@/lib/constantes";

export const metadata: Metadata = { title: "Ingresar" };

export default function PaginaIngreso({
  searchParams,
}: {
  searchParams: {
    continuar?: string;
    error?: string;
    detalle?: string;
    error_description?: string;
  };
}) {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-fondo px-4 py-10">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logotipo tamano={48} />
          <div>
            <h1 className="text-xl font-semibold tracking-tight">{NOMBRE_SISTEMA}</h1>
            <p className="text-sm text-atenuado-contraste">{NOMBRE_EMPRESA}</p>
          </div>
        </div>

        <div className="rounded-lg border border-borde bg-tarjeta p-6">
          <h2 className="text-sm font-semibold">Ingreso al sistema</h2>
          <p className="mt-1 text-xs leading-relaxed text-atenuado-contraste">
            El acceso está restringido a las cuentas corporativas del dominio{" "}
            <span className="font-medium text-texto">{DOMINIO_AUTORIZADO}</span>.
          </p>

          <FormularioIngreso
            continuar={searchParams.continuar}
            errorInicial={searchParams.error}
            detalleInicial={searchParams.detalle ?? searchParams.error_description}
          />
        </div>

        <p className="mt-6 text-center text-[11px] leading-relaxed text-atenuado-contraste">
          Si necesita acceso y todavía no lo tiene, escriba al responsable de TI.
        </p>
      </div>
    </main>
  );
}
