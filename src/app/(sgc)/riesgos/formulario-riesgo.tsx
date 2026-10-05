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
  requiereAcciones,
} from "@/lib/riesgos";
import { agruparPorCategoria, type ProcesoDocumentado } from "@/lib/procesos-documentados";
import { cn } from "@/lib/utilidades";
import type { TratamientoRiesgo } from "@/lib/tipos";

interface Persona {
  id: string;
  nombre_completo?: string;
}

/** Lo que trae un riesgo ya cargado cuando se lo abre para corregir. */
export interface RiesgoInicial {
  id: string;
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
 * EL ORDEN ES EL QUE PIDIO CALIDAD el 5 de octubre, y no es arbitrario:
 * sigue el razonamiento con el que se identifica un riesgo. Primero
 * donde aparece —el proceso— y de donde salio —el origen—; despues que
 * es, por que puede pasar y que pasaria si pasa; despues si interrumpe
 * la operacion; despues se lo valora; el nivel y la necesidad de
 * acciones salen solos de esa valoracion; y recien al final se decide
 * que se hace con el, que es la unica pregunta que no se puede contestar
 * antes de las otras.
 *
 * LA LISTA DE PROCESOS SALE DE LA INFORMACION DOCUMENTADA, no de una
 * lista propia: son los procesos que tienen su manual cargado. Ver
 * `lib/procesos-documentados.ts`.
 *
 * La diferencia real entre alta y edicion esta en la valoracion. Al dar
 * de alta se elige acá, porque es la evaluacion inicial. Al corregir NO
 * se toca: cambiar la probabilidad o la severidad es una reevaluacion, y
 * una reevaluacion lleva fecha, autor y comentario en el historial. Se
 * hace desde la ficha, en «Reevaluar». Si se pudiera cambiar desde acá,
 * el nivel se movería sin dejar rastro de quién lo movió ni por qué, que
 * es justo lo que el historial existe para evitar.
 */
export function FormularioRiesgo({
  procesos,
  usuarios,
  usuarioActual,
  inicial,
}: {
  procesos: ProcesoDocumentado[];
  usuarios: Persona[];
  usuarioActual: string;
  inicial?: RiesgoInicial;
}) {
  const router = useRouter();
  const editando = Boolean(inicial);
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [probabilidad, definirProbabilidad] = React.useState(inicial?.probabilidad ?? 0);
  const [severidad, definirSeveridad] = React.useState(inicial?.severidad ?? 0);
  const [tratamiento, definirTratamiento] = React.useState<TratamientoRiesgo | "">(
    inicial?.tratamiento ?? "",
  );

  const grupos = React.useMemo(() => agruparPorCategoria(procesos), [procesos]);

  // Mientras no se eligieron las dos escalas no hay nivel que mostrar.
  // Poner 3 × 3 por defecto, como estaba antes, hacia que el formulario
  // afirmara «nivel 9 · medio» sin que nadie lo hubiera evaluado.
  const valorado = probabilidad > 0 && severidad > 0;
  const nivel = valorado ? probabilidad * severidad : 0;
  const etiqueta = valorado ? etiquetaNivelRiesgo(nivel)! : null;
  const dias = valorado ? diasReevaluacion(nivel) : null;
  const exigeAcciones = valorado ? requiereAcciones(nivel) : null;

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

          {/* 1 · Donde se identifica. Agrupado por categoria, como la
              lista maestra, para que no sea un listado plano de
              diecinueve renglones. */}
          <GrupoCampo
            etiqueta="Proceso donde se identifica el riesgo"
            htmlFor="proceso_id"
            requerido
            className="sm:col-span-2"
            ayuda="Son los procesos con manual cargado en Información Documentada."
          >
            <Seleccion
              id="proceso_id"
              name="proceso_id"
              required
              defaultValue={inicial?.proceso_id ?? ""}
            >
              <option value="" disabled>
                Elija el proceso
              </option>
              {grupos.map((grupo) => (
                <optgroup key={grupo.categoria} label={grupo.categoria}>
                  {grupo.procesos.map((proceso) => (
                    <option key={proceso.id} value={proceso.id}>
                      {proceso.codigo ? `${proceso.codigo} · ` : ""}
                      {proceso.nombre}
                    </option>
                  ))}
                </optgroup>
              ))}
            </Seleccion>
          </GrupoCampo>

          {/* 2 · Origen. Lista cerrada y no texto libre: ver
              `ORIGENES_RIESGO`. La opcion vacia esta deshabilitada, asi
              obliga a elegir una en vez de dejar la primera por
              descuido. */}
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

          {/* 3 · Que es. */}
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

          {/* 4 y 5 · Por que puede pasar y que pasaria. */}
          <GrupoCampo etiqueta="Causa potencial" htmlFor="causas" requerido>
            <AreaTexto
              id="causas"
              name="causas"
              rows={2}
              required
              defaultValue={inicial?.causas ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Consecuencia potencial" htmlFor="consecuencias" requerido>
            <AreaTexto
              id="consecuencias"
              name="consecuencias"
              rows={2}
              required
              defaultValue={inicial?.consecuencias ?? ""}
            />
          </GrupoCampo>

          {/* 6 · Disrupcion. Sin valor por defecto: «No» preseleccionado
              se guarda solo, y en un retail de material controlado esa
              es justo la respuesta que hay que pensar. */}
          <GrupoCampo
            etiqueta="¿Está asociado a una disrupción?"
            htmlFor="asociado_disrupcion"
            requerido
            className="sm:col-span-2"
            ayuda="Si puede interrumpir la operación."
          >
            <Seleccion
              id="asociado_disrupcion"
              name="asociado_disrupcion"
              required
              defaultValue={
                inicial ? (inicial.asociado_disrupcion ? "si" : "no") : ""
              }
            >
              <option value="" disabled>
                Elija una opción
              </option>
              <option value="si">Sí</option>
              <option value="no">No</option>
            </Seleccion>
          </GrupoCampo>
        </div>

        {/* 7, 8 y 9 · Valoracion: probabilidad, severidad y el nivel que
            sale de las dos. */}
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
                required
                value={probabilidad === 0 ? "" : probabilidad}
                onChange={(evento) => definirProbabilidad(Number(evento.target.value))}
              >
                <option value="" disabled>
                  Elija la probabilidad
                </option>
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
                required
                value={severidad === 0 ? "" : severidad}
                onChange={(evento) => definirSeveridad(Number(evento.target.value))}
              >
                <option value="" disabled>
                  Elija la severidad
                </option>
                {ESCALA_SEVERIDAD.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor} title={opcion.legal}>
                    {opcion.valor} · {opcion.etiqueta} — {opcion.detalle}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>
          </div>

          {etiqueta && dias !== null ? (
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
          ) : (
            <p className="mt-4 rounded-md border border-dashed border-borde p-3 text-[11px] text-atenuado-contraste">
              El nivel y la necesidad de acciones se calculan al elegir la probabilidad y la
              severidad.
            </p>
          )}

          {/* 10 · ¿Requiere acciones? NO SE ESCRIBE: sale del semaforo.
              Medio, alto y critico requieren; el bajo se asume y se
              vigila. La columna de la base es generada con la misma
              regla, asi que acá solo se muestra: no hay campo que
              mandar ni forma de contradecirla desde la interfaz. */}
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border border-borde bg-acento/40 p-3">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-atenuado-contraste">
                ¿Requiere acciones?
              </p>
              <p className="text-sm font-semibold">
                {exigeAcciones === null ? "—" : exigeAcciones ? "Sí" : "No"}
              </p>
            </div>
            <p className="max-w-md text-[11px] text-atenuado-contraste">
              {exigeAcciones === null
                ? "Se completa solo con la clasificación del riesgo."
                : exigeAcciones
                  ? "Lo determina la clasificación: medio, alto y crítico requieren acciones. Complete el plan más abajo."
                  : "Lo determina la clasificación: el riesgo bajo se asume y se vigila."}
            </p>
          </div>
        </div>

        {/* 11 · Que se hace con el. Va al final porque es la unica
            pregunta que necesita todas las anteriores contestadas. */}
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <GrupoCampo
            etiqueta="Opción de tratamiento"
            htmlFor="tratamiento"
            requerido
            className="sm:col-span-2"
            ayuda={
              tratamiento
                ? EFECTO_DEL_TRATAMIENTO[tratamiento].explicacion
                : "Qué se decide hacer con el riesgo."
            }
          >
            <Seleccion
              id="tratamiento"
              name="tratamiento"
              required
              value={tratamiento}
              onChange={(evento) =>
                definirTratamiento(evento.target.value as TratamientoRiesgo | "")
              }
            >
              <option value="" disabled>
                Elija el tratamiento
              </option>
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
        </div>

        {/* El plan y el dueño. Quedan aparte de la ficha de
            identificacion, que es la que Calidad reordeno, porque son el
            paso siguiente: el plan se exige cuando el nivel lo exige
            —medio para arriba—, y para un riesgo bajo pedirlo seria
            pedir que se invente algo que nadie va a ejecutar.

            El responsable si va siempre: es quien recibe el aviso de
            reevaluacion, y un riesgo sin dueño no se revisa nunca. */}
        <div className="mt-5 rounded-md border border-borde p-4">
          <p className="text-xs font-semibold">Responsable y plan</p>
          <p className="mb-3 mt-0.5 text-[11px] text-atenuado-contraste">
            {exigeAcciones
              ? "El nivel exige acciones: la acción planificada y su plazo son obligatorios."
              : "Para un riesgo bajo el plan es opcional. Se puede dejar vacío y cargarlo después desde la ficha."}
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <GrupoCampo etiqueta="Responsable" htmlFor="responsable_id" requerido>
              <Seleccion
                id="responsable_id"
                name="responsable_id"
                required
                defaultValue={inicial?.responsable_id ?? usuarioActual}
              >
                {usuarios.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.nombre_completo}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>

            <GrupoCampo
              etiqueta="Controles existentes"
              htmlFor="controles_existentes"
              ayuda="Qué se hace hoy para contener el riesgo. Justifica la evaluación."
            >
              <AreaTexto
                id="controles_existentes"
                name="controles_existentes"
                rows={2}
                defaultValue={inicial?.controles_existentes ?? ""}
              />
            </GrupoCampo>

            <GrupoCampo
              etiqueta="Acción planificada"
              htmlFor="accion_planificada"
              requerido={exigeAcciones === true}
              className="sm:col-span-2"
              ayuda="Qué se va a hacer para tratar el riesgo."
            >
              <AreaTexto
                id="accion_planificada"
                name="accion_planificada"
                rows={2}
                required={exigeAcciones === true}
                defaultValue={inicial?.accion_planificada ?? ""}
              />
            </GrupoCampo>

            <GrupoCampo
              etiqueta="Plazo de la acción"
              htmlFor="plazo_accion"
              requerido={exigeAcciones === true}
            >
              <Entrada
                id="plazo_accion"
                name="plazo_accion"
                type="date"
                required={exigeAcciones === true}
                defaultValue={inicial?.plazo_accion ?? ""}
              />
            </GrupoCampo>

            <GrupoCampo
              etiqueta="Proceso donde se integra la acción"
              htmlFor="proceso_accion_id"
              ayuda="No siempre es el proceso donde se identificó el riesgo."
            >
              <Seleccion
                id="proceso_accion_id"
                name="proceso_accion_id"
                defaultValue={inicial?.proceso_accion_id ?? ""}
              >
                <option value="">El mismo proceso del riesgo</option>
                {grupos.map((grupo) => (
                  <optgroup key={grupo.categoria} label={grupo.categoria}>
                    {grupo.procesos.map((proceso) => (
                      <option key={proceso.id} value={proceso.id}>
                        {proceso.codigo ? `${proceso.codigo} · ` : ""}
                        {proceso.nombre}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </Seleccion>
            </GrupoCampo>
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
