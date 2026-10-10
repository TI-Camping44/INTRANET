"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  Paperclip,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  Upload,
  XCircle,
} from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { InsigniaEstadoAccion } from "@/components/comunes/insignias-estado";
import {
  Dialogo,
  DialogoCabecera,
  DialogoCierre,
  DialogoContenido,
  DialogoPie,
  DialogoTitulo,
} from "@/components/ui/dialogo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  adjuntarEvidenciaAccionRiesgo,
  crearAccionRiesgo,
  editarAccionRiesgo,
  ejecutarAccionRiesgo,
  eliminarAccionRiesgo,
  eliminarEvidenciaAccionRiesgo,
  evaluarEficaciaAccionRiesgo,
} from "@/app/(sgc)/riesgos/acciones";
import {
  ETIQUETAS_TRATAMIENTO_RIESGO,
  MAXIMO_EVIDENCIAS_ACCION,
  TRATAMIENTOS_VIGENTES,
} from "@/lib/constantes";
import { ACEPTA_EVIDENCIA, describirTamano } from "@/lib/adjuntos";
import { describirVencimiento, formatearFecha, hoyEnAsuncion } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import type { EstadoAccion, TratamientoRiesgo } from "@/lib/tipos";

export interface EvidenciaDeAccion {
  id: string;
  nombre_archivo: string;
  tamano_bytes: number;
  creado_en: string;
}

export interface AccionTratamiento {
  id: string;
  descripcion: string;
  tratamiento: TratamientoRiesgo;
  responsable_id: string | null;
  fecha_inicio: string | null;
  fecha_limite: string | null;
  plazo_permanente: boolean;
  estado: EstadoAccion;
  fecha_ejecucion: string | null;
  ejecucion_en_plazo: boolean | null;
  evidencia: string | null;
  eficacia: "eficaz" | "parcialmente_eficaz" | "no_eficaz" | "pendiente" | null;
  fecha_evaluacion_eficacia: string | null;
  comentario_eficacia: string | null;
  responsable: { nombre_completo: string } | null;
  evaluador: { nombre_completo: string } | null;
  adjuntos: EvidenciaDeAccion[];
}

/**
 * El plan de tratamiento del riesgo, accion por accion.
 *
 * Es el equivalente de las tareas de una accion correctiva, pero dentro
 * del riesgo: lo pidio Calidad el 5 de octubre. Cada accion lleva su
 * responsable, su plazo con dos fechas, su evidencia y su propia
 * evaluacion de eficacia.
 *
 * TRES PASOS, EN ESTE ORDEN, y cada uno habilita el siguiente:
 *
 *   1 · Se carga la accion: que se va a hacer, quien y entre que fechas.
 *   2 · Se registra su ejecucion, con un comentario de cierre. Ahi queda
 *       grabado si fue en plazo, y no se recalcula despues.
 *   3 · Se evalua si sirvio: eficaz o no eficaz.
 *
 * Que la eficacia no se pueda marcar antes de ejecutar no es una
 * comodidad de la pantalla: lo exige tambien la base, en
 * `riesgo_acciones_eficacia_tras_ejecucion`.
 *
 * LOS ENLACES DE LOS ARCHIVOS NO SE DIBUJAN. Cada uno apunta a
 * `/adjuntos/<id>`, y esa ruta firma el enlace recien en el clic, con la
 * sesion de la persona y por cinco minutos.
 */
