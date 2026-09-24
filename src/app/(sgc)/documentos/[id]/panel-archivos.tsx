"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Eye, Paperclip, Trash2, Upload } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { VisorPdf } from "@/components/comunes/visor-pdf";
import {
  Dialogo,
  DialogoCabecera,
  DialogoContenido,
  DialogoTitulo,
} from "@/components/ui/dialogo";
import { GuardarEnDrive } from "@/components/comunes/guardar-en-drive";
import { SelectorDrive } from "@/components/comunes/selector-drive";
import {
  eliminarArchivoDocumento,
  enlaceDeArchivo,
  subirArchivoDocumento,
} from "@/app/(sgc)/documentos/acciones";
import {
  describirTamano,
  extensionesAdmitidas,
  FORMATO_POR_TIPO,
  motivoDeRechazo,
} from "@/lib/adjuntos";
import { formatearFechaHora } from "@/lib/formato";
import type { TipoDocumento } from "@/lib/tipos";

export interface ArchivoAdjunto {
  id: string;
  nombre_archivo: string;
  tamano_bytes: number;
  creado_en: string;
  subido: { nombre_completo: string } | null;
}

/**
 * Los archivos del documento.
 *
 * El bucket es privado: ninguna direccion sirve por si sola. Para abrir
 * un archivo se pide un enlace firmado que dura cinco minutos, y recien
 * ahi se navega. Es un paso mas, y es a proposito: un enlace permanente
 * a un procedimiento interno se termina pegando en un chat.
 */
