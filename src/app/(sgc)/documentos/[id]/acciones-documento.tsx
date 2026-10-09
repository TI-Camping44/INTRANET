"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Archive,
  Ban,
  CheckCircle2,
  FilePlus2,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
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
  anularDocumentos,
  aprobarYPublicar,
  confirmarRevisionSinCambios,
  eliminarDocumento,
  enviarAValidacion,
  marcarObsoleto,
  validarDocumento,
} from "@/app/(sgc)/documentos/acciones";
import { extensionesAdmitidas, FORMATO_POR_TIPO, motivoDeRechazo } from "@/lib/adjuntos";
import { ETIQUETAS_TIPO_DOCUMENTO, TIPOS_DOCUMENTO_VIGENTES } from "@/lib/constantes";
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
  empresas,
  manuales,
  categorias,
  cabecera,
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
  /** Las dos empresas del grupo, para poder cambiarla al versionar. */
  empresas: { id: string; nombre: string }[];
  /** Los manuales de proceso cargados, idem. */
  manuales: { id: string; codigo: string | null; titulo: string }[];
  /** Las categorías ya usadas, para ofrecerlas sin duplicarlas. */
  categorias: string[];
  /** Lo que el documento dice hoy, para mostrarlo como «Se mantiene igual». */
  cabecera: {
    codigo: string | null;
    titulo: string;
    categoria: string | null;
    empresa_documento_id: string | null;
    proceso_documento_id: string | null;
  };
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
  const [archivo, definirArchivo] = React.useState<File | null>(null);
  const [dialogoAnular, definirDialogoAnular] = React.useState(false);
  const [motivoAnulacion, definirMotivoAnulacion] = React.useState("");

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
    const motivo = motivoDeRechazo(tipoQueQueda, elegido.name, elegido.size);
    if (motivo) {
      toast.error(motivo);
      evento.target.value = "";
      definirArchivo(null);
      return;
    }

    definirArchivo(elegido);
  }

  // TODOS LOS CAMPOS SON OBLIGATORIOS, y «Se mantiene igual» es una de
  // las respuestas válidas. No es lo mismo que dejarlo vacío: obliga a
  // decidir campo por campo qué pasa con la cabecera, en vez de que lo
  // viejo se arrastre por descuido. Eso fue lo que pasó la primera vez
  // que se versionó: se cargó un archivo distinto y el nombre siguió
  // siendo el anterior.
  //
  // Los tres de texto llevan su propio desplegable —«Se mantiene igual»
  // o «Cambiar»— porque una caja vacía no distingue entre «no lo toco»
  // y «me olvidé de escribirlo».
  const IGUAL = "igual";

  const [nuevoTipo, definirNuevoTipo] = React.useState(IGUAL);
  const [nuevaEmpresa, definirNuevaEmpresa] = React.useState(IGUAL);
  const [nuevoProceso, definirNuevoProceso] = React.useState(IGUAL);

  const [modoCodigo, definirModoCodigo] = React.useState(IGUAL);
  const [modoCategoria, definirModoCategoria] = React.useState(IGUAL);
  const [modoTitulo, definirModoTitulo] = React.useState(IGUAL);

  const [nuevoCodigo, definirNuevoCodigo] = React.useState("");
  const [nuevaCategoria, definirNuevaCategoria] = React.useState("");
  const [nuevoTitulo, definirNuevoTitulo] = React.useState("");

  // Está listo cuando hay archivo y cada campo que se eligió cambiar
  // tiene su valor. El diálogo no es un formulario —el botón no hace
  // `submit`—, así que el control vive acá y no en el `required` del
  // navegador, que sin formulario no hace nada.
  const laVersionEstaLista =
    Boolean(archivo) &&
    (modoCodigo === IGUAL || nuevoCodigo.trim().length > 0) &&
    (modoCategoria === IGUAL || nuevaCategoria.trim().length > 0) &&
    (modoTitulo === IGUAL || nuevoTitulo.trim().length >= 4);

  // El formato admitido lo decide el tipo que va a quedar, no el que
  // tiene hoy: si la versión nueva cambia de tipo, cambia el formato.
  const tipoQueQueda = (nuevoTipo === IGUAL
    ? tipoDocumento
    : nuevoTipo) as typeof tipoDocumento;

  // Lo que el documento dice hoy, para que «Se mantiene igual» diga qué
  // es lo que se mantiene en vez de dejarlo adivinar.
  const empresaDeHoy = empresas.find(
    (empresa) => empresa.id === cabecera.empresa_documento_id,
  );
  const procesoDeHoy = manuales.find(
    (manual) => manual.id === cabecera.proceso_documento_id,
  );

  function limpiarLaVersion() {
    definirDialogoVersion(false);
    definirArchivo(null);
    definirModoCodigo(IGUAL);
    definirModoCategoria(IGUAL);
    definirModoTitulo(IGUAL);
    definirNuevoTipo(IGUAL);
    definirNuevaEmpresa(IGUAL);
    definirNuevoProceso(IGUAL);
    definirNuevoCodigo("");
    definirNuevaCategoria("");
    definirNuevoTitulo("");
  }

  async function subirLaSiguienteVersion() {
    const datos = new FormData();
    // «Se mantiene igual» no viaja: el servidor no toca lo que no llega.
    if (archivo) datos.set("archivo", archivo);
    if (nuevoTipo !== IGUAL) datos.set("tipo", nuevoTipo);
    if (nuevaEmpresa !== IGUAL) datos.set("empresa_documento_id", nuevaEmpresa);
    if (nuevoProceso !== IGUAL) datos.set("proceso_documento_id", nuevoProceso);
    if (modoCodigo !== IGUAL) datos.set("codigo", nuevoCodigo.trim());
    if (modoCategoria !== IGUAL) datos.set("categoria", nuevaCategoria.trim());
    if (modoTitulo !== IGUAL) datos.set("titulo", nuevoTitulo.trim());
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

      {/* ANULAR ES EL BORRADO DE UN OBSOLETO, sin borrarlo. Lo pidió
          Dirección el 9 de octubre: un documento que se retiró y que ya
          no se quiere ver en ninguna lista. Sale de todas —incluida la
          de obsoletos— y queda la ficha, el motivo, quién lo anuló y la
          bitácora, que es lo que una auditoría pide.

          Solo sobre un obsoleto: anular algo que todavía está en
          circulación sería retirarlo sin haberlo retirado. */}
      {puedeEliminar && estadoDocumento === "obsoleto" ? (
        <Boton
          tamano="pequeno"
          variante="contorno"
          disabled={procesando}
          onClick={() => definirDialogoAnular(true)}
          className="border-semaforo-critico/40 text-semaforo-critico
                     hover:bg-semaforo-critico/10"
        >
          <Ban /> Anular
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
              "No se puede deshacer: de él solo queda la bitácora.\n\n" +
              (estadoDocumento === "anulado"
                ? "El documento está anulado, con su motivo registrado.\n\n"
                : "Si estuvo en uso, el camino es marcarlo obsoleto y después anularlo con su " +
                  "motivo: así queda escrito por qué ya no está.\n\n") +
              "¿Eliminar igual?";
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

      {/* Anular */}
      <Dialogo open={dialogoAnular} onOpenChange={definirDialogoAnular}>
        <DialogoContenido>
          <DialogoCabecera>
            <DialogoTitulo>Anular el documento</DialogoTitulo>
            <DialogoDescripcion>
              Sale de todas las listas, incluida la de obsoletos. No se borra: la ficha, el
              motivo y la bitácora quedan, que es lo que una auditoría pide ver.
            </DialogoDescripcion>
          </DialogoCabecera>

          <GrupoCampo
            etiqueta="Motivo de la anulación"
            htmlFor="motivo-anulacion"
            requerido
            ayuda="Es lo que explica, dentro de un año, por qué ese documento ya no está."
          >
            <AreaTexto
              id="motivo-anulacion"
              rows={3}
              value={motivoAnulacion}
              onChange={(evento) => definirMotivoAnulacion(evento.target.value)}
              placeholder="Reemplazado por el MP-SOP-01 de la versión 01 del mapa de procesos."
            />
          </GrupoCampo>

          <DialogoPie>
            <DialogoCierre asChild>
              <Boton variante="contorno">Cancelar</Boton>
            </DialogoCierre>
            <Boton
              cargando={procesando}
              disabled={motivoAnulacion.trim().length < 10}
              className="bg-semaforo-critico hover:bg-semaforo-critico/90"
              onClick={() =>
                ejecutar(
                  () => anularDocumentos([documentoId], motivoAnulacion),
                  () => {
                    // SE QUEDA EN LA FICHA. Un anulado no sale en
                    // ninguna lista, así que volver al listado lo dejaba
                    // sin forma de llegar, y el paso siguiente —borrarlo—
                    // se hace justo acá.
                    definirDialogoAnular(false);
                    definirMotivoAnulacion("");
                  },
                )
              }
            >
              Anular
            </Boton>
          </DialogoPie>
        </DialogoContenido>
      </Dialogo>

      {/* Actualizar a la siguiente versión */}
      <Dialogo open={dialogoVersion} onOpenChange={definirDialogoVersion}>
        <DialogoContenido className="max-w-2xl">
          <DialogoCabecera>
            <DialogoTitulo>
              Actualizar a {etiquetaSiguiente}
            </DialogoTitulo>
            <DialogoDescripcion>
              Suba el archivo nuevo. {etiquetaActual} queda obsoleta —se conserva con su archivo
              y sus firmas, y se ve en la pestaña «Obsoletos»— y el documento pasa a{" "}
              {etiquetaSiguiente}, para validarse y aprobarse como cualquier versión.
            </DialogoDescripcion>
          </DialogoCabecera>

          <div className="mt-4 max-h-[65vh] space-y-3 overflow-y-auto pr-1">
            <GrupoCampo
              etiqueta="Archivo de la versión nueva"
              htmlFor="archivo-version"
              requerido
              ayuda={FORMATO_POR_TIPO[tipoQueQueda].explicacion}
            >
              <input
                id="archivo-version"
                type="file"
                accept={extensionesAdmitidas(tipoQueQueda)}
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

            {/* LA CABECERA, SOLO SI CAMBIA. Una versión nueva no siempre
                es el mismo documento con otro contenido: puede cambiarle
                el código, el nombre o hasta la empresa. Hasta ahora el
                nombre viejo quedaba pegado al archivo nuevo.

                Cada campo arranca en «Se mantiene igual» y lo que se
                deja así no viaja: el servidor no toca lo que no llega. */}
            <p className="border-t border-borde pt-3 text-[11px] text-atenuado-contraste">
              Los seis campos son obligatorios, y «Se mantiene igual» es una respuesta válida:
              se contesta uno por uno qué pasa con la cabecera.
            </p>

            <div className="grid gap-3 sm:grid-cols-2">
              <GrupoCampo etiqueta="Tipo de documento" htmlFor="tipo-version" requerido>
                <Seleccion
                  id="tipo-version"
                  value={nuevoTipo}
                  onChange={(evento) => definirNuevoTipo(evento.target.value)}
                >
                  <option value={IGUAL}>
                    Se mantiene igual ({ETIQUETAS_TIPO_DOCUMENTO[tipoDocumento]})
                  </option>
                  {TIPOS_DOCUMENTO_VIGENTES.map((valor) => (
                    <option key={valor} value={valor}>
                      {ETIQUETAS_TIPO_DOCUMENTO[valor]}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>

              <GrupoCampo etiqueta="Empresa" htmlFor="empresa-version" requerido>
                <Seleccion
                  id="empresa-version"
                  value={nuevaEmpresa}
                  onChange={(evento) => definirNuevaEmpresa(evento.target.value)}
                >
                  <option value={IGUAL}>
                    Se mantiene igual
                    {empresaDeHoy ? ` (${empresaDeHoy.nombre})` : ""}
                  </option>
                  {empresas.map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.nombre}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Código controlado"
                htmlFor="codigo-version"
                requerido
                ayuda={
                  modoCodigo === IGUAL
                    ? undefined
                    : "Escríbalo conforme al documento original."
                }
              >
                <Seleccion
                  id="codigo-version"
                  value={modoCodigo}
                  onChange={(evento) => definirModoCodigo(evento.target.value)}
                >
                  <option value={IGUAL}>
                    Se mantiene igual{cabecera.codigo ? ` (${cabecera.codigo})` : " (sin código)"}
                  </option>
                  <option value="cambiar">Cambiar</option>
                </Seleccion>
                {modoCodigo === IGUAL ? null : (
                  <Entrada
                    value={nuevoCodigo}
                    onChange={(evento) => definirNuevoCodigo(evento.target.value.toUpperCase())}
                    placeholder="MP-SOP-01"
                    aria-label="Código controlado nuevo"
                    className="mt-1.5 tabular"
                  />
                )}
              </GrupoCampo>

              <GrupoCampo etiqueta="Categoría" htmlFor="categoria-version" requerido>
                <Seleccion
                  id="categoria-version"
                  value={modoCategoria}
                  onChange={(evento) => definirModoCategoria(evento.target.value)}
                >
                  <option value={IGUAL}>
                    Se mantiene igual
                    {cabecera.categoria ? ` (${cabecera.categoria})` : " (sin categoría)"}
                  </option>
                  <option value="cambiar">Cambiar</option>
                </Seleccion>
                {modoCategoria === IGUAL ? null : (
                  <>
                    <Entrada
                      list="categorias-de-la-version"
                      value={nuevaCategoria}
                      onChange={(evento) => definirNuevaCategoria(evento.target.value)}
                      placeholder="Políticas"
                      aria-label="Categoría nueva"
                      className="mt-1.5"
                    />
                    <datalist id="categorias-de-la-version">
                      {categorias.map((nombre) => (
                        <option key={nombre} value={nombre} />
                      ))}
                    </datalist>
                  </>
                )}
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Proceso al que pertenece"
                htmlFor="proceso-version"
                className="sm:col-span-2"
                requerido
              >
                <Seleccion
                  id="proceso-version"
                  value={nuevoProceso}
                  onChange={(evento) => definirNuevoProceso(evento.target.value)}
                  disabled={manuales.length === 0}
                >
                  <option value={IGUAL}>
                    Se mantiene igual
                    {procesoDeHoy ? ` (${procesoDeHoy.titulo})` : ""}
                  </option>
                  {manuales
                    .filter((manual) => manual.id !== documentoId)
                    .map((manual) => (
                      <option key={manual.id} value={manual.id}>
                        {manual.codigo ? `${manual.codigo} · ` : ""}
                        {manual.titulo}
                      </option>
                    ))}
                </Seleccion>
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Título"
                htmlFor="titulo-version"
                className="sm:col-span-2"
                requerido
                ayuda={modoTitulo === IGUAL ? undefined : "Al menos 4 caracteres."}
              >
                <Seleccion
                  id="titulo-version"
                  value={modoTitulo}
                  onChange={(evento) => definirModoTitulo(evento.target.value)}
                >
                  <option value={IGUAL}>Se mantiene igual ({cabecera.titulo})</option>
                  <option value="cambiar">Cambiar</option>
                </Seleccion>
                {modoTitulo === IGUAL ? null : (
                  <Entrada
                    value={nuevoTitulo}
                    onChange={(evento) => definirNuevoTitulo(evento.target.value)}
                    placeholder="Manual de recepción de mercadería"
                    aria-label="Título nuevo"
                    className="mt-1.5"
                  />
                )}
              </GrupoCampo>
            </div>
          </div>

          <DialogoPie>
            <DialogoCierre asChild>
              <Boton variante="contorno">Cancelar</Boton>
            </DialogoCierre>
            <Boton
              cargando={procesando}
              disabled={!laVersionEstaLista}
              onClick={() => ejecutar(subirLaSiguienteVersion, limpiarLaVersion)}
            >
              Actualizar a {etiquetaSiguiente}
            </Boton>
          </DialogoPie>
        </DialogoContenido>
      </Dialogo>
    </div>
  );
}
