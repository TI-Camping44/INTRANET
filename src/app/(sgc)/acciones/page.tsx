import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, Plus } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { PestanasListado } from "@/components/comunes/pestanas-listado";
import { InsigniaEstadoAccion } from "@/components/comunes/insignias-estado";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta, TarjetaCabecera, TarjetaTitulo } from "@/components/ui/tarjeta";
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import { esSoloLectura, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import {
  ESTADOS_NC_ABIERTOS,
  ETIQUETAS_ESTADO_ACCION,
  ETIQUETAS_TIPO_ACCION,
} from "@/lib/constantes";
import { describirVencimiento, formatearFecha, hoyEnAsuncion } from "@/lib/formato";
import { recortar } from "@/lib/utilidades";
import type { EstadoAccion, TipoAccion } from "@/lib/tipos";

export const metadata: Metadata = { title: "Acciones correctivas" };
export const dynamic = "force-dynamic";

interface FilaAccion {
  id: string;
  no_conformidad_id: string;
  tipo: TipoAccion;
  descripcion: string;
  estado: EstadoAccion;
  fecha_limite: string;
  fecha_ejecucion: string | null;
  nivel_escalamiento: number;
  responsable: { nombre_completo: string } | null;
  no_conformidad: { codigo: string; titulo: string } | null;
}

/**
 * El plan de acción de todas las no conformidades, en una sola tabla.
 *
 * Hasta ahora las acciones vivían dentro de la ficha de su no
 * conformidad. Eso sirve para tratar una desviación, pero no para la
 * pregunta que hace Calidad todas las semanas: qué está pendiente y
 * quién lo debe. Con quince no conformidades abiertas, contestarla
 * costaba abrir quince fichas.
 *
 * No hay alta acá. Una acción correctiva nace de una no conformidad, no
 * suelta: se carga desde la ficha de la desviación que la origina.
 */
const VISTAS: Record<string, { etiqueta: string; estados: EstadoAccion[] }> = {
  pendientes: { etiqueta: "Pendientes", estados: ["pendiente", "en_curso"] },
  ejecutadas: { etiqueta: "Ejecutadas", estados: ["ejecutada", "verificada"] },
  todas: {
    etiqueta: "Todas",
    estados: ["pendiente", "en_curso", "ejecutada", "verificada", "cancelada"],
  },
};

export default async function PaginaAcciones({
  searchParams,
}: {
  searchParams: { q?: string; vista?: string; estado?: string; tipo?: string; filtro?: string };
}) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();
  const hoy = hoyEnAsuncion();
  const soloLectura = esSoloLectura(usuario);

  const vista =
    searchParams.vista && searchParams.vista in VISTAS ? searchParams.vista : "pendientes";
  const { estados } = VISTAS[vista];

  let consulta = supabase
    .from("nc_acciones")
    .select(
      "id, no_conformidad_id, tipo, descripcion, estado, fecha_limite, fecha_ejecucion, " +
        "nivel_escalamiento, responsable:responsable_id (nombre_completo), " +
        "no_conformidad:no_conformidad_id (codigo, titulo)",
    )
    .in("estado", estados)
    // Por fecha límite ascendente: lo que vence antes va arriba. Es un
    // listado de trabajo, no un archivo.
    .order("fecha_limite", { ascending: true });

  if (searchParams.estado) consulta = consulta.eq("estado", searchParams.estado);
  if (searchParams.tipo) consulta = consulta.eq("tipo", searchParams.tipo);
  if (searchParams.filtro === "mias") consulta = consulta.eq("responsable_id", usuario.id);
  if (searchParams.filtro === "vencidas") consulta = consulta.lt("fecha_limite", hoy);
  if (searchParams.q) consulta = consulta.ilike("descripcion", `%${searchParams.q}%`);

  // Para rotular las pestañas hace falta el estado de todas, no solo el
  // de las de la vista actual.
  //
  // La tercera consulta es la que contesta lo que Calidad pidió: quien
  // recibe una no conformidad tiene que analizarla y proponer la acción
  // correctiva, así que al entrar acá lo primero que necesita ver es qué
  // desviaciones suyas todavía no tienen plan. Sin esto, una no
  // conformidad asignada y sin acciones no aparece en ningún listado:
  // hay que acordarse de ella.
  const [{ data, error }, { data: todas }, { data: mias }] = await Promise.all([
    consulta,
    supabase.from("nc_acciones").select("estado"),
    supabase
      .from("no_conformidades")
      .select("id, codigo, titulo, responsable_id, fecha_limite_cierre, nc_acciones (id)")
      .in("estado", ESTADOS_NC_ABIERTOS)
      .order("fecha_limite_cierre", { ascending: true }),
  ]);

  // Las abiertas que todavía no tienen ninguna acción cargada. Van todas,
  // no solo las propias: Calidad pidió que quien ve cómo resolver una
  // desviación pueda proponerlo aunque no le haya tocado a él. Las que
  // están a nombre de quien mira van primero, porque de esas responde.
  const sinPlan = (
    (mias as
      | {
          id: string;
          codigo: string;
          titulo: string;
          responsable_id: string | null;
          fecha_limite_cierre: string | null;
          nc_acciones: { id: string }[] | null;
        }[]
      | null) ?? []
  )
    .filter((nc) => (nc.nc_acciones ?? []).length === 0)
    .sort((a, b) => {
      const miaA = a.responsable_id === usuario.id ? 0 : 1;
      const miaB = b.responsable_id === usuario.id ? 0 : 1;
      if (miaA !== miaB) return miaA - miaB;
      return (a.fecha_limite_cierre ?? "").localeCompare(b.fecha_limite_cierre ?? "");
    });

  const miasSinPlan = sinPlan.filter((nc) => nc.responsable_id === usuario.id).length;

  const acciones = (data as FilaAccion[] | null) ?? [];

  const estadosCargados = (todas as { estado: EstadoAccion }[] | null) ?? [];
  const vistas = Object.entries(VISTAS).map(([valor, { etiqueta, estados: suyos }]) => ({
    valor,
    etiqueta,
    cantidad: estadosCargados.filter((accion) => suyos.includes(accion.estado)).length,
  }));

  const vencidas = acciones.filter(
    (accion) =>
      ["pendiente", "en_curso"].includes(accion.estado) && accion.fecha_limite < hoy,
  ).length;

  return (
    <>
      <EncabezadoPagina
        titulo="Acciones correctivas"
        descripcion="El plan de acción de todas las no conformidades, junto. Puede cargar una acción sobre cualquier desviación abierta, también sobre una que no esté a su nombre."
        acciones={
          soloLectura ? null : (
            <Boton comoHijo>
              <Link href="/acciones/nueva">
                <Plus /> Nueva acción correctiva
              </Link>
            </Boton>
          )
        }
      />

      <PestanasListado
        nombre="vista"
        ruta="/acciones"
        actual={vista}
        vistas={vistas}
        parametros={searchParams}
      />

      <FiltrosListado
        marcadorBusqueda="Buscar en la descripción de la acción…"
        campos={[
          {
            nombre: "tipo",
            etiqueta: "Tipo",
            opciones: Object.entries(ETIQUETAS_TIPO_ACCION).map(([valor, etiqueta]) => ({
              valor,
              etiqueta,
            })),
          },
          {
            nombre: "estado",
            etiqueta: "Estado",
            opciones: Object.entries(ETIQUETAS_ESTADO_ACCION).map(([valor, etiqueta]) => ({
              valor,
              etiqueta,
            })),
          },
          {
            nombre: "filtro",
            etiqueta: "Ver",
            opciones: [
              { valor: "mias", etiqueta: "A mi cargo" },
              { valor: "vencidas", etiqueta: "Vencidas" },
            ],
          },
        ]}
      />

      {sinPlan.length > 0 ? (
        <Tarjeta className={`mb-4 ${miasSinPlan > 0 ? "border-semaforo-alto/40" : ""}`}>
          <TarjetaCabecera className="pb-2">
            <TarjetaTitulo className={miasSinPlan > 0 ? "text-semaforo-alto" : undefined}>
              No conformidades sin plan de acción
            </TarjetaTitulo>
            <p className="text-xs text-atenuado-contraste">
              {miasSinPlan > 0
                ? `${miasSinPlan} ${
                    miasSinPlan === 1 ? "está a su nombre y espera" : "están a su nombre y esperan"
                  } su análisis. Las demás puede tomarlas igual: si ve cómo resolver una, cárguele la acción.`
                : "Ninguna está a su nombre, pero puede cargarle la acción a cualquiera de estas."}
            </p>
          </TarjetaCabecera>
          <div className="px-4 pb-4">
            <ul className="divide-y divide-borde">
              {sinPlan.map((nc) => (
                <li key={nc.id} className="flex items-center gap-3 py-2">
                  <Link
                    href={`/no-conformidades/${nc.id}`}
                    className="min-w-0 flex-1 text-xs hover:text-primario"
                  >
                    <span className="tabular text-atenuado-contraste">{nc.codigo}</span>{" "}
                    <span className="font-medium">{recortar(nc.titulo, 70)}</span>
                    {nc.responsable_id === usuario.id ? (
                      <span className="ml-2 text-[10px] font-medium text-semaforo-alto">
                        A su nombre
                      </span>
                    ) : null}
                  </Link>
                  {nc.fecha_limite_cierre ? (
                    <span
                      className={`shrink-0 text-[11px] ${
                        nc.fecha_limite_cierre < hoy
                          ? "text-semaforo-critico"
                          : "text-atenuado-contraste"
                      }`}
                    >
                      {describirVencimiento(nc.fecha_limite_cierre)}
                    </span>
                  ) : null}
                  {soloLectura ? null : (
                    <Boton variante="contorno" tamano="pequeno" comoHijo className="shrink-0">
                      <Link href={`/acciones/nueva?nc=${nc.id}`}>
                        <Plus /> Acción correctiva
                      </Link>
                    </Boton>
                  )}
                </li>
              ))}
            </ul>
          </div>
        </Tarjeta>
      ) : null}

      {vencidas > 0 ? (
        <p className="mb-3 text-xs text-semaforo-critico">
          {vencidas} {vencidas === 1 ? "acción pasó" : "acciones pasaron"} su fecha límite sin
          ejecutarse.
        </p>
      ) : null}

      {error ? (
        <EstadoVacio
          titulo="No se pudo cargar el listado"
          descripcion={error.message}
          icono={<ListChecks className="size-6" />}
        />
      ) : acciones.length === 0 ? (
        <EstadoVacio
          icono={<ListChecks className="size-6" />}
          titulo={
            vista === "pendientes" ? "Sin acciones pendientes" : "No hay acciones que coincidan"
          }
          descripcion={
            vista === "pendientes"
              ? "Ninguna acción correctiva está esperando ejecución."
              : "Ajuste los filtros o cargue una acción sobre una desviación abierta."
          }
          accion={
            soloLectura ? null : (
              <Boton comoHijo tamano="pequeno">
                <Link href="/acciones/nueva">
                  <Plus /> Nueva acción correctiva
                </Link>
              </Boton>
            )
          }
        />
      ) : (
        <Tarjeta>
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado className="w-[9rem]">No conformidad</TablaEncabezado>
                <TablaEncabezado>Acción</TablaEncabezado>
                <TablaEncabezado className="hidden md:table-cell">Tipo</TablaEncabezado>
                <TablaEncabezado className="hidden lg:table-cell">Responsable</TablaEncabezado>
                <TablaEncabezado className="w-[9rem]">Fecha límite</TablaEncabezado>
                <TablaEncabezado className="w-[7rem]">Estado</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {acciones.map((accion) => {
                const pendiente = ["pendiente", "en_curso"].includes(accion.estado);
                const vencida = pendiente && accion.fecha_limite < hoy;

                return (
                  <TablaFila key={accion.id}>
                    <TablaCelda className="font-medium tabular">
                      <Link
                        href={`/no-conformidades/${accion.no_conformidad_id}`}
                        className="hover:text-primario"
                      >
                        {accion.no_conformidad?.codigo ?? "—"}
                      </Link>
                    </TablaCelda>
                    <TablaCelda>
                      <Link
                        href={`/no-conformidades/${accion.no_conformidad_id}`}
                        className="hover:text-primario"
                      >
                        {recortar(accion.descripcion, 90)}
                      </Link>
                      {accion.nivel_escalamiento > 0 ? (
                        <span className="ml-2 text-[10px] text-semaforo-alto">
                          Escalada (nivel {accion.nivel_escalamiento})
                        </span>
                      ) : null}
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                      {ETIQUETAS_TIPO_ACCION[accion.tipo]}
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs lg:table-cell">
                      {accion.responsable?.nombre_completo ?? (
                        <span className="text-atenuado-contraste">Sin asignar</span>
                      )}
                    </TablaCelda>
                    <TablaCelda className="text-xs">
                      <span className={vencida ? "text-semaforo-critico" : undefined}>
                        {formatearFecha(accion.fecha_limite)}
                      </span>
                      {pendiente ? (
                        <span
                          className={`block text-[10px] ${
                            vencida ? "text-semaforo-critico" : "text-atenuado-contraste"
                          }`}
                        >
                          {describirVencimiento(accion.fecha_limite)}
                        </span>
                      ) : null}
                    </TablaCelda>
                    <TablaCelda>
                      <InsigniaEstadoAccion estado={accion.estado} />
                    </TablaCelda>
                  </TablaFila>
                );
              })}
            </TablaCuerpo>
          </Tabla>
        </Tarjeta>
      )}

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {acciones.length} {acciones.length === 1 ? "acción" : "acciones"} en el listado.
      </p>
    </>
  );
}
