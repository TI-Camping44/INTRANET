import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { BuscadorGlobal } from "@/components/comunes/buscador-global";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { humanizar, recortar } from "@/lib/utilidades";
import type { ResultadoBusqueda } from "@/lib/tipos";

export const metadata: Metadata = { title: "Búsqueda" };
export const dynamic = "force-dynamic";

export default async function PaginaBusqueda({
  searchParams,
}: {
  searchParams: { q?: string };
}) {
  await requerirUsuario();
  const consulta = (searchParams.q ?? "").trim();

  let resultados: ResultadoBusqueda[] = [];
  let fallo: string | null = null;

  if (consulta.length >= 2) {
    const supabase = crearClienteServidor();
    const { data, error } = await supabase.rpc("buscar_global", {
      p_texto: consulta,
      p_limite: 40,
    });

    if (error) fallo = error.message;
    else resultados = (data as ResultadoBusqueda[] | null) ?? [];
  }

  // Los resultados se agrupan por módulo para que la lectura sea rápida.
  const porEntidad = resultados.reduce<Record<string, ResultadoBusqueda[]>>((grupos, fila) => {
    grupos[fila.entidad_etiqueta] = [...(grupos[fila.entidad_etiqueta] ?? []), fila];
    return grupos;
  }, {});

  return (
    <div className="mx-auto max-w-4xl">
      <EncabezadoPagina
        titulo="Búsqueda global"
        descripcion="Busca sobre documentos, no conformidades, riesgos y proveedores. Solo aparece lo que su rol puede consultar."
      />

      <div className="mb-5">
        <BuscadorGlobal valorInicial={consulta} />
      </div>

      {consulta.length < 2 ? (
        <EstadoVacio
          icono={<Search className="size-6" />}
          titulo="Escriba al menos dos caracteres"
          descripcion="Puede buscar por código (MP-SOP-01, NC-2026-004), por título o por parte del contenido."
        />
      ) : fallo ? (
        <EstadoVacio titulo="No se pudo completar la búsqueda" descripcion={fallo} />
      ) : resultados.length === 0 ? (
        <EstadoVacio
          icono={<Search className="size-6" />}
          titulo={`Sin resultados para "${consulta}"`}
          descripcion="Pruebe con otra palabra o con el código del registro."
        />
      ) : (
        <div className="space-y-5">
          {Object.entries(porEntidad).map(([etiqueta, filas]) => (
            <section key={etiqueta}>
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-atenuado-contraste">
                {etiqueta} · {filas.length}
              </h2>
              <Tarjeta className="divide-y divide-borde">
                {filas.map((fila) => (
                  <Link
                    key={`${fila.entidad}-${fila.id}`}
                    href={fila.enlace}
                    className="flex items-start gap-3 p-3 transition-colors hover:bg-acento/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium">
                        {fila.codigo ? (
                          <span className="tabular text-atenuado-contraste">{fila.codigo} </span>
                        ) : null}
                        {fila.titulo}
                      </p>
                      {fila.detalle ? (
                        <p className="mt-0.5 text-[11px] leading-relaxed text-atenuado-contraste">
                          {recortar(fila.detalle, 140)}
                        </p>
                      ) : null}
                    </div>
                    <Insignia variante="contorno">{humanizar(fila.estado)}</Insignia>
                  </Link>
                ))}
              </Tarjeta>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
