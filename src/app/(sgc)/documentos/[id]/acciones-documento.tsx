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
  actualizarALaSiguienteVersion,
  aprobarYPublicar,
  confirmarRevisionSinCambios,
  eliminarDocumento,
  enviarAValidacion,
  marcarObsoleto,
  validarDocumento,
} from "@/app/(sgc)/documentos/acciones";
import { extensionesAdmitidas, FORMATO_POR_TIPO, motivoDeRechazo } from "@/lib/adjuntos";
import type { EstadoDocumento, ResultadoAccion, TipoDocumento } from "@/lib/tipos";

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
  tipoDocumento,
  versionActual,
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
  /** Decide qué formato admite el archivo de la versión nueva. */
  tipoDocumento: TipoDocumento;
  /** La versión que rige hoy: la siguiente es esta más uno. */
  versionActual: number;
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
  const [archivo, definirArchivo] = React.useState<File | null>(null);

  const etiquetaActual = `Ver.${String(versionActual).padStart(2, "0")}`;
  const etiquetaSiguiente = `Ver.${String(versionActual + 1).padStart(2, "0")}`;

  function elegirArchivo(evento: React.ChangeEvent<HTMLInputElement>) {
    const elegido = evento.target.files?.[0] ?? null;
    if (!elegido) {
      definirArchivo(null);
      return;
    }

    // Se avisa acá para no hacerle esperar la subida de un archivo que la
    // acción va a rechazar igual. El control que vale es el del servidor.
    const motivo = motivoDeRechazo(tipoDocumento, elegido.name, elegido.size);
    if (motivo) {
      toast.error(motivo);
      evento.target.value = "";
      definirArchivo(null);
      return;
    }

    definirArchivo(elegido);
  }

  async function subirLaSiguienteVersion() {
    const datos = new FormData();
    datos.set("resumen_cambios", resumen);
    if (archivo) datos.set("archivo", archivo);
    return actualizarALaSiguienteVersion(documentoId, datos);
  }

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

      {/* ACTUALIZAR A LA SIGUIENTE VERSIÓN. Está siempre, no solo sobre
          un documento vigente: lo que reemplaza es borrar el documento
          anterior y volver a cargarlo, y eso se hacía en cualquier
          estado. */}
      {estadoDocumento !== "obsoleto" ? (
        <Boton
          tamano="pequeno"
          variante="contorno"
          disabled={procesando}
          onClick={() => definirDialogoVersion(true)}
          title={`Pasa el documento de ${etiquetaActual} a ${etiquetaSiguiente} con un archivo nuevo`}
        >
          <FilePlus2 /> Actualizar a la siguiente versión
        </Boton>
      ) : null}

      {estadoDocumento === "vigente" ? (
        <>
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
              Dos personas distintas: una valida el contenido y la otra lo aprueba. Primero se
              valida y después se aprueba; sin la validación, la aprobación se niega. Las dos
              reciben el aviso en el sistema y por correo.
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
              <p className="text-[11px] text-semaforo-critico">
                No puede ser la misma persona en los dos lugares: quien valida no aprueba.
              </p>
            ) : null}
          </div>

          <DialogoPie>
            <DialogoCierre asChild>
              <Boton variante="contorno">Cancelar</Boton>
            </DialogoCierre>
            <Boton
              cargando={procesando}
              disabled={
                !validador || !aprobador || validador === aprobador || !versionEditableId
              }
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

      {/* Actualizar a la siguiente versión */}
      <Dialogo open={dialogoVersion} onOpenChange={definirDialogoVersion}>
        <DialogoContenido>
          <DialogoCabecera>
            <DialogoTitulo>
              Actualizar a {etiquetaSiguiente}
            </DialogoTitulo>
            <DialogoDescripcion>
              Suba el archivo nuevo y diga qué cambió. {etiquetaActual} queda obsoleta —se
              conserva con su archivo y sus firmas— y el documento pasa a {etiquetaSiguiente} en
              borrador, para validarse y aprobarse como cualquier versión.
            </DialogoDescripcion>
          </DialogoCabecera>

          <div className="mt-4 space-y-3">
            <GrupoCampo
              etiqueta="Archivo de la versión nueva"
              htmlFor="archivo-version"
              ayuda={FORMATO_POR_TIPO[tipoDocumento].explicacion}
            >
              <input
                id="archivo-version"
                type="file"
                accept={extensionesAdmitidas(tipoDocumento)}
                onChange={elegirArchivo}
                className="w-full cursor-pointer rounded-md border border-borde bg-fondo
                           text-xs text-texto file:mr-3 file:cursor-pointer file:border-0
                           file:bg-acento file:px-3 file:py-2 file:text-xs file:font-medium
                           file:text-texto"
              />
              {archivo ? (
                <p className="mt-1.5 text-[11px] text-atenuado-contraste">
                  Se va a subir <span className="font-medium text-texto">{archivo.name}</span>.
                </p>
              ) : null}
            </GrupoCampo>

            <GrupoCampo
              etiqueta="Qué cambió"
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
          </div>

          <DialogoPie>
            <DialogoCierre asChild>
              <Boton variante="contorno">Cancelar</Boton>
            </DialogoCierre>
            <Boton
              cargando={procesando}
              disabled={resumen.trim().length < 5}
              onClick={() =>
                ejecutar(subirLaSiguienteVersion, () => {
                  definirDialogoVersion(false);
                  definirResumen("");
                  definirArchivo(null);
                })
              }
            >
              Actualizar a {etiquetaSiguiente}
            </Boton>
          </DialogoPie>
        </DialogoContenido>
      </Dialogo>
    </div>
  );
}
