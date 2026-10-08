"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { actualizarOportunidad, crearOportunidad } from "@/app/(sgc)/riesgos/acciones";
import { ESCALA_BENEFICIO, ESCALA_FACTIBILIDAD } from "@/lib/constantes";
import {
  advertenciaAlineacion,
  CLASES_PRIORIDAD,
  DECISION_POR_PRIORIDAD,
  ETIQUETAS_PRIORIDAD,
  ORIGENES_OPORTUNIDAD,
  prioridadOportunidad,
} from "@/lib/riesgos";
import {
  SelectorDocumentos,
  type DocumentoElegible,
} from "@/app/(sgc)/riesgos/selector-documentos";
import { cn } from "@/lib/utilidades";

interface Opcion {
  id: string;
  nombre?: string;
  codigo?: string;
  nombre_completo?: string;
}

/**
 * Alta de una oportunidad, según el F-EST-01-04.
 *
 * Nada de probabilidad ni severidad: una oportunidad se valora por el
 * beneficio que podría aportar y por la facilidad real de concretarla.
 *
 * Las dos escalas se leen al revés una de la otra, y es el error más
 * común: en beneficio se toma la dimensión MÁS FAVORECIDA, y en
 * factibilidad la MÁS RESTRICTIVA —el cuello de botella—. Una
 * oportunidad que necesita una sola cosa imposible no es factible,
 * aunque todo lo demás esté resuelto.
 */
/** Una acción de la oportunidad, mientras se la escribe en el formulario. */
export interface AccionDeLaOportunidad {
  /** Solo de la pantalla: ordena las filas y no viaja al servidor. */
  clave: string;
  descripcion: string;
  responsable_id: string;
  plazo: string;
  documentos: string[];
}

/** Lo que trae una oportunidad ya cargada cuando se la abre para corregir. */
export interface OportunidadInicial {
  id: string;
  /** Los documentos ya vinculados, para que la edición los traiga marcados. */
  documentos?: string[];
  acciones?: AccionDeLaOportunidad[];
  descripcion: string | null;
  origen: string | null;
  efecto_deseado: string | null;
  responsable_id: string | null;
  beneficio: number | null;
  factibilidad: number | null;
  alineacion_estrategica: string | null;
  se_decide_abordar: boolean | null;
  fundamento_decision: string | null;
  recursos_necesarios: string | null;
}

