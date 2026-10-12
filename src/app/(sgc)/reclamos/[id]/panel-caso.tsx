"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Paperclip, PlayCircle, Plus, Trash2, X } from "lucide-react";

import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  adjuntarEvidenciaDeAccion,
  cambiarEstadoReclamo,
  cerrarCaso,
  eliminarEvidenciaDeAccion,
  guardarAccionesDelPlan,
  guardarEjecucionDeAcciones,
  reanudarPlazoSuspendido,
  registrarVerificacion,
} from "@/app/(sgc)/reclamos/acciones";
import {
  accionesPendientes,
  casoCerrado,
  DIAS_VERIFICACION_PLAN_C,
  estadoDePlazoDeAccion,
  ETIQUETAS_ESTADO_PLAZO,
  exigeNoConformidad,
  type EstadoReclamo,
  type GravedadReclamo,
  type PlanReclamo,
} from "@/lib/reclamos";
import { MAXIMO_EVIDENCIAS_ACCION } from "@/lib/constantes";
import { formatearFecha, hoyEnAsuncion } from "@/lib/formato";

interface Persona {
  id: string;
  nombre_completo: string;
}

export interface AccionDelPlan {
  id: string;
  descripcion: string;
  responsable_id: string | null;
  fecha_limite: string | null;
  ejecutada_en: string | null;
}

/** Un archivo de evidencia, como lo devuelve la consulta de la ficha. */
export interface ArchivoDeEvidencia {
  id: string;
  nombre: string;
  entidad_id: string;
}

/**
 * El caso, en bloques encadenados.
 *
 * EL CIRCUITO ES UNA SOLA LINEA y cada bloque habilita el siguiente, con
 * las palabras de Calidad del 12 de octubre:
 *
 *   1. Se carga el reclamo.
 *   2. Se declara la fecha de contacto con el cliente.
 *   3. Recién ahí se planifican las acciones —qué, quién, para cuándo— y
 *      se guardan. Guardar el plan ES definir el plan.
 *   4. Las acciones guardadas quedan de solo lectura y aparece el bloque
 *      de ejecución: la fecha real de cada una, con el «en plazo / fuera
 *      de plazo» que sale solo, y su evidencia.
 *   5. Con todas ejecutadas se habilita el cierre: resuelto o no
 *      resuelto, con su comentario, y la compensación solo si se
 *      resolvió.
 *
 * NO HAY «SIGUIENTE PASO». Era una tarjeta de botones que repetía lo que
 * la persona acababa de hacer: se cargaban las acciones y después había
 * que apretar «Definir el plan de acción» para decir que se habían
 * cargado. El estado ahora sigue a la acción, que es como se comporta el
 * resto del sistema.
 *
 * SE PLANIFICA UNA VEZ Y DESPUES SE MIDE. Son dos formularios y dos
 * acciones de servidor distintas a propósito: si fueran el mismo, al
 * cargar la fecha real se podría estar corrigiendo el plazo que se había
 * prometido, y el «en plazo» dejaría de significar algo.
 */
