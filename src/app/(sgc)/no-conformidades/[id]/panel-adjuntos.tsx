"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Paperclip, Trash2 } from "lucide-react";

import { Boton } from "@/components/ui/boton";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { eliminarAdjuntoNoConformidad } from "@/app/(sgc)/no-conformidades/acciones";
import { describirTamano } from "@/lib/adjuntos";
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
 * Acá se abren. SUBIR NO SE SUBE DESDE ACA: la evidencia se adjunta en
 * el formulario, al registrar la desviación o al editarla, que es cuando
 * la persona tiene el archivo en la mano. Lo pidió Calidad el 5 de
 * octubre y evita la pantalla intermedia de antes: guardar primero y
 * volver a entrar a cargar los archivos.
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
  puedeQuitar,
}: {
  noConformidadId: string;
  adjuntos: AdjuntoDeNoConformidad[];
  puedeQuitar: boolean;
}) {
  const router = useRouter();
  const [borrando, definirBorrando] = React.useState<string | null>(null);

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
            Todavía no hay archivos. La evidencia se adjunta al registrar la desviación, o
            después desde «Editar No Conformidad».
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

                {puedeQuitar ? (
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

      </TarjetaContenido>
    </Tarjeta>
  );
}
