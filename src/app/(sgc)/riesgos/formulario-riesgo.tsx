"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { actualizarRiesgo, crearRiesgo } from "@/app/(sgc)/riesgos/acciones";
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
  ORIGENES_RIESGO,
} from "@/lib/riesgos";
import { cn } from "@/lib/utilidades";
import type { TratamientoRiesgo } from "@/lib/tipos";

interface Opcion {
  id: string;
  nombre?: string;
  codigo?: string;
  nombre_completo?: string;
}

/** Lo que trae un riesgo ya cargado cuando se lo abre para corregir. */
export interface RiesgoInicial {
  id: string;
  titulo: string;
  descripcion: string | null;
  origen: string | null;
  proceso_id: string | null;
  responsable_id: string | null;
  causas: string | null;
  consecuencias: string | null;
  controles_existentes: string | null;
  asociado_disrupcion: boolean | null;
  tratamiento: TratamientoRiesgo | null;
  fundamento_decision: string | null;
  accion_planificada: string | null;
  plazo_accion: string | null;
  proceso_accion_id: string | null;
  probabilidad: number;
  severidad: number;
}

/**
 * El mismo formulario para cargar un riesgo y para corregirlo.
 *
 * Con `inicial` edita; sin `inicial` da de alta. Es un solo formulario a
 * proposito: dos que tienen que pedir los mismos campos terminan pidiendo
 * campos distintos el dia que se agrega uno.
 *
 * La diferencia real esta en la valoracion. Al dar de alta se elige acá,
 * porque es la evaluacion inicial. Al corregir NO se toca: cambiar la
 * probabilidad o la severidad es una reevaluacion, y una reevaluacion
 * lleva fecha, autor y comentario en el historial. Se hace desde la ficha,
 * en «Reevaluar». Si se pudiera cambiar desde acá, el nivel se movería sin
 * dejar rastro de quién lo movió ni por qué, que es justo lo que el
 * historial existe para evitar.
 */
