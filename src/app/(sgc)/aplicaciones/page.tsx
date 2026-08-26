import type { Metadata } from "next";
import { ExternalLink } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Tarjeta } from "@/components/ui/tarjeta";
import { agruparAplicaciones, ETIQUETAS_PUBLICO } from "@/lib/aplicaciones";
import { requerirUsuario } from "@/lib/sesion";

export const metadata: Metadata = { title: "Aplicaciones" };

/**
 * Las aplicaciones que la empresa ya tiene publicadas.
 *
 * No las reemplaza ni las copia: las reúne. Hasta ahora había que
 * conocerlas de memoria o tenerlas en los marcadores del navegador, que
 * es la manera más segura de que quien entra nuevo no se entere de que
 * existen.
 *
 * Abren en una pestaña nueva porque son sistemas aparte: quien mira el
 * catálogo no está saliendo de la intranet, está yendo a otra cosa y
 * después vuelve.
 */
export default async function PaginaAplicaciones() {
  await requerirUsuario();
  const grupos = agruparAplicaciones();

  return (
    <>
      <EncabezadoPagina
        titulo="Aplicaciones"
        descripcion="Los catálogos, tableros e informes de Camping 44, en un solo lugar."
      />

      <div className="space-y-8">
        {grupos.map(({ publico, aplicaciones }) => (
          <section key={publico}>
            <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste">
              {ETIQUETAS_PUBLICO[publico]}
            </h2>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {aplicaciones.map((aplicacion) => (
                <Tarjeta key={aplicacion.url} className="min-w-0">
                  <a
                    href={aplicacion.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex h-full flex-col gap-1.5 p-4 transition-colors hover:bg-acento/40"
                  >
                    <span className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{aplicacion.nombre}</span>
                      <ExternalLink
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-atenuado-contraste"
                        aria-hidden
                      />
                    </span>
                    <span className="text-xs leading-relaxed text-atenuado-contraste">
                      {aplicacion.descripcion}
                    </span>
                  </a>
                </Tarjeta>
              ))}
            </div>
          </section>
        ))}
      </div>
    </>
  );
}
