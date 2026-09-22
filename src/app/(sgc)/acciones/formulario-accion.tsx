"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { responderNoConformidad } from "@/app/(sgc)/no-conformidades/acciones";
import { ETIQUETAS_TIPO_ACCION, PREGUNTAS_CINCO_PORQUES } from "@/lib/constantes";
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
 *
 * Responder es un solo paso: el descargo, los cinco porqués y la acción.
 * Con eso la no conformidad se cierra y la acción queda abierta, que es
 * lo que después se controla. Estaba partido en tres pantallas —ficha,
 * análisis, plan— y la mitad de las desviaciones se quedaban con el
 * análisis a medias.
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
    const resultado = await responderNoConformidad(noConformidadId, datos);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "No conformidad respondida.");
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

          <GrupoCampo
            etiqueta="Descargo"
            htmlFor="descargo"
            requerido
            className="sm:col-span-2"
            ayuda="Qué pasó y por qué, en sus palabras. Es su explicación de la desviación, no lo que va a hacer."
          >
            <AreaTexto id="descargo" name="descargo" rows={3} required minLength={10} />
          </GrupoCampo>

          <div className="sm:col-span-2">
            <p className="text-xs font-medium">
              Análisis de causa raíz <span className="text-primario">*</span>
            </p>
            <p className="mt-0.5 text-[11px] text-atenuado-contraste">
              Cada respuesta encadena con la siguiente pregunta. Los cinco son obligatorios: el
              quinto es la causa raíz, y si la cadena se corta antes la acción ataca un síntoma.
            </p>
            <div className="mt-2 space-y-2">
              {PREGUNTAS_CINCO_PORQUES.map((pregunta, indice) => (
                <div key={indice} className="flex items-start gap-2">
                  <span
                    className="mt-2 w-4 shrink-0 text-right text-[11px] tabular
                               text-atenuado-contraste"
                  >
                    {indice + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <label
                      htmlFor={`porque-${indice}`}
                      className={`text-[11px] ${
                        indice === PREGUNTAS_CINCO_PORQUES.length - 1
                          ? "font-medium text-texto"
                          : "text-atenuado-contraste"
                      }`}
                    >
                      {pregunta}
                    </label>
                    <AreaTexto id={`porque-${indice}`} name="porque" rows={2} required />
                  </div>
                </div>
              ))}
            </div>
          </div>

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
            Responder y cerrar la no conformidad
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
