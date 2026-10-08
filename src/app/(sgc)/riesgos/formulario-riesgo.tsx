"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
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
  EFECTO_DEL_TRATAMIENTO,
  etiquetaNivelRiesgo,
  ORIGENES_RIESGO,
  requiereAcciones,
} from "@/lib/riesgos";
import { agruparPorCategoria, type ProcesoDocumentado } from "@/lib/procesos-documentados";
import {
  SelectorDocumentos,
  type DocumentoElegible,
} from "@/app/(sgc)/riesgos/selector-documentos";
import { cn } from "@/lib/utilidades";
import type { TratamientoRiesgo } from "@/lib/tipos";

interface Persona {
  id: string;
  nombre_completo?: string;
}

/** Una acción de tratamiento, mientras se la escribe en el formulario. */
export interface AccionDelRiesgo {
  /** Solo de la pantalla: ordena las filas y no viaja al servidor. */
  clave: string;
  descripcion: string;
  responsable_id: string;
  plazo: string;
  documentos: string[];
}

/** Lo que trae un riesgo ya cargado cuando se lo abre para corregir. */
export interface RiesgoInicial {
  id: string;
  /** Los documentos ya vinculados, para que la edición los traiga marcados. */
  documentos?: string[];
  acciones?: AccionDelRiesgo[];
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
  documentos,
  usuarios,
  usuarioActual,
  inicial,
}: {
  procesos: ProcesoDocumentado[];
  /** La información documentada. Puede venir vacía: el módulo recién se carga. */
  documentos: DocumentoElegible[];
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

  const [documentosDelRiesgo, definirDocumentosDelRiesgo] = React.useState<string[]>(
    inicial?.documentos ?? [],
  );

  // Las acciones del riesgo. `clave` es solo de la pantalla: ordena las
  // filas y no viaja al servidor.
  const [acciones, definirAcciones] = React.useState<AccionDelRiesgo[]>(
    inicial?.acciones ?? [],
  );

  function agregarAccion() {
    definirAcciones((actuales) => [
      ...actuales,
      {
        clave: `accion-${Date.now()}-${actuales.length}`,
        descripcion: "",
        responsable_id: usuarioActual,
        plazo: "",
        documentos: [],
      },
    ]);
  }

  function quitarAccion(clave: string) {
    definirAcciones((actuales) => actuales.filter((accion) => accion.clave !== clave));
  }

  function cambiarAccion(clave: string, cambios: Partial<AccionDelRiesgo>) {
    definirAcciones((actuales) =>
      actuales.map((accion) => (accion.clave === clave ? { ...accion, ...cambios } : accion)),
    );
  }

  // Mientras no se eligieron las dos escalas no hay nivel que mostrar.
  // Poner 3 × 3 por defecto, como estaba antes, hacia que el formulario
  // afirmara «nivel 9 · medio» sin que nadie lo hubiera evaluado.
  const valorado = probabilidad > 0 && severidad > 0;
  const nivel = valorado ? probabilidad * severidad : 0;
  const etiqueta = valorado ? etiquetaNivelRiesgo(nivel)! : null;
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

          {/* 1 · DONDE SE IDENTIFICA, CONTRA INFORMACION DOCUMENTADA.
              Antes era un desplegable con la lista fija de procesos del
              mapa. Direccion lo cambio el 8 de octubre: no siempre es un
              proceso —puede ser una politica, un instructivo o un
              formulario—, asi que se elige de lo que hay cargado en
              Informacion Documentada, y se puede elegir mas de uno.

              Va en una lista de casillas y no en un `<select multiple>`:
              en un celular el multiple obliga a mantener apretada una
              tecla que no existe. */}
          <SelectorDocumentos
            etiqueta="Dónde se identifica el riesgo"
            ayuda="Elija uno o varios de Información Documentada. No siempre es un proceso: puede ser una política o un instructivo."
            documentos={documentos}
            elegidos={documentosDelRiesgo}
            alAlternar={(id) =>
              definirDocumentosDelRiesgo((actuales) =>
                actuales.includes(id)
                  ? actuales.filter((otro) => otro !== id)
                  : [...actuales, id],
              )
            }
          />
          <input type="hidden" name="documentos" value={JSON.stringify(documentosDelRiesgo)} />

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

          {etiqueta ? (
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
                {DECISION_POR_NIVEL[etiqueta]}
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
                  ? "Lo determina la clasificación: alto y crítico exigen una acción de tratamiento. Complete el plan más abajo."
                  : "Lo determina la clasificación: moderado y bajo se aceptan sin acción inmediata y se reevalúan en cada Revisión por la Dirección."}
            </p>
          </div>
        </div>

        {/* 11 · QUE SE HACE CON EL, SOLO SI EL NIVEL LO EXIGE. Direccion
            lo fijo el 8 de octubre: el riesgo alto o critico exige una
            accion de tratamiento; el moderado y el bajo se aceptan sin
            accion inmediata y se reevaluan en cada Revision por la
            Direccion. Para esos dos el bloque entero no aparece: pedir un
            tratamiento que nadie va a ejecutar es ruido. */}
        <div className={exigeAcciones ? "mt-5 grid gap-4 sm:grid-cols-2" : "hidden"}>
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

        {/* LOS CONTROLES EXISTENTES, SOLOS. Dirección sacó de acá el
            bloque «Responsable y plan» el 8 de octubre: el dueño y el
            plazo ya se cargan en cada acción de tratamiento, que son
            ilimitadas, y pedirlos otra vez acá era pedir dos veces lo
            mismo con riesgo de que no coincidieran.

            El riesgo igual necesita un dueño —es quien recibe el aviso
            de reevaluación—, así que queda quien lo carga, o el que ya
            tenía si se está editando. Se cambia desde la ficha. */}
        <div className="mt-5 rounded-md border border-borde p-4">
          <input
            type="hidden"
            name="responsable_id"
            value={inicial?.responsable_id ?? usuarioActual}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <GrupoCampo
              etiqueta="Controles existentes"
              htmlFor="controles_existentes"
              className="sm:col-span-2"
              ayuda="Qué se hace hoy para contener el riesgo. Justifica la evaluación."
            >
              <AreaTexto
                id="controles_existentes"
                name="controles_existentes"
                rows={2}
                defaultValue={inicial?.controles_existentes ?? ""}
              />
            </GrupoCampo>

          </div>

          {/* UN RIESGO ADMITE TODAS LAS ACCIONES QUE HAGAN FALTA. Antes
              el alta cargaba una sola, escrita en columnas del propio
              riesgo. Direccion pidio el 8 de octubre que sean ilimitadas,
              y lo esencial de cada una es accion, responsable y plazo.
              Van a `riesgo_acciones`, que es la tabla que la ficha ya
              usaba para las que se agregaban despues. */}
          {exigeAcciones ? (
            <div className="mt-4 space-y-3 border-t border-borde pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold">Acciones de tratamiento</p>
                <Boton
                  type="button"
                  variante="contorno"
                  tamano="pequeno"
                  onClick={agregarAccion}
                >
                  <Plus /> Agregar acción
                </Boton>
              </div>

              {acciones.length === 0 ? (
                <p className="text-[11px] text-atenuado-contraste">
                  El nivel exige al menos una acción. Use «Agregar acción».
                </p>
              ) : null}

              {acciones.map((accion, indice) => (
                <div key={accion.clave} className="rounded-md border border-borde p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium text-atenuado-contraste">
                      Acción {indice + 1}
                    </p>
                    <Boton
                      type="button"
                      variante="fantasma"
                      tamano="iconoPequeno"
                      aria-label={`Quitar la acción ${indice + 1}`}
                      onClick={() => quitarAccion(accion.clave)}
                      className="text-atenuado-contraste hover:text-semaforo-critico"
                    >
                      <Trash2 />
                    </Boton>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <GrupoCampo
                      etiqueta="Acción"
                      htmlFor={`accion-${accion.clave}`}
                      requerido
                      className="sm:col-span-2"
                      ayuda="Qué se va a hacer para tratar el riesgo."
                    >
                      <AreaTexto
                        id={`accion-${accion.clave}`}
                        rows={2}
                        value={accion.descripcion}
                        onChange={(evento) =>
                          cambiarAccion(accion.clave, { descripcion: evento.target.value })
                        }
                      />
                    </GrupoCampo>

                    <GrupoCampo
                      etiqueta="Responsable"
                      htmlFor={`responsable-${accion.clave}`}
                      requerido
                    >
                      <Seleccion
                        id={`responsable-${accion.clave}`}
                        value={accion.responsable_id}
                        onChange={(evento) =>
                          cambiarAccion(accion.clave, { responsable_id: evento.target.value })
                        }
                      >
                        <option value="">Elija el responsable</option>
                        {usuarios.map((persona) => (
                          <option key={persona.id} value={persona.id}>
                            {persona.nombre_completo}
                          </option>
                        ))}
                      </Seleccion>
                    </GrupoCampo>

                    <GrupoCampo
                      etiqueta="Plazo de ejecución"
                      htmlFor={`plazo-${accion.clave}`}
                      requerido
                    >
                      <Entrada
                        id={`plazo-${accion.clave}`}
                        type="date"
                        value={accion.plazo}
                        onChange={(evento) =>
                          cambiarAccion(accion.clave, { plazo: evento.target.value })
                        }
                      />
                    </GrupoCampo>

                    <div className="sm:col-span-2">
                      <SelectorDocumentos
                        etiqueta="Dónde se integra la acción"
                        ayuda="Opcional. No siempre es donde se identificó el riesgo."
                        documentos={documentos}
                        elegidos={accion.documentos}
                        alAlternar={(id) =>
                          cambiarAccion(accion.clave, {
                            documentos: accion.documentos.includes(id)
                              ? accion.documentos.filter((otro) => otro !== id)
                              : [...accion.documentos, id],
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              ))}

              <input
                type="hidden"
                name="acciones"
                value={JSON.stringify(
                  acciones.map(({ clave: _clave, ...resto }) => resto),
                )}
              />
            </div>
          ) : null}
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
