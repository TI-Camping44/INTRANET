"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Paperclip, PlayCircle, Plus, ThumbsDown, Trash2, X } from "lucide-react";

import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  adjuntarEvidenciaDeAccion,
  cambiarEstadoReclamo,
  eliminarEvidenciaDeAccion,
  guardarAccionesDelPlan,
  reanudarPlazoSuspendido,
  registrarRechazo,
  registrarVerificacion,
} from "@/app/(sgc)/reclamos/acciones";
import {
  accionesPendientes,
  admiteRechazo,
  casoCerrado,
  COMPENSACIONES_SUGERIDAS,
  DIAS_VERIFICACION_PLAN_C,
  ESTADOS_CLIENTE_FINAL,
  ETIQUETAS_ESTADO_CLIENTE_RECLAMO,
  exigeAccionCorrectiva,
  exigeNoConformidad,
  estadoDePlazoDeAccion,
  ETIQUETAS_ESTADO_PLAZO,
  excedeTopePorcentual,
  tramoDeAutorizacion,
  TRANSICIONES_RECLAMO,
  type EstadoReclamo,
  type GravedadReclamo,
  type PlanReclamo,
} from "@/lib/reclamos";
import { formatearFecha, formatearGuaranies, hoyEnAsuncion } from "@/lib/formato";
import { MAXIMO_EVIDENCIAS_ACCION } from "@/lib/constantes";

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
 * El caso, en un panel.
 *
 * DOS COSAS DISTINTAS que conviven: las acciones del plan —qué se hace,
 * quién y cuándo, que el procedimiento exige registrar— y el paso
 * siguiente del ciclo.
 *
 * Los botones salen de `TRANSICIONES_RECLAMO`, la misma tabla que usa la
 * acción de servidor para aceptar o rechazar. Así la pantalla no puede
 * ofrecer algo que el servidor va a negar.
 */
