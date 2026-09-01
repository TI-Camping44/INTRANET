import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { PestanasListado } from "@/components/comunes/pestanas-listado";
import {
  InsigniaDemostracion,
  InsigniaEstadoDocumento,
} from "@/components/comunes/insignias-estado";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { DIAS_AVISO_REVISION_DOCUMENTO, ETIQUETAS_TIPO_DOCUMENTO } from "@/lib/constantes";
import { describirVencimiento, formatearFecha, hoyEnAsuncion, sumarDias } from "@/lib/formato";
import { diasHasta } from "@/lib/formato";
import { recortar } from "@/lib/utilidades";
import type { EstadoDocumento, TipoDocumento } from "@/lib/tipos";

export const metadata: Metadata = { title: "Información documentada" };
export const dynamic = "force-dynamic";

interface FilaDocumento {
  id: string;
  codigo: string | null;
  titulo: string;
  tipo: TipoDocumento;
  estado: EstadoDocumento;
  version_actual: number;
  fecha_proxima_revision: string | null;
  es_demostracion: boolean;
}

/**
 * Las tres listas del control documental.
 *
 * No son un filtro sobre una sola lista: son tres conjuntos distintos.
 * Lo vigente es lo que la gente tiene que leer y aplicar; lo obsoleto se
 * conserva porque la norma lo exige, no porque se consulte. Mezclarlos
 * en una sola tabla es lo que hace que alguien trabaje con la version
 * equivocada.
 */
const VISTAS: Record<string, { etiqueta: string; estados: EstadoDocumento[] }> = {
  vigentes: { etiqueta: "Vigentes", estados: ["vigente"] },
  "en-proceso": { etiqueta: "En elaboración", estados: ["borrador", "en_revision"] },
  obsoletos: { etiqueta: "Obsoletos", estados: ["obsoleto"] },
};

