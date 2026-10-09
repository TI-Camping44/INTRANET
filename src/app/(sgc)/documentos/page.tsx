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
import { BotonReindexar } from "@/app/(sgc)/documentos/boton-reindexar";
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
import { formatearFecha, hoyEnAsuncion, sumarDias } from "@/lib/formato";
import { recortar } from "@/lib/utilidades";
import type { EstadoDocumento, TipoDocumento } from "@/lib/tipos";

export const metadata: Metadata = { title: "Lista Maestra de la Información documentada" };
export const dynamic = "force-dynamic";

interface FilaDocumento {
  id: string;
  codigo: string | null;
  titulo: string;
  tipo: TipoDocumento;
  estado: EstadoDocumento;
  version_actual: number;
  fecha_vigencia: string | null;
  fecha_proxima_revision: string | null;
  proceso_documento_id: string | null;
  actualizado_en: string;
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
  // «Todos» es la pestaña de entrada y la que el menú nombra: es la
  // lista maestra, o sea lo que está en uso.
  //
  // NO LLEVA LOS OBSOLETOS. Dirección lo pidió el 9 de octubre: un
  // documento que se retiró de circulación mezclado con los vigentes es
  // justo lo que hace que alguien trabaje con la versión equivocada.
  // Tienen su propia pestaña, que es donde la norma pide conservarlos.
  //
  // Los anulados tampoco: están fuera de uso y se consultan por la
  // ficha, que sigue abierta, y por la bitácora.
  todos: {
    etiqueta: "Todos",
    estados: ["borrador", "en_revision", "en_aprobacion", "vigente"],
  },
  vigentes: { etiqueta: "Vigentes", estados: ["vigente"] },
  // LAS TRES ETAPAS, SEPARADAS. Antes iban juntas en «En elaboración» y
  // no se veía en qué escritorio estaba parado un documento. Dirección
  // las separó el 8 de octubre: en elaboración es el borrador, en
  // validación está con los revisores y en aprobación espera la firma.
  // Un documento sale solo de cada lista cuando el paso se cumple: el
  // validado pasa a aprobación, el aprobado pasa a vigente.
  "en-proceso": { etiqueta: "En elaboración", estados: ["borrador"] },
  "en-validacion": { etiqueta: "En validación", estados: ["en_revision"] },
  "en-aprobacion": { etiqueta: "En aprobación", estados: ["en_aprobacion"] },
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
    responsable?: string;
    empresa?: string;
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

  const vista = searchParams.vista && searchParams.vista in VISTAS ? searchParams.vista : "todos";
  const limiteRevision = sumarDias(hoyEnAsuncion(), DIAS_AVISO_REVISION_DOCUMENTO);
  const { estados } = VISTAS[vista];

  const [{ data: responsables }, { data: todos }, { data: datosEmpresas }] =
    await Promise.all([
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
    // Para rotular cada pestaña con su cantidad hace falta el estado de
    // todos los documentos, no solo el de los de la vista actual. Con la
    // misma consulta se arma el panel de categorías, que agrupa la lista
    // maestra entera y no la pestaña abierta.
    supabase
      .from("documentos")
      .select("id, codigo, titulo, estado, categoria, orden, orden_categoria, empresa_documento_id")
      .order("orden_categoria", { nullsFirst: true })
      .order("categoria", { nullsFirst: true })
      .order("orden", { nullsFirst: false })
      .order("codigo", { nullsFirst: false }),
    // Las dos empresas del grupo, para los botones que parten la lista.
    supabase.rpc("empresas_del_grupo"),
  ]);

  const empresasDelGrupo = (datosEmpresas as { id: string; nombre: string }[] | null) ?? [];

