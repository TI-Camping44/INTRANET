"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Users, FileCheck2, Lock } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, GrupoCampo } from "@/components/ui/campo";
import {
  Dialogo,
  DialogoCabecera,
  DialogoCierre,
  DialogoContenido,
  DialogoDescripcion,
  DialogoPie,
  DialogoTitulo,
} from "@/components/ui/dialogo";
import { cambiarEstadoAuditoria, definirEquipo } from "@/app/(sgc)/auditorias/acciones";
import type { EstadoAuditoria, ResultadoAccion } from "@/lib/tipos";

/**
 * Avance del ciclo de la auditoria y composicion del equipo auditor.
 * planificada -> en ejecucion -> informe pendiente -> cerrada.
 */
export function PanelEjecucion({
  auditoriaId,
  estado,
  equipoActual,
  auditorLiderId,
  personas,
  puedeEditar,
}: {
  auditoriaId: string;
  estado: EstadoAuditoria;
  equipoActual: string[];
  auditorLiderId: string | null;
  personas: { id: string; nombre_completo: string }[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);
  const [dialogoEquipo, definirDialogoEquipo] = React.useState(false);
  const [dialogoCierre, definirDialogoCierre] = React.useState(false);
  const [equipo, definirEquipoElegido] = React.useState<string[]>(equipoActual);
  const [conclusiones, definirConclusiones] = React.useState("");

  async function ejecutar(operacion: () => Promise<ResultadoAccion>, alTerminar?: () => void) {
    definirProcesando(true);
    const resultado = await operacion();
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Operación realizada.");
      alTerminar?.();
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  if (!puedeEditar) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {estado === "planificada" ? (
        <Boton
          tamano="pequeno"
          disabled={procesando}
          onClick={() => ejecutar(() => cambiarEstadoAuditoria(auditoriaId, "en_ejecucion"))}
        >
          <Play /> Iniciar ejecución
        </Boton>
      ) : null}

      {estado === "en_ejecucion" ? (
        <Boton
          tamano="pequeno"
          disabled={procesando}
          onClick={() => ejecutar(() => cambiarEstadoAuditoria(auditoriaId, "informe_pendiente"))}
        >
          <FileCheck2 /> Finalizar trabajo de campo
        </Boton>
      ) : null}

      {estado === "informe_pendiente" ? (
        <Boton tamano="pequeno" disabled={procesando} onClick={() => definirDialogoCierre(true)}>
          <Lock /> Cerrar auditoría
        </Boton>
      ) : null}

      {estado !== "cerrada" && estado !== "cancelada" ? (
        <Boton
          tamano="pequeno"
          variante="contorno"
          onClick={() => definirDialogoEquipo(true)}
          disabled={procesando}
        >
          <Users /> Equipo auditor
        </Boton>
      ) : null}

      {/* Equipo auditor */}
      <Dialogo open={dialogoEquipo} onOpenChange={definirDialogoEquipo}>
        <DialogoContenido>
          <DialogoCabecera>
            <DialogoTitulo>Equipo auditor</DialogoTitulo>
            <DialogoDescripcion>
              El auditor líder integra el equipo siempre. Quienes se incorporen reciben una
              notificación.
            </DialogoDescripcion>
          </DialogoCabecera>

          <div className="max-h-64 overflow-y-auto rounded-md border border-borde p-2">
            {personas.map((persona) => {
              const esLider = persona.id === auditorLiderId;
              return (
                <label
                  key={persona.id}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm
                             hover:bg-acento"
                >
                  <input
                    type="checkbox"
                    className="size-4 accent-[#E01E37]"
                    checked={esLider || equipo.includes(persona.id)}
                    disabled={esLider}
                    onChange={(evento) =>
                      definirEquipoElegido((actuales) =>
                        evento.target.checked
                          ? [...actuales, persona.id]
                          : actuales.filter((id) => id !== persona.id),
                      )
                    }
                  />
                  {persona.nombre_completo}
                  {esLider ? (
                    <span className="text-[11px] text-atenuado-contraste">· auditor líder</span>
                  ) : null}
                </label>
              );
            })}
          </div>

          <DialogoPie>
            <DialogoCierre asChild>
              <Boton variante="contorno">Cancelar</Boton>
            </DialogoCierre>
            <Boton
              disabled={procesando}
              onClick={() =>
                ejecutar(
                  () => definirEquipo(auditoriaId, equipo),
                  () => definirDialogoEquipo(false),
                )
              }
            >
              Guardar equipo
            </Boton>
          </DialogoPie>
        </DialogoContenido>
      </Dialogo>

      {/* Cierre con conclusiones */}
      <Dialogo open={dialogoCierre} onOpenChange={definirDialogoCierre}>
        <DialogoContenido>
          <DialogoCabecera>
            <DialogoTitulo>Cerrar la auditoría</DialogoTitulo>
            <DialogoDescripcion>
              Todos los hallazgos de no conformidad deben tener su NC generada. Las conclusiones
              quedan como informe de la auditoría.
            </DialogoDescripcion>
          </DialogoCabecera>

          <GrupoCampo etiqueta="Conclusiones" htmlFor="conclusiones" requerido>
            <AreaTexto
              id="conclusiones"
              rows={4}
              value={conclusiones}
              onChange={(evento) => definirConclusiones(evento.target.value)}
              placeholder="Resultado general, hallazgos relevantes y recomendaciones al proceso auditado."
            />
          </GrupoCampo>

          <DialogoPie>
            <DialogoCierre asChild>
              <Boton variante="contorno">Cancelar</Boton>
            </DialogoCierre>
            <Boton
              disabled={procesando || conclusiones.trim().length < 15}
              onClick={() =>
                ejecutar(
                  () => cambiarEstadoAuditoria(auditoriaId, "cerrada", conclusiones),
                  () => definirDialogoCierre(false),
                )
              }
            >
              Cerrar auditoría
            </Boton>
          </DialogoPie>
        </DialogoContenido>
      </Dialogo>
    </div>
  );
}
