"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { ErrorDeFormulario } from "@/components/ui/error-de-formulario";
import { AvisoDeCambiosSinGuardar } from "@/components/ui/aviso-cambios-sin-guardar";
import { actualizarControl, crearControl } from "@/app/(sgc)/informatica/controles/acciones";
import { ETIQUETAS_FRECUENCIA, FRECUENCIAS_CONTROL } from "@/lib/controles-ti";

/** Los datos del control que este formulario edita. */
export interface ControlInicial {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  documento_origen: string | null;
  formulario: string | null;
  frecuencia_meses: number;
  primer_periodo: string;
  responsable_id: string | null;
  vigente: boolean;
}

/**
 * El mismo formulario sirve para el alta y para la edición. Con uno
 * propio para cada cosa, el de edición termina pidiendo menos campos que
 * el alta y guardar borra lo que no preguntó.
 *
 * EL CÓDIGO SOLO SE ESCRIBE AL DAR DE ALTA: identifica al control en sus
 * ejecuciones y en la bitácora.
 */
export function FormularioControl({
  personas,
  codigoSugerido,
  responsableSugerido,
  inicial,
}: {
  personas: { id: string; nombre_completo: string }[];
  codigoSugerido?: string;
  responsableSugerido?: string;
  inicial?: ControlInicial;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const datos = new FormData(evento.currentTarget);
    const resultado = inicial
      ? await actualizarControl(inicial.id, datos)
      : await crearControl(datos);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Control guardado.");
      router.push(`/informatica/controles/${inicial?.id ?? resultado.id}`);
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
          {inicial ? null : (
            <GrupoCampo etiqueta="Código" htmlFor="codigo" requerido>
              <Entrada
                id="codigo"
                name="codigo"
                defaultValue={codigoSugerido}
                required
                maxLength={20}
                className="tabular"
              />
            </GrupoCampo>
          )}

          <GrupoCampo
            etiqueta="Nombre del control"
            htmlFor="nombre"
            requerido
            className={inicial ? "sm:col-span-2" : undefined}
          >
            <Entrada
              id="nombre"
              name="nombre"
              defaultValue={inicial?.nombre}
              required
              minLength={5}
              placeholder="Auditoría de cuentas activas"
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Qué se controla"
            htmlFor="descripcion"
            className="sm:col-span-2"
          >
            <AreaTexto
              id="descripcion"
              name="descripcion"
              rows={3}
              defaultValue={inicial?.descripcion ?? ""}
              placeholder="Qué se revisa, contra qué y qué se hace con lo que aparece…"
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Proceso que lo exige"
            htmlFor="documento_origen"
            ayuda="El proceso y su actividad, para ir directo a la fuente."
          >
            <Entrada
              id="documento_origen"
              name="documento_origen"
              defaultValue={inicial?.documento_origen ?? ""}
              placeholder="MP-SOP-07, actividad 2"
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Formulario de registro"
            htmlFor="formulario"
            ayuda="Si el control se registra en un formulario del SGC."
          >
            <Entrada
              id="formulario"
              name="formulario"
              defaultValue={inicial?.formulario ?? ""}
              placeholder="F-SOP-03-03"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Frecuencia" htmlFor="frecuencia_meses" requerido>
            <Seleccion
              id="frecuencia_meses"
              name="frecuencia_meses"
              required
              defaultValue={String(inicial?.frecuencia_meses ?? 1)}
            >
              {FRECUENCIAS_CONTROL.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS_FRECUENCIA[valor]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Primer mes del ciclo"
            htmlFor="primer_periodo"
            requerido
            ayuda="Desde este mes se cuentan los períodos según la frecuencia."
          >
            <Entrada
              id="primer_periodo"
              name="primer_periodo"
              type="month"
              required
              defaultValue={inicial?.primer_periodo.slice(0, 7)}
              className="tabular"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Responsable" htmlFor="responsable_id" requerido>
            <Seleccion
              id="responsable_id"
              name="responsable_id"
              required
              defaultValue={inicial?.responsable_id ?? responsableSugerido ?? ""}
            >
              <option value="" disabled>
                Elija una persona
              </option>
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          {inicial ? (
            <div className="flex items-end pb-2">
              <input type="hidden" name="vigente_preguntado" value="1" />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  name="vigente"
                  defaultChecked={inicial.vigente}
                  className="size-4 accent-primario"
                />
                Vigente: se sigue programando
              </label>
            </div>
          ) : null}
        </div>

        <AvisoDeCambiosSinGuardar />
        {error ? <ErrorDeFormulario error={error} className="mt-4" /> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            {inicial ? "Guardar cambios" : "Programar control"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
