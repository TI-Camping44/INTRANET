"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  CheckCircle2,
  FilePlus2,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, GrupoCampo, Seleccion } from "@/components/ui/campo";
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
  eliminarDocumento,
  enviarAValidacion,
  marcarObsoleto,
  validarDocumento,
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
  puedeEliminar,
  fechaValidacion,
}: {
  documentoId: string;
  estadoDocumento: EstadoDocumento;
  versionEditableId: string | null;
  versionEnRevisionId: string | null;
  revisionesPendientes: number;
  personas: Persona[];
  puedeGestionar: boolean;
  /** Solo el Administrador SGC puede eliminar. */
  puedeEliminar: boolean;
  /** Si ya se registró la validación del contenido. */
  fechaValidacion: string | null;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);
  const [dialogoRevision, definirDialogoRevision] = React.useState(false);
  const [dialogoVersion, definirDialogoVersion] = React.useState(false);
  const [validador, definirValidador] = React.useState("");
  const [aprobador, definirAprobador] = React.useState("");
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

      {/* Validar va antes de aprobar: sin la validación, el botón de
          aprobar se niega. */}
      {versionEnRevisionId && !fechaValidacion ? (
        <Boton
          tamano="pequeno"
          variante="contorno"
          cargando={procesando}
          onClick={() => ejecutar(() => validarDocumento(documentoId))}
          title="Registra que el contenido fue validado"
        >
          <ShieldCheck /> Validar contenido
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

      {/* Eliminar es para lo que no deberia haberse cargado: una prueba,
          un duplicado, un error. Retirar un documento que estuvo en uso
          es «Marcar obsoleto», que lo conserva con su historial. */}
      {puedeEliminar ? (
        <Boton
          variante="fantasma"
          cargando={procesando}
          className="text-semaforo-critico hover:bg-semaforo-critico/10"
          onClick={() => {
            const aviso =
              "Se elimina el documento, sus versiones, su lista de difusión y sus archivos. " +
              "No se puede deshacer.\n\n" +
              "Si el documento estuvo en uso, lo correcto es marcarlo obsoleto: así se conserva " +
              "con su historial, que es lo que pide la norma.\n\n¿Eliminar igual?";
            if (confirm(aviso)) {
              ejecutar(() => eliminarDocumento(documentoId), () => router.push("/documentos"));
            }
          }}
        >
          <Trash2 /> Eliminar
        </Boton>
      ) : null}

      {/* Validación y aprobación */}
      <Dialogo open={dialogoRevision} onOpenChange={definirDialogoRevision}>
        <DialogoContenido>
          <DialogoCabecera>
            <DialogoTitulo>Enviar a validar y aprobar</DialogoTitulo>
            <DialogoDescripcion>
              Dos personas: una valida el contenido y otra lo aprueba. Puede ser la misma en los
              dos lugares. Las dos reciben el aviso en el sistema y por correo.
            </DialogoDescripcion>
          </DialogoCabecera>

          <div className="mt-4 space-y-3">
            <GrupoCampo
              etiqueta="Valida el contenido"
              htmlFor="validador"
              requerido
              ayuda="Revisa que lo que dice el documento sea correcto."
            >
              <Seleccion
                id="validador"
                value={validador}
                onChange={(evento) => definirValidador(evento.target.value)}
              >
                <option value="" disabled>
                  Elija a la persona
                </option>
                {personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.nombre_completo}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>

            <GrupoCampo
              etiqueta="Aprueba"
              htmlFor="aprobador"
              requerido
              ayuda="Con su aprobación el documento queda vigente."
            >
              <Seleccion
                id="aprobador"
                value={aprobador}
                onChange={(evento) => definirAprobador(evento.target.value)}
              >
                <option value="" disabled>
                  Elija a la persona
                </option>
                {personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.nombre_completo}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>

            {validador && validador === aprobador ? (
              <p className="text-[11px] text-atenuado-contraste">
                La misma persona valida y aprueba. Está permitido: recibe un solo aviso y hace
                los dos pasos.
              </p>
            ) : null}
          </div>

          <DialogoPie>
            <DialogoCierre asChild>
              <Boton variante="contorno">Cancelar</Boton>
            </DialogoCierre>
            <Boton
              cargando={procesando}
              disabled={!validador || !aprobador || !versionEditableId}
              onClick={() =>
                ejecutar(
                  () => enviarAValidacion(versionEditableId!, validador, aprobador),
                  () => {
                    definirDialogoRevision(false);
                    definirValidador("");
                    definirAprobador("");
                  },
                )
              }
            >
              Enviar
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
