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
import { MoverCategoria } from "@/app/(sgc)/documentos/mover-categoria";
import { PanelCategorias } from "@/app/(sgc)/documentos/panel-categorias";
import {
  FilaArrastrable,
  FilaCategoria,
  ProveedorArrastre,
} from "@/app/(sgc)/documentos/arrastre-documentos";
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
import { armarJerarquia } from "@/lib/documentos";
import { hoyEnAsuncion, sumarDias } from "@/lib/formato";
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
  orden_categoria: number | null;
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
      .select("id, codigo, titulo, estado, categoria, orden, orden_categoria")
      .order("orden_categoria", { nullsFirst: true })
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
          orden_categoria: number | null;
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
        "es_demostracion, categoria, orden, orden_categoria",
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
  };

  const columna = searchParams.orden ? COLUMNAS_ORDENABLES[searchParams.orden] : null;
  const ascendente = searchParams.dir !== "desc";

  if (columna) {
    // Cuando se ordena por una columna, el orden manual y la agrupacion
    // por categoria quedan de lado: son dos formas de ordenar la misma
    // lista y mezclarlas no da ninguna de las dos.
    consulta = consulta.order(columna, { ascending: ascendente, nullsFirst: false });
  } else {
    // Primero la posicion de la categoria —que Calidad mueve entera—,
    // despues el orden manual dentro de ella. El nombre queda de
    // desempate por si dos categorias comparten posicion, y el codigo
    // para los documentos que todavia no tienen lugar asignado.
    consulta = consulta
      .order("orden_categoria", { nullsFirst: true })
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

  // El arbol de la lista maestra. El codigo dice de quien depende cada
  // documento —F-EST-01-02 cuelga de MP-EST-01— asi que los hijos se
  // dibujan debajo de su manual de proceso, indentados, y no en el lugar
  // que les tocaria por orden alfabetico.
  //
  // Con una columna ordenada no hay arbol: la lista viene por otra cosa
  // y anidar ahi seria mezclar dos criterios.
  const { hijosPorPadre, esHijo } = columna
    ? { hijosPorPadre: new Map<string, FilaDocumento[]>(), esHijo: new Set<string>() }
    : armarJerarquia(documentos);

  // Cada fila sabe si cuelga de otra y si abre una categoria. Se calcula
  // una sola vez al armar la lista, que es cuando se conoce cual fue la
  // ultima categoria de primer nivel: un hijo no abre categoria, y si se
  // mirara solo la fila anterior, el documento que viene despues de un
  // hijo abriria una que ya estaba abierta.
  const filas: { documento: FilaDocumento; esHijo: boolean; abreCategoria: boolean }[] = [];
  let categoriaAbierta: string | null | undefined = undefined;

  for (const documento of documentos) {
    if (esHijo.has(documento.id)) continue;

    const abre = !columna && categoriaAbierta !== documento.categoria;
    if (abre) categoriaAbierta = documento.categoria;

    filas.push({ documento, esHijo: false, abreCategoria: abre });
    for (const hijo of hijosPorPadre.get(documento.id) ?? []) {
      filas.push({ documento: hijo, esHijo: true, abreCategoria: false });
    }
  }

  // El orden global de las categorias, sacado de la lista maestra y no
  // de la pestaña abierta: una categoria que hoy solo tiene borradores
  // igual ocupa su lugar, y que el orden cambiara segun la pestaña
  // seria imposible de entender.
  const ordenGlobalCategorias: (string | null)[] = [];
  for (const documento of maestra) {
    if (!ordenGlobalCategorias.includes(documento.categoria)) {
      ordenGlobalCategorias.push(documento.categoria);
    }
  }

  // Los ids de cada categoria, en el orden en que se ven. Es lo que
  // necesita el arrastre para recalcular las posiciones al soltar.
  const CLAVE_SIN_CATEGORIA = "__sin_categoria__";
  const grupos: Record<string, string[]> = {};
  for (const { documento, esHijo: colgado } of filas) {
    if (colgado) continue;
    const clave = documento.categoria ?? CLAVE_SIN_CATEGORIA;
    (grupos[clave] ??= []).push(documento.id);
  }

  // Se arrastra cuando hay orden manual que tocar: si la lista viene
  // ordenada por una columna, mover una fila no significa nada.
  const seArrastra = puedeOrdenar && !columna;

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
          <ProveedorArrastre
            grupos={seArrastra ? grupos : {}}
            categorias={seArrastra ? ordenGlobalCategorias : []}
          >
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
                <TablaEncabezado className="w-[4.5rem] text-right">Ficha</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {filas.map(({ documento, esHijo: colgado, abreCategoria }) => {

                // Tocar el codigo o el titulo abre el archivo, no la ficha:
                // quien entra al control documental viene a leer el
                // procedimiento. La ficha queda en su propia columna.
                const abre = tieneArchivo.has(documento.id);
                const destino = abre
                  ? `/documentos/${documento.id}/archivo`
                  : `/documentos/${documento.id}`;
                const rotulo = abre
                  ? "Abrir el archivo"
                  : "Este documento todavía no tiene archivo cargado";

                return (
                  <React.Fragment key={documento.id}>
                    {abreCategoria ? (
                      <FilaCategoria categoria={documento.categoria}>
                        <td
                          colSpan={12}
                          className="px-3 py-1.5 text-[11px] font-semibold uppercase
                                     tracking-wide text-atenuado-contraste"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <span>{documento.categoria ?? "Sin categoría"}</span>
                            {puedeOrdenar ? (
                              <MoverCategoria
                                categoria={documento.categoria}
                                esPrimera={
                                  ordenGlobalCategorias.indexOf(documento.categoria) === 0
                                }
                                esUltima={
                                  ordenGlobalCategorias.indexOf(documento.categoria) ===
                                  ordenGlobalCategorias.length - 1
                                }
                              />
                            ) : null}
                          </div>
                        </td>
                      </FilaCategoria>
                    ) : null}
                  <FilaArrastrable
                    id={documento.id}
                    grupo={colgado ? "" : documento.categoria ?? CLAVE_SIN_CATEGORIA}
                    fijo={colgado}
                  >
                    {puedeEliminar ? (
                      <TablaCelda>
                        <CasillaDocumento id={documento.id} titulo={documento.titulo} />
                      </TablaCelda>
                    ) : null}
                    <TablaCelda className="font-medium tabular">
                      <Link
                        href={destino}
                        style={colgado ? { paddingLeft: "1.5rem" } : undefined}
                        title={rotulo}
                        draggable={false}
                        className="hover:text-primario"
                      >
                        {documento.codigo ?? <span className="text-atenuado-contraste">—</span>}
                      </Link>
                    </TablaCelda>
                    <TablaCelda>
                      <Link
                        href={destino}
                        title={rotulo}
                        draggable={false}
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
                    <TablaCelda className="text-right">
                      <Link
                        href={`/documentos/${documento.id}`}
                        draggable={false}
                        className="text-xs text-primario hover:underline"
                      >
                        Ver
                      </Link>
                    </TablaCelda>
                  </FilaArrastrable>
                  </React.Fragment>
                );
              })}
            </TablaCuerpo>
          </Tabla>
          </Tarjeta>
          </ProveedorArrastre>
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
        {seArrastra
          ? " Para reordenar, arrastre la fila a donde va. El renglón de la categoría se " +
            "arrastra igual y se lleva sus documentos, y sus flechas la mueven de a un lugar. " +
            "«Categorías» arma los grupos."
          : ""}
        {columna
          ? " Ordenado por una columna: toque el encabezado una vez más para volver al orden de la carpeta."
          : ""}
      </p>
    </>
  );
}