export function PanelArchivos({
  documentoId,
  tipo,
  archivos,
  puedeGestionar,
}: {
  documentoId: string;
  tipo: TipoDocumento;
  archivos: ArchivoAdjunto[];
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const entrada = React.useRef<HTMLInputElement>(null);
  const [subiendo, definirSubiendo] = React.useState(false);
  const [abriendo, definirAbriendo] = React.useState<string | null>(null);
  // El archivo que se está mirando en la ventana, con su enlace firmado.
  const [mirando, definirMirando] = React.useState<{
    nombre: string;
    url: string;
    id: string;
  } | null>(null);

  async function subir(archivo: File) {
    // El control de verdad esta en la accion de servidor. Este es para
    // no hacerle esperar una subida de 20 MB a alguien que eligio mal.
    const motivo = motivoDeRechazo(tipo, archivo.name, archivo.size);
    if (motivo) {
      toast.error(motivo);
      return;
    }

    definirSubiendo(true);
    const datos = new FormData();
    datos.set("archivo", archivo);
    const resultado = await subirArchivoDocumento(documentoId, datos);
    definirSubiendo(false);
    if (entrada.current) entrada.current.value = "";

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Archivo subido.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  /**
   * Abre el archivo en una ventana dentro de la intranet.
   *
   * Antes se abría en una pestaña nueva y la persona quedaba fuera del
   * sistema, con una dirección firmada a la vista. Ahora se muestra acá
   * y desde la misma ventana se descarga.
   *
   * El enlace para mirar va sin la marca de descarga: es el mismo objeto
   * y el mismo permiso, lo único que cambia es la cabecera con la que
   * Storage lo entrega. Dura cinco minutos, como antes.
   */
  function mirar(adjuntoId: string, nombre: string) {
    // El archivo se pide a una dirección de la intranet que lo entrega
    // con la cabecera «inline». El enlace firmado de Storage no sirve
    // para mostrar: el navegador lo toma como descarga y dibuja su
    // propio cuadro con un botón «Abrir» en vez del documento.
    definirMirando({
      nombre,
      url: `/documentos/${documentoId}/archivo/contenido?adjunto=${adjuntoId}`,
      id: adjuntoId,
    });
  }

  async function descargar(adjuntoId: string) {
    definirAbriendo(adjuntoId);
    const resultado = await enlaceDeArchivo(adjuntoId, true);
    definirAbriendo(null);

    if (resultado.exito && resultado.mensaje) {
      window.open(resultado.mensaje, "_blank", "noopener,noreferrer");
    } else if (!resultado.exito) {
      toast.error(resultado.error);
    }
  }

  async function eliminar(adjuntoId: string) {
    const resultado = await eliminarArchivoDocumento(adjuntoId, documentoId);
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Archivo eliminado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  const visor = mirando ? (
    <Dialogo open onOpenChange={() => definirMirando(null)}>
      <DialogoContenido className="max-w-5xl">
        <DialogoCabecera>
          <DialogoTitulo className="truncate pr-4">{mirando.nombre}</DialogoTitulo>
        </DialogoCabecera>

        {/* El PDF lo dibuja el visor propio y no un marco: Chrome puede
            estar configurado para descargar los PDF en vez de abrirlos, y
            ahí el marco muestra un recuadro gris en lugar del documento.
            Las imágenes se muestran tal cual; lo demás —Word, una
            planilla— el navegador no lo sabe dibujar, así que en vez de
            un cuadro en blanco se ofrece la descarga. */}
        {/^.+\.pdf$/i.test(mirando.nombre) ? (
          <div className="max-h-[70vh] overflow-y-auto">
            <VisorPdf url={mirando.url} nombre={mirando.nombre} />
          </div>
        ) : /^.+\.(png|jpe?g|webp|gif|svg)$/i.test(mirando.nombre) ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={mirando.url}
            alt={mirando.nombre}
            className="mx-auto max-h-[70vh] w-auto max-w-full rounded-md border border-borde"
          />
        ) : (
          <p className="py-8 text-center text-xs text-atenuado-contraste">
            Este formato no se puede ver en el navegador. Descárguelo para abrirlo.
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Boton variante="contorno" onClick={() => definirMirando(null)}>
            Cerrar
          </Boton>
          <GuardarEnDrive url={mirando.url} nombre={mirando.nombre} />
          <Boton onClick={() => descargar(mirando.id)}>
            <Download /> Descargar
          </Boton>
        </div>
      </DialogoContenido>
    </Dialogo>
  ) : null;

  return (
    <div className="space-y-3">
      {visor}
      {archivos.length === 0 ? (
        <p className="text-xs text-atenuado-contraste">
          Todavía no hay ningún archivo cargado.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {archivos.map((archivo) => (
            <li
              key={archivo.id}
              className="flex items-center gap-2 rounded-md border border-borde px-3 py-2"
            >
              <Paperclip className="size-3.5 shrink-0 text-atenuado-contraste" aria-hidden />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{archivo.nombre_archivo}</p>
                <p className="text-[10px] text-atenuado-contraste">
                  {describirTamano(archivo.tamano_bytes)} ·{" "}
                  {archivo.subido?.nombre_completo ?? "—"} ·{" "}
                  {formatearFechaHora(archivo.creado_en)}
                </p>
              </div>
              <Boton
                variante="fantasma"
                tamano="pequeno"
                onClick={() => mirar(archivo.id, archivo.nombre_archivo)}
                aria-label={`Ver ${archivo.nombre_archivo}`}
                title="Ver el archivo"
              >
                <Eye />
              </Boton>
              <Boton
                variante="fantasma"
                tamano="pequeno"
                onClick={() => descargar(archivo.id)}
                aria-label={`Descargar ${archivo.nombre_archivo}`}
                title="Descargar"
              >
                <Download />
              </Boton>
              {puedeGestionar ? (
                <button
                  type="button"
                  onClick={() => eliminar(archivo.id)}
                  className="text-atenuado-contraste transition-colors hover:text-semaforo-critico"
                  aria-label={`Eliminar ${archivo.nombre_archivo}`}
                >
                  <Trash2 className="size-3.5" />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {puedeGestionar ? (
        <div className="border-t border-borde pt-3">
          <input
            ref={entrada}
            type="file"
            className="sr-only"
            accept={extensionesAdmitidas(tipo)}
            onChange={(evento) => {
              const archivo = evento.target.files?.[0];
              if (archivo) subir(archivo);
            }}
          />
          <div className="flex flex-wrap gap-2">
            {/* Los dos orígenes terminan en la misma función: el archivo
                pasa por las mismas validaciones venga de donde venga. */}
            <SelectorDrive tipoDocumento={tipo} onElegir={subir} deshabilitado={subiendo} />
            <Boton
              variante="contorno"
              tamano="pequeno"
              cargando={subiendo}
              onClick={() => entrada.current?.click()}
            >
              <Upload /> Desde la computadora
            </Boton>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-atenuado-contraste">
            {FORMATO_POR_TIPO[tipo].explicacion} Hasta 20 MB por archivo. Los documentos y
            planillas de Google se convierten al elegirlos.
          </p>
        </div>
      ) : null}
    </div>
  );
}