export function FormularioRiesgo({
  procesos,
  usuarios,
  usuarioActual,
  inicial,
}: {
  procesos: Opcion[];
  usuarios: Opcion[];
  usuarioActual: string;
  inicial?: RiesgoInicial;
}) {
  const router = useRouter();
  const editando = Boolean(inicial);
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [probabilidad, definirProbabilidad] = React.useState(inicial?.probabilidad ?? 3);
  const [severidad, definirSeveridad] = React.useState(inicial?.severidad ?? 3);
  const [tratamiento, definirTratamiento] = React.useState<TratamientoRiesgo>(
    inicial?.tratamiento ?? "cambiar_probabilidad",
  );

  const nivel = probabilidad * severidad;
  const etiqueta = etiquetaNivelRiesgo(nivel)!;
  const dias = diasReevaluacion(nivel);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const datos = new FormData(evento.currentTarget);
    const resultado = inicial
      ? await actualizarRiesgo(inicial.id, datos)
      : await crearRiesgo(datos);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Riesgo registrado.");
      router.push(`/riesgos/${inicial?.id ?? resultado.id}`);
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

          {/* Lista cerrada y no texto libre: ver `ORIGENES_RIESGO`. La
              opcion vacia esta deshabilitada, asi obliga a elegir una en
              vez de dejar la primera por descuido. */}
          <GrupoCampo etiqueta="Origen" htmlFor="origen" requerido className="sm:col-span-2">
            <Seleccion id="origen" name="origen" required defaultValue={inicial?.origen ?? ""}>
              <option value="" disabled>
                Elija de dónde salió
              </option>
              {ORIGENES_RIESGO.map((origen) => (
                <option key={origen} value={origen}>
                  {origen}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Título" htmlFor="titulo" requerido className="sm:col-span-2">
            <Entrada
              id="titulo"
              name="titulo"
              required
              minLength={5}
              defaultValue={inicial?.titulo}
              placeholder="Incumplimiento del registro de armas ante la DIMABEL"
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Descripción"
            htmlFor="descripcion"
            requerido
            className="sm:col-span-2"
          >
            <AreaTexto
              id="descripcion"
              name="descripcion"
              rows={3}
              required
              defaultValue={inicial?.descripcion ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Proceso afectado" htmlFor="proceso_id" requerido>
            <Seleccion
              id="proceso_id"
              name="proceso_id"
              required
              defaultValue={inicial?.proceso_id ?? ""}
            >
              <option value="" disabled>
                Elija el proceso
              </option>
              {procesos.map((proceso) => (
                <option key={proceso.id} value={proceso.id}>
                  {proceso.codigo} · {proceso.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Responsable" htmlFor="responsable_id" requerido>
            <Seleccion
              id="responsable_id"
              name="responsable_id"
              defaultValue={inicial?.responsable_id ?? usuarioActual}
            >
              {usuarios.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Causas potenciales" htmlFor="causas" requerido>
            <AreaTexto
              id="causas"
              name="causas"
              rows={2}
              required
              defaultValue={inicial?.causas ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Consecuencias potenciales" htmlFor="consecuencias" requerido>
            <AreaTexto
              id="consecuencias"
              name="consecuencias"
              rows={2}
              required
              defaultValue={inicial?.consecuencias ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Controles existentes"
            htmlFor="controles_existentes"
            requerido
            className="sm:col-span-2"
            ayuda="Qué se hace hoy para contener el riesgo. Justifica la evaluación."
          >
            <AreaTexto
              id="controles_existentes"
              name="controles_existentes"
              rows={2}
              required
              defaultValue={inicial?.controles_existentes ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="¿Asociado a disrupción?"
            htmlFor="asociado_disrupcion"
            requerido
            ayuda="Si puede interrumpir la operación."
          >
            <Seleccion
              id="asociado_disrupcion"
              name="asociado_disrupcion"
              defaultValue={inicial?.asociado_disrupcion ? "si" : "no"}
            >
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
              <AreaTexto
                id="fundamento_decision"
                name="fundamento_decision"
                rows={2}
                required
                defaultValue={inicial?.fundamento_decision ?? ""}
              />
            </GrupoCampo>
          ) : null}

          {/* El instructivo la exige de nivel 4 para arriba; Calidad
              pidio que se cargue siempre. Un riesgo bajo tambien tiene
              algo que hacer, aunque sea vigilarlo, y escribirlo cuesta
              menos que descubrir en la auditoria que nadie lo penso. */}
          <GrupoCampo
            etiqueta="Acción planificada"
            htmlFor="accion_planificada"
            requerido
            className="sm:col-span-2"
            ayuda="Qué se va a hacer, con responsable y plazo."
          >
            <AreaTexto
              id="accion_planificada"
              name="accion_planificada"
              rows={2}
              required
              defaultValue={inicial?.accion_planificada ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Plazo de la acción" htmlFor="plazo_accion" requerido>
            <Entrada
              id="plazo_accion"
              name="plazo_accion"
              type="date"
              required
              defaultValue={inicial?.plazo_accion ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Proceso donde se integra la acción"
            htmlFor="proceso_accion_id"
            requerido
            ayuda="No siempre es el proceso afectado."
          >
            <Seleccion
              id="proceso_accion_id"
              name="proceso_accion_id"
              defaultValue={inicial?.proceso_accion_id ?? ""}
            >
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
          <p className="text-xs font-semibold">
            {editando ? "Valoración vigente" : "Evaluación inicial (riesgo inherente)"}
          </p>
          <p className="mb-3 mt-0.5 text-[11px] text-atenuado-contraste">
            {editando
              ? "La valoración no se corrige desde acá: cambiarla es reevaluar, y una reevaluación lleva fecha, autor y comentario. Se hace desde la ficha, en «Reevaluar»."
              : "Sin considerar las acciones que todavía no se implementaron. La severidad se evalúa en seis dimensiones y se toma la más afectada, no el promedio, sobre el peor caso razonable y no el peor caso teórico."}
          </p>

          <div className={cn("grid gap-4 sm:grid-cols-2", editando && "hidden")}>
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
            {editando ? "Guardar cambios" : "Registrar riesgo"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