export function AccionesTratamiento({
  riesgoId,
  acciones,
  personas,
  tratamientoDelRiesgo,
  puedeEditar,
}: {
  riesgoId: string;
  acciones: AccionTratamiento[];
  personas: { id: string; nombre_completo: string }[];
  tratamientoDelRiesgo: TratamientoRiesgo | null;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [formulario, definirFormulario] = React.useState<AccionTratamiento | "nueva" | null>(null);
  const [ejecutando, definirEjecutando] = React.useState<AccionTratamiento | null>(null);
  const [evaluando, definirEvaluando] = React.useState<{
    accion: AccionTratamiento;
    eficaz: boolean;
  } | null>(null);
  const [subiendoEn, definirSubiendoEn] = React.useState<string | null>(null);
  const [procesando, definirProcesando] = React.useState(false);
  const hoy = hoyEnAsuncion();

  function avisar(resultado: { exito: boolean; mensaje?: string; error?: string }, caida: string) {
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? caida);
      router.refresh();
      return true;
    }
    toast.error(resultado.error ?? "No se pudo completar la operación.");
    return false;
  }

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    definirProcesando(true);
    const resultado =
      formulario && formulario !== "nueva"
        ? await editarAccionRiesgo(formulario.id, riesgoId, datos)
        : await crearAccionRiesgo(riesgoId, datos);
    definirProcesando(false);
    if (avisar(resultado, "Acción guardada.")) definirFormulario(null);
  }

  async function ejecutar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!ejecutando) return;
    const comentario = String(new FormData(evento.currentTarget).get("comentario") ?? "");
    definirProcesando(true);
    const resultado = await ejecutarAccionRiesgo(ejecutando.id, riesgoId, comentario);
    definirProcesando(false);
    if (avisar(resultado, "Acción ejecutada.")) definirEjecutando(null);
  }

  async function evaluar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!evaluando) return;
    const comentario = String(new FormData(evento.currentTarget).get("comentario") ?? "");
    definirProcesando(true);
    const resultado = await evaluarEficaciaAccionRiesgo(
      evaluando.accion.id,
      riesgoId,
      evaluando.eficaz,
      comentario,
    );
    definirProcesando(false);
    if (avisar(resultado, "Eficacia registrada.")) definirEvaluando(null);
  }

  async function subir(evento: React.FormEvent<HTMLFormElement>, accionId: string) {
    evento.preventDefault();
    const formularioHtml = evento.currentTarget;
    definirProcesando(true);
    const resultado = await adjuntarEvidenciaAccionRiesgo(
      accionId,
      riesgoId,
      new FormData(formularioHtml),
    );
    definirProcesando(false);
    if (avisar(resultado, "Evidencia subida.")) {
      formularioHtml.reset();
      definirSubiendoEn(null);
    }
  }

  async function quitarArchivo(adjuntoId: string, accionId: string, nombre: string) {
    if (!confirm(`¿Quitar «${nombre}»? No se puede deshacer.`)) return;
    avisar(
      await eliminarEvidenciaAccionRiesgo(adjuntoId, accionId, riesgoId),
      "Archivo eliminado.",
    );
  }

  async function borrar(accion: AccionTratamiento) {
    if (!confirm("¿Eliminar esta acción y su evidencia? No se puede deshacer.")) return;
    avisar(await eliminarAccionRiesgo(accion.id, riesgoId), "Acción eliminada.");
  }

  return (
    <div className="space-y-3">
      {acciones.length === 0 ? (
        <EstadoVacio
          titulo="Sin acciones de tratamiento"
          descripcion="Defina qué se va a hacer para llevar el riesgo a un nivel aceptable, con responsable y plazo."
        />
      ) : (
        <ul className="space-y-2">
          {acciones.map((accion) => {
            const ejecutada = Boolean(accion.fecha_ejecucion);
            const evaluada = accion.eficacia === "eficaz" || accion.eficacia === "no_eficaz";
            const vencida =
              !ejecutada &&
              !accion.plazo_permanente &&
              accion.fecha_limite !== null &&
              accion.fecha_limite < hoy;

            return (
              <li key={accion.id} className="rounded-md border border-borde p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-snug">{accion.descripcion}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-atenuado-contraste">
                      <span>{ETIQUETAS_TRATAMIENTO_RIESGO[accion.tratamiento]}</span>
                      <span aria-hidden>·</span>
                      <span>{accion.responsable?.nombre_completo ?? "Sin responsable"}</span>
                      <span aria-hidden>·</span>
                      <span className={cn(vencida && "font-medium text-semaforo-critico")}>
                        {accion.plazo_permanente
                          ? "Plazo permanente"
                          : `${accion.fecha_inicio ? formatearFecha(accion.fecha_inicio) : "—"} a ${
                              accion.fecha_limite ? formatearFecha(accion.fecha_limite) : "—"
                            }`}
                        {!accion.plazo_permanente && accion.fecha_limite && !ejecutada
                          ? ` · ${describirVencimiento(accion.fecha_limite)}`
                          : ""}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <InsigniaEstadoAccion estado={accion.estado} />
                    {puedeEditar ? (
                      <>
                        <button
                          type="button"
                          onClick={() => definirFormulario(accion)}
                          className="text-atenuado-contraste transition-colors hover:text-primario"
                          aria-label={`Editar ${accion.descripcion}`}
                        >
                          <Pencil className="size-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => borrar(accion)}
                          className="text-atenuado-contraste transition-colors hover:text-semaforo-critico"
                          aria-label={`Eliminar ${accion.descripcion}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>

                {/* Lo que paso con la accion, en orden. */}
                {ejecutada ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-atenuado-contraste">
                    <span
                      className={cn(
                        "font-medium",
                        accion.ejecucion_en_plazo === false
                          ? "text-semaforo-alto"
                          : "text-semaforo-bajo",
                      )}
                    >
                      {accion.ejecucion_en_plazo === false
                        ? "Ejecutada fuera de plazo"
                        : "Ejecutada en plazo"}
                    </span>
                    {` · ${formatearFecha(accion.fecha_ejecucion!)}`}
                    {accion.evidencia ? ` · ${accion.evidencia}` : ""}
                  </p>
                ) : null}

                {evaluada ? (
                  <p className="mt-1 text-[11px] leading-relaxed text-atenuado-contraste">
                    <span
                      className={cn(
                        "font-medium",
                        accion.eficacia === "eficaz"
                          ? "text-semaforo-bajo"
                          : "text-semaforo-critico",
                      )}
                    >
                      {accion.eficacia === "eficaz" ? "Eficaz" : "No eficaz"}
                    </span>
                    {accion.fecha_evaluacion_eficacia
                      ? ` · ${formatearFecha(accion.fecha_evaluacion_eficacia)}`
                      : ""}
                    {accion.evaluador ? ` · ${accion.evaluador.nombre_completo}` : ""}
                    {accion.comentario_eficacia ? ` · ${accion.comentario_eficacia}` : ""}
                  </p>
                ) : null}

                {/* La evidencia de la accion. */}
                {accion.adjuntos.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {accion.adjuntos.map((adjunto) => (
                      <li key={adjunto.id} className="flex items-center gap-1.5 text-[11px]">
                        <a
                          href={`/adjuntos/${adjunto.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-w-0 flex-1 items-center gap-1.5 hover:underline"
                        >
                          <Paperclip className="size-3 shrink-0 text-atenuado-contraste" />
                          <span className="truncate">{adjunto.nombre_archivo}</span>
                          <span className="shrink-0 text-atenuado-contraste">
                            {describirTamano(adjunto.tamano_bytes)}
                          </span>
                        </a>
                        {puedeEditar ? (
                          <button
                            type="button"
                            onClick={() =>
                              quitarArchivo(adjunto.id, accion.id, adjunto.nombre_archivo)
                            }
                            className="shrink-0 text-atenuado-contraste transition-colors hover:text-semaforo-critico"
                            aria-label={`Quitar ${adjunto.nombre_archivo}`}
                          >
                            <Trash2 className="size-3" />
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {puedeEditar ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-borde pt-2">
                    {!ejecutada ? (
                      <Boton
                        tamano="pequeno"
                        variante="contorno"
                        onClick={() => definirEjecutando(accion)}
                      >
                        <CheckCircle2 /> Registrar ejecución
                      </Boton>
                    ) : null}

                    {ejecutada && !evaluada ? (
                      <>
                        <Boton
                          tamano="pequeno"
                          variante="contorno"
                          onClick={() => definirEvaluando({ accion, eficaz: true })}
                        >
                          <ShieldCheck /> Eficaz
                        </Boton>
                        <Boton
                          tamano="pequeno"
                          variante="contorno"
                          onClick={() => definirEvaluando({ accion, eficaz: false })}
                        >
                          <XCircle /> No eficaz
                        </Boton>
                      </>
                    ) : null}

                    <Boton
                      tamano="pequeno"
                      variante="fantasma"
                      onClick={() =>
                        definirSubiendoEn(subiendoEn === accion.id ? null : accion.id)
                      }
                    >
                      <Upload /> Evidencia
                    </Boton>
                  </div>
                ) : null}

                {subiendoEn === accion.id ? (
                  <form
                    onSubmit={(evento) => subir(evento, accion.id)}
                    className="mt-2 space-y-2 rounded-md border border-dashed border-borde p-2.5"
                  >
                    <input
                      type="file"
                      name="evidencia"
                      multiple
                      required
                      accept={ACEPTA_EVIDENCIA}
                      className="block w-full text-[11px] file:mr-2 file:rounded file:border file:border-borde file:bg-acento file:px-2 file:py-1 file:text-[11px]"
                    />
                    <Entrada
                      name="descripcion"
                      placeholder="Qué es el archivo (opcional)"
                      className="text-[11px]"
                    />
                    {/* El tope es por acción y cuenta lo que ya está
                        cargado. El control que vale es el del servidor;
                        esto es para no hacer elegir diez archivos y
                        después rechazarlos. */}
                    <p className="text-[10px] text-atenuado-contraste">
                      Hasta {MAXIMO_EVIDENCIAS_ACCION} archivos por acción.
                      {accion.adjuntos.length > 0
                        ? ` Van ${accion.adjuntos.length}.`
                        : ""}
                    </p>
                    <div className="flex justify-end gap-1.5">
                      <Boton
                        type="button"
                        tamano="pequeno"
                        variante="fantasma"
                        onClick={() => definirSubiendoEn(null)}
                      >
                        Cancelar
                      </Boton>
                      <Boton type="submit" tamano="pequeno" cargando={procesando}>
                        Subir
                      </Boton>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {puedeEditar ? (
        <div className="flex justify-end">
          <Boton tamano="pequeno" variante="contorno" onClick={() => definirFormulario("nueva")}>
            <Plus /> Agregar acción
          </Boton>
        </div>
      ) : null}

      <FormularioDeAccion
        abierto={formulario !== null}
        accion={formulario === "nueva" ? null : formulario}
        personas={personas}
        tratamientoDelRiesgo={tratamientoDelRiesgo}
        procesando={procesando}
        onCerrar={() => definirFormulario(null)}
        onGuardar={guardar}
      />

      {/* Ejecucion: el comentario de cierre va antes de guardar, igual que
          en las tareas de una accion correctiva. */}
      <Dialogo
        open={ejecutando !== null}
        onOpenChange={(abierto) => !abierto && definirEjecutando(null)}
      >
        <DialogoContenido>
          <form onSubmit={ejecutar}>
            <DialogoCabecera>
              <DialogoTitulo>Registrar la ejecución</DialogoTitulo>
            </DialogoCabecera>
            <div className="mt-4 space-y-3">
              <p className="text-xs leading-relaxed text-atenuado-contraste">
                {ejecutando?.plazo_permanente
                  ? "La acción es permanente: no tiene vencimiento contra el que compararla."
                  : ejecutando?.fecha_limite && ejecutando.fecha_limite < hoy
                    ? `El plazo venció el ${formatearFecha(ejecutando.fecha_limite)}: queda registrada como ejecutada fuera de plazo.`
                    : "Queda registrada como ejecutada en plazo."}
              </p>
              <GrupoCampo etiqueta="Comentario de cierre" htmlFor="comentario-ejecucion">
                <AreaTexto
                  id="comentario-ejecucion"
                  name="comentario"
                  rows={3}
                  placeholder="Qué se hizo y con qué resultado."
                />
              </GrupoCampo>
            </div>
            <DialogoPie className="mt-5">
              <DialogoCierre asChild>
                <Boton type="button" variante="contorno">
                  Cancelar
                </Boton>
              </DialogoCierre>
              <Boton type="submit" cargando={procesando}>
                Guardar
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>

      {/* Eficacia. */}
      <Dialogo
        open={evaluando !== null}
        onOpenChange={(abierto) => !abierto && definirEvaluando(null)}
      >
        <DialogoContenido>
          <form onSubmit={evaluar}>
            <DialogoCabecera>
              <DialogoTitulo>
                {evaluando?.eficaz ? "La acción fue eficaz" : "La acción no fue eficaz"}
              </DialogoTitulo>
            </DialogoCabecera>
            <div className="mt-4 space-y-3">
              <p className="text-xs leading-relaxed text-atenuado-contraste">
                {evaluando?.eficaz
                  ? "La acción se ejecutó y el riesgo bajó como se esperaba."
                  : "La acción se ejecutó pero el riesgo no bajó. Conviene cargar otra acción, o reevaluar el riesgo."}
              </p>
              <GrupoCampo etiqueta="Fundamento" htmlFor="comentario-eficacia">
                <AreaTexto
                  id="comentario-eficacia"
                  name="comentario"
                  rows={3}
                  placeholder="Con qué se verificó."
                />
              </GrupoCampo>
            </div>
            <DialogoPie className="mt-5">
              <DialogoCierre asChild>
                <Boton type="button" variante="contorno">
                  Cancelar
                </Boton>
              </DialogoCierre>
              <Boton type="submit" cargando={procesando}>
                Guardar
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </div>
  );
}

/** El alta y la correccion de una accion, con los mismos campos. */
function FormularioDeAccion({
  abierto,
  accion,
  personas,
  tratamientoDelRiesgo,
  procesando,
  onCerrar,
  onGuardar,
}: {
  abierto: boolean;
  accion: AccionTratamiento | null;
  personas: { id: string; nombre_completo: string }[];
  tratamientoDelRiesgo: TratamientoRiesgo | null;
  procesando: boolean;
  onCerrar: () => void;
  onGuardar: (evento: React.FormEvent<HTMLFormElement>) => void;
}) {
  const hoy = hoyEnAsuncion();
  const [permanente, definirPermanente] = React.useState(false);

  // El formulario se reinicia cada vez que se abre: si no, al editar una
  // accion permanente y despues abrir el alta, la casilla queda marcada.
  React.useEffect(() => {
    if (abierto) definirPermanente(accion?.plazo_permanente ?? false);
  }, [abierto, accion]);

  return (
    <Dialogo open={abierto} onOpenChange={(valor) => !valor && onCerrar()}>
      <DialogoContenido>
        <form onSubmit={onGuardar}>
          <DialogoCabecera>
            <DialogoTitulo>
              {accion ? "Editar la acción" : "Nueva acción de tratamiento"}
            </DialogoTitulo>
          </DialogoCabecera>

          <div className="mt-4 space-y-3">
            <GrupoCampo etiqueta="Acción planificada" htmlFor="descripcion" requerido>
              <AreaTexto
                id="descripcion"
                name="descripcion"
                rows={3}
                required
                minLength={10}
                defaultValue={accion?.descripcion ?? ""}
              />
            </GrupoCampo>

            <GrupoCampo etiqueta="Opción de tratamiento" htmlFor="tratamiento" requerido>
              <Seleccion
                id="tratamiento"
                name="tratamiento"
                required
                defaultValue={
                  accion?.tratamiento ?? tratamientoDelRiesgo ?? "cambiar_probabilidad"
                }
              >
                {TRATAMIENTOS_VIGENTES.map((valor) => (
                  <option key={valor} value={valor}>
                    {ETIQUETAS_TRATAMIENTO_RIESGO[valor]}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>

            <GrupoCampo etiqueta="Responsable" htmlFor="responsable_id" requerido>
              <Seleccion
                id="responsable_id"
                name="responsable_id"
                required
                defaultValue={accion?.responsable_id ?? ""}
                key={accion?.id ?? "nueva"}
              >
                <option value="" disabled>
                  Elija el responsable
                </option>
                {personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.nombre_completo}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>

            {/* LOS DOS PLAZOS SE ESCRIBEN. Venían con hoy y hoy más
                treinta días puestos: una fecha ya cargada se acepta sin
                mirarla, y el plazo de una acción de tratamiento es
                justamente lo que hay que decidir. Lo único que se
                calcula solo en este formulario es el nivel del riesgo,
                que sale de la probabilidad y la severidad. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <GrupoCampo etiqueta="Plazo desde" htmlFor="fecha_inicio" requerido>
                <Entrada
                  id="fecha_inicio"
                  name="fecha_inicio"
                  type="date"
                  required
                  defaultValue={accion?.fecha_inicio ?? ""}
                />
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Plazo hasta"
                htmlFor="fecha_limite"
                requerido={!permanente}
                ayuda={permanente ? "La acción no vence." : undefined}
              >
                <Entrada
                  id="fecha_limite"
                  name="fecha_limite"
                  type="date"
                  required={!permanente}
                  disabled={permanente}
                  defaultValue={accion?.fecha_limite ?? ""}
                />
              </GrupoCampo>
            </div>

            {/* «Permanente» es la palabra que usa la matriz de Calidad
                para los controles que no terminan: el arqueo diario, la
                verificacion del permiso antes de cada despacho. */}
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                name="plazo_permanente"
                value="si"
                checked={permanente}
                onChange={(evento) => definirPermanente(evento.target.checked)}
                className="mt-0.5 size-3.5 accent-[#E01E37]"
              />
              <span className="leading-relaxed">
                Acción permanente: es un control que no termina y no tiene fecha de cierre.
              </span>
            </label>

            <GrupoCampo
              etiqueta="Evidencia"
              htmlFor="evidencia-nueva"
              ayuda={`Opcional. Hasta ${MAXIMO_EVIDENCIAS_ACCION} archivos por acción. Se puede agregar después, en cada acción.`}
            >
              <input
                id="evidencia-nueva"
                type="file"
                name="evidencia"
                multiple
                accept={ACEPTA_EVIDENCIA}
                className="block w-full text-xs file:mr-2 file:rounded file:border file:border-borde file:bg-acento file:px-2 file:py-1 file:text-xs"
              />
            </GrupoCampo>
          </div>

          <DialogoPie className="mt-5">
            <DialogoCierre asChild>
              <Boton type="button" variante="contorno">
                Cancelar
              </Boton>
            </DialogoCierre>
            <Boton type="submit" cargando={procesando}>
              {accion ? "Guardar cambios" : "Agregar acción"}
            </Boton>
          </DialogoPie>
        </form>
      </DialogoContenido>
    </Dialogo>
  );
}
