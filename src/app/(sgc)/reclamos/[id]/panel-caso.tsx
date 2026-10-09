"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PlayCircle, Plus, ThumbsDown, X } from "lucide-react";

import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  cambiarEstadoReclamo,
  guardarAccionesDelPlan,
  reanudarPlazoSuspendido,
  registrarRechazo,
  registrarVerificacion,
} from "@/app/(sgc)/reclamos/acciones";
import {
  admiteRechazo,
  casoCerrado,
  COMPENSACIONES_SUGERIDAS,
  DIAS_VERIFICACION_PLAN_C,
  ESTADOS_CLIENTE_FINAL,
  ETIQUETAS_ESTADO_CLIENTE_RECLAMO,
  exigeAccionCorrectiva,
  exigeNoConformidad,
  excedeTopePorcentual,
  tramoDeAutorizacion,
  TRANSICIONES_RECLAMO,
  type EstadoReclamo,
  type GravedadReclamo,
  type PlanReclamo,
} from "@/lib/reclamos";
import { formatearGuaranies, hoyEnAsuncion } from "@/lib/formato";

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
  suspendido,
  fechaVerificacion,
}: {
  reclamoId: string;
  estado: EstadoReclamo;
  plan: PlanReclamo;
  gravedad: GravedadReclamo;
  personas: Persona[];
  acciones: AccionDelPlan[];
  /** Si hay un trámite ante la DIGEMABEL con el plazo detenido. */
  suspendido: boolean;
  fechaVerificacion: string | null;
}) {
  const router = useRouter();
  const [destino, definirDestino] = React.useState<EstadoReclamo | null>(null);
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [monto, definirMonto] = React.useState("");
  const [factura, definirFactura] = React.useState("");

  // LAS ACCIONES SE CARGAN AL DEFINIR EL PLAN. Definir el plan ES decir
  // qué se hace, quién lo hace y cuándo: antes el paso solo pedía la
  // fecha y después rechazaba el cambio pidiendo cargarlas en la
  // tarjeta de arriba, que es una vuelta que nadie adivina.
  const [nuevasAcciones, definirNuevasAcciones] = React.useState([{ clave: 0 }]);
  const claveSiguiente = React.useRef(1);

  function agregarAccionDelPaso() {
    definirNuevasAcciones((actuales) => [...actuales, { clave: claveSiguiente.current++ }]);
  }

  function quitarAccionDelPaso(clave: number) {
    definirNuevasAcciones((actuales) =>
      actuales.length === 1 ? actuales : actuales.filter((fila) => fila.clave !== clave),
    );
  }

  const posibles = TRANSICIONES_RECLAMO[estado];

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
    definirNuevasAcciones([{ clave: 0 }]);
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

  return (
    <div className="space-y-4">
      <AccionesDelPlan
        reclamoId={reclamoId}
        personas={personas}
        iniciales={acciones}
        exigeCorrectiva={exigeAccionCorrectiva(plan)}
      />

      {suspendido ? <BotonReanudar reclamoId={reclamoId} /> : null}

      {exigeNoConformidad(plan) && casoCerrado(estado) ? (
        <Verificacion reclamoId={reclamoId} fechaVerificacion={fechaVerificacion} />
      ) : null}

      {posibles.length === 0 ? null : (
        <Tarjeta className="p-4">
          <p className="text-xs font-semibold">Siguiente paso</p>

          <div className="mt-2 flex flex-wrap gap-2">
            {posibles.map((posible) => (
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

            {/* El rechazo del cliente no es un estado: es lo que hace que
                el caso escale al plan siguiente para otra propuesta. */}
            {admiteRechazo(estado) ? (
              <Boton tamano="pequeno" variante="contorno" cargando={enviando} onClick={rechazar}>
                <ThumbsDown /> El cliente rechazó
              </Boton>
            ) : null}
          </div>

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

                  <div className="rounded-md border border-borde p-3">
                    <p className="text-xs font-semibold">Acciones del plan</p>
                    <p className="mb-2 mt-0.5 text-[11px] text-atenuado-contraste">
                      Qué se hace, quién lo hace y cuándo. Al menos una; agregue las que hagan
                      falta.
                    </p>

                    <div className="space-y-2">
                      {nuevasAcciones.map((fila, indice) => (
                        <div key={fila.clave} className="rounded-md border border-borde p-2.5">
                          <div className="flex items-start gap-2">
                            <AreaTexto
                              name="accion_descripcion"
                              rows={2}
                              required={indice === 0}
                              placeholder="Retirar el artículo equivocado y entregar el correcto"
                              className="text-xs"
                              aria-label={`Acción ${indice + 1}`}
                            />
                            <Boton
                              type="button"
                              tamano="iconoPequeno"
                              variante="fantasma"
                              aria-label={`Quitar la acción ${indice + 1}`}
                              onClick={() => quitarAccionDelPaso(fila.clave)}
                            >
                              <X />
                            </Boton>
                          </div>

                          <div className="mt-2 grid gap-2 sm:grid-cols-2">
                            <Seleccion
                              name="accion_responsable"
                              required={indice === 0}
                              defaultValue=""
                              className="text-xs"
                              aria-label={`Responsable de la acción ${indice + 1}`}
                            >
                              <option value="">Responsable…</option>
                              {personas.map((persona) => (
                                <option key={persona.id} value={persona.id}>
                                  {persona.nombre_completo}
                                </option>
                              ))}
                            </Seleccion>
                            <Entrada
                              name="accion_fecha_limite"
                              type="date"
                              required={indice === 0}
                              className="text-xs"
                              aria-label={`Plazo de la acción ${indice + 1}`}
                              title="Plazo"
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <Boton
                      type="button"
                      tamano="pequeno"
                      variante="contorno"
                      className="mt-2"
                      onClick={agregarAccionDelPaso}
                    >
                      <Plus /> Agregar acción
                    </Boton>
                  </div>

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
                      {excede === true ? (
                        <p className="mt-1 font-medium text-semaforo-critico">
                          Excede el tope del {tramo.topePorcentaje}% de la factura para ese nivel:
                          tiene que autorizarlo el nivel siguiente.
                        </p>
                      ) : null}
                      {excede === null ? (
                        <p className="mt-1 text-semaforo-medio">
                          Sin el monto de la factura no se puede verificar el tope porcentual.
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
  exigeCorrectiva,
}: {
  reclamoId: string;
  personas: Persona[];
  iniciales: AccionDelPlan[];
  exigeCorrectiva: boolean;
}) {
  const router = useRouter();
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
        {filas.map((fila) => (
          <div key={fila.clave} className="rounded-md border border-borde p-2.5">
            <input type="hidden" name="accion_id" value={fila.id} />

            <div className="flex items-start gap-2">
              <AreaTexto
                name="accion_descripcion"
                rows={2}
                defaultValue={fila.descripcion}
                placeholder="Retirar el artículo equivocado y entregar el correcto"
                className="text-xs"
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

            <div className="mt-2 grid gap-2 sm:grid-cols-3">
              <Seleccion name="accion_responsable" defaultValue={fila.responsable_id ?? ""} className="text-xs">
                <option value="">Responsable…</option>
                {personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.nombre_completo}
                  </option>
                ))}
              </Seleccion>
              <Entrada
                name="accion_fecha_limite"
                type="date"
                defaultValue={fila.fecha_limite ?? ""}
                className="text-xs"
                aria-label="Fecha límite"
              />
              <Entrada
                name="accion_ejecutada_en"
                type="date"
                defaultValue={fila.ejecutada_en ?? ""}
                className="text-xs"
                aria-label="Ejecutada el"
                title="Ejecutada el"
              />
            </div>
          </div>
        ))}

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
