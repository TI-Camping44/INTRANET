"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { ErrorDeFormulario } from "@/components/ui/error-de-formulario";
import { AvisoDeCambiosSinGuardar } from "@/components/ui/aviso-cambios-sin-guardar";
import {
  actualizarAutomatismo,
  crearAutomatismo,
} from "@/app/(sgc)/informatica/automatismos/acciones";
import { FRECUENCIAS_SUGERIDAS } from "@/lib/automatismos-ti";

export interface AutomatismoInicial {
  id: string;
  clave: string;
  nombre: string;
  donde_vive: string | null;
  descripcion: string | null;
  frecuencia_horas: number | null;
  vigente: boolean;
  responsable_id: string | null;
}

export interface PersonaOpcion {
  id: string;
  nombre_completo: string;
}

/** El mismo formulario para el alta y la edición. La clave solo se escribe al dar de alta. */
export function FormularioAutomatismo({
  personas,
  inicial,
  responsablePorOmision,
}: {
  personas: PersonaOpcion[];
  inicial?: AutomatismoInicial;
  responsablePorOmision?: string;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const datos = new FormData(evento.currentTarget);
    if (inicial) datos.set("clave", inicial.clave);
    const resultado = inicial
      ? await actualizarAutomatismo(inicial.id, datos)
      : await crearAutomatismo(datos);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Automatismo guardado.");
      router.push(`/informatica/automatismos/${inicial?.id ?? resultado.id}`);
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
          <GrupoCampo etiqueta="Nombre" htmlFor="nombre" requerido className="sm:col-span-2">
            <Entrada
              id="nombre"
              name="nombre"
              required
              minLength={3}
              maxLength={160}
              defaultValue={inicial?.nombre}
              placeholder="Qué hace, en pocas palabras…"
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Clave"
            htmlFor="clave"
            requerido={!inicial}
            ayuda={
              inicial
                ? "Con esta clave avisa el script. No se cambia."
                : "Con lo que el script se identifica al avisar: minúsculas, sin espacios ni tildes."
            }
          >
            <Entrada
              id="clave"
              name="clave"
              required={!inicial}
              disabled={Boolean(inicial)}
              defaultValue={inicial?.clave}
              pattern="[a-z0-9][a-z0-9._\-]{2,79}"
              placeholder="ticketera.revisar-sla"
              className="font-mono"
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Frecuencia esperada (horas)"
            htmlFor="frecuencia_horas"
            ayuda="Cada cuánto tiene que avisar. Vacío si corre por un evento, como un formulario."
          >
            <Entrada
              id="frecuencia_horas"
              name="frecuencia_horas"
              type="number"
              min={1}
              max={8784}
              step={1}
              list="frecuencias-sugeridas"
              defaultValue={inicial?.frecuencia_horas ?? ""}
              className="tabular"
            />
          </GrupoCampo>
          <datalist id="frecuencias-sugeridas">
            {FRECUENCIAS_SUGERIDAS.map((frecuencia) => (
              <option key={frecuencia.horas} value={frecuencia.horas}>
                {frecuencia.etiqueta}
              </option>
            ))}
          </datalist>

          <GrupoCampo
            etiqueta="Dónde vive"
            htmlFor="donde_vive"
            ayuda="El proyecto de Apps Script o la planilla, y la función."
            className="sm:col-span-2"
          >
            <Entrada
              id="donde_vive"
              name="donde_vive"
              maxLength={200}
              defaultValue={inicial?.donde_vive ?? ""}
              placeholder="Tickets TI - Automatización · revisarSLA"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Responsable" htmlFor="responsable_id" ayuda="A quién avisa si se cae.">
            <Seleccion
              id="responsable_id"
              name="responsable_id"
              defaultValue={inicial?.responsable_id ?? responsablePorOmision ?? ""}
            >
              <option value="">Sin responsable</option>
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Control"
            htmlFor="vigente"
            ayuda="Pausado: deja de controlarse sin perder su historial."
          >
            <Seleccion id="vigente" name="vigente" defaultValue={inicial?.vigente === false ? "no" : "si"}>
              <option value="si">Se controla</option>
              <option value="no">Pausado</option>
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Qué hace" htmlFor="descripcion" className="sm:col-span-2">
            <AreaTexto
              id="descripcion"
              name="descripcion"
              rows={3}
              defaultValue={inicial?.descripcion ?? ""}
              placeholder="Qué hace, a quién le manda qué y qué pasa si deja de correr…"
            />
          </GrupoCampo>
        </div>

        <AvisoDeCambiosSinGuardar />
        {error ? <ErrorDeFormulario error={error} className="mt-4" /> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            {inicial ? "Guardar cambios" : "Registrar automatismo"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
