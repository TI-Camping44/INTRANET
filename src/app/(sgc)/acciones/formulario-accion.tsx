"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { ErrorDeFormulario } from "@/components/ui/error-de-formulario";
import { AvisoDeCambiosSinGuardar } from "@/components/ui/aviso-cambios-sin-guardar";
import { responderNoConformidad } from "@/app/(sgc)/no-conformidades/acciones";
import { CampoAcciones, type AccionInicial } from "@/app/(sgc)/acciones/campo-acciones";
import { CampoAnalisisHorizontal } from "@/app/(sgc)/acciones/campo-analisis-horizontal";
import { actualizarRespuesta } from "@/app/(sgc)/acciones/acciones";

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
 * Responder es un solo paso: el descargo, la causa raíz y las acciones.
 * Estaba partido en tres pantallas —ficha, análisis, plan— y la mitad de
 * las desviaciones se quedaban con el análisis a medias.
 *
 * Con esto la desviación pasa sola a «En proceso». No se cierra: el
 * cierre lo decide una persona desde la ficha, diciendo si fue en plazo
 * o fuera de plazo, que es como lo definió Calidad el 23 de septiembre.
 */
export interface RespuestaInicial {
  noConformidadId: string;
  descargo: string;
  causaRaiz: string | null;
  acciones: AccionInicial[];
  hayNcSimilares?: boolean | null;
  analisisHorizontal?: string | null;
}

export function FormularioAccion({
  noConformidades,
  personas,
  usuarioActual,
  noConformidadInicial,
  inicial,
}: {
  noConformidades: OpcionNoConformidad[];
  personas: { id: string; nombre_completo: string }[];
  usuarioActual: string;
  noConformidadInicial?: string;
  /** Cuando viene, el formulario edita esa respuesta en vez de crear una. */
  inicial?: RespuestaInicial;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [noConformidadId, definirNoConformidadId] = React.useState(
    inicial?.noConformidadId ??
      (noConformidadInicial && noConformidades.some((nc) => nc.id === noConformidadInicial)
        ? noConformidadInicial
        : ""),
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
    const resultado = inicial
      ? await actualizarRespuesta(inicial.noConformidadId, datos)
      : await responderNoConformidad(noConformidadId, datos);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "No conformidad respondida.");
      // Se va a la acción correctiva y no a la ficha de la desviación:
      // quien acaba de cargarla suele querer ver cómo quedó el plan, y
      // eso está acá, no allá.
      router.push(`/acciones/${inicial?.noConformidadId ?? noConformidadId}`);
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
              disabled={Boolean(inicial)}
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
            <AreaTexto
              id="descargo"
              name="descargo"
              defaultValue={inicial?.descargo ?? ""}
              rows={3}
              required
              minLength={10}
            />
          </GrupoCampo>

          {/* LA CAUSA RAIZ SE DECLARA; YA NO SE LLEGA A ELLA POR UNA
              CADENA DE CINCO. Los cinco porqués salieron del formulario
              el 4 de noviembre, a pedido de Calidad. Lo que queda es la
              conclusión, que es lo que la norma pide —determinar la
              causa— y lo que la acción correctiva tiene que atacar; el
              método para llegar a ella deja de estar impuesto por la
              pantalla.

              `nc_porques` NO SE TOCA: las seis cadenas ya cargadas
              siguen en la base y la ficha de la acción correctiva las
              sigue mostrando. Este formulario ni las escribe ni las
              borra, así que editar una respuesta vieja no puede
              perderlas. */}
          <GrupoCampo
            etiqueta="Causa raíz"
            htmlFor="causa_raiz"
            requerido
            className="sm:col-span-2"
            ayuda="En una frase: qué es lo que falta o falla y que, si se corrige, evita que la desviación vuelva a pasar."
          >
            <AreaTexto
              id="causa_raiz"
              name="causa_raiz"
              defaultValue={inicial?.causaRaiz ?? ""}
              rows={3}
              required
              minLength={10}
            />
          </GrupoCampo>

          {/* El tipo de acción se fue del formulario: acá siempre es una
              acción correctiva, y un desplegable con una sola respuesta
              posible es un paso que nadie lee y que igual hay que dar.
              La columna `tipo` sigue existiendo —hay correcciones y
              mejoras cargadas por otras vías— y esta pantalla escribe
              siempre 'accion_correctiva'. */}
          <div className="sm:col-span-2">
            <p className="text-xs font-medium">
              Acciones <span className="text-primario">*</span>
            </p>
            <p className="mb-2 mt-0.5 text-[11px] text-atenuado-contraste">
              De una misma causa suelen salir varias, y cada una la ejecuta una persona
              distinta. Puede cargar más de una.
            </p>
            <CampoAcciones
              personas={personas}
              usuarioActual={usuarioActual}
              iniciales={inicial?.acciones ?? []}
            />
          </div>

          {/* Va despues de las acciones a proposito: primero se resuelve
              lo que aparecio, despues se mira si puede estar pasando en
              otro lado. */}
          <div className="border-t border-borde pt-4">
            <CampoAnalisisHorizontal
              hayNcSimilares={inicial?.hayNcSimilares}
              analisisHorizontal={inicial?.analisisHorizontal}
            />
          </div>
        </div>

        <AvisoDeCambiosSinGuardar />
        {error ? <ErrorDeFormulario error={error} className="mt-4" /> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            {inicial ? "Guardar cambios" : "Responder la no conformidad"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
