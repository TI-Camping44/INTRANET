"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Play, Plus, Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { InsigniaEstadoAccion } from "@/components/comunes/insignias-estado";
import {
  Dialogo,
  DialogoCabecera,
  DialogoCierre,
  DialogoContenido,
  DialogoDescripcion,
  DialogoPie,
  DialogoTitulo,
} from "@/components/ui/dialogo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  actualizarEstadoAccion,
  crearAccion,
  eliminarAccion,
} from "@/app/(sgc)/no-conformidades/acciones";
import { DIAS_ESCALAMIENTO_NC, ETIQUETAS_TIPO_ACCION } from "@/lib/constantes";
import { describirVencimiento, diasHasta, formatearFecha, hoyEnAsuncion, sumarDias } from "@/lib/formato";
import type { EstadoAccion, TipoAccion } from "@/lib/tipos";

interface AccionConResponsable {
  id: string;
  tipo: TipoAccion;
  descripcion: string;
  responsable_id: string | null;
  fecha_limite: string;
  estado: EstadoAccion;
  fecha_ejecucion: string | null;
  evidencia: string | null;
  nivel_escalamiento: number;
  responsable: { nombre_completo: string } | null;
}

interface Persona {
  id: string;
  nombre_completo: string;
}

/**
 * Plan de accion de la no conformidad. Cada accion tiene responsable y
 * fecha limite; el trabajo programado escala al lider inmediato a los
 * diez dias de vencimiento sin resolucion.
 */
