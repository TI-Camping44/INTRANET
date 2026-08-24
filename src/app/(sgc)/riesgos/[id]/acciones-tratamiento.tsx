"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Plus, Trash2 } from "lucide-react";
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
  actualizarAccionRiesgo,
  crearAccionRiesgo,
  eliminarAccionRiesgo,
} from "@/app/(sgc)/riesgos/acciones";
import { ETIQUETAS_TRATAMIENTO_RIESGO } from "@/lib/constantes";
import { describirVencimiento, formatearFecha, hoyEnAsuncion, sumarDias } from "@/lib/formato";
import type { EstadoAccion, TratamientoRiesgo } from "@/lib/tipos";

interface AccionTratamiento {
  id: string;
  descripcion: string;
  tratamiento: TratamientoRiesgo;
  fecha_limite: string | null;
  estado: EstadoAccion;
  responsable: { nombre_completo: string } | null;
}

/** Plan de tratamiento del riesgo. */
export function AccionesTratamiento({
  riesgoId,
  acciones,
  personas,
  puedeEditar,
}: {
  riesgoId: string;
  acciones: AccionTratamiento[];
  personas: { id: string; nombre_completo: string }[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abierto, definirAbierto] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);
  const hoy = hoyEnAsuncion();

  async function agregar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirProcesando(true);
    const resultado = await crearAccionRiesgo(riesgoId, new FormData(evento.currentTarget));
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Acción agregada.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function marcarEjecutada(accionId: string) {
    const resultado = await actualizarAccionRiesgo(accionId, riesgoId, "ejecutada");
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Acción actualizada.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function borrar(accionId: string) {
    if (!confirm("¿Eliminar esta acción de tratamiento?")) return;
    const resultado = await eliminarAccionRiesgo(accionId, riesgoId);
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
          titulo="Sin acciones de tratamiento"
          descripcion="Defina qué se hará para llevar el riesgo a un nivel aceptable."
        />
      ) : (
        <ul className="space-y-2">
          {acciones.map((accion) => (
            <li key={accion.id} className="rounded-md border border-borde p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium leading-snug">{accion.descripcion}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[11px] text-atenuado-contraste">
                    <span>{ETIQUETAS_TRATAMIENTO_RIESGO[accion.tratamiento]}</span>
                    <span aria-hidden>·</span>
                    <span>{accion.responsable?.nombre_completo ?? "Sin responsable"}</span>
                    {accion.fecha_limite ? (
                      <>
                        <span aria-hidden>·</span>
                        <span>
                          {formatearFecha(accion.fecha_limite)} ·{" "}
                          {describirVencimiento(accion.fecha_limite)}
                        </span>
                      </>
                    ) : null}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <InsigniaEstadoAccion estado={accion.estado} />
                  {puedeEditar ? (
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

              {puedeEditar && ["pendiente", "en_curso"].includes(accion.estado) ? (
                <div className="mt-2 border-t border-borde pt-2">
                  <Boton
                    tamano="pequeno"
                    variante="contorno"
                    onClick={() => marcarEjecutada(accion.id)}
                  >
                    <CheckCircle2 /> Marcar ejecutada
                  </Boton>
                </div>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {puedeEditar ? (
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
              <DialogoTitulo>Nueva acción de tratamiento</DialogoTitulo>
            </DialogoCabecera>

            <div className="mt-4 space-y-3">
              <GrupoCampo etiqueta="Descripción" htmlFor="descripcion" requerido>
                <AreaTexto id="descripcion" name="descripcion" rows={3} required minLength={10} />
              </GrupoCampo>

              <GrupoCampo etiqueta="Estrategia" htmlFor="tratamiento" requerido>
                <Seleccion id="tratamiento" name="tratamiento" defaultValue="mitigar">
                  {Object.entries(ETIQUETAS_TRATAMIENTO_RIESGO).map(([valor, texto]) => (
                    <option key={valor} value={valor}>
                      {texto}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>

              <GrupoCampo etiqueta="Responsable" htmlFor="responsable_id">
                <Seleccion id="responsable_id" name="responsable_id">
                  <option value="">Sin asignar</option>
                  {personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.nombre_completo}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>

              <GrupoCampo etiqueta="Fecha límite" htmlFor="fecha_limite">
                <Entrada
                  id="fecha_limite"
                  name="fecha_limite"
                  type="date"
                  min={hoy}
                  defaultValue={sumarDias(hoy, 30)}
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
