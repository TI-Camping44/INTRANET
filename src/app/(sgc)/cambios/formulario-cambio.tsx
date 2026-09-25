"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { actualizarCambio, crearCambio } from "@/app/(sgc)/cambios/acciones";
import { ETIQUETAS_TIPO_CAMBIO, TIPOS_CAMBIO } from "@/lib/cambios";

interface Opcion {
  id: string;
  nombre?: string;
  codigo?: string;
  nombre_completo?: string;
}

export interface CambioInicial {
  id: string;
  titulo: string;
  tipo: string;
  proceso_id: string | null;
  responsable_id: string | null;
  proposito: string;
  consecuencias_potenciales: string;
  impacto_integridad_sgc: string;
  recursos_necesarios: string;
  responsabilidades: string;
  comunicacion_a_quien: string;
  comunicacion_cuando: string;
  comunicacion_canal: string;
  afecta_material_controlado: boolean;
  impacto_trazabilidad: string | null;
  indicador_exito: string;
  criterio_exito: string;
  fecha_revision: string;
}

/**
 * Alta y edición de un cambio significativo.
 *
 * EL ORDEN ES EL DEL PROCEDIMIENTO, no el de la tabla: qué se cambia,
 * para qué, qué puede salir mal, qué hace falta, a quién se avisa, y cómo
 * se va a saber si funcionó. Quien lo completa de arriba abajo termina
 * habiendo pensado el cambio, que es el punto.
 *
 * ES EL MISMO FORMULARIO PARA ALTA Y EDICIÓN. Dos formularios con los
 * mismos campos son dos lugares donde agregar el campo siguiente, y uno
 * de los dos se olvida.
 *
 * El impacto en la trazabilidad aparece solo si el cambio toca material
 * controlado: preguntarlo siempre lo convertiría en un campo que se
 * completa con «no aplica», y ahí deja de significar algo.
 */
