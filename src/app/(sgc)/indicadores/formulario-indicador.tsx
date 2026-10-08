"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  actualizarIndicador,
  crearIndicador,
  eliminarIndicador,
} from "@/app/(sgc)/indicadores/acciones";
import { ETIQUETAS_FRECUENCIA, ETIQUETAS_SENTIDO } from "@/lib/constantes";
import { ETIQUETAS_CONSOLIDACION } from "@/lib/objetivos";
import type { SentidoIndicador } from "@/lib/tipos";

interface Opcion {
  id: string;
  nombre?: string;
  codigo?: string;
  nombre_completo?: string;
}

/** El indicador que se está editando. Sin esto, el formulario da de alta. */
export interface IndicadorEditable {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  formula: string | null;
  unidad: string | null;
  frecuencia: string;
  sentido: SentidoIndicador;
  meta: number | null;
  meta_minima: number | null;
  meta_maxima: number | null;
  proceso_id: string | null;
  responsable_id: string | null;
  objetivo_id: string | null;
  linea_base: number | null;
  fuente_dato: string | null;
  consolidacion: string | null;
  mediciones: number;
}

/**
 * Alta y edición del indicador.
 *
 * EL CÓDIGO NO SE EDITA. Es lo que identifica al indicador en la hoja de
 * Calidad y en los informes ya emitidos: cambiarlo rompe la referencia
 * sin que nadie se entere. Al editar, el campo se muestra apagado.
 */