export function PanelCaso({
  reclamoId,
  estado,
  plan,
  personas,
  acciones,
  evidenciaPorAccion,
  suspendido,
  fechaVerificacion,
}: {
  reclamoId: string;
  estado: EstadoReclamo;
  plan: PlanReclamo;
  gravedad: GravedadReclamo;
  personas: Persona[];
  acciones: AccionDelPlan[];
  /** La evidencia ya cargada, agrupada por acción. */
  evidenciaPorAccion: Record<string, ArchivoDeEvidencia[]>;
  /** Si hay un trámite ante la DIGEMABEL con el plazo detenido. */
  suspendido: boolean;
  fechaVerificacion: string | null;
}) {
  const cerrado = casoCerrado(estado);
  const planGuardado = acciones.length > 0;
  const sinEjecutar = accionesPendientes(acciones);

  return (
    <div className="space-y-4">
      {/* EL CONTACTO ES EL PRIMER PASO Y EL UNICO QUE QUEDA COMO PASO:
          es una fecha y nada más. */}
      {estado === "registrado" ? <RegistrarContacto reclamoId={reclamoId} /> : null}

      {estado === "registrado" ? (
        <Tarjeta className="p-4">
          <p className="text-xs font-semibold text-atenuado-contraste">Acciones del plan</p>
          <p className="mt-1 text-[11px] leading-relaxed text-atenuado-contraste">
            Se habilitan al registrar el contacto con el cliente: de esa conversación salen las
            acciones, y el plazo de resolución se cuenta desde ahí.
          </p>
        </Tarjeta>
      ) : (
        <PlanificacionDeAcciones
          reclamoId={reclamoId}
          personas={personas}
          iniciales={acciones}
          cerrado={cerrado}
        />
      )}

      {planGuardado && !cerrado ? (
        <EjecucionDeAcciones
          reclamoId={reclamoId}
          acciones={acciones}
          personas={personas}
          evidenciaPorAccion={evidenciaPorAccion}
        />
      ) : null}

      {planGuardado && !cerrado ? (
        <CierreDelCaso reclamoId={reclamoId} sinEjecutar={sinEjecutar} />
      ) : null}

      {suspendido ? <BotonReanudar reclamoId={reclamoId} /> : null}

      {exigeNoConformidad(plan) && cerrado ? (
        <Verificacion reclamoId={reclamoId} fechaVerificacion={fechaVerificacion} />
      ) : null}
    </div>
  );
}

/**
 * El contacto con el cliente: una fecha y confirmar.
 *
 * Desde acá se cuenta el plazo de resolución, no desde la detección, así
 * que es lo primero que se registra y lo que habilita todo lo demás.
 */
