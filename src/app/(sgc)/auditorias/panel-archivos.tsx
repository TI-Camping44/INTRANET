"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Paperclip, Trash2, Upload } from "lucide-react";

import { Boton } from "@/components/ui/boton";
import { Entrada, GrupoCampo } from "@/components/ui/campo";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import {
  adjuntarArchivosAuditoria,
  adjuntarArchivosPrograma,
  eliminarAdjuntoAuditoria,
  eliminarAdjuntoPrograma,
} from "@/app/(sgc)/auditorias/acciones";
import { describirTamano } from "@/lib/adjuntos";
import { formatearFecha } from "@/lib/formato";

export interface ArchivoDeAuditoria {
  id: string;
  nombre_archivo: string;
  tamano_bytes: number;
  descripcion: string | null;
  creado_en: string;
  autor: { nombre_completo: string } | null;
}

/**
 * Los PDF del plan de auditoría o del programa anual.
 *
 * El plan y el programa existen en papel antes que en el sistema: se
 * redactan, se firman y se archivan. Sin dónde ponerlos, el PDF firmado
 * queda en el Drive de quien lo armó, y la auditoría de certificación
 * pide justamente ese archivo.
 *
 * SOLO PDF. Lo pidió Dirección el 8 de octubre: es un documento firmado
 * que se entrega como está, no un archivo que se sigue editando. El
 * `accept` del campo es comodidad; el control de verdad está en la
 * acción de servidor.
 *
 * EL ENLACE NO SE DIBUJA EN LA PÁGINA. Cada archivo apunta a
 * `/adjuntos/<id>`, y esa ruta firma el enlace recién en el clic, con la
 * sesión de la persona y por cinco minutos. Poner el enlace firmado en
 * el HTML dejaría enlaces vivos a archivos privados en la caché del
 * navegador.
 */
export function PanelArchivosAuditoria({
  entidad,
  entidadId,
  archivos,
  puedeGestionar,
  titulo = "Archivos",
  ayuda,
}: {
  entidad: "auditoria" | "programa";
  entidadId: string;
  archivos: ArchivoDeAuditoria[];
  puedeGestionar: boolean;
  titulo?: string;
  ayuda?: string;
}) {
  const router = useRouter();
  const formulario = React.useRef<HTMLFormElement>(null);
  const [subiendo, definirSubiendo] = React.useState(false);
  const [borrando, definirBorrando] = React.useState<string | null>(null);

  async function subir(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);

    definirSubiendo(true);
    const respuesta =
      entidad === "auditoria"
        ? await adjuntarArchivosAuditoria(entidadId, datos)
        : await adjuntarArchivosPrograma(entidadId, datos);
    definirSubiendo(false);

    if (respuesta.exito) {
      toast.success(respuesta.mensaje ?? "Archivo adjuntado.");
      formulario.current?.reset();
      router.refresh();
    } else {
      toast.error(respuesta.error);
    }
  }

  async function quitar(archivo: ArchivoDeAuditoria) {
    if (!confirm(`¿Quitar «${archivo.nombre_archivo}»? No se puede deshacer.`)) return;

    definirBorrando(archivo.id);
    const respuesta =
      entidad === "auditoria"
        ? await eliminarAdjuntoAuditoria(archivo.id, entidadId)
        : await eliminarAdjuntoPrograma(archivo.id, entidadId);
    definirBorrando(null);

    if (respuesta.exito) {
      toast.success(respuesta.mensaje ?? "Archivo eliminado.");
      router.refresh();
    } else {
      toast.error(respuesta.error);
    }
  }

  return (
    <Tarjeta>
      <TarjetaCabecera>
        <TarjetaTitulo>{titulo}</TarjetaTitulo>
      </TarjetaCabecera>
      <TarjetaContenido className="space-y-3">
        {archivos.length === 0 ? (
          <p className="text-xs leading-relaxed text-atenuado-contraste">
            {ayuda ?? "Todavía no hay archivos."}
          </p>
        ) : (
          <ul className="divide-y divide-borde">
            {archivos.map((archivo) => (
              <li key={archivo.id} className="flex items-start gap-2 py-2 first:pt-0">
                <a
                  href={`/adjuntos/${archivo.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-start gap-2 hover:underline"
                >
                  <Paperclip className="mt-0.5 size-3.5 shrink-0 text-atenuado-contraste" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">
                      {archivo.nombre_archivo}
                    </span>
                    <span className="block text-[11px] text-atenuado-contraste">
                      {describirTamano(archivo.tamano_bytes)}
                      {archivo.autor ? ` · ${archivo.autor.nombre_completo}` : ""}
                      {` · ${formatearFecha(archivo.creado_en)}`}
                    </span>
                    {archivo.descripcion ? (
                      <span className="block text-[11px] leading-relaxed text-atenuado-contraste">
                        {archivo.descripcion}
                      </span>
                    ) : null}
                  </span>
                </a>

                {puedeGestionar ? (
                  <Boton
                    tamano="iconoPequeno"
                    variante="fantasma"
                    aria-label={`Quitar ${archivo.nombre_archivo}`}
                    cargando={borrando === archivo.id}
                    onClick={() => quitar(archivo)}
                    className="text-atenuado-contraste hover:text-semaforo-critico"
                  >
                    <Trash2 />
                  </Boton>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {puedeGestionar ? (
          <form ref={formulario} onSubmit={subir} className="space-y-2 border-t border-borde pt-3">
            <GrupoCampo
              etiqueta="Adjuntar PDF"
              htmlFor={`archivos-${entidadId}`}
              ayuda="Solo PDF, hasta 20 MB cada uno. Puede elegir varios."
            >
              <Entrada
                id={`archivos-${entidadId}`}
                name="archivos"
                type="file"
                accept="application/pdf,.pdf"
                multiple
                required
              />
            </GrupoCampo>

            <GrupoCampo etiqueta="Descripción" htmlFor={`descripcion-${entidadId}`}>
              <Entrada
                id={`descripcion-${entidadId}`}
                name="descripcion"
                placeholder="Plan firmado, versión final…"
              />
            </GrupoCampo>

            <Boton type="submit" tamano="pequeno" cargando={subiendo}>
              <Upload /> Adjuntar
            </Boton>
          </form>
        ) : null}
      </TarjetaContenido>
    </Tarjeta>
  );
}
