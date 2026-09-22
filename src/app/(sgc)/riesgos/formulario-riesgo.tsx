"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { crearRiesgo } from "@/app/(sgc)/riesgos/acciones";
import {
  ESCALA_PROBABILIDAD,
  ESCALA_SEVERIDAD,
  ETIQUETAS_NIVEL_RIESGO,
  ETIQUETAS_TRATAMIENTO_RIESGO,
  TRATAMIENTOS_VIGENTES,
} from "@/lib/constantes";
import {
  CLASES_NIVEL_RIESGO,
  DECISION_POR_NIVEL,
  diasReevaluacion,
  EFECTO_DEL_TRATAMIENTO,
  etiquetaNivelRiesgo,
  requiereAccion,
} from "@/lib/riesgos";
import { cn } from "@/lib/utilidades";
import type { TratamientoRiesgo } from "@/lib/tipos";

interface Opcion {
  id: string;
  nombre?: string;
  codigo?: string;
  nombre_completo?: string;
}

export function FormularioRiesgo({
  procesos,
  usuarios,
  usuarioActual,
}: {
  procesos: Opcion[];
  usuarios: Opcion[];
  usuarioActual: string;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [probabilidad, definirProbabilidad] = React.useState(3);
  const [severidad, definirSeveridad] = React.useState(3);
  const [tratamiento, definirTratamiento] =
    React.useState<TratamientoRiesgo>("cambiar_probabilidad");

  const nivel = probabilidad * severidad;
  const etiqueta = etiquetaNivelRiesgo(nivel)!;
  const dias = diasReevaluacion(nivel);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const resultado = await crearRiesgo(new FormData(evento.currentTarget));

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Riesgo registrado.");
      router.push(`/riesgos/${resultado.id}`);
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
          {/* El tipo no se elige: las oportunidades tienen su propio
              formulario porque no se valoran igual. */}
          <input type="hidden" name="tipo" value="riesgo" />

          <GrupoCampo
            etiqueta="Origen"
            htmlFor="origen"
            ayuda="De dónde salió: queja de cliente, auditoría, análisis del proceso, incidente."
          >
            <Entrada id="origen" name="origen" placeholder="Queja de cliente" />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Categoría"
            htmlFor="categoria"
            ayuda="Por ejemplo: Operativo, Legal, Financiero, Seguridad."
          >
            <Entrada id="categoria" name="categoria" placeholder="Operativo" />
          </GrupoCampo>

          <GrupoCampo etiqueta="Título" htmlFor="titulo" requerido className="sm:col-span-2">
            <Entrada
              id="titulo"
              name="titulo"
              required
              minLength={5}
              placeholder="Incumplimiento del registro de armas ante la DIMABEL"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Descripción" htmlFor="descripcion" className="sm:col-span-2">
            <AreaTexto id="descripcion" name="descripcion" rows={3} />
          </GrupoCampo>

          <GrupoCampo etiqueta="Proceso afectado" htmlFor="proceso_id">
            <Seleccion id="proceso_id" name="proceso_id">
              <option value="">Sin proceso asociado</option>
              {procesos.map((proceso) => (
                <option key={proceso.id} value={proceso.id}>
                  {proceso.codigo} · {proceso.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Responsable" htmlFor="responsable_id" requerido>
            <Seleccion id="responsable_id" name="responsable_id" defaultValue={usuarioActual}>
              {usuarios.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Causas" htmlFor="causas">
            <AreaTexto id="causas" name="causas" rows={2} />
          </GrupoCampo>

          <GrupoCampo etiqueta="Consecuencias" htmlFor="consecuencias">
            <AreaTexto id="consecuencias" name="consecuencias" rows={2} />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Controles existentes"
            htmlFor="controles_existentes"
            className="sm:col-span-2"
            ayuda="Qué se hace hoy para contener el riesgo. Justifica la evaluación."
          >
            <AreaTexto id="controles_existentes" name="controles_existentes" rows={2} />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="¿Asociado a disrupción?"
            htmlFor="asociado_disrupcion"
            ayuda="Si puede interrumpir la operación."
          >
            <Seleccion id="asociado_disrupcion" name="asociado_disrupcion" defaultValue="no">
              <option value="no">No</option>
              <option value="si">Sí</option>
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Opción de tratamiento"
            htmlFor="tratamiento"
            requerido
            className="sm:col-span-2"
            ayuda={EFECTO_DEL_TRATAMIENTO[tratamiento].explicacion}
          >
            <Seleccion
              id="tratamiento"
              name="tratamiento"
              value={tratamiento}
              onChange={(evento) => definirTratamiento(evento.target.value as TratamientoRiesgo)}
            >
              {TRATAMIENTOS_VIGENTES.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS_TRATAMIENTO_RIESGO[valor]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          {/* «Asumir» sin constancia es un riesgo sin dueño: el
              instructivo exige registrar quién lo decidió y por qué. */}
          {tratamiento === "asumir" ? (
            <GrupoCampo
              etiqueta="Fundamento de la decisión"
              htmlFor="fundamento_decision"
              requerido
              className="sm:col-span-2"
              ayuda="Quién decidió asumirlo y con qué fundamento."
            >
              <AreaTexto id="fundamento_decision" name="fundamento_decision" rows={2} required />
            </GrupoCampo>
          ) : null}

          <GrupoCampo
            etiqueta="Acción planificada"
            htmlFor="accion_planificada"
            className="sm:col-span-2"
            ayuda={
              requiereAccion(nivel)
                ? "Obligatoria: de nivel 4 para arriba el riesgo exige acción con responsable y plazo."
                : "Opcional: un riesgo bajo se asume y solo se vigila."
            }
          >
            <AreaTexto
              id="accion_planificada"
              name="accion_planificada"
              rows={2}
              required={requiereAccion(nivel)}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Plazo de la acción" htmlFor="plazo_accion">
            <Entrada id="plazo_accion" name="plazo_accion" type="date" />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Proceso donde se integra la acción"
            htmlFor="proceso_accion_id"
            ayuda="No siempre es el proceso afectado."
          >
            <Seleccion id="proceso_accion_id" name="proceso_accion_id">
              <option value="">El mismo proceso afectado</option>
              {procesos.map((proceso) => (
                <option key={proceso.id} value={proceso.id}>
                  {proceso.codigo} · {proceso.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>
        </div>

        {/* Evaluación */}
        <div className="mt-5 rounded-md border border-borde p-4">
          <p className="text-xs font-semibold">Evaluación inicial (riesgo inherente)</p>
          <p className="mb-3 mt-0.5 text-[11px] text-atenuado-contraste">
            Sin considerar las acciones que todavía no se implementaron. La severidad se evalúa
            en seis dimensiones y se toma la más afectada, no el promedio, sobre el peor caso
            razonable y no el peor caso teórico.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <GrupoCampo etiqueta="Probabilidad" htmlFor="probabilidad" requerido>
              <Seleccion
                id="probabilidad"
                name="probabilidad"
                value={probabilidad}
                onChange={(evento) => definirProbabilidad(Number(evento.target.value))}
              >
                {ESCALA_PROBABILIDAD.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor} title={opcion.control}>
                    {opcion.valor} · {opcion.etiqueta} — {opcion.detalle}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>

            <GrupoCampo etiqueta="Severidad" htmlFor="severidad" requerido>
              <Seleccion
                id="severidad"
                name="severidad"
                value={severidad}
                onChange={(evento) => definirSeveridad(Number(evento.target.value))}
              >
                {ESCALA_SEVERIDAD.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor} title={opcion.legal}>
                    {opcion.valor} · {opcion.etiqueta} — {opcion.detalle}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>
          </div>

          <div
            className={cn(
              "mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border p-3",
              CLASES_NIVEL_RIESGO[etiqueta],
            )}
          >
            <div>
              <p className="text-[11px] uppercase tracking-wide opacity-80">Nivel resultante</p>
              <p className="text-lg font-semibold tabular">
                {nivel} · {ETIQUETAS_NIVEL_RIESGO[etiqueta]}
              </p>
            </div>
            <p className="max-w-md text-[11px] opacity-90">
              {DECISION_POR_NIVEL[etiqueta]} Reevaluación cada {dias} días.
            </p>
          </div>
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            Registrar riesgo
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
