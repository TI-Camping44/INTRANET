"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle, Pencil, Plus, Trash2, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import {
  Dialogo,
  DialogoCabecera,
  DialogoCierre,
  DialogoContenido,
  DialogoPie,
  DialogoTitulo,
} from "@/components/ui/dialogo";
import {
  actualizarFormacion,
  crearFormacion,
  eliminarFormacion,
} from "@/app/(sgc)/recursos-humanos/formacion/acciones";
import {
  ETIQUETAS_MODALIDAD,
  HORAS_PARA_EXIGIR_EFICACIA,
  MODALIDADES,
  requiereEvaluacionDeEficacia,
  TIPOS_FORMACION_VIGENTES,
  ETIQUETAS_TIPO_FORMACION,
  horasTotales,
} from "@/lib/formacion";
import { hoyEnAsuncion } from "@/lib/formato";
import type { FilaFormacion } from "@/app/(sgc)/recursos-humanos/formacion/page";

export interface PersonaElegible {
  id: string;
  nombre_completo: string;
}

/**
 * Alta y edición de una acción formativa.
 *
 * TRES COSAS QUE CAMBIAN SOLAS MIENTRAS SE COMPLETA, y por eso el
 * formulario tiene estado:
 *
 *   · El formador depende del tipo. Si la acción es interna, el formador
 *     es alguien de la casa y se elige de la lista; si es externa no
 *     tiene perfil en la intranet y el nombre se escribe. Mostrar los
 *     dos campos a la vez dejaría dos formadores para la misma acción y
 *     ninguna forma de saber cuál vale.
 *
 *   · Los colaboradores se agregan de a uno, sin límite. Arranca con uno
 *     y el botón suma otro. Es lo que pidió Dirección y es lo que pasa en
 *     la práctica: una formación no tiene una cantidad fija de gente.
 *
 *   · El aviso de las dos horas aparece cuando la cuenta lo pide. No
 *     bloquea nada: avisa. La regla la aplica la base, en la columna
 *     generada `requiere_eficacia`, y la eficacia se verifica después,
 *     persona por persona.
 */
