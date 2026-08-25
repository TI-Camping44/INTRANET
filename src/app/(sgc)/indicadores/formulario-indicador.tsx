"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { crearIndicador } from "@/app/(sgc)/indicadores/acciones";
import { ETIQUETAS_FRECUENCIA, ETIQUETAS_SENTIDO } from "@/lib/constantes";
import type { SentidoIndicador } from "@/lib/tipos";

interface Opcion {
  id: string;
  nombre?: string;
  codigo?: string;
  nombre_completo?: string;
}

export function FormularioIndicador({
  procesos,
  usuarios,
  usuarioActual,
  codigoSugerido,
}: {
  procesos: Opcion[];
  usuarios: Opcion[];
  usuarioActual: string;
  codigoSugerido: string;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [sentido, definirSentido] = React.useState<SentidoIndicador>("mayor_mejor");

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const resultado = await crearIndicador(new FormData(evento.currentTarget));

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Indicador creado.");
      router.push(`/indicadores/${resultado.id}`);
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
          <GrupoCampo etiqueta="Código" htmlFor="codigo" requerido ayuda="Formato KPI-01.">
            <Entrada
              id="codigo"
              name="codigo"
              defaultValue={codigoSugerido}
              required
              className="tabular"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Unidad" htmlFor="unidad" requerido ayuda="%, días, reclamos, Gs.">
            <Entrada id="unidad" name="unidad" defaultValue="%" required />
          </GrupoCampo>

          <GrupoCampo etiqueta="Nombre" htmlFor="nombre" requerido className="sm:col-span-2">
            <Entrada
              id="nombre"
              name="nombre"
              required
              minLength={5}
              placeholder="Exactitud de inventario"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Descripción" htmlFor="descripcion" className="sm:col-span-2">
            <AreaTexto id="descripcion" name="descripcion" rows={2} />
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
              placeholder="(1 − diferencias / unidades contadas) × 100"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Proceso" htmlFor="proceso_id">
            <Seleccion id="proceso_id" name="proceso_id">
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
            <Seleccion id="responsable_id" name="responsable_id" defaultValue={usuarioActual}>
              {usuarios.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Frecuencia de medición" htmlFor="frecuencia" requerido>
            <Seleccion id="frecuencia" name="frecuencia" defaultValue="mensual">
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
                type="number"
                step="0.01"
                required
                className="tabular"
              />
            </GrupoCampo>
          )}
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={enviando}>
            {enviando ? "Creando…" : "Crear indicador"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