  const maestra =
    (todos as
      | {
          id: string;
          codigo: string | null;
          titulo: string;
          estado: EstadoDocumento;
          categoria: string | null;
          orden_categoria: number | null;
          empresa_documento_id: string | null;
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
      "id, codigo, titulo, tipo, estado, version_actual, fecha_vigencia, " +
        "fecha_proxima_revision, es_demostracion, categoria, orden, orden_categoria, " +
        "proceso_documento_id, actualizado_en",
    )
    .in("estado", estados);

  // LA EMPRESA DEL GRUPO. Es el corte de los dos botones de arriba:
  // misma vista, distinta empresa.
  if (searchParams.empresa) {
    consulta = consulta.eq("empresa_documento_id", searchParams.empresa);
  }

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
  if (searchParams.responsable) {
    consulta = consulta.eq("responsable_id", searchParams.responsable);
  }
  if (searchParams.q) {
    const texto = `%${searchParams.q}%`;
    consulta = consulta.or(`codigo.ilike.${texto},titulo.ilike.${texto}`);
  }
  if (searchParams.filtro === "por-revisar") {
    consulta = consulta.lte(
      "fecha_proxima_revision",
      limiteRevision,
    );
  }

  const { data, error } = await consulta;
  const documentos = (data as unknown as FilaDocumento[] | null) ?? [];

  // LAS VERSIONES REEMPLAZADAS. Un documento que se actualizó de versión
  // sigue siendo un solo registro: lo que quedó atrás es su versión
  // anterior, en obsoleto.
  //
  // OBSOLETO ES UNO SOLO. Dirección lo dijo el 9 de octubre: si un
  // documento se reemplaza o deja de existir, queda obsoleto, y no hay
  // dos categorías. Así que la pestaña los mezcla en una sola lista y
  // los cuenta juntos.
  //
  // La consulta va siempre, no solo en esa pestaña: el número entre
  // paréntesis se ve desde cualquiera.
  const { data: datosReemplazadas } = await supabase
    .from("documento_versiones")
    .select(
      "id, version, creado_en, resumen_cambios, " +
        "documentos:documento_id (id, codigo, titulo, tipo, estado, actualizado_en)",
    )
    .eq("estado", "obsoleto")
    .order("creado_en", { ascending: false });

  // Las de un documento que ya está obsoleto entero no se repiten: ese
  // documento ya tiene su propia fila.
  const reemplazadas = (
    (datosReemplazadas as unknown as {
      id: string;
      version: number;
      creado_en: string;
      resumen_cambios: string | null;
      documentos: {
        id: string;
        codigo: string | null;
        titulo: string;
        tipo: TipoDocumento;
        estado: EstadoDocumento;
        actualizado_en: string;
      } | null;
    }[] | null) ?? []
  ).filter((version) => version.documentos && version.documentos.estado !== "obsoleto");

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

  // LA LISTA DE OBSOLETOS, UNA SOLA. El documento retirado entero y la
  // versión reemplazada son lo mismo para quien mira: algo que dejó de
  // estar en uso. Van en la misma tabla, ordenados por fecha, con la
  // versión de cada uno y por qué quedó obsoleto.
  const obsoletos = [
    ...documentos.map((documento) => ({
      clave: documento.id,
      documentoId: documento.id,
      codigo: documento.codigo,
      titulo: documento.titulo,
      tipo: documento.tipo,
      version: documento.version_actual,
      fecha: documento.actualizado_en,
      motivo: "Retirado de circulación",
    })),
    ...reemplazadas.map((version) => ({
      clave: version.id,
      documentoId: version.documentos!.id,
      codigo: version.documentos!.codigo,
      titulo: version.documentos!.titulo,
      tipo: version.documentos!.tipo,
      version: version.version,
      // Cuándo quedó atrás, no cuándo se creó: el documento se tocó por
      // última vez al subirle la versión que la reemplazó.
      fecha: version.documentos!.actualizado_en,
      motivo: "Reemplazada por una versión nueva",
    })),
  ].sort((uno, otro) => (otro.fecha ?? "").localeCompare(uno.fecha ?? ""));

  // Se arrastra cuando hay orden manual que tocar: si la lista viene
  // ordenada por una columna, mover una fila no significa nada.
  const seArrastra = puedeOrdenar && !columna;

  const vistas = Object.entries(VISTAS).map(([valor, { etiqueta, estados: suyos }]) => ({
    valor,
    etiqueta,
    // «Obsoletos» cuenta las dos cosas que lo son: el documento que se
    // retiró entero y la versión que fue reemplazada por otra.
    cantidad:
      maestra.filter((documento) => suyos.includes(documento.estado)).length +
      (valor === "obsoletos" ? reemplazadas.length : 0),
  }));

  return (
    <>
      <EncabezadoPagina
        titulo="Lista Maestra de la Información documentada"
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
              {/* Reindexar es del Administrador SGC, no de cualquiera
                  que pueda gestionar: lee TODOS los documentos, no los
                  suyos. La accion lo vuelve a controlar; ocultar el boton
                  no es un control de acceso. */}
              {puedeEliminar ? <BotonReindexar /> : null}
              <Boton comoHijo>
                <Link href="/documentos/nuevo">
                  <Plus /> Nuevo documento
                </Link>
              </Boton>
            </>
          ) : null
        }
      />