export function PanelCaso({
  reclamoId,
  estado,
  plan,
  gravedad,
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
  const router = useRouter();
  /**
   * EL PASO VIENE ABIERTO CUANDO HAY UNO SOLO.
   *
   * Antes había que tocar el botón para que apareciera el campo. Con un
   * único paso posible, ese botón no es una elección: es un clic de más
   * entre la persona y lo único que puede hacer. Registrar el contacto
   * con el cliente, que es el caso de todo reclamo recién cargado, pasa
   * a mostrar la fecha directamente.
   *
   * Con más de un paso sigue habiendo que elegir, que ahí sí es una
   * decisión.
   */
  const pasosDelEstado = TRANSICIONES_RECLAMO[estado].filter(
    (posible) => !(posible === "resuelto" && accionesPendientes(acciones) > 0),
  );
  const unicoPaso = pasosDelEstado.length === 1 ? pasosDelEstado[0] : null;
  const [destino, definirDestino] = React.useState<EstadoReclamo | null>(unicoPaso);
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [monto, definirMonto] = React.useState("");
  const [factura, definirFactura] = React.useState("");

  // EL CASO NO SE RESUELVE CON ACCIONES ABIERTAS. Declararlo resuelto
  // con el plan a medias es decirle al cliente que está solucionado
  // antes de haberlo solucionado. El servidor lo rechaza igual; acá se
  // saca el paso de la pantalla para que no se ofrezca algo que va a ser
  // negado, y se dice por qué.
  const sinEjecutar = accionesPendientes(acciones);
  const posibles = TRANSICIONES_RECLAMO[estado].filter(
    (posible) => !(posible === "resuelto" && sinEjecutar > 0),
  );

  const etiquetas: Partial<Record<EstadoReclamo, string>> = {
    contactado: "Registrar el contacto con el cliente",
    plan_definido: "Definir el plan de acción",
    resuelto: "Registrar la resolución",
    cerrado: "Cerrar el caso",
    no_conciliado: "Cerrar como no conciliado",
  };

  const montoNumero = Number(monto.replace(/[^\d]/g, "")) || 0;
  const facturaNumero = Number(factura.replace(/[^\d]/g, "")) || 0;
  const tramo = montoNumero > 0 ? tramoDeAutorizacion(montoNumero) : null;
  const excede = montoNumero > 0 ? excedeTopePorcentual(montoNumero, facturaNumero || null) : null;
  /** El maximo en guaranies que admite el tramo para esta factura. */
  const topeDelTramo =
    tramo?.topePorcentaje != null && facturaNumero > 0
      ? Math.floor((facturaNumero * tramo.topePorcentaje) / 100)
      : null;

  async function mover(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!destino) return;

    definirEnviando(true);
    definirError(null);

    const respuesta = await cambiarEstadoReclamo(reclamoId, destino, new FormData(evento.currentTarget));
    definirEnviando(false);

    if (!respuesta.exito) {
      definirError(respuesta.error);
      return;
    }

    toast.success(respuesta.mensaje ?? "Actualizado.");
    definirDestino(null);
    router.refresh();
  }

  async function rechazar() {
    definirEnviando(true);
    const respuesta = await registrarRechazo(reclamoId);
    definirEnviando(false);

    if (respuesta.exito) {
      toast.success(respuesta.mensaje ?? "Rechazo registrado.");
      router.refresh();
    } else {
      toast.error(respuesta.error);
    }
  }

  const paso = (
    <>
      {posibles.length === 0 ? (
        sinEjecutar > 0 && TRANSICIONES_RECLAMO[estado].includes("resuelto") ? (
          <Tarjeta className="p-4">
            <p className="text-xs font-semibold text-atenuado-contraste">Resolución del caso</p>
            <p className="mt-1 text-[11px] leading-relaxed text-atenuado-contraste">
              Se habilita cuando estén ejecutadas las {sinEjecutar} acci
              {sinEjecutar === 1 ? "ón" : "ones"} que quedan abiertas. Hasta entonces el caso no
              está resuelto, por más que el cliente ya esté conforme.
            </p>
          </Tarjeta>
        ) : null
      ) : (
        <Tarjeta className="p-4">
          <p className="text-xs font-semibold">
            {unicoPaso ? (etiquetas[unicoPaso] ?? "Siguiente paso") : "Siguiente paso"}
          </p>

          {/* CON UN SOLO PASO NO HAY BOTON QUE ELEGIR. El titulo ya
              dice que se va a hacer y abajo esta el campo: un boton
              encendido que repite el titulo y no decide nada es ruido, y
              encima se lee como si hubiera que apretarlo primero. Con
              mas de un paso sigue habiendo que elegir, y ahi si son
              botones. */}
          {!unicoPaso || admiteRechazo(estado) ? (
            <div className="mt-2 flex flex-wrap gap-2">
              {unicoPaso
                ? null
                : posibles.map((posible) => (
                    <Boton
                      key={posible}
                      tamano="pequeno"
                      variante={destino === posible ? "primario" : "contorno"}
                      onClick={() => {
                        definirError(null);
                        definirDestino(destino === posible ? null : posible);
                      }}
                    >
                      {etiquetas[posible] ?? posible}
                    </Boton>
                  ))}

              {/* El rechazo del cliente no es un estado: es lo que hace
                  que el caso escale al plan siguiente para otra
                  propuesta. */}
              {admiteRechazo(estado) ? (
                <Boton tamano="pequeno" variante="contorno" cargando={enviando} onClick={rechazar}>
                  <ThumbsDown /> El cliente rechazó
                </Boton>
              ) : null}
            </div>
          ) : null}

          {destino ? (
            <form onSubmit={mover} className="mt-4 border-t border-borde pt-4">
              {destino === "contactado" ? (
                <GrupoCampo
                  etiqueta="Fecha del contacto"
                  htmlFor="fecha_contacto"
                  ayuda="Desde acá se cuenta el plazo de resolución, no desde la detección."
                >
                  <Entrada id="fecha_contacto" name="fecha_contacto" type="date" defaultValue={hoyEnAsuncion()} />
                </GrupoCampo>
              ) : null}

              {destino === "plan_definido" ? (
                <div className="space-y-3">
                  <GrupoCampo etiqueta="Fecha de definición del plan" htmlFor="fecha_definicion_plan">
                    <Entrada
                      id="fecha_definicion_plan"
                      name="fecha_definicion_plan"
                      type="date"
                      defaultValue={hoyEnAsuncion()}
                    />
                  </GrupoCampo>

                  {/* LAS ACCIONES NO SE PIDEN DOS VECES. Este paso
                      tenía su propio formulario de acciones al lado de
                      la tarjeta «Acciones del plan», que pide lo mismo:
                      quien cargaba en los dos terminaba con la acción
                      duplicada. Acá solo se confirma que el plan quedó
                      definido; las acciones se cargan y se guardan
                      arriba, que es donde después se les carga la
                      evidencia y se las marca ejecutadas. */}
                  <p className="rounded-md border border-borde bg-acento/40 p-2.5 text-[11px] leading-relaxed text-atenuado-contraste">
                    Las acciones se cargan en «Acciones del plan», acá abajo. Guárdelas antes de
                    confirmar este paso.
                  </p>

                  <label className="flex items-start gap-2 text-[11px] leading-relaxed">
                    <input type="checkbox" name="tramite_digemabel" className="mt-0.5 size-3.5 accent-[#E01E37]" />
                    <span>
                      Hay trámite ante la DIGEMABEL en curso
                      <span className="block text-atenuado-contraste">
                        Suspende el plazo del plan desde hoy. Hay que informárselo al cliente por
                        escrito.
                      </span>
                    </span>
                  </label>

                  <label className="flex items-start gap-2 text-[11px] leading-relaxed">
                    <input type="checkbox" name="notificado_gerencia" className="mt-0.5 size-3.5 accent-[#E01E37]" />
                    <span>
                      Se notificó a la Gerencia General
                      <span className="block text-atenuado-contraste">
                        Obligatorio dentro de las 24 horas si hay material controlado o
                        repercusión pública.
                      </span>
                    </span>
                  </label>

                  {plan === "c" ? (
                    <p className="rounded-md border border-semaforo-medio/40 bg-semaforo-medio/5 p-2.5 text-[11px] leading-relaxed">
                      Al definir el plan de un Plan C se abre una no conformidad automáticamente,
                      con su número y su plazo, y queda vinculada a este caso.
                    </p>
                  ) : null}
                </div>
              ) : null}

              {destino === "resuelto" ? (
                <div className="space-y-3">
                  {/* CÓMO SE SOLUCIONÓ, antes que la plata. Es distinto
                      de la compensación: la compensación es lo que se le
                      dio al cliente, la resolución es lo que se hizo
                      para que el problema deje de existir. Un caso puede
                      resolverse sin compensación ninguna, y así quedaba
                      sin registro de nada. */}
                  <GrupoCampo
                    etiqueta="Resolución del caso"
                    htmlFor="resolucion_detalle"
                    requerido
                    ayuda="Cómo se solucionó. Es lo que queda como registro de la gestión."
                  >
                    <AreaTexto
                      id="resolucion_detalle"
                      name="resolucion_detalle"
                      rows={3}
                      required
                      minLength={10}
                      placeholder="Se retiró el artículo equivocado y se entregó el correcto en el domicilio del cliente."
                    />
                  </GrupoCampo>

                  <GrupoCampo etiqueta="Fecha de resolución" htmlFor="fecha_resolucion">
                    <Entrada id="fecha_resolucion" name="fecha_resolucion" type="date" defaultValue={hoyEnAsuncion()} />
                  </GrupoCampo>

                  <GrupoCampo
                    etiqueta="Compensación acordada"
                    htmlFor="compensacion_detalle"
                    ayuda={`Sugeridas para esta gravedad: ${COMPENSACIONES_SUGERIDAS[gravedad].join(" · ")}`}
                  >
                    <AreaTexto id="compensacion_detalle" name="compensacion_detalle" rows={2} />
                  </GrupoCampo>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <GrupoCampo
                      etiqueta="Monto de la compensación"
                      htmlFor="compensacion_monto"
                      ayuda="Vacío si no hay compensación económica."
                    >
                      <Entrada
                        id="compensacion_monto"
                        name="compensacion_monto"
                        inputMode="numeric"
                        value={monto}
                        onChange={(evento) => definirMonto(evento.target.value)}
                        placeholder="0"
                      />
                    </GrupoCampo>
                    <GrupoCampo
                      etiqueta="Monto de la factura afectada"
                      htmlFor="monto_factura"
                      ayuda="El porcentaje se calcula sobre esto, no sobre el perjuicio estimado."
                    >
                      <Entrada
                        id="monto_factura"
                        name="monto_factura"
                        inputMode="numeric"
                        value={factura}
                        onChange={(evento) => definirFactura(evento.target.value)}
                        placeholder="0"
                      />
                    </GrupoCampo>
                  </div>

                  {tramo ? (
                    <div className="rounded-md border border-borde bg-acento/40 p-2.5 text-[11px] leading-relaxed">
                      <p>
                        <span className="font-medium">
                          {formatearGuaranies(montoNumero)} lo autoriza:
                        </span>{" "}
                        {tramo.autoriza}
                        {tramo.requiereCofirma
                          ? ", con co-firma del Gerente de Administración y Finanzas o del Gerente General"
                          : null}
                        .
                      </p>
                      {/* EL TOPE PORCENTUAL BLOQUEA, no avisa. Antes
                          decía «tiene que autorizarlo el nivel
                          siguiente», y no es lo que pasa: el tramo lo
                          decide el monto, así que no hay nivel
                          siguiente al que pasarle este caso. La salida
                          es bajar la compensación. */}
                      {excede === true ? (
                        <p className="mt-1 font-medium text-semaforo-critico">
                          Excede el tope del {tramo.topePorcentaje} % de la factura para este
                          tramo. El máximo es {formatearGuaranies(topeDelTramo ?? 0)}: con más
                          que eso no se puede guardar.
                        </p>
                      ) : null}
                      {excede === null ? (
                        <p className="mt-1 text-semaforo-medio">
                          Cargue el monto de la factura: sin él no hay porcentaje que calcular y
                          la compensación no se puede guardar.
                        </p>
                      ) : null}
                    </div>
                  ) : null}

                  <GrupoCampo etiqueta="Quién autorizó" htmlFor="autorizado_por">
                    <Seleccion id="autorizado_por" name="autorizado_por" defaultValue="">
                      <option value="">Sin compensación económica</option>
                      {personas.map((persona) => (
                        <option key={persona.id} value={persona.id}>
                          {persona.nombre_completo}
                        </option>
                      ))}
                    </Seleccion>
                  </GrupoCampo>

                  <label className="flex items-start gap-2 text-[11px] leading-relaxed">
                    <input type="checkbox" name="conformidad_firmada" className="mt-0.5 size-3.5 accent-[#E01E37]" />
                    <span>
                      El cliente firmó su conformidad
                      <span className="block text-atenuado-contraste">
                        Obligatorio antes de ejecutar cualquier compensación económica o reembolso.
                      </span>
                    </span>
                  </label>
                </div>
              ) : null}

              {destino === "cerrado" ? (
                <GrupoCampo
                  etiqueta="Estado final del cliente"
                  htmlFor="estado_cliente"
                  requerido
                  ayuda="Es el dato que después alimenta el porcentaje de clientes recuperados."
                >
                  <Seleccion id="estado_cliente" name="estado_cliente" defaultValue="recuperado">
                    {ESTADOS_CLIENTE_FINAL.map((valor) => (
                      <option key={valor} value={valor}>
                        {ETIQUETAS_ESTADO_CLIENTE_RECLAMO[valor]}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>
              ) : null}

              {destino === "no_conciliado" ? (
                <GrupoCampo
                  etiqueta="Motivo"
                  htmlFor="motivo_no_conciliado"
                  requerido
                  ayuda="Qué se le ofreció y por qué no se llegó a un acuerdo."
                >
                  <AreaTexto id="motivo_no_conciliado" name="motivo_no_conciliado" rows={3} required minLength={10} />
                </GrupoCampo>
              ) : null}

              {error ? <p className="mt-3 text-xs text-semaforo-critico">{error}</p> : null}

              <div className="mt-4 flex justify-end">
                <Boton type="submit" tamano="pequeno" cargando={enviando}>
                  Confirmar
                </Boton>
              </div>
            </form>
          ) : null}
        </Tarjeta>
      )}
    </>
  );

  return (
    <div className="space-y-4">
      {/* EL PASO DEL CASO VA ARRIBA DE LAS ACCIONES. El orden anterior
          pedía primero cargar las acciones y recién abajo registrar que
          se habló con el cliente, que es al revés de como pasa: primero
          se contacta, y de esa conversación salen las acciones. */}
      {paso}

      {/* LAS ACCIONES SE HABILITAN RECIEN CON EL CONTACTO HECHO. De la
          conversacion con el cliente salen las acciones: ofrecerlas
          antes es pedir que se invente el plan sin haber escuchado el
          reclamo, y encima el plazo de resolucion se cuenta desde el
          contacto, no desde la deteccion. */}
      {estado === "registrado" ? (
        <Tarjeta className="p-4">
          <p className="text-xs font-semibold text-atenuado-contraste">Acciones del plan</p>
          <p className="mt-1 text-[11px] leading-relaxed text-atenuado-contraste">
            Se habilitan al registrar el contacto con el cliente: de esa conversación salen las
            acciones, y el plazo de resolución se cuenta desde ahí.
          </p>
        </Tarjeta>
      ) : (
        <AccionesDelPlan
          reclamoId={reclamoId}
          personas={personas}
          iniciales={acciones}
          evidenciaPorAccion={evidenciaPorAccion}
          exigeCorrectiva={exigeAccionCorrectiva(plan)}
        />
      )}

      {suspendido ? <BotonReanudar reclamoId={reclamoId} /> : null}

      {exigeNoConformidad(plan) && casoCerrado(estado) ? (
        <Verificacion reclamoId={reclamoId} fechaVerificacion={fechaVerificacion} />
      ) : null}

    </div>
  );
}

/**
 * Las acciones del plan.
 *
 * El procedimiento pide que quede registrado qué acciones se toman, quién
 * las ejecuta y en qué fecha. En los planes B y C el caso NO SE CIERRA
 * hasta que estén todas ejecutadas: sin eso el caso se resolvió para el
 * cliente pero la causa sigue viva.
 */
function AccionesDelPlan({
  reclamoId,
  personas,
  iniciales,
  evidenciaPorAccion,
  exigeCorrectiva,
}: {
  reclamoId: string;
  personas: Persona[];
  iniciales: AccionDelPlan[];
  evidenciaPorAccion: Record<string, ArchivoDeEvidencia[]>;
  exigeCorrectiva: boolean;
}) {
  const router = useRouter();
  const hoy = hoyEnAsuncion();
  const [guardando, definirGuardando] = React.useState(false);
  const [filas, definirFilas] = React.useState(() =>
    iniciales.length > 0
      ? iniciales.map((accion, indice) => ({ clave: indice, ...accion }))
      : [
          {
            clave: 0,
            id: "",
            descripcion: "",
            responsable_id: null as string | null,
            fecha_limite: null as string | null,
            ejecutada_en: null as string | null,
          },
        ],
  );
  const siguiente = React.useRef(Math.max(iniciales.length, 1));

  const pendientes = iniciales.filter((a) => !a.ejecutada_en).length;

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirGuardando(true);
    const respuesta = await guardarAccionesDelPlan(reclamoId, new FormData(evento.currentTarget));
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
      <p className="text-xs font-semibold">Acciones del plan</p>
      <p className="mb-3 mt-0.5 text-[11px] leading-relaxed text-atenuado-contraste">
        Qué se hace, quién lo hace y cuándo.
        {exigeCorrectiva
          ? ` En este plan el caso no se cierra hasta que estén todas ejecutadas${
              pendientes > 0 ? ` (quedan ${pendientes})` : ""
            }.`
          : null}
      </p>

      <form onSubmit={guardar} className="space-y-3">
        {filas.map((fila) => {
          const plazo = estadoDePlazoDeAccion(fila.fecha_limite, fila.ejecutada_en, hoy);

          return (
          <div key={fila.clave} className="rounded-md border border-borde p-2.5">
            <input type="hidden" name="accion_id" value={fila.id} />

            <div className="flex items-start gap-2">
              <AreaTexto
                name="accion_descripcion"
                rows={2}
                defaultValue={fila.descripcion}
                required
                minLength={10}
                placeholder="Retirar el artículo equivocado y entregar el correcto"
                className="text-xs"
                aria-label="Qué se hace"
              />
              <Boton
                type="button"
                tamano="iconoPequeno"
                variante="fantasma"
                aria-label="Quitar acción"
                onClick={() =>
                  definirFilas((actuales) =>
                    actuales.length === 1 ? actuales : actuales.filter((o) => o.clave !== fila.clave),
                  )
                }
              >
                <X />
              </Boton>
            </div>

            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Seleccion
                name="accion_responsable"
                defaultValue={fila.responsable_id ?? ""}
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

              {/* UNA SOLA FECHA, Y DICE CUÁL ES. Eran dos campos de fecha
                  pegados y sin rótulo —el plazo y la ejecución—, así que
                  no había forma de saber cuál era cuál sin pasar el
                  puntero por encima. */}
              <label className="flex flex-col gap-1">
                <span className="text-[11px] text-atenuado-contraste">
                  Límite para ejecutar la acción
                </span>
                <Entrada
                  name="accion_fecha_limite"
                  type="date"
                  value={fila.fecha_limite ?? ""}
                  onChange={(evento) =>
                    definirFilas((actuales) =>
                      actuales.map((otra) =>
                        otra.clave === fila.clave
                          ? { ...otra, fecha_limite: evento.target.value || null }
                          : otra,
                      ),
                    )
                  }
                  required
                  className="text-xs"
                />

                {/* EN PLAZO O FUERA DE PLAZO, LA MISMA CUENTA ABIERTA Y
                    CERRADA. Mientras la acción está abierta se compara
                    contra hoy y sirve para saberlo ANTES de que se
                    venza; al marcarla ejecutada queda fija contra la
                    fecha en que se ejecutó. Si fueran dos cuentas
                    distintas, la leyenda podría decir una cosa abierta y
                    otra cerrada sobre la misma acción. */}
                {plazo && fila.id ? (
                  <span
                    className={
                      plazo === "en_plazo"
                        ? "text-[11px] font-medium text-semaforo-bajo"
                        : "text-[11px] font-medium text-semaforo-critico"
                    }
                  >
                    {ETIQUETAS_ESTADO_PLAZO[plazo]}
                    {!fila.ejecutada_en ? (
                      <span className="font-normal text-atenuado-contraste">
                        {" "}
                        · todavía sin ejecutar
                      </span>
                    ) : null}
                  </span>
                ) : null}
              </label>
            </div>

            {/* EJECUTADA Y EVIDENCIA, RECIÉN DESPUÉS DE GUARDAR. Primero
                se planifica —qué se hace, quién y para cuándo— y se
                guarda; a partir de ahí la acción existe y se la puede
                medir. Ofrecer «Ejecutada» en una fila que todavía no se
                guardó es ofrecer declarar cumplido algo que todavía no
                se planificó, y la evidencia ni siquiera tiene dónde
                colgarse: hace falta el id de la acción. */}
            {!fila.id ? (
              <p className="mt-2 border-t border-borde pt-2 text-[11px] text-atenuado-contraste">
                Guarde la acción para poder marcarla ejecutada y adjuntarle evidencia.
              </p>
            ) : (
              <>
            {/* LA EJECUCIÓN PASA A SER UNA CASILLA. Era la segunda fecha,
                y no se podía sacar sin romper el cierre del caso: en los
                planes B y C el reclamo no cierra hasta que estén todas
                ejecutadas. Como casilla sigue cumpliendo esa función y
                deja una sola fecha, que es lo que se pidió.

                Marcarla guarda la fecha de hoy; si ya tenía una, se
                respeta la que estaba. */}
            <label className="mt-2 flex items-center gap-2 text-[11px]">
              <input
                type="checkbox"
                checked={Boolean(fila.ejecutada_en)}
                onChange={(evento) =>
                  definirFilas((actuales) =>
                    actuales.map((otra) =>
                      otra.clave === fila.clave
                        ? {
                            ...otra,
                            ejecutada_en: evento.target.checked
                              ? (otra.ejecutada_en ?? hoyEnAsuncion())
                              : null,
                          }
                        : otra,
                    ),
                  )
                }
                className="size-3.5 accent-[#E01E37]"
              />
              <span>
                Ejecutada
                {fila.ejecutada_en ? (
                  <span className="text-atenuado-contraste">
                    {" "}
                    el {formatearFecha(fila.ejecutada_en)}
                  </span>
                ) : null}
              </span>
            </label>
            <input type="hidden" name="accion_ejecutada_en" value={fila.ejecutada_en ?? ""} />

            <EvidenciaDeAccion
              accionId={fila.id}
              reclamoId={reclamoId}
              archivos={evidenciaPorAccion[fila.id] ?? []}
            />
              </>
            )}
          </div>
          );
        })}

        <div className="flex items-center justify-between gap-2">
          <Boton
            type="button"
            tamano="pequeno"
            variante="contorno"
            onClick={() =>
              definirFilas((actuales) => [
                ...actuales,
                {
                  clave: siguiente.current++,
                  id: "",
                  descripcion: "",
                  responsable_id: null,
                  fecha_limite: null,
                  ejecutada_en: null,
                },
              ])
            }
          >
            <Plus /> Otra acción
          </Boton>
          <Boton type="submit" tamano="pequeno" cargando={guardando}>
            Guardar acciones
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

/**
 * Reanudar el plazo cuando el trámite ante la DIGEMABEL terminó.
 *
 * Va suelto y arriba de todo porque mientras el caso está suspendido no
 * corre ningún plazo: es lo primero que hay que resolver, no un paso más
 * del ciclo.
 */
function BotonReanudar({ reclamoId }: { reclamoId: string }) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);

  return (
    <Tarjeta className="border-semaforo-medio/40 bg-semaforo-medio/5 p-4">
      <p className="text-xs font-semibold">Plazo suspendido</p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-atenuado-contraste">
        Mientras dure el trámite el caso no cuenta como fuera de plazo. Al reanudarlo, los días
        hábiles que el trámite duró se le devuelven al plazo de resolución.
      </p>
      <Boton
        tamano="pequeno"
        variante="contorno"
        className="mt-2"
        cargando={enviando}
        onClick={async () => {
          definirEnviando(true);
          const respuesta = await reanudarPlazoSuspendido(reclamoId);
          definirEnviando(false);
          if (respuesta.exito) {
            toast.success(respuesta.mensaje ?? "Plazo reanudado.");
            router.refresh();
          } else {
            toast.error(respuesta.error);
          }
        }}
      >
        <PlayCircle /> El trámite terminó, reanudar el plazo
      </Boton>
    </Tarjeta>
  );
}

/**
 * La verificación con el cliente a los 30 días de cerrar un Plan C.
 *
 * Es lo único que separa un caso cerrado de un caso resuelto: que alguien
 * volvió a preguntarle al cliente si la solución sirvió.
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
  const [error, definirError] = React.useState<string | null>(null);

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const respuesta = await registrarVerificacion(reclamoId, new FormData(evento.currentTarget));
    definirEnviando(false);

    if (respuesta.exito) {
      toast.success(respuesta.mensaje ?? "Verificación registrada.");
      router.refresh();
    } else {
      definirError(respuesta.error);
    }
  }

  return (
    <Tarjeta className="p-4">
      <p className="text-xs font-semibold">
        Verificación con el cliente a los {DIAS_VERIFICACION_PLAN_C} días
      </p>
      <p className="mt-0.5 text-[11px] leading-relaxed text-atenuado-contraste">
        {fechaVerificacion
          ? "Ya está registrada. Si vuelve a hablar con el cliente, se puede corregir."
          : "El Plan C la pide después del cierre: si la solución se sostuvo y qué dijo el cliente."}
      </p>

      <form onSubmit={guardar} className="mt-3 space-y-3">
        <GrupoCampo etiqueta="Fecha de la verificación" htmlFor="fecha_verificacion">
          <Entrada
            id="fecha_verificacion"
            name="fecha_verificacion"
            type="date"
            defaultValue={fechaVerificacion ?? hoyEnAsuncion()}
          />
        </GrupoCampo>
        <GrupoCampo etiqueta="Qué dijo el cliente" htmlFor="verificacion_observacion" requerido>
          <AreaTexto
            id="verificacion_observacion"
            name="verificacion_observacion"
            rows={3}
            required
            minLength={10}
          />
        </GrupoCampo>

        {error ? <p className="text-xs text-semaforo-critico">{error}</p> : null}

        <div className="flex justify-end">
          <Boton type="submit" tamano="pequeno" cargando={enviando}>
            Guardar la verificación
          </Boton>
        </div>
      </form>
    </Tarjeta>
  );
}

/**
 * La evidencia de una acción del plan.
 *
 * HASTA CINCO ARCHIVOS POR ACCIÓN, contando los que ya tiene: es un tope
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

      {/* La subida va por fuera del formulario de las acciones: es una
          acción de servidor distinta y no tiene que arrastrar consigo el
          guardado de las descripciones y los plazos. */}
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
