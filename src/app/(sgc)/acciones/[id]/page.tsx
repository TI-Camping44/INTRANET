import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, TriangleAlert } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { EliminarRespuesta } from "@/app/(sgc)/acciones/[id]/eliminar-respuesta";
import {
  CierreEficacia,
  PanelAcciones,
  type TareaPlan,
} from "@/app/(sgc)/acciones/[id]/panel-acciones";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { esSoloLectura, puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { estaEjecutada } from "@/lib/acciones";
import { formatearFecha } from "@/lib/formato";
import type { EstadoNoConformidad, NcPorque, ResultadoEficacia } from "@/lib/tipos";

export const dynamic = "force-dynamic";

/**
 * La acción correctiva de una desviación, completa.
 *
 * La dirección lleva el id de la NO CONFORMIDAD y no el de una fila de
 * `nc_acciones`, y es a propósito: «la acción correctiva» es una sola
 * cosa —el descargo, el análisis y las tareas— aunque viva repartida en
 * tres tablas. Abrir una tarea suelta no serviría de nada: el descargo y
 * los cinco porqués son de la desviación, no de esa tarea.
 *
 * Antes esta pantalla no existía y el listado llevaba de vuelta a la
 * ficha de la no conformidad, que después de la revisión del 23 ya no
 * muestra ni el análisis ni el plan. Se llegaba a una pantalla que no
 * tenía lo que se había ido a buscar.
 */
interface Cabecera {
  id: string;
  codigo: string;
  titulo: string;
  estado: EstadoNoConformidad;
  eficacia: ResultadoEficacia;
  observacion_eficacia: string | null;
  conclusion_causa_raiz: string | null;
  fecha_deteccion: string;
  detectado_por: string | null;
  responsable_id: string | null;
  proceso_id: string | null;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("no_conformidades")
    .select("codigo")
    .eq("id", params.id)
    .maybeSingle();

  return { title: data ? `Acción correctiva · ${data.codigo}` : "Acción correctiva" };
}

export default async function PaginaAccionCorrectiva({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const [{ data: consulta }, { data: porques }, { data: filas }] = await Promise.all([
    supabase
      .from("no_conformidades")
      .select(
        "id, codigo, titulo, estado, eficacia, observacion_eficacia, conclusion_causa_raiz, " +
          "fecha_deteccion, detectado_por, responsable_id, proceso_id",
      )
      .eq("id", params.id)
      .maybeSingle(),
    supabase.from("nc_porques").select("*").eq("no_conformidad_id", params.id).order("orden"),
    supabase
      .from("nc_acciones")
      .select(
        "id, descripcion, descargo, estado, ejecucion_en_plazo, fecha_limite, " +
          "fecha_ejecucion, creado_en, responsable:responsable_id (nombre_completo)",
      )
      .eq("no_conformidad_id", params.id)
      .order("creado_en"),
  ]);

  const nc = consulta as Cabecera | null;
  if (!nc) notFound();

  const tareas = (filas as unknown as (TareaPlan & { descargo: string | null })[] | null) ?? [];
  // El descargo es el mismo en todas las filas: se escribe en todas
  // porque es de la persona y de la desviacion, no de cada tarea.
  const descargo = tareas.find((tarea) => tarea.descargo)?.descargo ?? null;
  const faltan = tareas.filter((tarea) => !estaEjecutada(tarea.estado)).length;

  const esCalidad = usuario.rol === "administrador_sgc";
  const gestiona =
    esCalidad ||
    nc.detectado_por === usuario.id ||
    nc.responsable_id === usuario.id ||
    (puedeGestionar(usuario) && nc.proceso_id === usuario.proceso_id);
  const puedeEditar = gestiona && !esSoloLectura(usuario);

  return (
    <div className="mx-auto max-w-4xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/acciones">
          <ArrowLeft /> Volver al listado
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo="Acción correctiva"
        descripcion={nc.titulo}
        acciones={
          puedeEditar && tareas.length > 0 ? (
            <>
              <Boton variante="contorno" tamano="pequeno" comoHijo>
                <Link href={`/acciones/${nc.id}/editar`}>
                  <Pencil /> Editar Acción Correctiva
                </Link>
              </Boton>
              {esCalidad ? (
                <EliminarRespuesta noConformidadId={nc.id} codigo={nc.codigo} />
              ) : null}
            </>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Insignia variante="primaria" className="tabular text-xs">
          {nc.codigo}
        </Insignia>
        <Link
          href={`/no-conformidades/${nc.id}`}
          className="text-xs text-primario hover:underline"
        >
          Ver la no conformidad
        </Link>
        <span className="text-[11px] text-atenuado-contraste">
          Detectada el {formatearFecha(nc.fecha_deteccion)}
        </span>
      </div>

      {tareas.length === 0 ? (
        <EstadoVacio
          icono={<TriangleAlert className="size-6" />}
          titulo="Esta desviación todavía no tiene acción correctiva"
          descripcion="Cargue el descargo, el análisis de causa raíz y las acciones con sus responsables."
          accion={
            puedeEditar ? (
              <Boton comoHijo tamano="pequeno">
                <Link href={`/acciones/nueva?nc=${nc.id}`}>Cargar la acción correctiva</Link>
              </Boton>
            ) : null
          }
        />
      ) : (
        <div className="space-y-4">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Cierre de la acción correctiva</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <CierreEficacia
                noConformidadId={nc.id}
                eficacia={nc.eficacia}
                observacion={nc.observacion_eficacia}
                faltan={faltan}
                puedeGestionar={puedeEditar}
              />
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Descargo</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <p className="whitespace-pre-line text-xs leading-relaxed">
                {descargo ?? (
                  <span className="text-atenuado-contraste">Sin descargo cargado.</span>
                )}
              </p>
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Análisis de causa raíz</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <ol className="space-y-2">
                {((porques as NcPorque[] | null) ?? []).map((porque, indice) => (
                  <li key={porque.id} className="flex gap-2 text-xs">
                    <span className="w-4 shrink-0 text-right tabular text-atenuado-contraste">
                      {indice + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="text-[11px] text-atenuado-contraste">{porque.pregunta}</p>
                      <p className="leading-relaxed">{porque.respuesta}</p>
                    </div>
                  </li>
                ))}
              </ol>
              {nc.conclusion_causa_raiz ? (
                <p className="mt-3 rounded-md border border-borde bg-acento/40 p-2.5 text-xs">
                  <span className="font-semibold">Causa raíz: </span>
                  {nc.conclusion_causa_raiz}
                </p>
              ) : null}
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>
                Acciones planificadas{" "}
                <span className="font-normal text-atenuado-contraste">({tareas.length})</span>
              </TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <PanelAcciones tareas={tareas} puedeGestionar={puedeEditar} />
            </TarjetaContenido>
          </Tarjeta>
        </div>
      )}
    </div>
  );
}
