"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { ErrorDeFormulario } from "@/components/ui/error-de-formulario";
import { AvisoDeCambiosSinGuardar } from "@/components/ui/aviso-cambios-sin-guardar";
import { actualizarLicencia } from "@/app/(sgc)/informatica/licencias/acciones";
import { CICLOS_LICENCIA, ETIQUETAS_MONEDA, MONEDAS } from "@/lib/gastos-ti";

export interface LicenciaInicial {
  id: string;
  cantidad_contratada: number | null;
  cantidad_en_uso: number | null;
  costo_ciclo: number | null;
  moneda_costo: string | null;
  ciclo_meses: number | null;
}

/** Las cantidades y el costo de una licencia. Lo demás se edita en Activos. */
export function FormularioLicencia({ inicial }: { inicial: LicenciaInicial }) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);
    const resultado = await actualizarLicencia(inicial.id, new FormData(evento.currentTarget));
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Licencia actualizada.");
      router.push("/informatica/licencias");
      router.refresh();
    } else {
      definirError(resultado.error);
      toast.error(resultado.error);
      definirEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <Tarjeta className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <GrupoCampo etiqueta="Contratadas" htmlFor="cantidad_contratada" ayuda="Vacío si no se relevó.">
            <Entrada
              id="cantidad_contratada"
              name="cantidad_contratada"
              type="number"
              min={0}
              step={1}
              defaultValue={inicial.cantidad_contratada ?? ""}
              className="tabular"
            />
          </GrupoCampo>
          <GrupoCampo
            etiqueta="En uso"
            htmlFor="cantidad_en_uso"
            ayuda="Asignadas, incluidas las de Vitalica."
          >
            <Entrada
              id="cantidad_en_uso"
              name="cantidad_en_uso"
              type="number"
              min={0}
              step={1}
              defaultValue={inicial.cantidad_en_uso ?? ""}
              className="tabular"
            />
          </GrupoCampo>
          <GrupoCampo etiqueta="Costo del ciclo" htmlFor="costo_ciclo" ayuda="Vacío si no se sabe.">
            <Entrada
              id="costo_ciclo"
              name="costo_ciclo"
              inputMode="decimal"
              defaultValue={
                inicial.costo_ciclo === null ? "" : String(inicial.costo_ciclo).replace(".", ",")
              }
              placeholder="308,44"
              className="tabular"
            />
          </GrupoCampo>
          <GrupoCampo etiqueta="Moneda" htmlFor="moneda_costo">
            <Seleccion id="moneda_costo" name="moneda_costo" defaultValue={inicial.moneda_costo ?? "USD"}>
              {MONEDAS.map((moneda) => (
                <option key={moneda} value={moneda}>
                  {ETIQUETAS_MONEDA[moneda]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>
          <GrupoCampo etiqueta="Se paga" htmlFor="ciclo_meses" className="sm:col-span-2">
            <Seleccion
              id="ciclo_meses"
              name="ciclo_meses"
              defaultValue={inicial.ciclo_meses === null ? "" : String(inicial.ciclo_meses)}
            >
              <option value="">Sin definir</option>
              {CICLOS_LICENCIA.map((ciclo) => (
                <option key={ciclo.meses} value={ciclo.meses}>
                  {ciclo.etiqueta}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>
        </div>

        <AvisoDeCambiosSinGuardar />
        {error ? <ErrorDeFormulario error={error} className="mt-4" /> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            Guardar
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