function RegistrarContacto({ reclamoId }: { reclamoId: string }) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);

  async function confirmar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const respuesta = await cambiarEstadoReclamo(
      reclamoId,
      "contactado",
      new FormData(evento.currentTarget),
    );
    definirEnviando(false);

    if (!respuesta.exito) {
      definirError(respuesta.error);
      return;
    }

    toast.success(respuesta.mensaje ?? "Contacto registrado.");
    router.refresh();
  }

  return (
    <Tarjeta className="p-4">
      <p className="text-xs font-semibold">Registrar el contacto con el cliente</p>

      <form onSubmit={confirmar} className="mt-3">
        <GrupoCampo
          etiqueta="Fecha del contacto"
          htmlFor="fecha_contacto"
          ayuda="Desde acá se cuenta el plazo de resolución, no desde la detección."
        >
          <Entrada
            id="fecha_contacto"
            name="fecha_contacto"
            type="date"
            defaultValue={hoyEnAsuncion()}
          />
        </GrupoCampo>

        {error ? <p className="mt-3 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-4 flex justify-end">
          <Boton type="submit" tamano="pequeno" cargando={enviando}>
            Confirmar
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

/**
 * Planificar: qué se hace, quién lo hace y para cuándo.
 *
 * LO GUARDADO QUEDA DE SOLO LECTURA. Lo que se promete tiene que quedar
 * escrito: si el plazo se pudiera corregir después, el «en plazo / fuera
 * de plazo» del bloque siguiente mediría contra un plazo movido a
 * conveniencia, y dejaría de medir nada.
 *
 * Se pueden AGREGAR acciones más adelante —un plan puede quedar corto— y
 * eso no toca las que ya están.
 */
function PlanificacionDeAcciones({
  reclamoId,
  personas,
  iniciales,
  cerrado,
}: {
  reclamoId: string;
  personas: Persona[];
  iniciales: AccionDelPlan[];
  cerrado: boolean;
}) {
  const router = useRouter();
  const [guardando, definirGuardando] = React.useState(false);
  const [nuevas, definirNuevas] = React.useState<{ clave: number }[]>(
    iniciales.length === 0 ? [{ clave: 0 }] : [],
  );
  const siguiente = React.useRef(1);

  const nombrePorId = React.useMemo(
    () => new Map(personas.map((persona) => [persona.id, persona.nombre_completo])),
    [personas],
  );

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirGuardando(true);

    // Las ya guardadas viajan igual, sin cambios: la acción de servidor
    // borra lo que no venga en el formulario, así que omitirlas las
    // eliminaría.
    const datos = new FormData(evento.currentTarget);
    const respuesta = await guardarAccionesDelPlan(reclamoId, datos);
    definirGuardando(false);

    if (!respuesta.exito) {
      toast.error(respuesta.error);
      return;
    }

    toast.success(respuesta.mensaje ?? "Guardado.");
    definirNuevas([]);
    router.refresh();
  }

  return (
    <Tarjeta className="p-4">
      <p className="text-xs font-semibold">Acciones del plan</p>
      <p className="mb-3 mt-0.5 text-[11px] leading-relaxed text-atenuado-contraste">
        Qué se hace, quién lo hace y para cuándo. Una vez guardada, la acción no se edita: su
        plazo es contra lo que después se mide si se cumplió.
      </p>

      <form onSubmit={guardar} className="space-y-3">
        {/* LAS YA GUARDADAS, DE SOLO LECTURA. Viajan en campos ocultos
            para que el servidor no las borre al recibir el formulario. */}
        {iniciales.map((accion, indice) => (
          <div key={accion.id} className="rounded-md border border-borde bg-acento/30 p-2.5">
            <input type="hidden" name="accion_id" value={accion.id} />
            <input type="hidden" name="accion_descripcion" value={accion.descripcion} />
            <input type="hidden" name="accion_responsable" value={accion.responsable_id ?? ""} />
            <input type="hidden" name="accion_fecha_limite" value={accion.fecha_limite ?? ""} />
            <input type="hidden" name="accion_ejecutada_en" value={accion.ejecutada_en ?? ""} />

            <p className="text-xs leading-snug">
              <span className="mr-1.5 text-atenuado-contraste">{indice + 1}.</span>
              {accion.descripcion}
            </p>
            <p className="mt-1 text-[11px] text-atenuado-contraste">
              {accion.responsable_id
                ? (nombrePorId.get(accion.responsable_id) ?? "Responsable sin asignar")
                : "Responsable sin asignar"}
              {accion.fecha_limite ? ` · para el ${formatearFecha(accion.fecha_limite)}` : null}
            </p>
          </div>
        ))}

        {nuevas.map((fila, indice) => (
          <div key={fila.clave} className="rounded-md border border-borde p-2.5">
            <input type="hidden" name="accion_id" value="" />
            <input type="hidden" name="accion_ejecutada_en" value="" />

            <div className="flex items-start gap-2">
              <AreaTexto
                name="accion_descripcion"
                rows={2}
                required
                minLength={10}
                placeholder="Retirar el artículo equivocado y entregar el correcto"
                className="text-xs"
                aria-label={`Qué se hace, acción ${iniciales.length + indice + 1}`}
              />
              <Boton
                type="button"
                tamano="iconoPequeno"
                variante="fantasma"
                aria-label="Quitar acción"
                onClick={() =>
                  definirNuevas((actuales) => actuales.filter((o) => o.clave !== fila.clave))
                }
              >
                <X />
              </Boton>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Seleccion
                name="accion_responsable"
                defaultValue=""
                required
                className="text-xs"
                aria-label="Responsable de la acción"
              >
                <option value="">Responsable…</option>
                {personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.nombre_completo}
                  </option>
                ))}
              </Seleccion>

              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-atenuado-contraste">
                  Límite para ejecutar la acción
                </span>
                <Entrada name="accion_fecha_limite" type="date" required className="text-xs" />
              </label>
            </div>
          </div>
        ))}

        {cerrado ? null : (
          <div className="flex items-center justify-between gap-2">
            <Boton
              type="button"
              tamano="pequeno"
              variante="contorno"
              onClick={() =>
                definirNuevas((actuales) => [...actuales, { clave: siguiente.current++ }])
              }
            >
              <Plus /> {iniciales.length === 0 ? "Otra acción" : "Agregar acción"}
            </Boton>

            {nuevas.length > 0 ? (
              <Boton type="submit" tamano="pequeno" cargando={guardando}>
                Guardar acciones
              </Boton>
            ) : null}
          </div>
        )}
      </form>
    </Tarjeta>
  );
}