export default async function PaginaDocumentos({
  searchParams,
}: {
  searchParams: { q?: string; vista?: string; tipo?: string; proceso?: string; filtro?: string };
}) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const vista = searchParams.vista && searchParams.vista in VISTAS ? searchParams.vista : "vigentes";
  const { estados } = VISTAS[vista];

  const [{ data: procesos }, { data: todos }] = await Promise.all([
    supabase.from("procesos").select("id, nombre").eq("activo", true).order("nombre"),
    // Para rotular cada pestaña con su cantidad hace falta el estado de
    // todos los documentos, no solo el de los de la vista actual.
    supabase.from("documentos").select("estado"),
  ]);

  let consulta = supabase
    .from("documentos")
    .select(
      "id, codigo, titulo, tipo, estado, version_actual, fecha_proxima_revision, es_demostracion",
    )
    .in("estado", estados)
    // Los documentos sin codigo controlado (contexto, politicas) van al
    // final: la lista se lee por codigo.
    .order("codigo", { nullsFirst: false });

  if (searchParams.tipo) consulta = consulta.eq("tipo", searchParams.tipo);
  if (searchParams.proceso) consulta = consulta.eq("proceso_id", searchParams.proceso);
  if (searchParams.q) {
    const texto = `%${searchParams.q}%`;
    consulta = consulta.or(`codigo.ilike.${texto},titulo.ilike.${texto}`);
  }
  if (searchParams.filtro === "por-revisar") {
    consulta = consulta.lte(
      "fecha_proxima_revision",
      sumarDias(hoyEnAsuncion(), DIAS_AVISO_REVISION_DOCUMENTO),
    );
  }

  const { data, error } = await consulta;
  const documentos = (data as FilaDocumento[] | null) ?? [];

  const estadosCargados = (todos as { estado: EstadoDocumento }[] | null) ?? [];
  const vistas = Object.entries(VISTAS).map(([valor, { etiqueta, estados: suyos }]) => ({
    valor,
    etiqueta,
    cantidad: estadosCargados.filter((documento) => suyos.includes(documento.estado)).length,
  }));

  return (
    <>
      <EncabezadoPagina
        titulo="Control de información documentada"
        descripcion="Manuales, procedimientos, políticas y formularios con código controlado, versionado y flujo de aprobación."
        acciones={
          puedeGestionar(usuario) ? (
            <Boton comoHijo>
              <Link href="/documentos/nuevo">
                <Plus /> Nuevo documento
              </Link>
            </Boton>
          ) : null
        }
      />

      <PestanasListado
        nombre="vista"
        ruta="/documentos"
        actual={vista}
        vistas={vistas}
        parametros={searchParams}
      />

      <FiltrosListado
        campos={[
          {
            nombre: "tipo",
            etiqueta: "Tipo",
            opciones: Object.entries(ETIQUETAS_TIPO_DOCUMENTO).map(([valor, etiqueta]) => ({
              valor,
              etiqueta,
            })),
          },
          {
            nombre: "proceso",
            etiqueta: "Proceso",
            opciones: (procesos ?? []).map((proceso: { id: string; nombre: string }) => ({
              valor: proceso.id,
              etiqueta: proceso.nombre,
            })),
          },
        ]}
      />

      {error ? (
        <EstadoVacio
          titulo="No se pudo cargar el listado"
          descripcion={error.message}
          icono={<FileText className="size-6" />}
        />
      ) : documentos.length === 0 ? (
        <EstadoVacio
          icono={<FileText className="size-6" />}
          titulo={
            vista === "obsoletos"
              ? "No hay documentos obsoletos"
              : "No hay documentos que coincidan"
          }
          descripcion={
            vista === "obsoletos"
              ? "Cuando un documento se reemplaza por una versión nueva, la anterior queda acá."
              : "Ajuste los filtros o cree el primer documento del sistema."
          }
          accion={
            puedeGestionar(usuario) && vista !== "obsoletos" ? (
              <Boton comoHijo tamano="pequeno">
                <Link href="/documentos/nuevo">
                  <Plus /> Nuevo documento
                </Link>
              </Boton>
            ) : null
          }
        />
      ) : (
        <Tarjeta>
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado className="w-[9rem]">Código</TablaEncabezado>
                <TablaEncabezado>Título</TablaEncabezado>
                <TablaEncabezado className="hidden md:table-cell">Tipo</TablaEncabezado>
                <TablaEncabezado className="w-[5rem]">Versión</TablaEncabezado>
                {/* En «Vigentes» la columna de estado diría lo mismo en
                    todas las filas: la pestaña ya lo dice. */}
                {vista === "vigentes" ? null : (
                  <TablaEncabezado className="w-[7rem]">Estado</TablaEncabezado>
                )}
                <TablaEncabezado className="hidden xl:table-cell">Próxima revisión</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {documentos.map((documento) => {
                const dias = diasHasta(documento.fecha_proxima_revision);
                const porVencer =
                  documento.estado === "vigente" &&
                  dias !== null &&
                  dias <= DIAS_AVISO_REVISION_DOCUMENTO;

                return (
                  <TablaFila key={documento.id}>
                    <TablaCelda className="font-medium tabular">
                      <Link href={`/documentos/${documento.id}`} className="hover:text-primario">
                        {documento.codigo ?? <span className="text-atenuado-contraste">—</span>}
                      </Link>
                    </TablaCelda>
                    <TablaCelda>
                      <Link
                        href={`/documentos/${documento.id}`}
                        className="flex items-center gap-2 hover:text-primario"
                      >
                        <span>{recortar(documento.titulo, 80)}</span>
                        {documento.es_demostracion ? <InsigniaDemostracion /> : null}
                      </Link>
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                      {ETIQUETAS_TIPO_DOCUMENTO[documento.tipo]}
                    </TablaCelda>
                    <TablaCelda className="tabular text-xs">
                      v{String(documento.version_actual).padStart(2, "0")}
                    </TablaCelda>
                    {vista === "vigentes" ? null : (
                      <TablaCelda>
                        <InsigniaEstadoDocumento estado={documento.estado} />
                      </TablaCelda>
                    )}
                    <TablaCelda className="hidden text-xs xl:table-cell">
                      {documento.fecha_proxima_revision ? (
                        <span className={porVencer ? "text-semaforo-alto" : "text-atenuado-contraste"}>
                          {formatearFecha(documento.fecha_proxima_revision)}
                          {porVencer ? (
                            <span className="block text-[10px]">
                              {describirVencimiento(documento.fecha_proxima_revision)}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-atenuado-contraste">—</span>
                      )}
                    </TablaCelda>
                  </TablaFila>
                );
              })}
            </TablaCuerpo>
          </Tabla>
        </Tarjeta>
      )}

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {documentos.length}{" "}
        {vista === "obsoletos"
          ? `documento${documentos.length === 1 ? "" : "s"} obsoleto${documentos.length === 1 ? "" : "s"}`
          : `documento${documentos.length === 1 ? "" : "s"} en el listado`}
        .{" "}
        {vista === "vigentes"
          ? "Es lo que está en vigencia hoy; las versiones reemplazadas están en «Obsoletos»."
          : null}
      </p>
    </>
  );
}
