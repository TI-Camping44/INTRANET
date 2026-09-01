"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";
import { Boton } from "@/components/ui/boton";
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

  async function abrir(adjuntoId: string) {
    definirAbriendo(adjuntoId);
    const resultado = await enlaceDeArchivo(adjuntoId);
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

  return (
    <div className="space-y-3">
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
                onClick={() => abrir(archivo.id)}
                cargando={abriendo === archivo.id}
                aria-label={`Abrir ${archivo.nombre_archivo}`}
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
          <Boton
            variante="contorno"
            tamano="pequeno"
            cargando={subiendo}
            onClick={() => entrada.current?.click()}
          >
            <Upload /> Subir archivo
          </Boton>
          <p className="mt-2 text-[11px] leading-relaxed text-atenuado-contraste">
            {FORMATO_POR_TIPO[tipo].explicacion} Hasta 20 MB por archivo.
          </p>
        </div>
      ) : null}
    </div>
  );
}