      {/* LOS DOS BOTONES DE EMPRESA, debajo del título. Misma vista,
          distinta empresa: solo parten la lista maestra en dos. El rojo
          es el institucional de Camping 44 y el naranja el de Vitalica,
          que son los de sus logotipos: acá el color identifica a la
          empresa, así que va fijo y no sale de las variables del tema.
          El texto dice lo mismo que el color. */}
      <div className="mb-3 flex flex-wrap gap-2">
        {[{ id: "", nombre: "Todas las empresas" }, ...empresasDelGrupo].map((empresa) => {
          const elegida = (searchParams.empresa ?? "") === empresa.id;
          const parametros = new URLSearchParams(
            Object.entries(searchParams).filter(
              ([clave, valor]) => clave !== "empresa" && typeof valor === "string" && valor,
            ) as [string, string][],
          );
          if (empresa.id) parametros.set("empresa", empresa.id);
          const cola = parametros.toString();

          const deCamping = empresa.nombre.toLowerCase().startsWith("camping");
          const color = !empresa.id
            ? "border-borde text-atenuado-contraste hover:bg-acento"
            : deCamping
              ? "border-[#E01E37] text-[#E01E37] hover:bg-[#E01E37]/10"
              : "border-[#F47B20] text-[#F47B20] hover:bg-[#F47B20]/10";
          const elegidaColor = !empresa.id
            ? "border-primario bg-primario/10 text-primario"
            : deCamping
              ? "border-[#E01E37] bg-[#E01E37]/10 text-[#E01E37]"
              : "border-[#F47B20] bg-[#F47B20]/10 text-[#F47B20]";

          const cuantos = empresa.id
            ? maestra.filter((documento) => documento.empresa_documento_id === empresa.id).length
            : maestra.length;

          return (
            <Link
              key={empresa.id || "todas"}
              href={cola ? `/documentos?${cola}` : "/documentos"}
              className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                elegida ? elegidaColor : color
              }`}
            >
              {empresa.nombre} ({cuantos})
            </Link>
          );
        })}
      </div>

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
            nombre: "responsable",
            etiqueta: "Responsable",
            opciones: (responsables ?? []).map(
              (persona: { id: string; nombre_completo: string }) => ({
                valor: persona.id,
                etiqueta: persona.nombre_completo,
              }),
            ),
          },
          {
            // Era alcanzable solo escribiendo la direccion a mano. Es el
            // corte que Calidad mira todas las semanas: lo que hay que
            // revisar antes de que se venza.
            nombre: "filtro",
            etiqueta: "Revisión",
            opciones: [
              { valor: "por-revisar", etiqueta: `Vence en ${DIAS_AVISO_REVISION_DOCUMENTO} días` },
            ],
          },
        ]}
      />

      {error ? (
        <EstadoVacio
          titulo="No se pudo cargar el listado"
          descripcion={error.message}
          icono={<FileText className="size-6" />}
        />
      ) : vista === "obsoletos" ? (
        obsoletos.length === 0 ? (
          <EstadoVacio
            icono={<FileText className="size-6" />}
            titulo="No hay nada obsoleto"
            descripcion="Acá quedan los documentos que se retiraron de circulación y las versiones que fueron reemplazadas por una más nueva."
          />
        ) : (
          <>
            <Tarjeta>
              <Tabla>
                <TablaCabecera>
                  <TablaFila>
                    <TablaEncabezado className="w-[9rem]">Código</TablaEncabezado>
                    <TablaEncabezado>Título</TablaEncabezado>
                    <TablaEncabezado className="hidden md:table-cell">Tipo</TablaEncabezado>
                    <TablaEncabezado className="w-[6rem]">Versión</TablaEncabezado>
                    <TablaEncabezado className="hidden lg:table-cell">
                      Por qué está acá
                    </TablaEncabezado>
                    <TablaEncabezado className="hidden w-[9rem] sm:table-cell">
                      Quedó obsoleto
                    </TablaEncabezado>
                    <TablaEncabezado className="w-[4.5rem] text-right">Ficha</TablaEncabezado>
                  </TablaFila>
                </TablaCabecera>
                <TablaCuerpo>
                  {obsoletos.map((fila) => (
                    <TablaFila key={fila.clave}>
                      <TablaCelda className="font-medium tabular">
                        {fila.codigo ?? <span className="text-atenuado-contraste">—</span>}
                      </TablaCelda>
                      <TablaCelda className="text-xs">{recortar(fila.titulo, 80)}</TablaCelda>
                      <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                        {ETIQUETAS_TIPO_DOCUMENTO[fila.tipo]}
                      </TablaCelda>
                      <TablaCelda className="tabular text-xs">
                        Ver.{String(fila.version).padStart(2, "0")}
                      </TablaCelda>
                      <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                        {fila.motivo}
                      </TablaCelda>
                      <TablaCelda className="hidden whitespace-nowrap text-xs text-atenuado-contraste sm:table-cell">
                        {fila.fecha ? formatearFecha(fila.fecha) : "—"}
                      </TablaCelda>
                      <TablaCelda className="text-right">
                        <Link
                          href={`/documentos/${fila.documentoId}`}
                          className="text-xs text-primario hover:underline"
                        >
                          Ver
                        </Link>
                      </TablaCelda>
                    </TablaFila>
                  ))}
                </TablaCuerpo>
              </Tabla>
            </Tarjeta>

            <p className="mt-3 text-[11px] text-atenuado-contraste">
              {obsoletos.length} obsoleto{obsoletos.length === 1 ? "" : "s"}: documentos
              retirados de circulación y versiones reemplazadas por una más nueva. «Ver» abre la
              ficha, con el historial de versiones y el archivo de cada una.
            </p>
          </>
        )
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
                <TablaEncabezado className="hidden w-[7rem] xl:table-cell">
                  Vigencia
                </TablaEncabezado>
                <TablaEncabezado className="hidden w-[8rem] lg:table-cell">
                  Próxima revisión
                </TablaEncabezado>
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
                // La proxima revision se resalta cuando entra en la
                // ventana de aviso: es la columna que Calidad mira.
                const porRevisar =
                  documento.estado === "vigente" &&
                  documento.fecha_proxima_revision !== null &&
                  documento.fecha_proxima_revision <= limiteRevision;
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
                          colSpan={10}
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
                      Ver.{String(documento.version_actual).padStart(2, "0")}
                    </TablaCelda>
                    <TablaCelda className="hidden whitespace-nowrap text-xs xl:table-cell">
                      {documento.fecha_vigencia ? (
                        formatearFecha(documento.fecha_vigencia)
                      ) : (
                        <span className="text-atenuado-contraste">—</span>
                      )}
                    </TablaCelda>
                    <TablaCelda className="hidden whitespace-nowrap text-xs lg:table-cell">
                      {documento.fecha_proxima_revision ? (
                        <span className={porRevisar ? "font-medium text-semaforo-medio" : ""}>
                          {formatearFecha(documento.fecha_proxima_revision)}
                        </span>
                      ) : (
                        <span className="text-atenuado-contraste">—</span>
                      )}
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

      {documentos.length > 0 ? (
      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {documentos.length} documento{documentos.length === 1 ? "" : "s"} en el listado.{" "}
        {vista === "vigentes"
          ? "Es lo que está en vigencia hoy; las versiones reemplazadas están en «Obsoletos»."
          : null}{" "}
        Tocar el código o el título abre el archivo; «Ver» lleva a la ficha con el historial de
        versiones.
        {puedeEliminar ? " Marque las casillas para anular varios de una vez." : ""}
        {seArrastra
          ? " Para reordenar, arrastre la fila a donde va. El renglón de la categoría se " +
            "arrastra igual y se lleva sus documentos, y sus flechas la mueven de a un lugar. " +
            "«Categorías» arma los grupos."
          : ""}
        {columna
          ? " Ordenado por una columna: toque el encabezado una vez más para volver al orden de la carpeta."
          : ""}
      </p>
      ) : null}

    </>
  );
}
