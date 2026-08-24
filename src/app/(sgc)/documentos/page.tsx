import type { Metadata } from "next";
import Link from "next/link";
import { FileText, Plus } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
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
import {
  DIAS_AVISO_REVISION_DOCUMENTO,
  ETIQUETAS_ESTADO_DOCUMENTO,
  ETIQUETAS_TIPO_DOCUMENTO,
} from "@/lib/constantes";
import { describirVencimiento, formatearFecha, hoyEnAsuncion, sumarDias } from "@/lib/formato";
import { diasHasta } from "@/lib/formato";
import { recortar } from "@/lib/utilidades";
import type { EstadoDocumento, TipoDocumento } from "@/lib/tipos";

export const metadata: Metadata = { title: "Información documentada" };
export const dynamic = "force-dynamic";

interface FilaDocumento {
  id: string;
  codigo: string;
  titulo: string;
  tipo: TipoDocumento;
  estado: EstadoDocumento;
  version_actual: number;
  fecha_proxima_revision: string | null;
  es_demostracion: boolean;
  procesos: { nombre: string } | null;
  responsable: { nombre_completo: string } | null;
}

export default async function PaginaDocumentos({
  searchParams,
}: {
  searchParams: { q?: string; estado?: string; tipo?: string; proceso?: string; filtro?: string };
}) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: procesos } = await supabase
    .from("procesos")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");

  let consulta = supabase
    .from("documentos")
    .select(
      "id, codigo, titulo, tipo, estado, version_actual, fecha_proxima_revision, es_demostracion, " +
        "procesos:proceso_id (nombre), responsable:responsable_id (nombre_completo)",
    )
    .order("codigo");

  if (searchParams.estado) consulta = consulta.eq("estado", searchParams.estado);
  if (searchParams.tipo) consulta = consulta.eq("tipo", searchParams.tipo);
  if (searchParams.proceso) consulta = consulta.eq("proceso_id", searchParams.proceso);
  if (searchParams.q) {
    const texto = `%${searchParams.q}%`;
    consulta = consulta.or(`codigo.ilike.${texto},titulo.ilike.${texto}`);
  }
  if (searchParams.filtro === "por-revisar") {
    consulta = consulta
      .eq("estado", "vigente")
      .lte("fecha_proxima_revision", sumarDias(hoyEnAsuncion(), DIAS_AVISO_REVISION_DOCUMENTO));
  }

  const { data, error } = await consulta;
  const documentos = (data as FilaDocumento[] | null) ?? [];

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

      <FiltrosListado
        campos={[
          {
            nombre: "estado",
            etiqueta: "Estado",
            opciones: Object.entries(ETIQUETAS_ESTADO_DOCUMENTO).map(([valor, etiqueta]) => ({
              valor,
              etiqueta,
            })),
          },
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
          titulo="No hay documentos que coincidan"
          descripcion="Ajuste los filtros o cree el primer documento del sistema."
          accion={
            puedeGestionar(usuario) ? (
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
                <TablaEncabezado className="hidden lg:table-cell">Proceso</TablaEncabezado>
                <TablaEncabezado className="hidden lg:table-cell">Responsable</TablaEncabezado>
                <TablaEncabezado className="w-[5rem]">Versión</TablaEncabezado>
                <TablaEncabezado className="w-[7rem]">Estado</TablaEncabezado>
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
                        {documento.codigo}
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
                    <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                      {documento.procesos?.nombre ?? "—"}
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                      {documento.responsable?.nombre_completo ?? "—"}
                    </TablaCelda>
                    <TablaCelda className="tabular text-xs">
                      v{String(documento.version_actual).padStart(2, "0")}
                    </TablaCelda>
                    <TablaCelda>
                      <InsigniaEstadoDocumento estado={documento.estado} />
                    </TablaCelda>
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
        {documentos.length} documento{documentos.length === 1 ? "" : "s"} en el listado.
      </p>
    </>
  );
}