export function FormularioFormacion({
  personas,
  formacion,
  participantesActuales = [],
}: {
  personas: PersonaElegible[];
  formacion?: FilaFormacion;
  participantesActuales?: string[];
}) {
  const router = useRouter();
  const [abierto, definirAbierto] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);
  const editando = Boolean(formacion);

  const [tipo, definirTipo] = React.useState(formacion?.tipo ?? "externa");
  const [sesiones, definirSesiones] = React.useState(formacion?.cantidad_sesiones ?? 1);
  const [horas, definirHoras] = React.useState(Number(formacion?.horas_por_sesion ?? 1));
  const [elegidos, definirElegidos] = React.useState<string[]>(
    participantesActuales.length > 0 ? participantesActuales : [""],
  );

  // El formulario se reinicia cada vez que se abre: si no, al cerrar sin
  // guardar queda a medio llenar para la próxima.
  React.useEffect(() => {
    if (!abierto) return;
    definirTipo(formacion?.tipo ?? "externa");
    definirSesiones(formacion?.cantidad_sesiones ?? 1);
    definirHoras(Number(formacion?.horas_por_sesion ?? 1));
    definirElegidos(participantesActuales.length > 0 ? participantesActuales : [""]);
    // `participantesActuales` es un arreglo nuevo en cada render del
    // padre; se compara por su contenido para no reiniciar de más.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abierto, formacion, participantesActuales.join(",")]);

  const total = horasTotales(sesiones, horas);
  const exigeEficacia = requiereEvaluacionDeEficacia(sesiones, horas);

  function cambiarColaborador(indice: number, valor: string) {
    definirElegidos((anteriores) =>
      anteriores.map((elegido, posicion) => (posicion === indice ? valor : elegido)),
    );
  }

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    definirProcesando(true);
    const resultado = editando
      ? await actualizarFormacion(formacion!.id, datos)
      : await crearFormacion(datos);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Guardado.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function borrar() {
    if (!formacion) return;
    if (!confirm(`¿Eliminar «${formacion.nombre}» y sus archivos? No se puede deshacer.`)) return;

    definirProcesando(true);
    const resultado = await eliminarFormacion(formacion.id);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Eliminada.");
      definirAbierto(false);
      router.push("/recursos-humanos/formacion");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <>
      {editando ? (
        <Boton variante="contorno" tamano="pequeno" onClick={() => definirAbierto(true)}>
          <Pencil /> Editar
        </Boton>
      ) : (
        <Boton onClick={() => definirAbierto(true)}>
          <Plus /> Nueva Formación
        </Boton>
      )}

      <Dialogo open={abierto} onOpenChange={definirAbierto}>
        <DialogoContenido className="max-w-2xl">
          <form onSubmit={guardar}>
            <DialogoCabecera>
              <DialogoTitulo>
                {editando ? "Editar la acción formativa" : "Nueva acción formativa"}
              </DialogoTitulo>
            </DialogoCabecera>

            <div className="mt-4 max-h-[65vh] space-y-3 overflow-y-auto pr-1">
              <GrupoCampo etiqueta="Acción formativa" htmlFor="nombre" requerido>
                <Entrada
                  id="nombre"
                  name="nombre"
                  required
                  minLength={5}
                  placeholder="Auditor Interno ISO 9001"
                  defaultValue={formacion?.nombre ?? ""}
                />
              </GrupoCampo>

              <GrupoCampo etiqueta="Objetivo de la acción formativa" htmlFor="objetivo" requerido>
                <AreaTexto
                  id="objetivo"
                  name="objetivo"
                  rows={2}
                  required
                  placeholder="Qué se espera que la persona sepa hacer al terminar."
                  defaultValue={formacion?.objetivo ?? ""}
                />
              </GrupoCampo>

              <div className="grid gap-3 sm:grid-cols-2">
                <GrupoCampo etiqueta="Modalidad" htmlFor="modalidad" requerido>
                  <Seleccion
                    id="modalidad"
                    name="modalidad"
                    required
                    defaultValue={formacion?.modalidad ?? ""}
                    key={formacion?.id ?? "nueva"}
                  >
                    <option value="" disabled>
                      Elija la modalidad
                    </option>
                    {MODALIDADES.map((modalidad) => (
                      <option key={modalidad} value={modalidad}>
                        {ETIQUETAS_MODALIDAD[modalidad]}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>

                <GrupoCampo etiqueta="Tipo" htmlFor="tipo" requerido>
                  <Seleccion
                    id="tipo"
                    name="tipo"
                    required
                    value={tipo}
                    onChange={(evento) =>
                      definirTipo(evento.target.value as FilaFormacion["tipo"])
                    }
                  >
                    {TIPOS_FORMACION_VIGENTES.map((valor) => (
                      <option key={valor} value={valor}>
                        {ETIQUETAS_TIPO_FORMACION[valor]}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>
              </div>

              {/* El formador depende del tipo: ver el comentario de arriba. */}
              {tipo === "interna" ? (
                <GrupoCampo
                  etiqueta="Formador"
                  htmlFor="formador_id"
                  requerido
                  ayuda="Una persona de la casa."
                >
                  <Seleccion
                    id="formador_id"
                    name="formador_id"
                    required
                    defaultValue=""
                    key={`formador-${formacion?.id ?? "nueva"}`}
                  >
                    <option value="" disabled>
                      Elija al formador
                    </option>
                    {personas.map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.nombre_completo}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>
              ) : (
                <GrupoCampo
                  etiqueta="Formador externo"
                  htmlFor="instructor"
                  requerido
                  ayuda="El nombre de la persona o de la institución que la dicta."
                >
                  <Entrada
                    id="instructor"
                    name="instructor"
                    required
                    placeholder="Intedya"
                    defaultValue={formacion?.instructor ?? ""}
                  />
                </GrupoCampo>
              )}

              {/* Los colaboradores, de a uno y sin límite. */}
              <div className="space-y-2">
                <p className="text-xs font-medium">
                  Colaboradores <span className="text-primario">*</span>
                </p>
                {elegidos.map((elegido, indice) => (
                  <div key={indice} className="flex items-center gap-2">
                    <Seleccion
                      name="participantes"
                      aria-label={`Colaborador ${indice + 1}`}
                      value={elegido}
                      onChange={(evento) => cambiarColaborador(indice, evento.target.value)}
                      className="flex-1"
                    >
                      <option value="" disabled>
                        Elija un colaborador
                      </option>
                      {personas.map((persona) => (
                        <option key={persona.id} value={persona.id}>
                          {persona.nombre_completo}
                        </option>
                      ))}
                    </Seleccion>

                    {elegidos.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          definirElegidos((anteriores) =>
                            anteriores.filter((_, posicion) => posicion !== indice),
                          )
                        }
                        className="shrink-0 text-atenuado-contraste transition-colors hover:text-semaforo-critico"
                        aria-label={`Quitar el colaborador ${indice + 1}`}
                      >
                        <X className="size-4" />
                      </button>
                    ) : null}
                  </div>
                ))}

                <Boton
                  type="button"
                  variante="contorno"
                  tamano="pequeno"
                  onClick={() => definirElegidos((anteriores) => [...anteriores, ""])}
                >
                  <Plus /> Agregar otro colaborador
                </Boton>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <GrupoCampo etiqueta="Desde" htmlFor="fecha_inicio" requerido>
                  <Entrada
                    id="fecha_inicio"
                    name="fecha_inicio"
                    type="date"
                    required
                    defaultValue={formacion?.fecha_inicio ?? hoyEnAsuncion()}
                  />
                </GrupoCampo>

                <GrupoCampo etiqueta="Hasta" htmlFor="fecha_fin">
                  <Entrada
                    id="fecha_fin"
                    name="fecha_fin"
                    type="date"
                    defaultValue={formacion?.fecha_fin ?? ""}
                  />
                </GrupoCampo>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <GrupoCampo etiqueta="Cantidad de sesiones" htmlFor="cantidad_sesiones" requerido>
                  <Entrada
                    id="cantidad_sesiones"
                    name="cantidad_sesiones"
                    type="number"
                    min={1}
                    step={1}
                    required
                    value={sesiones}
                    onChange={(evento) => definirSesiones(Number(evento.target.value))}
                  />
                </GrupoCampo>

                <GrupoCampo
                  etiqueta="Horas estimadas por sesión"
                  htmlFor="horas_por_sesion"
                  requerido
                >
                  <Entrada
                    id="horas_por_sesion"
                    name="horas_por_sesion"
                    type="number"
                    min={0.5}
                    max={24}
                    step={0.5}
                    required
                    value={horas}
                    onChange={(evento) => definirHoras(Number(evento.target.value))}
                  />
                </GrupoCampo>
              </div>

              {/* El aviso de las dos horas. No bloquea: avisa. */}
              <div
                className={
                  exigeEficacia
                    ? "rounded-md border border-semaforo-medio/40 bg-semaforo-medio/10 p-3"
                    : "rounded-md border border-borde p-3"
                }
              >
                <p className="flex items-start gap-2 text-[11px] leading-relaxed">
                  {exigeEficacia ? (
                    <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-semaforo-medio" />
                  ) : null}
                  <span>
                    <span className="font-medium">
                      {Number.isFinite(total) ? total : 0} hora{total === 1 ? "" : "s"} en total
                    </span>
                    {exigeEficacia ? (
                      <>
                        {" · "}
                        Supera las {HORAS_PARA_EXIGIR_EFICACIA} horas:{" "}
                        <span className="font-medium">
                          debe aplicarse una Evaluación de Eficacia de la Formación
                        </span>
                        , que se verifica por persona al registrar la ejecución.
                      </>
                    ) : (
                      <>
                        {" · "}
                        Hasta {HORAS_PARA_EXIGIR_EFICACIA} horas no se exige Evaluación de
                        Eficacia.
                      </>
                    )}
                  </span>
                </p>
              </div>

              <GrupoCampo
                etiqueta="Plan o programa"
                htmlFor="plan"
                ayuda="Opcional. Se puede subir después, desde la ficha."
              >
                <input
                  id="plan"
                  type="file"
                  name="plan"
                  multiple
                  className="block w-full text-xs file:mr-2 file:rounded file:border file:border-borde file:bg-acento file:px-2 file:py-1 file:text-xs"
                />
              </GrupoCampo>
            </div>

            <DialogoPie className="mt-5 sm:justify-between">
              {editando ? (
                <Boton
                  type="button"
                  variante="contorno"
                  onClick={borrar}
                  cargando={procesando}
                  className="text-semaforo-critico hover:text-semaforo-critico"
                >
                  <Trash2 /> Eliminar
                </Boton>
              ) : (
                <span />
              )}

              <span className="flex gap-2">
                <DialogoCierre asChild>
                  <Boton type="button" variante="contorno">
                    Cancelar
                  </Boton>
                </DialogoCierre>
                <Boton type="submit" cargando={procesando}>
                  {editando ? "Guardar cambios" : "Planificar formación"}
                </Boton>
              </span>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </>
  );
}
