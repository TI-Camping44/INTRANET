"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Trash2, Upload } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Entrada } from "@/components/ui/campo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import {
  adjuntarPerfilDePuesto,
  eliminarPerfilDePuesto,
} from "@/app/(sgc)/recursos-humanos/puestos/acciones";
import { describirTamano } from "@/lib/adjuntos";
import { formatearFecha } from "@/lib/formato";

export interface ArchivoDelPuesto {
  id: string;
  nombre_archivo: string;
  tamano_bytes: number;
  descripcion: string | null;
  creado_en: string;
}

/**
 * El perfil del puesto, en PDF.
 *
 * SOLO PDF. El perfil es un documento firmado y revisado: en formato
 * editable deja de ser evidencia de nada ante una auditoría. El `accept`
 * del campo es comodidad del navegador; el control está en
 * `adjuntarPerfilDePuesto`, que rechaza lo que no termine en .pdf.
 *
 * EL ENLACE NO SE DIBUJA EN LA PÁGINA. Cada archivo apunta a
 * `/adjuntos/<id>`, y esa ruta firma el enlace recién en el clic, con la
 * sesión de la persona y por cinco minutos. Poner el enlace firmado en
 * el HTML dejaría enlaces vivos a archivos privados en la caché del
 * navegador.
 */
export function PerfilesDelPuesto({
  puestoId,
  archivos,
  puedeEditar,
}: {
  puestoId: string;
  archivos: ArchivoDelPuesto[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [subiendo, definirSubiendo] = React.useState(false);
  const [borrando, definirBorrando] = React.useState<string | null>(null);

  async function subir(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    definirSubiendo(true);
    const resultado = await adjuntarPerfilDePuesto(puestoId, new FormData(formulario));
    definirSubiendo(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Archivo subido.");
      formulario.reset();
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function quitar(archivo: ArchivoDelPuesto) {
    if (!confirm(`¿Quitar «${archivo.nombre_archivo}»? No se puede deshacer.`)) return;

    definirBorrando(archivo.id);
    const resultado = await eliminarPerfilDePuesto(archivo.id, puestoId);
    definirBorrando(null);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Archivo eliminado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <Tarjeta>
      <TarjetaCabecera>
        <TarjetaTitulo>Perfil del puesto</TarjetaTitulo>
      </TarjetaCabecera>
      <TarjetaContenido className="space-y-4">
        {archivos.length === 0 ? (
          <EstadoVacio
            icono={<FileText className="size-6" />}
            titulo="Sin perfil cargado"
            descripcion="Suba el Perfil de Resultados de Puesto firmado, en PDF."
          />
        ) : (
          <ul className="divide-y divide-borde">
            {archivos.map((archivo) => (
              <li key={archivo.id} className="flex items-start gap-2 py-2 first:pt-0">
                {/* El enlace firmado se genera en el clic, en /adjuntos/[id]. */}
                <a
                  href={`/adjuntos/${archivo.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex min-w-0 flex-1 items-start gap-2 hover:underline"
                >
                  <FileText className="mt-0.5 size-3.5 shrink-0 text-atenuado-contraste" />
                  <span className="min-w-0">
                    <span className="block truncate text-xs font-medium">
                      {archivo.nombre_archivo}
                    </span>
                    <span className="block text-[11px] text-atenuado-contraste">
                      {describirTamano(archivo.tamano_bytes)} ·{" "}
                      {formatearFecha(archivo.creado_en)}
                    </span>
                    {archivo.descripcion ? (
                      <span className="block text-[11px] leading-relaxed text-atenuado-contraste">
                        {archivo.descripcion}
                      </span>
                    ) : null}
                  </span>
                </a>

                {puedeEditar ? (
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

        {puedeEditar ? (
          <form
            onSubmit={subir}
            className="space-y-2 rounded-md border border-dashed border-borde p-3"
          >
            <input
              type="file"
              name="perfil"
              multiple
              required
              accept="application/pdf,.pdf"
              className="block w-full text-xs file:mr-2 file:rounded file:border file:border-borde file:bg-acento file:px-2 file:py-1 file:text-xs"
            />
            <Entrada
              name="descripcion"
              placeholder="Qué es el archivo (opcional)"
              className="text-xs"
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] text-atenuado-contraste">
                Solo PDF. Hasta 20 MB por archivo.
              </span>
              <Boton type="submit" tamano="pequeno" cargando={subiendo}>
                <Upload /> Subir
              </Boton>
            </div>
          </form>
        ) : null}
      </TarjetaContenido>
    </Tarjeta>
  );
}
