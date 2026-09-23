import * as React from "react";
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
import { EncabezadoOrdenable } from "@/components/comunes/encabezado-ordenable";
import { MoverDocumento } from "@/app/(sgc)/documentos/mover-documento";
import { PanelCategorias } from "@/app/(sgc)/documentos/panel-categorias";
import {
  BarraSeleccion,
  CasillaDocumento,
  ProveedorSeleccion,
} from "@/app/(sgc)/documentos/seleccion-documentos";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import {
  DIAS_AVISO_REVISION_DOCUMENTO,
  ETIQUETAS_TIPO_DOCUMENTO,
  TIPOS_DOCUMENTO_VIGENTES,
} from "@/lib/constantes";
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
  categoria: string | null;
  orden: number | null;
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
  searchParams: {
    q?: string;
    vista?: string;
    tipo?: string;
    proceso?: string;
    filtro?: string;
    orden?: string;
    dir?: string;
  };
}) {
  const usuario = await requerirUsuario();
  // Eliminar es atribucion del Administrador SGC, igual que en RLS.
  const puedeEliminar = usuario.rol === "administrador_sgc";
  // Reordenar es parte de armar la carpeta: lo hace quien gestiona.
  const puedeOrdenar = puedeGestionar(usuario);
  const supabase = crearClienteServidor();

  const vista = searchParams.vista && searchParams.vista in VISTAS ? searchParams.vista : "vigentes";
  const { estados } = VISTAS[vista];

  const [{ data: procesos }, { data: todos }] = await Promise.all([
    supabase.from("procesos").select("id, nombre").eq("activo", true).order("nombre"),
    // Para rotular cada pestaña con su cantidad hace falta el estado de
    // todos los documentos, no solo el de los de la vista actual. Con la
    // misma consulta se arma el panel de categorías, que agrupa la lista
    // maestra entera y no la pestaña abierta.
    supabase
      .from("documentos")
      .select("id, codigo, titulo, estado, categoria, orden")
      .order("categoria", { nullsFirst: true })
      .order("orden", { nullsFirst: false })
      .order("codigo", { nullsFirst: false }),
  ]);

  const maestra =
    (todos as
      | {
          id: string;
          codigo: string | null;
          titulo: string;
          estado: EstadoDocumento;
          categoria: string | null;
        }[]
      | null) ?? [];

  // Las categorías ya en uso, para ofrecerlas y no terminar con
  // «Políticas» y «politicas» como dos carpetas distintas.
  const categorias = Array.from(
    new Set(maestra.map((documento) => documento.categoria).filter(Boolean) as string[]),
  ).sort((una, otra) => una.localeCompare(otra, "es"));

  let consulta = supabase
    .from("documentos")
    .select(
      "id, codigo, titulo, tipo, estado, version_actual, fecha_proxima_revision, " +
        "es_demostracion, categoria, orden",
    )
    .in("estado", estados);

  // Las columnas por las que se puede ordenar al tocar el encabezado.
  // Es una lista cerrada a proposito: `orden` viene de la direccion, o
  // sea de cualquiera, y pasarselo tal cual a la base seria dejar que
  // ordene por lo que se le ocurra.
  const COLUMNAS_ORDENABLES: Record<string, string> = {
    codigo: "codigo",
    titulo: "titulo",
    tipo: "tipo",
    version: "version_actual",
    estado: "estado",
    revision: "fecha_proxima_revision",
  };

  const columna = searchParams.orden ? COLUMNAS_ORDENABLES[searchParams.orden] : null;
  const ascendente = searchParams.dir !== "desc";

  if (columna) {
    // Cuando se ordena por una columna, el orden manual y la agrupacion
    // por categoria quedan de lado: son dos formas de ordenar la misma
    // lista y mezclarlas no da ninguna de las dos.
    consulta = consulta.order(columna, { ascending: ascendente, nullsFirst: false });
  } else {
    // Por categoria y por el orden manual que fijo Calidad. El codigo
    // queda de desempate para los que todavia no tienen posicion.
    consulta = consulta
      .order("categoria", { nullsFirst: true })
      .order("orden", { nullsFirst: false })
      .order("codigo", { nullsFirst: false });
  }

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

  // Que documentos tienen archivo cargado. Una sola consulta con los ids
  // de la pagina, no una por fila. Hace falta para decidir a donde lleva
  // el clic: enlazar al archivo un documento que todavia no lo tiene es
  // prometer un PDF que no esta.
  const { data: conArchivo } = documentos.length
    ? await supabase
        .from("adjuntos")
        .select("entidad_id")
        .eq("entidad", "documentos")
        .in(
          "entidad_id",
          documentos.map((documento) => documento.id),
        )
    : { data: [] };

  const tieneArchivo = new Set(
    ((conArchivo as { entidad_id: string }[] | null) ?? []).map((fila) => fila.entidad_id),
  );

  const vistas = Object.entries(VISTAS).map(([valor, { etiqueta, estados: suyos }]) => ({
    valor,
    etiqueta,
    cantidad: maestra.filter((documento) => suyos.includes(documento.estado)).length,
  }));

  return (
    <>
      <EncabezadoPagina
        titulo="Control de información documentada"
        descripcion="Manuales, procedimientos, políticas y formularios con código controlado, versionado y flujo de aprobación."
        acciones={
          puedeGestionar(usuario) ? (
            <>
              <PanelCategorias
                documentos={maestra.map(({ id, codigo, titulo, categoria }) => ({
                  id,
                  codigo,
                  titulo,
                  categoria,
                }))}
                categorias={categorias}
              />
              <Boton comoHijo>
                <Link href="/documentos/nuevo">
                  <Plus /> Nuevo documento
                </Link>
              </Boton>
            </>
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
            // Solo los cinco tipos vigentes: filtrar por «Registro» o
            // «Plan», que ya no se dan de alta, devolveria siempre vacio.
            opciones: TIPOS_DOCUMENTO_VIGENTES.map((valor) => ({
              valor,
              etiqueta: ETIQUETAS_TIPO_DOCUMENTO[valor],
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
        <ProveedorSeleccion>
          {puedeEliminar ? <BarraSeleccion /> : null}
          <Tarjeta>
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                {puedeEliminar ? <TablaEncabezado className="w-8" /> : null}
                <EncabezadoOrdenable campo="codigo" className="w-[9rem]">
                  Código
                </EncabezadoOrdenable>
                <EncabezadoOrdenable campo="titulo">Título</EncabezadoOrdenable>
                <EncabezadoOrdenable campo="tipo" className="hidden md:table-cell">
                  Tipo
                </EncabezadoOrdenable>
                <EncabezadoOrdenable campo="version" className="w-[5rem]">
                  Versión
                </EncabezadoOrdenable>
                {/* En «Vigentes» la columna de estado diría lo mismo en
                    todas las filas: la pestaña ya lo dice. */}
                {vista === "vigentes" ? null : (
                  <EncabezadoOrdenable campo="estado" className="w-[7rem]">
                    Estado
                  </EncabezadoOrdenable>
                )}
                <EncabezadoOrdenable campo="revision" className="hidden xl:table-cell">
                  Próxima revisión
                </EncabezadoOrdenable>
                <TablaEncabezado className="w-[4.5rem] text-right">Ficha</TablaEncabezado>
                {puedeOrdenar ? <TablaEncabezado className="w-12">Orden</TablaEncabezado> : null}
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {documentos.map((documento, indice) => {
                // El separador se dibuja cuando cambia la categoría. Es
                // la agrupación que pidió Calidad: la carpeta se lee por
                // categoría, no por código.
                const anterior = documentos[indice - 1];
                const siguiente = documentos[indice + 1];
                // Con una columna ordenada no hay categorías ni posición
                // manual que mostrar: la lista viene por otra cosa.
                const abreCategoria = !columna && anterior?.categoria !== documento.categoria;
                const esPrimeroDeCategoria = abreCategoria;
                const esUltimoDeCategoria = siguiente?.categoria !== documento.categoria;

                const dias = diasHasta(documento.fecha_proxima_revision);
                const porVencer =
                  documento.estado === "vigente" &&
                  dias !== null &&
                  dias <= DIAS_AVISO_REVISION_DOCUMENTO;

                // Tocar el codigo o el titulo abre el archivo, no la ficha:
                // quien entra al control documental viene a leer el
                // procedimiento. La ficha queda en su propia columna.
                const abre = tieneArchivo.has(documento.id);
                const destino = abre
                  ? `/documentos/${documento.id}/archivo`
                  : `/documentos/${documento.id}`;
                const rotulo = abre
                  ? "Abrir el archivo en una pestaña nueva"
                  : "Este documento todavía no tiene archivo cargado";

                return (
                  <React.Fragment key={documento.id}>
                    {abreCategoria ? (
                      <tr className="border-b border-borde bg-acento/40">
                        <td
                          colSpan={12}
                          className="px-3 py-1.5 text-[11px] font-semibold uppercase
                                     tracking-wide text-atenuado-contraste"
                        >
                          {documento.categoria ?? "Sin categoría"}
                        </td>
                      </tr>
                    ) : null}
                  <TablaFila>
                    {puedeEliminar ? (
                      <TablaCelda>
                        <CasillaDocumento id={documento.id} titulo={documento.titulo} />
                      </TablaCelda>
                    ) : null}
                    <TablaCelda className="font-medium tabular">
                      <Link
                        href={destino}
                        target={abre ? "_blank" : undefined}
                        rel={abre ? "noopener noreferrer" : undefined}
                        title={rotulo}
                        className="hover:text-primario"
                      >
                        {documento.codigo ?? <span className="text-atenuado-contraste">—</span>}
                      </Link>
                    </TablaCelda>
                    <TablaCelda>
                      <Link
                        href={destino}
                        target={abre ? "_blank" : undefined}
                        rel={abre ? "noopener noreferrer" : undefined}
                        title={rotulo}
                        className="flex items-center gap-2 hover:text-primario"
                      >
                        {abre ? (
                          <FileText className="size-3.5 shrink-0 text-atenuado-contraste" />
                        ) : null}
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
                    <TablaCelda className="text-right">
                      <Link
                        href={`/documentos/${documento.id}`}
                        className="text-xs text-primario hover:underline"
                      >
                        Ver
                      </Link>
                    </TablaCelda>
                    {puedeOrdenar ? (
                      <TablaCelda>
                        {columna ? (
                          <span
                            className="text-[10px] text-atenuado-contraste"
                            title="Se está ordenando por una columna. Quite el orden para mover a mano."
                          >
                            —
                          </span>
                        ) : (
                        <MoverDocumento
                          documentoId={documento.id}
                          esPrimero={esPrimeroDeCategoria}
                          esUltimo={esUltimoDeCategoria}
                        />
                        )}
                      </TablaCelda>
                    ) : null}
                  </TablaFila>
                  </React.Fragment>
                );
              })}
            </TablaCuerpo>
          </Tabla>
          </Tarjeta>
        </ProveedorSeleccion>
      )}

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {documentos.length}{" "}
        {vista === "obsoletos"
          ? `documento${documentos.length === 1 ? "" : "s"} obsoleto${documentos.length === 1 ? "" : "s"}`
          : `documento${documentos.length === 1 ? "" : "s"} en el listado`}
        .{" "}
        {vista === "vigentes"
          ? "Es lo que está en vigencia hoy; las versiones reemplazadas están en «Obsoletos»."
          : null}{" "}
        Tocar el código o el título abre el archivo; «Ver» lleva a la ficha con el historial de
        versiones.{puedeEliminar ? " Marque las casillas para eliminar varios de una vez." : ""}
        {puedeOrdenar && !columna
          ? " Las flechas mueven el documento dentro de su categoría, y «Categorías» arma los grupos."
          : ""}
        {columna
          ? " Ordenado por una columna: toque el encabezado una vez más para volver al orden de la carpeta."
          : ""}
      </p>
    </>
  );
}