export function FormularioCambio({
  procesos,
  personas,
  inicial,
}: {
  procesos: Opcion[];
  personas: Opcion[];
  inicial?: CambioInicial;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [afectaMaterial, definirAfectaMaterial] = React.useState(
    inicial?.afecta_material_controlado ?? false,
  );

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const datos = new FormData(evento.currentTarget);
    const resultado = inicial
      ? await actualizarCambio(inicial.id, datos)
      : await crearCambio(datos);

    definirEnviando(false);

    if (!resultado.exito) {
      definirError(resultado.error);
      return;
    }

    toast.success(resultado.mensaje ?? "Guardado.");
    router.push(inicial ? `/cambios/${inicial.id}` : `/cambios/${resultado.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={guardar}>
      <Tarjeta className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <GrupoCampo etiqueta="Título del cambio" htmlFor="titulo" requerido className="sm:col-span-2">
            <Entrada
              id="titulo"
              name="titulo"
              defaultValue={inicial?.titulo}
              placeholder="Mudanza del depósito de material controlado a la nueva sede"
              required
              minLength={5}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Tipo de cambio"
            htmlFor="tipo"
            requerido
            ayuda="Los que Calidad considera significativos. «Otro» está porque la lista es un mínimo, no un límite."
          >
            <Seleccion id="tipo" name="tipo" defaultValue={inicial?.tipo ?? "otro"}>
              {TIPOS_CAMBIO.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS_TIPO_CAMBIO[valor]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Proceso afectado" htmlFor="proceso_id">
            <Seleccion id="proceso_id" name="proceso_id" defaultValue={inicial?.proceso_id ?? ""}>
              <option value="">Sin proceso asociado</option>
              {procesos.map((proceso) => (
                <option key={proceso.id} value={proceso.id}>
                  {proceso.codigo ? `${proceso.codigo} · ` : ""}
                  {proceso.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Propósito del cambio"
            htmlFor="proposito"
            requerido
            className="sm:col-span-2"
            ayuda="Para qué se hace y qué se espera conseguir."
          >
            <AreaTexto
              id="proposito"
              name="proposito"
              defaultValue={inicial?.proposito}
              rows={3}
              required
              minLength={15}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Consecuencias potenciales"
            htmlFor="consecuencias_potenciales"
            requerido
            className="sm:col-span-2"
            ayuda="Qué puede salir mal, y a quién afectaría. Pensarlo antes es el motivo de este registro."
          >
            <AreaTexto
              id="consecuencias_potenciales"
              name="consecuencias_potenciales"
              defaultValue={inicial?.consecuencias_potenciales}
              rows={3}
              required
              minLength={15}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Impacto en la integridad del SGC"
            htmlFor="impacto_integridad_sgc"
            requerido
            className="sm:col-span-2"
            ayuda="Qué procesos, documentos, indicadores o habilitaciones quedan alcanzados."
          >
            <AreaTexto
              id="impacto_integridad_sgc"
              name="impacto_integridad_sgc"
              defaultValue={inicial?.impacto_integridad_sgc}
              rows={3}
              required
              minLength={15}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Recursos e información necesarios"
            htmlFor="recursos_necesarios"
            requerido
          >
            <AreaTexto
              id="recursos_necesarios"
              name="recursos_necesarios"
              defaultValue={inicial?.recursos_necesarios}
              rows={3}
              required
              minLength={10}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Responsabilidades a asignar"
            htmlFor="responsabilidades"
            requerido
          >
            <AreaTexto
              id="responsabilidades"
              name="responsabilidades"
              defaultValue={inicial?.responsabilidades}
              rows={3}
              required
              minLength={10}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Responsable del cambio"
            htmlFor="responsable_id"
            ayuda="Quien lo lleva adelante y responde por su implementación."
            className="sm:col-span-2"
          >
            <Seleccion
              id="responsable_id"
              name="responsable_id"
              defaultValue={inicial?.responsable_id ?? ""}
            >
              <option value="">Sin asignar</option>
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>
        </div>

        {/* Plan de comunicación: los tres separados porque en un solo
            párrafo siempre falta uno de los tres. */}
        <div className="mt-5 border-t border-borde pt-4">
          <p className="text-xs font-medium">
            Plan de comunicación <span className="text-primario">*</span>
          </p>
          <p className="mb-3 mt-0.5 text-[11px] text-atenuado-contraste">
            A quién, cuándo y por qué canal.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <GrupoCampo etiqueta="A quién" htmlFor="comunicacion_a_quien" requerido>
              <Entrada
                id="comunicacion_a_quien"
                name="comunicacion_a_quien"
                defaultValue={inicial?.comunicacion_a_quien}
                placeholder="Depósito, Ventas y Calidad"
                required
                minLength={3}
              />
            </GrupoCampo>
            <GrupoCampo etiqueta="Cuándo" htmlFor="comunicacion_cuando" requerido>
              <Entrada
                id="comunicacion_cuando"
                name="comunicacion_cuando"
                defaultValue={inicial?.comunicacion_cuando}
                placeholder="Una semana antes de la mudanza"
                required
                minLength={3}
              />
            </GrupoCampo>
            <GrupoCampo etiqueta="Por qué canal" htmlFor="comunicacion_canal" requerido>
              <Entrada
                id="comunicacion_canal"
                name="comunicacion_canal"
                defaultValue={inicial?.comunicacion_canal}
                placeholder="Publicación en la Intranet y reunión de área"
                required
                minLength={3}
              />
            </GrupoCampo>
          </div>
        </div>

        {/* Material controlado. Es lo único de este formulario que puede
            terminar en una inspección de la DIGEMABEL. */}
        <div className="mt-5 border-t border-borde pt-4">
          <label className="flex items-center gap-2 text-xs font-medium">
            <input
              type="checkbox"
              name="afecta_material_controlado"
              checked={afectaMaterial}
              onChange={(evento) => definirAfectaMaterial(evento.target.checked)}
              className="size-3.5 accent-[#E01E37]"
            />
            El cambio afecta procesos con material controlado
          </label>

          {afectaMaterial ? (
            <div className="mt-3">
              <GrupoCampo
                etiqueta="Impacto en la trazabilidad de la Ley N° 7411/2024"
                htmlFor="impacto_trazabilidad"
                requerido
                ayuda="Qué pasa con el registro y la trazabilidad del material controlado durante y después del cambio."
              >
                <AreaTexto
                  id="impacto_trazabilidad"
                  name="impacto_trazabilidad"
                  defaultValue={inicial?.impacto_trazabilidad ?? ""}
                  rows={3}
                  required
                  minLength={15}
                />
              </GrupoCampo>
            </div>
          ) : null}
        </div>

        {/* Antes de implementar. Sin esto el cambio no se puede aprobar, y
            es lo que separa este módulo de una lista de avisos. */}
        <div className="mt-5 border-t border-borde pt-4">
          <p className="text-xs font-medium">
            Cómo se va a saber si funcionó <span className="text-primario">*</span>
          </p>
          <p className="mb-3 mt-0.5 text-[11px] text-atenuado-contraste">
            Se define antes de implementar, no después.
          </p>

          <div className="grid gap-4 sm:grid-cols-3">
            <GrupoCampo etiqueta="Indicador" htmlFor="indicador_exito" requerido>
              <Entrada
                id="indicador_exito"
                name="indicador_exito"
                defaultValue={inicial?.indicador_exito}
                placeholder="Diferencias en el conteo cíclico"
                required
                minLength={5}
              />
            </GrupoCampo>
            <GrupoCampo etiqueta="Criterio de éxito" htmlFor="criterio_exito" requerido>
              <Entrada
                id="criterio_exito"
                name="criterio_exito"
                defaultValue={inicial?.criterio_exito}
                placeholder="Cero diferencias en dos conteos seguidos"
                required
                minLength={5}
              />
            </GrupoCampo>
            <GrupoCampo
              etiqueta="Fecha de revisión"
              htmlFor="fecha_revision"
              requerido
              ayuda="Cuándo se revisan los resultados."
            >
              <Entrada
                id="fecha_revision"
                name="fecha_revision"
                type="date"
                defaultValue={inicial?.fecha_revision}
                required
              />
            </GrupoCampo>
          </div>
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            {inicial ? "Guardar cambios" : "Registrar el cambio"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