export function FormularioOportunidad({
  documentos,
  usuarios,
  usuarioActual,
  inicial,
}: {
  /** La información documentada. Puede venir vacía: el módulo recién se carga. */
  documentos: DocumentoElegible[];
  usuarios: Opcion[];
  usuarioActual: string;
  inicial?: OportunidadInicial;
}) {
  const router = useRouter();
  const editando = Boolean(inicial);
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [beneficio, definirBeneficio] = React.useState(inicial?.beneficio ?? 3);
  const [factibilidad, definirFactibilidad] = React.useState(inicial?.factibilidad ?? 3);
  const [alineacion, definirAlineacion] = React.useState(
    inicial?.alineacion_estrategica ?? "media",
  );
  const [seAborda, definirSeAborda] = React.useState(inicial?.se_decide_abordar ?? true);

  const [documentosDeLaOportunidad, definirDocumentosDeLaOportunidad] = React.useState<string[]>(
    inicial?.documentos ?? [],
  );

  // Las acciones. `clave` es solo de la pantalla: ordena las filas y no
  // viaja al servidor.
  const [acciones, definirAcciones] = React.useState<AccionDeLaOportunidad[]>(
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

  function cambiarAccion(clave: string, cambios: Partial<AccionDeLaOportunidad>) {
    definirAcciones((actuales) =>
      actuales.map((accion) => (accion.clave === clave ? { ...accion, ...cambios } : accion)),
    );
  }

  const indice = beneficio * factibilidad;
  const prioridad = prioridadOportunidad(indice)!;
  const advertencia = advertenciaAlineacion(indice, alineacion, seAborda);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const datos = new FormData(evento.currentTarget);
    const resultado = inicial
      ? await actualizarOportunidad(inicial.id, datos)
      : await crearOportunidad(datos);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Oportunidad registrada.");
      router.push(inicial ? `/riesgos/${inicial.id}` : "/oportunidades");
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
          {/* 1 · DONDE SE IDENTIFICA, CONTRA INFORMACION DOCUMENTADA.
              Mismo modelo que el riesgo: antes era un desplegable con la
              lista fija de procesos del mapa, y no siempre es un proceso
              —puede ser una politica, un instructivo o un formulario—.
              Se elige de lo que hay cargado en Informacion Documentada y
              admite mas de uno. */}
          <SelectorDocumentos
            etiqueta="Dónde se identifica la oportunidad"
            ayuda="Elija uno o varios de Información Documentada. No siempre es un proceso: puede ser una política o un instructivo."
            documentos={documentos}
            elegidos={documentosDeLaOportunidad}
            alAlternar={(id) =>
              definirDocumentosDeLaOportunidad((actuales) =>
                actuales.includes(id)
                  ? actuales.filter((otro) => otro !== id)
                  : [...actuales, id],
              )
            }
          />
          <input
            type="hidden"
            name="documentos"
            value={JSON.stringify(documentosDeLaOportunidad)}
          />

          {/* Lista cerrada y propia, no la de riesgos: ver
              `ORIGENES_OPORTUNIDAD`. La opcion vacia esta deshabilitada,
              asi obliga a elegir en vez de dejar la primera por
              descuido. */}
          <GrupoCampo etiqueta="Origen" htmlFor="origen" requerido className="sm:col-span-2">
            <Seleccion id="origen" name="origen" required defaultValue={inicial?.origen ?? ""}>
              <option value="" disabled>
                Elija de dónde salió
              </option>
              {ORIGENES_OPORTUNIDAD.map((origen) => (
                <option key={origen} value={origen}>
                  {origen}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Descripción de la oportunidad"
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

          {/* Contra esto se mide la eficacia al cerrar, no contra el
              índice. Si no se declara al inicio, después no hay forma de
              decir si la acción sirvió. */}
          <GrupoCampo
            etiqueta="Efecto deseado esperado"
            htmlFor="efecto_deseado"
            requerido
            className="sm:col-span-2"
            ayuda="Qué se espera lograr, en concreto. La eficacia se evalúa comparando el resultado obtenido contra esto."
          >
            <AreaTexto
              id="efecto_deseado"
              name="efecto_deseado"
              rows={2}
              required
              defaultValue={inicial?.efecto_deseado ?? ""}
            />
          </GrupoCampo>

          {/* El dueño de la oportunidad no se pregunta acá, igual que
              en el riesgo: cada acción lleva el suyo. Queda quien la
              carga —es quien recibe los avisos— y se cambia desde la
              ficha. */}
          <input
            type="hidden"
            name="responsable_id"
            value={inicial?.responsable_id ?? usuarioActual}
          />
        </div>

        {/* Valoración */}
        <div className="mt-5 rounded-md border border-borde p-4">
          <p className="text-xs font-semibold">Valoración</p>
          <p className="mb-3 mt-0.5 text-[11px] text-atenuado-contraste">
            En beneficio se toma la dimensión más favorecida. En factibilidad, al revés: la más
            restrictiva, el cuello de botella.
          </p>

          <div className="grid gap-4 sm:grid-cols-2">
            <GrupoCampo etiqueta="Beneficio potencial" htmlFor="beneficio" requerido>
              <Seleccion
                id="beneficio"
                name="beneficio"
                value={beneficio}
                onChange={(evento) => definirBeneficio(Number(evento.target.value))}
              >
                {ESCALA_BENEFICIO.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.valor} · {opcion.etiqueta} — {opcion.detalle}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>

            <GrupoCampo etiqueta="Factibilidad" htmlFor="factibilidad" requerido>
              <Seleccion
                id="factibilidad"
                name="factibilidad"
                value={factibilidad}
                onChange={(evento) => definirFactibilidad(Number(evento.target.value))}
              >
                {ESCALA_FACTIBILIDAD.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.valor} · {opcion.etiqueta} — {opcion.detalle}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>
          </div>

          <div
            className={cn(
              "mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border p-3",
              CLASES_PRIORIDAD[prioridad],
            )}
          >
            <div>
              <p className="text-[11px] uppercase tracking-wide opacity-80">Índice resultante</p>
              <p className="text-lg font-semibold tabular">
                {indice} · Prioridad {ETIQUETAS_PRIORIDAD[prioridad].toLowerCase()}
              </p>
            </div>
            <p className="max-w-md text-[11px] opacity-90">{DECISION_POR_PRIORIDAD[prioridad]}</p>
          </div>
        </div>

        {/* Decisión */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <GrupoCampo
            etiqueta="Alineación con la dirección estratégica"
            htmlFor="alineacion_estrategica"
            requerido
            ayuda="No suma puntaje: es condición. Una oportunidad de índice alto con alineación baja no se aborda."
          >
            <Seleccion
              id="alineacion_estrategica"
              name="alineacion_estrategica"
              value={alineacion}
              onChange={(evento) => definirAlineacion(evento.target.value)}
            >
              <option value="alta">Alta</option>
              <option value="media">Media</option>
              <option value="baja">Baja</option>
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="¿Se decide abordar?" htmlFor="se_decide_abordar" requerido>
            <Seleccion
              id="se_decide_abordar"
              name="se_decide_abordar"
              value={seAborda ? "si" : "no"}
              onChange={(evento) => definirSeAborda(evento.target.value === "si")}
            >
              <option value="si">Sí</option>
              <option value="no">No</option>
            </Seleccion>
          </GrupoCampo>

          {advertencia ? (
            <p className="text-xs text-semaforo-alto sm:col-span-2">{advertencia}</p>
          ) : null}

          <GrupoCampo
            etiqueta="Fundamento de la decisión"
            htmlFor="fundamento_decision"
            className="sm:col-span-2"
            requerido
            ayuda="Por qué se decidió abordarla o dejarla. Queda como constancia de la decisión."
          >
            <AreaTexto
              id="fundamento_decision"
              name="fundamento_decision"
              rows={2}
              required
              defaultValue={inicial?.fundamento_decision ?? ""}
            />
          </GrupoCampo>
        </div>

        {/* EL PLAN, SOLO SI SE ABORDA, Y CON ACCIONES ILIMITADAS. Es el
            mismo modelo que el riesgo alto o crítico: antes se cargaba
            una sola acción, escrita en columnas de la propia
            oportunidad. Van a `riesgo_acciones`, que es la misma tabla
            porque la oportunidad vive en `riesgos` con
            `tipo = oportunidad`. */}
        {seAborda ? (
          <div className="mt-4 rounded-md border border-borde p-4">
            <GrupoCampo
              etiqueta="Recursos necesarios"
              htmlFor="recursos_necesarios"
              requerido
              ayuda="Qué hace falta para concretarla. Es de la oportunidad entera, no de cada acción."
            >
              <AreaTexto
                id="recursos_necesarios"
                name="recursos_necesarios"
                rows={2}
                required
                defaultValue={inicial?.recursos_necesarios ?? ""}
              />
            </GrupoCampo>

            <div className="mt-4 space-y-3 border-t border-borde pt-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs font-semibold">Acciones</p>
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
                  Una oportunidad que se decide abordar exige al menos una acción. Use «Agregar
                  acción».
                </p>
              ) : null}

              {acciones.map((accion, indiceAccion) => (
                <div key={accion.clave} className="rounded-md border border-borde p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-[11px] font-medium text-atenuado-contraste">
                      Acción {indiceAccion + 1}
                    </p>
                    <Boton
                      type="button"
                      variante="fantasma"
                      tamano="iconoPequeno"
                      aria-label={`Quitar la acción ${indiceAccion + 1}`}
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
                      ayuda="Qué se va a hacer para concretar la oportunidad."
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
                        ayuda="Opcional. No siempre es donde se identificó la oportunidad."
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
          </div>
        ) : null}

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            {editando ? "Guardar cambios" : "Registrar oportunidad"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
