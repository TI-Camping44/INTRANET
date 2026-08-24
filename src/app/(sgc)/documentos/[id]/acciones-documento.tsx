"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Archive, CheckCircle2, FilePlus2, RefreshCw, Send } from "lucide-react";
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
import {
  aprobarYPublicar,
  confirmarRevisionSinCambios,
  crearNuevaVersion,
  enviarARevision,
  marcarObsoleto,
} from "@/app/(sgc)/documentos/acciones";
import type { EstadoDocumento, ResultadoAccion } from "@/lib/tipos";

interface Persona {
  id: string;
  nombre_completo: string;
}

/**
 * Panel de acciones del flujo documental:
 * elaboracion -> revision -> aprobacion -> vigente -> obsoleto.
 */
export function AccionesDocumento({
  documentoId,
  estadoDocumento,
  versionEditableId,
  versionEnRevisionId,
  revisionesPendientes,
  personas,
  puedeGestionar,
}: {
  documentoId: string;
  estadoDocumento: EstadoDocumento;
  versionEditableId: string | null;
  versionEnRevisionId: string | null;
  revisionesPendientes: number;
  personas: Persona[];
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);
  const [dialogoRevision, definirDialogoRevision] = React.useState(false);
  const [dialogoVersion, definirDialogoVersion] = React.useState(false);
  const [revisores, definirRevisores] = React.useState<string[]>([]);
  const [resumen, definirResumen] = React.useState("");

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

  if (!puedeGestionar) return null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {versionEditableId ? (
        <Boton tamano="pequeno" onClick={() => definirDialogoRevision(true)} disabled={procesando}>
          <Send /> Enviar a revisión
        </Boton>
      ) : null}

      {versionEnRevisionId ? (
        <Boton
          tamano="pequeno"
          disabled={procesando || revisionesPendientes > 0}
          title={
            revisionesPendientes > 0
              ? `Quedan ${revisionesPendientes} revisiones sin aprobar`
              : undefined
          }
          onClick={() => ejecutar(() => aprobarYPublicar(versionEnRevisionId))}
        >
          <CheckCircle2 /> Aprobar y publicar
        </Boton>
      ) : null}

      {estadoDocumento === "vigente" ? (
        <>
          <Boton
            tamano="pequeno"
            variante="contorno"
            disabled={procesando || !!versionEditableId || !!versionEnRevisionId}
            onClick={() => definirDialogoVersion(true)}
          >
            <FilePlus2 /> Nueva versión
          </Boton>
          <Boton
            tamano="pequeno"
            variante="contorno"
            disabled={procesando}
            onClick={() => ejecutar(() => confirmarRevisionSinCambios(documentoId))}
            title="Registra que el documento fue revisado y no requiere cambios"
          >
            <RefreshCw /> Revisado sin cambios
          </Boton>
        </>
      ) : null}

      {estadoDocumento !== "obsoleto" ? (
        <Boton
          tamano="pequeno"
          variante="fantasma"
          disabled={procesando}
          onClick={() => {
            if (confirm("¿Marcar el documento como obsoleto? Dejará de estar vigente.")) {
              ejecutar(() => marcarObsoleto(documentoId));
            }
          }}
        >
          <Archive /> Marcar obsoleto
        </Boton>
      ) : null}

      {/* Asignación de revisores */}
      <Dialogo open={dialogoRevision} onOpenChange={definirDialogoRevision}>
        <DialogoContenido>
          <DialogoCabecera>
            <DialogoTitulo>Enviar a revisión</DialogoTitulo>
            <DialogoDescripcion>
              Seleccione quiénes deben revisar esta versión. Recibirán una notificación en el
              sistema y por correo.
            </DialogoDescripcion>
          </DialogoCabecera>

          <div className="max-h-64 overflow-y-auto rounded-md border border-borde p-2">
            {personas.map((persona) => (
              <label
                key={persona.id}
                className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm
                           hover:bg-acento"
              >
                <input
                  type="checkbox"
                  className="size-4 accent-[#E01E37]"
                  checked={revisores.includes(persona.id)}
                  onChange={(evento) =>
                    definirRevisores((actuales) =>
                      evento.target.checked
                        ? [...actuales, persona.id]
                        : actuales.filter((id) => id !== persona.id),
                    )
                  }
                />
                {persona.nombre_completo}
              </label>
            ))}
          </div>

          <DialogoPie>
            <DialogoCierre asChild>
              <Boton variante="contorno">Cancelar</Boton>
            </DialogoCierre>
            <Boton
              disabled={procesando || revisores.length === 0 || !versionEditableId}
              onClick={() =>
                ejecutar(
                  () => enviarARevision(versionEditableId!, revisores),
                  () => {
                    definirDialogoRevision(false);
                    definirRevisores([]);
                  },
                )
              }
            >
              Enviar a {revisores.length || "…"} revisor{revisores.length === 1 ? "" : "es"}
            </Boton>
          </DialogoPie>
        </DialogoContenido>
      </Dialogo>

      {/* Nueva versión */}
      <Dialogo open={dialogoVersion} onOpenChange={definirDialogoVersion}>
        <DialogoContenido>
          <DialogoCabecera>
            <DialogoTitulo>Nueva versión</DialogoTitulo>
            <DialogoDescripcion>
              La versión vigente se mantiene en circulación hasta que la nueva sea aprobada.
            </DialogoDescripcion>
          </DialogoCabecera>

          <GrupoCampo
            etiqueta="Resumen de cambios"
            htmlFor="resumen"
            requerido
            ayuda="Queda registrado en el historial de versiones del documento."
          >
            <AreaTexto
              id="resumen"
              rows={3}
              value={resumen}
              onChange={(evento) => definirResumen(evento.target.value)}
              placeholder="Se incorpora el control de temperatura en la recepción."
            />
          </GrupoCampo>

          <DialogoPie>
            <DialogoCierre asChild>
              <Boton variante="contorno">Cancelar</Boton>
            </DialogoCierre>
            <Boton
              disabled={procesando || resumen.trim().length < 5}
              onClick={() =>
                ejecutar(
                  () => crearNuevaVersion(documentoId, resumen),
                  () => {
                    definirDialogoVersion(false);
                    definirResumen("");
                  },
                )
              }
            >
              Crear versión
            </Boton>
          </DialogoPie>
        </DialogoContenido>
      </Dialogo>
    </div>
  );
}
