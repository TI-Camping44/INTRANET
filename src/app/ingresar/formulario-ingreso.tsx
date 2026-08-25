"use client";

import * as React from "react";
import { Boton } from "@/components/ui/boton";
import { Aviso, AvisoDescripcion } from "@/components/ui/aviso";
import { crearClienteNavegador } from "@/lib/supabase/navegador";
import { DOMINIO_AUTORIZADO } from "@/lib/constantes";

const MENSAJES_ERROR: Record<string, string> = {
  dominio: `Esa cuenta no pertenece al dominio ${DOMINIO_AUTORIZADO}.`,
  intercambio: "No se pudo completar el ingreso. Vuelva a intentarlo.",
  sin_codigo: "El enlace de ingreso no es válido o ya expiró.",
  inactivo: "Su usuario está inactivo. Comuníquese con el Administrador SGC.",
  // Lo devuelve Supabase cuando el retorno de Google no corresponde a un
  // ingreso que haya empezado en esta pantalla: tipicamente una pestana
  // vieja que se recarga, o el boton de atras del navegador.
  invalid_request: "Ese intento de ingreso ya no es válido. Empiece de nuevo desde este botón.",
};

export function FormularioIngreso({
  continuar,
  errorInicial,
  detalleInicial,
}: {
  continuar?: string;
  errorInicial?: string;
  /** Motivo tecnico que devolvio el servidor, para poder diagnosticar. */
  detalleInicial?: string;
}) {
  const [cargando, definirCargando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(
    errorInicial ? (MENSAJES_ERROR[errorInicial] ?? MENSAJES_ERROR.intercambio) : null,
  );
  const [detalle, definirDetalle] = React.useState<string | null>(detalleInicial ?? null);

  async function ingresarConGoogle() {
    definirCargando(true);
    definirError(null);
    definirDetalle(null);

    const supabase = crearClienteNavegador();
    const destino = new URL("/auth/callback", window.location.origin);
    if (continuar) destino.searchParams.set("continuar", continuar);

    const { error: fallo } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: destino.toString(),
        // Google restringe el selector de cuentas al dominio corporativo.
        // La validación real se repite en el servidor y en la base de datos.
        queryParams: { hd: DOMINIO_AUTORIZADO, prompt: "select_account" },
      },
    });

    if (fallo) {
      definirError("No se pudo iniciar el ingreso con Google.");
      definirCargando(false);
    }
  }

  return (
    <div className="mt-5 flex flex-col gap-3">
      {error ? (
        <Aviso variante="peligro">
          <AvisoDescripcion>
            {error}
            {detalle ? (
              <span className="mt-1 block text-[11px] opacity-80">Motivo: {detalle}</span>
            ) : null}
          </AvisoDescripcion>
        </Aviso>
      ) : null}

      <Boton onClick={ingresarConGoogle} disabled={cargando} className="w-full">
        <LogotipoGoogle />
        {cargando ? "Redirigiendo…" : "Continuar con Google"}
      </Boton>
    </div>
  );
}

function LogotipoGoogle() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4">
      <path
        fill="#FFFFFF"
        d="M12 11v2.8h6.6c-.3 1.7-2 5-6.6 5-4 0-7.2-3.3-7.2-7.4S8 4 12 4c2.3 0 3.8.97 4.7 1.8l2.2-2.1C17.4 2.3 15 1.3 12 1.3 6.5 1.3 2 5.8 2 11.4s4.5 10.1 10 10.1c5.8 0 9.6-4 9.6-9.8 0-.66-.07-1.16-.16-1.66H12z"
      />
    </svg>
  );
}
