import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, LayoutGrid, Settings2 } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  agruparAplicaciones,
  estaOculta,
  ETIQUETAS_PUBLICO,
  type Aplicacion,
} from "@/lib/aplicaciones";
import { obtenerPermisos, requerirModulo } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Aplicaciones" };
export const dynamic = "force-dynamic";

/**
 * Las aplicaciones que la empresa ya tiene publicadas.
 *
 * No las reemplaza ni las copia: las reúne. Hasta ahora había que
 * conocerlas de memoria o tenerlas en los marcadores del navegador, que
 * es la manera más segura de que quien entra nuevo no se entere de que
 * existen.
 *
 * QUIÉN VE CADA UNA LO DECIDE LA BASE, no esta pantalla: la política de
 * lectura de `aplicaciones` compara el rol de quien consulta contra
 * `roles_visibles` y directamente no devuelve la fila. Por eso acá no
 * hay ningún filtro por rol: lo que llega es lo que corresponde.
 *
 * La excepción es quien administra la lista, que las recibe todas —si no,
 * no podría volver a habilitar lo que ocultó—. A esa persona, y solo a
 * esa, se le marcan las que no ve nadie.
 *
 * Abren en una pestaña nueva porque son sistemas aparte: quien mira el
 * catálogo no está saliendo de la intranet, está yendo a otra cosa y
 * después vuelve.
 */
export default async function PaginaAplicaciones() {
  await requerirModulo("aplicaciones");
  const permisos = await obtenerPermisos();
  const puedeAdministrar = permisos.aplicaciones.editar;

  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("aplicaciones")
    .select("id, nombre, descripcion, url, publico, orden, roles_visibles, usuarios_visibles")
    .order("orden");

  const aplicaciones = (data as unknown as Aplicacion[] | null) ?? [];
  const grupos = agruparAplicaciones(aplicaciones);

  return (
    <>
      <EncabezadoPagina
        titulo="Aplicaciones"
        descripcion="Los formularios, catálogos, tableros e informes de Camping 44, en un solo lugar."
        acciones={
          puedeAdministrar ? (
            <Boton variante="contorno" comoHijo>
              <Link href="/aplicaciones/administrar">
                <Settings2 /> Administrar
              </Link>
            </Boton>
          ) : null
        }
      />

      {grupos.length === 0 ? (
        <EstadoVacio
          icono={<LayoutGrid className="size-6" />}
          titulo="No hay aplicaciones para mostrar"
          descripcion={
            puedeAdministrar
              ? "Agregue la primera desde Administrar: un nombre, para qué sirve, la dirección y a qué roles se les muestra."
              : "Todavía no se habilitó ninguna aplicación para su rol. Consulte con el Administrador SGC."
          }
        />
      ) : (
        <div className="space-y-8">
          {grupos.map(({ publico, aplicaciones: delGrupo }) => (
            <section key={publico}>
              <h2 className="mb-3 text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste">
                {ETIQUETAS_PUBLICO[publico]}
              </h2>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {delGrupo.map((aplicacion) => (
                  <Tarjeta key={aplicacion.id} className="min-w-0">
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
                      {/* Solo le aparece a quien administra la lista: es
                          la unica persona que recibe las ocultas, y sin
                          esto las vería mezcladas con las demás y
                          creería que todos las ven. */}
                      {estaOculta(aplicacion) ? (
                        <span className="mt-auto pt-1.5">
                          <Insignia variante="contorno">Oculta para todos</Insignia>
                        </span>
                      ) : null}
                    </a>
                  </Tarjeta>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  );
}