export function FormularioIndicador({
  procesos,
  usuarios,
  objetivos,
  usuarioActual,
  codigoSugerido,
  indicador,
  objetivoFijo,
  volverA,
}: {
  procesos: Opcion[];
  usuarios: Opcion[];
  objetivos: Opcion[];
  usuarioActual: string;
  codigoSugerido: string;
  indicador?: IndicadorEditable;
  /**
   * El objetivo desde cuya ficha se entró. Viene elegido y no se cambia
   * acá: el indicador se carga desde el objetivo que mide.
   */
  objetivoFijo?: string;
  /**
   * A dónde volver al guardar o al eliminar. La arma el servidor con el
   * id del objetivo; nunca llega una dirección escrita por nadie.
   */
  volverA?: string;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [sentido, definirSentido] = React.useState<SentidoIndicador>(
    indicador?.sentido ?? "mayor_mejor",
  );

  const editando = Boolean(indicador);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const datos = new FormData(evento.currentTarget);
    const resultado = indicador
      ? await actualizarIndicador(indicador.id, datos)
      : await crearIndicador(datos);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Guardado.");
      router.push(volverA ?? `/indicadores/${indicador?.id ?? resultado.id}`);
      router.refresh();
    } else {
      definirError(resultado.error);
      toast.error(resultado.error);
      definirEnviando(false);
    }
  }

  async function borrar() {
    if (!indicador) return;

    const aviso =
      indicador.mediciones > 0
        ? `¿Eliminar el indicador ${indicador.codigo} y sus ${indicador.mediciones} medición(es)? ` +
          "No se puede deshacer."
        : `¿Eliminar el indicador ${indicador.codigo}? No se puede deshacer.`;

    if (!confirm(aviso)) return;

    definirEnviando(true);
    const resultado = await eliminarIndicador(indicador.id);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Indicador eliminado.");
      router.push(volverA ?? "/indicadores");
      router.refresh();
    } else {
      toast.error(resultado.error);
      definirEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <Tarjeta className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <GrupoCampo etiqueta="Código" htmlFor="codigo" requerido ayuda="Formato KPI-01.">
            <Entrada
              id="codigo"
              name="codigo"
              defaultValue={indicador?.codigo ?? codigoSugerido}
              required
              readOnly={editando}
              disabled={editando}
              className="tabular"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Unidad" htmlFor="unidad" requerido ayuda="%, días, reclamos, Gs.">
            <Entrada id="unidad" name="unidad" defaultValue={indicador?.unidad ?? "%"} required />
          </GrupoCampo>

          <GrupoCampo etiqueta="Nombre" htmlFor="nombre" requerido className="sm:col-span-2">
            <Entrada
              id="nombre"
              name="nombre"
              defaultValue={indicador?.nombre ?? ""}
              required
              minLength={5}
              placeholder="Exactitud de inventario"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Descripción" htmlFor="descripcion" className="sm:col-span-2">
            <AreaTexto
              id="descripcion"
              name="descripcion"
              rows={2}
              defaultValue={indicador?.descripcion ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Fórmula de cálculo"
            htmlFor="formula"
            className="sm:col-span-2"
            ayuda="Cómo se obtiene el valor. Queda a la vista de quien carga la medición."
          >
            <Entrada
              id="formula"
              name="formula"
              defaultValue={indicador?.formula ?? ""}
              placeholder="(1 − diferencias / unidades contadas) × 100"
            />
          </GrupoCampo>

          {/* Sin objetivo, el indicador mide algo que no responde a
              ninguna meta del año y en el F-EST-01-05 queda en una fila
              suelta al final. Se puede dejar vacío, pero se ve. */}
          <GrupoCampo
            etiqueta="Objetivo de la calidad"
            htmlFor="objetivo_id"
            className="sm:col-span-2"
            ayuda="A qué objetivo del año responde. En el F-EST-01-05 van en la misma fila."
          >
            <Seleccion
              id="objetivo_id"
              name="objetivo_id"
              defaultValue={objetivoFijo ?? indicador?.objetivo_id ?? ""}
              disabled={Boolean(objetivoFijo)}
            >
              <option value="">Sin objetivo asociado</option>
              {objetivos.map((objetivo) => (
                <option key={objetivo.id} value={objetivo.id}>
                  {objetivo.codigo} · {objetivo.nombre}
                </option>
              ))}
            </Seleccion>
            {/* Un campo apagado no viaja en el formulario: va aparte. */}
            {objetivoFijo ? (
              <input type="hidden" name="objetivo_id" value={objetivoFijo} />
            ) : null}
          </GrupoCampo>

          <GrupoCampo etiqueta="Proceso" htmlFor="proceso_id">
            <Seleccion
              id="proceso_id"
              name="proceso_id"
              defaultValue={indicador?.proceso_id ?? ""}
            >
              <option value="">Sin proceso asociado</option>
              {procesos.map((proceso) => (
                <option key={proceso.id} value={proceso.id}>
                  {proceso.codigo} · {proceso.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Responsable"
            htmlFor="responsable_id"
            requerido
            ayuda="Recibe el aviso cuando una medición queda fuera de meta."
          >
            <Seleccion
              id="responsable_id"
              name="responsable_id"
              defaultValue={indicador?.responsable_id ?? usuarioActual}
            >
              {usuarios.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Línea base"
            htmlFor="linea_base"
            ayuda="De dónde se parte. Es contra lo que se mide si la meta se alcanzó."
          >
            <Entrada
              id="linea_base"
              name="linea_base"
              type="number"
              step="0.01"
              defaultValue={indicador?.linea_base ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Fuente del dato"
            htmlFor="fuente_dato"
            ayuda="Qué planilla, sistema o registro. Sin esto nadie sabe de dónde sale el número."
          >
            <Entrada
              id="fuente_dato"
              name="fuente_dato"
              placeholder="Odoo · Inventario"
              defaultValue={indicador?.fuente_dato ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Consolidación"
            htmlFor="consolidacion"
            requerido
            ayuda="Cómo se resume el año: suma para cantidades, promedio para porcentajes."
          >
            <Seleccion
              id="consolidacion"
              name="consolidacion"
              defaultValue={indicador?.consolidacion ?? "promedio"}
            >
              {Object.entries(ETIQUETAS_CONSOLIDACION).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Frecuencia de medición" htmlFor="frecuencia" requerido>
            <Seleccion
              id="frecuencia"
              name="frecuencia"
              defaultValue={indicador?.frecuencia ?? "mensual"}
            >
              {Object.entries(ETIQUETAS_FRECUENCIA).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Sentido"
            htmlFor="sentido"
            requerido
            ayuda="Define cuándo se considera cumplida la meta."
          >
            <Seleccion
              id="sentido"
              name="sentido"
              value={sentido}
              onChange={(evento) => definirSentido(evento.target.value as SentidoIndicador)}
            >
              {Object.entries(ETIQUETAS_SENTIDO).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          {sentido === "rango" ? (
            <>
              <GrupoCampo etiqueta="Mínimo aceptable" htmlFor="meta_minima" requerido>
                <Entrada
                  id="meta_minima"
                  name="meta_minima"
                  defaultValue={indicador?.meta_minima ?? ""}
                  type="number"
                  step="0.01"
                  required
                  className="tabular"
                />
              </GrupoCampo>
              <GrupoCampo etiqueta="Máximo aceptable" htmlFor="meta_maxima" requerido>
                <Entrada
                  id="meta_maxima"
                  name="meta_maxima"
                  defaultValue={indicador?.meta_maxima ?? ""}
                  type="number"
                  step="0.01"
                  required
                  className="tabular"
                />
              </GrupoCampo>
            </>
          ) : (
            <GrupoCampo etiqueta="Meta" htmlFor="meta" requerido className="sm:col-span-2">
              <Entrada
                id="meta"
                name="meta"
                defaultValue={indicador?.meta ?? ""}
                type="number"
                step="0.01"
                required
                className="tabular"
              />
            </GrupoCampo>
          )}
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex flex-wrap justify-end gap-2">
          {editando ? (
            <Boton
              type="button"
              variante="contorno"
              onClick={borrar}
              cargando={enviando}
              className="mr-auto text-semaforo-critico hover:text-semaforo-critico"
            >
              <Trash2 /> Eliminar
            </Boton>
          ) : null}
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            {editando ? "Guardar cambios" : "Crear indicador"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
