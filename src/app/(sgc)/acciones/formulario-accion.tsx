"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { crearAccion } from "@/app/(sgc)/no-conformidades/acciones";
import { ETIQUETAS_TIPO_ACCION } from "@/lib/constantes";
import { hoyEnAsuncion, sumarDias } from "@/lib/formato";

export interface OpcionNoConformidad {
  id: string;
  codigo: string;
  titulo: string;
}

/**
 * Alta de una acción correctiva desde el listado transversal.
 *
 * La no conformidad se elige de una lista. Va con el código adelante
 * —NC-2026-007 · Faltante de stock…— y no solo con el título: el código
 * es como se la nombra en las reuniones y en los correos, y con cuarenta
 * desviaciones abiertas buscar por título es leer cuarenta renglones.
 *
 * Cualquiera que pueda escribir puede cargar una acción, también sobre
 * una desviación que no está a su nombre. Es lo que pidió Calidad y es lo
 * que permite RLS (`nc_acciones_alta`).
 */
export function FormularioAccion({
  noConformidades,
  personas,
  usuarioActual,
  noConformidadInicial,
}: {
  noConformidades: OpcionNoConformidad[];
  personas: { id: string; nombre_completo: string }[];
  usuarioActual: string;
  noConformidadInicial?: string;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [noConformidadId, definirNoConformidadId] = React.useState(
    noConformidadInicial && noConformidades.some((nc) => nc.id === noConformidadInicial)
      ? noConformidadInicial
      : "",
  );

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    if (!noConformidadId) {
      definirError("Elija la no conformidad a la que corresponde la acción.");
      return;
    }

    definirEnviando(true);
    definirError(null);

    const datos = new FormData(evento.currentTarget);
    const resultado = await crearAccion(noConformidadId, datos);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Acción cargada.");
      // Se vuelve a la ficha de la desviación y no al listado: quien
      // acaba de cargar la acción suele querer ver cómo queda el plan.
      router.push(`/no-conformidades/${noConformidadId}`);
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
          <GrupoCampo
            etiqueta="No conformidad"
            htmlFor="no_conformidad_id"
            requerido
            className="sm:col-span-2"
            ayuda="Se busca por código. Solo se listan las que están abiertas o en tratamiento."
          >
            <Seleccion
              id="no_conformidad_id"
              value={noConformidadId}
              onChange={(evento) => definirNoConformidadId(evento.target.value)}
              required
            >
              <option value="" disabled>
                Elija la no conformidad
              </option>
              {noConformidades.map((nc) => (
                <option key={nc.id} value={nc.id}>
                  {nc.codigo} · {nc.titulo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Tipo de acción" htmlFor="tipo" requerido>
            <Seleccion id="tipo" name="tipo" defaultValue="accion_correctiva">
              {Object.entries(ETIQUETAS_TIPO_ACCION).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Fecha límite"
            htmlFor="fecha_limite"
            requerido
            ayuda="Cuándo tiene que estar ejecutada."
          >
            <Entrada
              id="fecha_limite"
              name="fecha_limite"
              type="date"
              defaultValue={sumarDias(hoyEnAsuncion(), 15)}
              required
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Descripción de la acción"
            htmlFor="descripcion"
            requerido
            className="sm:col-span-2"
            ayuda="Qué se hará concretamente para eliminar la causa."
          >
            <AreaTexto id="descripcion" name="descripcion" rows={3} required minLength={10} />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Responsable de ejecutarla"
            htmlFor="responsable_id"
            className="sm:col-span-2"
            ayuda="Recibe la notificación de asignación."
          >
            <Seleccion id="responsable_id" name="responsable_id" defaultValue={usuarioActual}>
              <option value="">Asignar más adelante</option>
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            Cargar acción correctiva
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