export function PlanAccion({
  noConformidadId,
  acciones,
  personas,
  usuarioActual,
  puedeGestionar,
}: {
  noConformidadId: string;
  acciones: AccionConResponsable[];
  personas: Persona[];
  usuarioActual: string;
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const [abierto, definirAbierto] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);
  const [evidencia, definirEvidencia] = React.useState<Record<string, string>>({});

  const hoy = hoyEnAsuncion();

  async function agregar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirProcesando(true);
    const resultado = await crearAccion(noConformidadId, new FormData(evento.currentTarget));
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Acción agregada.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function cambiarEstado(accionId: string, estado: EstadoAccion) {
    definirProcesando(true);
    const resultado = await actualizarEstadoAccion(
      accionId,
      noConformidadId,
      estado,
      evidencia[accionId],
    );
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Acción actualizada.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function borrar(accionId: string) {
    if (!confirm("¿Eliminar esta acción del plan?")) return;
    const resultado = await eliminarAccion(accionId, noConformidadId);
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Acción eliminada.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="space-y-3">
      {acciones.length === 0 ? (
        <EstadoVacio
          titulo="Sin plan de acción"
          descripcion="Defina al menos una acción correctiva que elimine la causa raíz identificada."
        />
      ) : (
        <ul className="space-y-2">
          {acciones.map((accion) => {
            const dias = diasHasta(accion.fecha_limite);
            const abierta = accion.estado === "pendiente" || accion.estado === "en_curso";
            const vencida = abierta && dias !== null && dias < 0;
            const escalada = accion.nivel_escalamiento > 0;
            const esResponsable = accion.responsable_id === usuarioActual;

            return (
              <li
                key={accion.id}
                className={`rounded-md border p-3 ${
                  vencida ? "border-semaforo-critico/40 bg-semaforo-critico/5" : "border-borde"
                }`}
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium leading-snug">{accion.descripcion}</p>
                    <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-atenuado-contraste">
                      <span>{ETIQUETAS_TIPO_ACCION[accion.tipo]}</span>
                      <span aria-hidden>·</span>
                      <span>{accion.responsable?.nombre_completo ?? "Sin responsable"}</span>
                      <span aria-hidden>·</span>
                      <span className={vencida ? "font-medium text-semaforo-critico" : ""}>
                        {formatearFecha(accion.fecha_limite)} ·{" "}
                        {describirVencimiento(accion.fecha_limite)}
                      </span>
                      {escalada ? (
                        <span className="font-medium text-semaforo-alto">
                          Escalada (nivel {accion.nivel_escalamiento})
                        </span>
                      ) : null}
                    </p>
                    {accion.evidencia ? (
                      <p className="mt-1.5 rounded bg-atenuado/60 p-2 text-[11px] leading-relaxed">
                        <span className="font-medium">Evidencia: </span>
                        {accion.evidencia}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    <InsigniaEstadoAccion estado={accion.estado} />
                    {puedeGestionar ? (
                      <button
                        type="button"
                        onClick={() => borrar(accion.id)}
                        className="text-atenuado-contraste transition-colors hover:text-semaforo-critico"
                        aria-label="Eliminar acción"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    ) : null}
                  </div>
                </div>

                {/* Avance: lo registra el responsable de la acción o Calidad. */}
                {(esResponsable || puedeGestionar) && abierta ? (
                  <div className="mt-2.5 flex flex-col gap-2 border-t border-borde pt-2.5 sm:flex-row sm:items-end">
                    {accion.estado === "pendiente" ? (
                      <Boton
                        tamano="pequeno"
                        variante="contorno"
                        disabled={procesando}
                        onClick={() => cambiarEstado(accion.id, "en_curso")}
                      >
                        <Play /> Iniciar
                      </Boton>
                    ) : null}

                    <GrupoCampo
                      etiqueta="Evidencia de ejecución"
                      htmlFor={`evidencia-${accion.id}`}
                      className="flex-1"
                    >
                      <Entrada
                        id={`evidencia-${accion.id}`}
                        value={evidencia[accion.id] ?? ""}
                        onChange={(evento) =>
                          definirEvidencia((actual) => ({
                            ...actual,
                            [accion.id]: evento.target.value,
                          }))
                        }
                        placeholder="Instructivo IT-DEP-03 actualizado y difundido"
                        className="h-8 text-xs"
                      />
                    </GrupoCampo>

                    <Boton
                      tamano="pequeno"
                      disabled={procesando}
                      onClick={() => cambiarEstado(accion.id, "ejecutada")}
                    >
                      <CheckCircle2 /> Marcar ejecutada
                    </Boton>
                  </div>
                ) : null}

                {accion.estado === "ejecutada" && puedeGestionar ? (
                  <div className="mt-2.5 border-t border-borde pt-2.5">
                    <Boton
                      tamano="pequeno"
                      disabled={procesando}
                      onClick={() => cambiarEstado(accion.id, "verificada")}
                    >
                      <CheckCircle2 /> Verificar eficacia de la acción
                    </Boton>
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}

      {puedeGestionar ? (
        <div className="flex justify-end">
          <Boton tamano="pequeno" variante="contorno" onClick={() => definirAbierto(true)}>
            <Plus /> Agregar acción
          </Boton>
        </div>
      ) : null}

      <Dialogo open={abierto} onOpenChange={definirAbierto}>
        <DialogoContenido>
          <form onSubmit={agregar}>
            <DialogoCabecera>
              <DialogoTitulo>Nueva acción del plan</DialogoTitulo>
              <DialogoDescripcion>
                Si no se resuelve dentro de los {DIAS_ESCALAMIENTO_NC} días posteriores al
                vencimiento, el sistema notifica al líder inmediato del responsable.
              </DialogoDescripcion>
            </DialogoCabecera>

            <div className="mt-4 space-y-3">
              <GrupoCampo etiqueta="Tipo de acción" htmlFor="tipo" requerido>
                <Seleccion id="tipo" name="tipo" defaultValue="accion_correctiva">
                  {Object.entries(ETIQUETAS_TIPO_ACCION).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Descripción"
                htmlFor="descripcion"
                requerido
                ayuda="Qué se hará concretamente para eliminar la causa."
              >
                <AreaTexto id="descripcion" name="descripcion" rows={3} required minLength={10} />
              </GrupoCampo>

              <GrupoCampo etiqueta="Responsable" htmlFor="responsable_id" requerido>
                <Seleccion id="responsable_id" name="responsable_id" required>
                  <option value="">Seleccione un responsable</option>
                  {personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.nombre_completo}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>

              <GrupoCampo etiqueta="Fecha límite" htmlFor="fecha_limite" requerido>
                <Entrada
                  id="fecha_limite"
                  name="fecha_limite"
                  type="date"
                  min={hoy}
                  defaultValue={sumarDias(hoy, 15)}
                  required
                />
              </GrupoCampo>
            </div>

            <DialogoPie className="mt-5">
              <DialogoCierre asChild>
                <Boton type="button" variante="contorno">
                  Cancelar
                </Boton>
              </DialogoCierre>
              <Boton type="submit" disabled={procesando}>
                Agregar acción
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </div>
  );
}
