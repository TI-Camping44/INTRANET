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
  adjuntarArchivosNoConformidad,
  eliminarAdjuntoNoConformidad,
} from "@/app/(sgc)/no-conformidades/acciones";
import { ACEPTA_EVIDENCIA, describirTamano, TAMANO_MAXIMO_ADJUNTO } from "@/lib/adjuntos";
import { formatearFecha } from "@/lib/formato";

export interface AdjuntoDeNoConformidad {
  id: string;
  nombre_archivo: string;
  tamano_bytes: number;
  descripcion: string | null;
  creado_en: string;
  autor: { nombre_completo: string } | null;
}

/**
 * Los archivos de la no conformidad.
 *
 * Lo que sostiene una desviación ante una auditoría suele ser un archivo:
 * la foto del producto fallado, el remito firmado, el correo del cliente.
 * Acá se suben y acá se abren.
 *
 * EL ENLACE NO SE DIBUJA EN LA PÁGINA. Cada archivo apunta a
 * `/adjuntos/<id>`, y esa ruta firma el enlace recién en el clic, con la
 * sesión de la persona y por cinco minutos. Poner el enlace firmado en el
 * HTML dejaría enlaces vivos a archivos privados en la caché del
 * navegador.
 */
export function PanelAdjuntos({
  noConformidadId,
  adjuntos,
  puedeSubir,
}: {
  noConformidadId: string;
  adjuntos: AdjuntoDeNoConformidad[];
  puedeSubir: boolean;
}) {
  const router = useRouter();
  const formulario = React.useRef<HTMLFormElement>(null);
  const [subiendo, definirSubiendo] = React.useState(false);
  const [borrando, definirBorrando] = React.useState<string | null>(null);
  const [elegidos, definirElegidos] = React.useState(0);

  async function subir(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirSubiendo(true);

    const respuesta = await adjuntarArchivosNoConformidad(
      noConformidadId,
      new FormData(evento.currentTarget),
    );
    definirSubiendo(false);

    if (respuesta.exito) {
      toast.success(respuesta.mensaje ?? "Archivo adjuntado.");
      formulario.current?.reset();
      definirElegidos(0);
      router.refresh();
    } else {
      toast.error(respuesta.error);
    }
  }

  async function quitar(adjunto: AdjuntoDeNoConformidad) {
    if (!confirm(`¿Quitar «${adjunto.nombre_archivo}»? No se puede deshacer.`)) return;

    definirBorrando(adjunto.id);
    const respuesta = await eliminarAdjuntoNoConformidad(adjunto.id, noConformidadId);
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
        <TarjetaTitulo>Archivos</TarjetaTitulo>
      </TarjetaCabecera>
      <TarjetaContenido className="space-y-3">
        {adjuntos.length === 0 ? (
          <p className="text-xs leading-relaxed text-atenuado-contraste">
            Todavía no hay archivos. Acá va la evidencia: la foto del producto, el remito, la
            captura del sistema, el correo del cliente.
          </p>
        ) : (
          <ul className="divide-y divide-borde">
            {adjuntos.map((adjunto) => (
              <li key={adjunto.id} className="flex items-start gap-2 py-2 first:pt-0">
                {/* El enlace firmado se genera en el clic, en /adjuntos/[id]. */}
                <a
                  href={`/adjuntos/${adjunto.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-start gap-2 hover:underline"
                >
                  <Paperclip className="mt-0.5 size-3.5 shrink-0 text-atenuado-contraste" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">
                      {adjunto.nombre_archivo}
                    </span>
                    <span className="block text-[11px] text-atenuado-contraste">
                      {describirTamano(adjunto.tamano_bytes)}
                      {adjunto.autor ? ` · ${adjunto.autor.nombre_completo}` : ""}
                      {` · ${formatearFecha(adjunto.creado_en)}`}
                    </span>
                    {adjunto.descripcion ? (
                      <span className="block text-[11px] leading-relaxed text-atenuado-contraste">
                        {adjunto.descripcion}
                      </span>
                    ) : null}
                  </span>
                </a>

                {puedeSubir ? (
                  <Boton
                    tamano="iconoPequeno"
                    variante="fantasma"
                    aria-label={`Quitar ${adjunto.nombre_archivo}`}
                    cargando={borrando === adjunto.id}
                    onClick={() => quitar(adjunto)}
                    className="text-atenuado-contraste hover:text-semaforo-critico"
                  >
                    <Trash2 />
                  </Boton>
                ) : null}
              </li>
            ))}
          </ul>
        )}

        {puedeSubir ? (
          <form ref={formulario} onSubmit={subir} className="space-y-3 border-t border-borde pt-3">
            <GrupoCampo
              etiqueta="Agregar archivos"
              htmlFor="archivos"
              ayuda={`PDF, imágenes y archivos de Office. Hasta ${describirTamano(
                TAMANO_MAXIMO_ADJUNTO,
              )} por archivo. Se pueden elegir varios a la vez.`}
            >
              <input
                id="archivos"
                name="archivos"
                type="file"
                multiple
                accept={ACEPTA_EVIDENCIA}
                onChange={(evento) => definirElegidos(evento.target.files?.length ?? 0)}
                className="block w-full cursor-pointer rounded-md border border-borde bg-fondo
                           text-xs text-texto file:mr-3 file:cursor-pointer file:border-0
                           file:bg-acento file:px-3 file:py-2 file:text-xs file:font-medium
                           file:text-texto"
              />
            </GrupoCampo>

            <GrupoCampo
              etiqueta="Qué es (opcional)"
              htmlFor="descripcion"
              ayuda="Sirve para que dentro de un año se sepa qué mira uno al abrirlo."
            >
              <Entrada
                id="descripcion"
                name="descripcion"
                maxLength={200}
                placeholder="Foto del lote con la etiqueta cambiada"
              />
            </GrupoCampo>

            <div className="flex justify-end">
              <Boton type="submit" tamano="pequeno" cargando={subiendo}>
                <Upload />
                {elegidos > 1 ? `Subir ${elegidos} archivos` : "Subir"}
              </Boton>
            </div>
          </form>
        ) : null}
      </TarjetaContenido>
    </Tarjeta>
  );
}