/**
 * Medir: cuándo se ejecutó cada acción.
 *
 * LA FECHA DECIDE SOLA SI FUE EN PLAZO. No hay nada que elegir: se carga
 * la fecha real y el sistema la compara contra el plazo que se había
 * prometido. Dejar que la persona declarara «en plazo» a mano sería
 * pedirle que se califique a sí misma.
 */
function EjecucionDeAcciones({
  reclamoId,
  acciones,
  personas,
  evidenciaPorAccion,
}: {
  reclamoId: string;
  acciones: AccionDelPlan[];
  personas: Persona[];
  evidenciaPorAccion: Record<string, ArchivoDeEvidencia[]>;
}) {
  const router = useRouter();
  const hoy = hoyEnAsuncion();
  const [guardando, definirGuardando] = React.useState(false);
  const [fechas, definirFechas] = React.useState<Record<string, string>>(() =>
    Object.fromEntries(acciones.map((accion) => [accion.id, accion.ejecutada_en ?? ""])),
  );

  const nombrePorId = React.useMemo(
    () => new Map(personas.map((persona) => [persona.id, persona.nombre_completo])),
    [personas],
  );

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirGuardando(true);
    const respuesta = await guardarEjecucionDeAcciones(reclamoId, new FormData(evento.currentTarget));
    definirGuardando(false);

    if (respuesta.exito) {
      toast.success(respuesta.mensaje ?? "Guardado.");
      router.refresh();
    } else {
      toast.error(respuesta.error);
    }
  }

  return (
    <Tarjeta className="p-4">
      <p className="text-xs font-semibold">Ejecución de las acciones</p>
      <p className="mb-3 mt-0.5 text-[11px] leading-relaxed text-atenuado-contraste">
        Cargue la fecha en que se ejecutó cada una. El sistema dice solo si fue en plazo o fuera
        de plazo, comparando contra el límite que se había fijado.
      </p>

      <form onSubmit={guardar} className="space-y-3">
        {acciones.map((accion, indice) => {
          const fecha = fechas[accion.id] ?? "";
          const plazo = estadoDePlazoDeAccion(accion.fecha_limite, fecha || null, hoy);

          return (
            <div key={accion.id} className="rounded-md border border-borde p-2.5">
              <input type="hidden" name="accion_id" value={accion.id} />

              <p className="text-xs leading-snug">
                <span className="mr-1.5 text-atenuado-contraste">{indice + 1}.</span>
                {accion.descripcion}
              </p>
              <p className="mt-1 text-[11px] text-atenuado-contraste">
                {accion.responsable_id
                  ? (nombrePorId.get(accion.responsable_id) ?? "Sin responsable")
                  : "Sin responsable"}
                {accion.fecha_limite ? ` · límite ${formatearFecha(accion.fecha_limite)}` : null}
              </p>

              <div className="mt-2 grid items-end gap-2 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-[11px] text-atenuado-contraste">Ejecutada el</span>
                  <Entrada
                    name="accion_ejecutada_en"
                    type="date"
                    value={fecha}
                    onChange={(evento) =>
                      definirFechas((actuales) => ({
                        ...actuales,
                        [accion.id]: evento.target.value,
                      }))
                    }
                    className="text-xs"
                  />
                </label>

                <p className="text-[11px]">
                  {!fecha ? (
                    <span className="text-atenuado-contraste">Sin ejecutar</span>
                  ) : plazo === "en_plazo" ? (
                    <span className="font-medium text-semaforo-bajo">
                      {ETIQUETAS_ESTADO_PLAZO.en_plazo}
                    </span>
                  ) : plazo === "fuera_de_plazo" ? (
                    <span className="font-medium text-semaforo-critico">
                      {ETIQUETAS_ESTADO_PLAZO.fuera_de_plazo}
                    </span>
                  ) : (
                    <span className="text-atenuado-contraste">
                      Sin límite declarado: no hay contra qué compararla
                    </span>
                  )}
                </p>
              </div>

              <EvidenciaDeAccion
                accionId={accion.id}
                reclamoId={reclamoId}
                archivos={evidenciaPorAccion[accion.id] ?? []}
              />
            </div>
          );
        })}

        <div className="flex justify-end">
          <Boton type="submit" tamano="pequeno" cargando={guardando}>
            Guardar ejecución
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

/**
 * El cierre: resuelto o no resuelto.
 *
 * SE HABILITA RECIEN CON TODAS LAS ACCIONES EJECUTADAS, sin importar si
 * fueron en plazo o fuera: lo que decide que el caso se puede cerrar es
 * que el plan esté hecho, no que haya salido bien.
 *
 * LA COMPENSACION SOLO APARECE EN «RESUELTO». Un caso que no se resolvió
 * no compensó nada, y dejar el campo visible invitaría a escribir algo
 * ahí que después nadie sabría cómo leer.
 */
function CierreDelCaso({
  reclamoId,
  sinEjecutar,
}: {
  reclamoId: string;
  sinEjecutar: number;
}) {
  const router = useRouter();
  const [resultado, definirResultado] = React.useState("");
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);

  if (sinEjecutar > 0) {
    return (
      <Tarjeta className="p-4">
        <p className="text-xs font-semibold text-atenuado-contraste">Cierre del caso</p>
        <p className="mt-1 text-[11px] leading-relaxed text-atenuado-contraste">
          Se habilita cuando las {sinEjecutar} acci{sinEjecutar === 1 ? "ón" : "ones"} que quedan
          tengan su fecha de ejecución. Hasta entonces el plan no está hecho, por más que el
          cliente ya esté conforme.
        </p>
      </Tarjeta>
    );
  }

  async function cerrar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const respuesta = await cerrarCaso(reclamoId, new FormData(evento.currentTarget));
    definirEnviando(false);

    if (!respuesta.exito) {
      definirError(respuesta.error);
      return;
    }

    toast.success(respuesta.mensaje ?? "Caso cerrado.");
    router.refresh();
  }

  return (
    <Tarjeta className="p-4">
      <p className="text-xs font-semibold">Cierre del caso</p>
      <p className="mb-3 mt-0.5 text-[11px] leading-relaxed text-atenuado-contraste">
        Todas las acciones están ejecutadas. Declare con qué resultado cierra el caso.
      </p>

      <form onSubmit={cerrar} className="space-y-3">
        <GrupoCampo etiqueta="Resultado" htmlFor="resultado" requerido>
          <Seleccion
            id="resultado"
            name="resultado"
            value={resultado}
            onChange={(evento) => definirResultado(evento.target.value)}
            required
          >
            <option value="">Elija el resultado…</option>
            <option value="resuelto">Resuelto</option>
            <option value="no_resuelto">No resuelto</option>
          </Seleccion>
        </GrupoCampo>

        <GrupoCampo
          etiqueta="Comentarios"
          htmlFor="comentario"
          requerido
          ayuda="Qué pasó con el caso. Es lo que queda como registro de la gestión."
        >
          <AreaTexto id="comentario" name="comentario" rows={3} required minLength={10} />
        </GrupoCampo>

        {/* UN CAMPO QUE NO CORRESPONDE SE DESMONTA, no se esconde con
            CSS: el navegador se niega a enviar un formulario por un
            campo `required` que no se ve, y el botón queda muerto sin
            decir por qué. Pasó el 9 de octubre con el riesgo. */}
        {resultado === "resuelto" ? (
          <GrupoCampo
            etiqueta="Compensación otorgada"
            htmlFor="compensacion"
            ayuda="Qué se le dio al cliente. Vacío si no hubo compensación."
          >
            <AreaTexto
              id="compensacion"
              name="compensacion"
              rows={2}
              placeholder="Cambio del artículo sin costo y envío a domicilio."
            />
          </GrupoCampo>
        ) : null}

        {error ? <p className="text-xs text-semaforo-critico">{error}</p> : null}

        <div className="flex justify-end">
          <Boton type="submit" tamano="pequeno" cargando={enviando}>
            Cerrar el caso
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

/**
 * La evidencia de una acción del plan.
 *
 * HASTA CINCO ARCHIVOS POR ACCION, contando los que ya tiene: es un tope
 * por acción y no por subida. Alcanza para el acta, la foto, el correo y
 * el comprobante; más que eso deja de ser evidencia de una acción y pasa
 * a ser un archivo. Es el mismo tope que en las acciones de tratamiento
 * del riesgo, porque es la misma pregunta.
 *
 * El tope lo hace cumplir el servidor; acá se dice cuántos quedan para
 * que la persona no elija siete archivos y se entere después.
 */
function EvidenciaDeAccion({
  accionId,
  reclamoId,
  archivos,
}: {
  accionId: string;
  reclamoId: string;
  archivos: ArchivoDeEvidencia[];
}) {
  const router = useRouter();
  const [subiendo, definirSubiendo] = React.useState(false);
  const entrada = React.useRef<HTMLInputElement>(null);

  const libres = MAXIMO_EVIDENCIAS_ACCION - archivos.length;

  async function subir(lista: FileList | null) {
    if (!lista || lista.length === 0) return;

    const datos = new FormData();
    for (const archivo of Array.from(lista)) datos.append("evidencia", archivo);

    definirSubiendo(true);
    const respuesta = await adjuntarEvidenciaDeAccion(accionId, reclamoId, datos);
    definirSubiendo(false);
    if (entrada.current) entrada.current.value = "";

    if (respuesta.exito) {
      toast.success(respuesta.mensaje ?? "Evidencia cargada.");
      router.refresh();
    } else {
      toast.error(respuesta.error);
    }
  }

  async function quitar(adjuntoId: string) {
    const respuesta = await eliminarEvidenciaDeAccion(adjuntoId, accionId, reclamoId);
    if (respuesta.exito) {
      toast.success(respuesta.mensaje ?? "Eliminado.");
      router.refresh();
    } else {
      toast.error(respuesta.error);
    }
  }

  return (
    <div className="mt-2 border-t border-borde pt-2">
      <p className="text-[11px] font-medium">
        Evidencia
        <span className="ml-1 font-normal text-atenuado-contraste">
          {archivos.length} de {MAXIMO_EVIDENCIAS_ACCION}
        </span>
      </p>

      {archivos.length > 0 ? (
        <ul className="mt-1 space-y-0.5">
          {archivos.map((archivo) => (
            <li key={archivo.id} className="flex items-center gap-1.5 text-[11px]">
              <Paperclip className="size-3 shrink-0 text-atenuado-contraste" aria-hidden="true" />
              <span className="min-w-0 flex-1 truncate">{archivo.nombre}</span>
              <button
                type="button"
                onClick={() => quitar(archivo.id)}
                className="shrink-0 text-atenuado-contraste hover:text-semaforo-critico"
                aria-label={`Quitar ${archivo.nombre}`}
              >
                <Trash2 className="size-3" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      {/* La subida va por fuera del formulario de la ejecución: es una
          acción de servidor distinta y no tiene que arrastrar consigo el
          guardado de las fechas. */}
      {libres > 0 ? (
        <>
          <input
            ref={entrada}
            type="file"
            multiple
            className="hidden"
            onChange={(evento) => subir(evento.target.files)}
          />
          <Boton
            type="button"
            tamano="pequeno"
            variante="fantasma"
            cargando={subiendo}
            className="mt-1 h-7 px-2 text-[11px]"
            onClick={() => entrada.current?.click()}
          >
            {subiendo ? null : <Paperclip className="size-3" />}
            Adjuntar evidencia
            <span className="font-normal text-atenuado-contraste">
              (entra{libres === 1 ? "" : "n"} {libres})
            </span>
          </Boton>
        </>
      ) : (
        <p className="mt-1 text-[11px] text-atenuado-contraste">
          Llegó al máximo de {MAXIMO_EVIDENCIAS_ACCION}. Quite alguno para subir otro.
        </p>
      )}
    </div>
  );
}

/**
 * Reanudar el plazo cuando el trámite ante la DIGEMABEL terminó.
 *
 * El trámite detiene el reloj: el caso no puede correr contra un plazo
 * que depende de un tercero. Al volver, el plazo se recalcula desde hoy.
 */
function BotonReanudar({ reclamoId }: { reclamoId: string }) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);

  async function reanudar() {
    definirEnviando(true);
    const respuesta = await reanudarPlazoSuspendido(reclamoId);
    definirEnviando(false);

    if (respuesta.exito) {
      toast.success(respuesta.mensaje ?? "Plazo reanudado.");
      router.refresh();
    } else {
      toast.error(respuesta.error);
    }
  }

  return (
    <Tarjeta className="p-4">
      <p className="text-xs font-semibold">Trámite ante la DIGEMABEL</p>
      <p className="mb-3 mt-0.5 text-[11px] leading-relaxed text-atenuado-contraste">
        El plazo del caso está detenido mientras dure el trámite. Al reanudarlo, se recalcula
        desde hoy.
      </p>
      <Boton tamano="pequeno" variante="contorno" cargando={enviando} onClick={reanudar}>
        <PlayCircle /> El trámite terminó, reanudar el plazo
      </Boton>
    </Tarjeta>
  );
}

/**
 * La verificación con el cliente a los 30 días del cierre, que el plan C
 * exige. Antes de esa fecha no hay nada que verificar.
 */
function Verificacion({
  reclamoId,
  fechaVerificacion,
}: {
  reclamoId: string;
  fechaVerificacion: string | null;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);

  async function registrar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    const respuesta = await registrarVerificacion(reclamoId, new FormData(evento.currentTarget));
    definirEnviando(false);

    if (respuesta.exito) {
      toast.success(respuesta.mensaje ?? "Verificación registrada.");
      router.refresh();
    } else {
      toast.error(respuesta.error);
    }
  }

  if (fechaVerificacion) {
    return (
      <Tarjeta className="p-4">
        <p className="text-xs font-semibold">Verificación con el cliente</p>
        <p className="mt-1 text-[11px] text-atenuado-contraste">
          Registrada el {formatearFecha(fechaVerificacion)}.
        </p>
      </Tarjeta>
    );
  }

  return (
    <Tarjeta className="p-4">
      <p className="text-xs font-semibold">Verificación con el cliente</p>
      <p className="mb-3 mt-0.5 text-[11px] leading-relaxed text-atenuado-contraste">
        El Plan C pide volver a hablar con el cliente a los {DIAS_VERIFICACION_PLAN_C} días del
        cierre, para confirmar que la solución se sostuvo.
      </p>

      <form onSubmit={registrar} className="space-y-3">
        <GrupoCampo etiqueta="Qué dijo el cliente" htmlFor="verificacion_observacion" requerido>
          <AreaTexto
            id="verificacion_observacion"
            name="verificacion_observacion"
            rows={3}
            required
            minLength={10}
          />
        </GrupoCampo>

        <div className="flex justify-end">
          <Boton type="submit" tamano="pequeno" cargando={enviando}>
            Registrar la verificación
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}
