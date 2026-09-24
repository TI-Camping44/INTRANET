import type { Metadata } from "next";
import Link from "next/link";
import { Lightbulb, Plus } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import {
  InsigniaDemostracion,
  InsigniaEstadoRiesgo,
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
import { ETIQUETAS_ESTADO_RIESGO } from "@/lib/constantes";
import { formatearFecha } from "@/lib/formato";
import {
  CLASES_PRIORIDAD,
  ETIQUETAS_ALINEACION,
  ETIQUETAS_PRIORIDAD,
  prioridadOportunidad,
} from "@/lib/riesgos";
import { cn, recortar } from "@/lib/utilidades";
import type { EstadoRiesgo } from "@/lib/tipos";

export const metadata: Metadata = { title: "Oportunidades" };
export const dynamic = "force-dynamic";

/**
 * Matriz de oportunidades, el F-EST-01-04.
 *
 * Pantalla propia y no una pestaña de riesgos, porque no se valoran
 * igual. Una oportunidad no tiene probabilidad ni severidad: tiene
 * Beneficio por Factibilidad, y de ahí sale su índice y su prioridad.
 * Mezcladas con los riesgos, la mitad de las columnas quedaba vacía en
 * cada fila y el semáforo no significaba lo mismo en unas que en otras.
 *
 * La alineación con la dirección estratégica se muestra al lado de la
 * prioridad y no dentro del índice: es una condición, no un puntaje. Una
 * oportunidad de índice alto con alineación baja no se aborda, y esa
 * decisión queda escrita.
 */
interface FilaOportunidad {
  id: string;
  codigo: string;
  titulo: string;
  estado: EstadoRiesgo;
  origen: string | null;
  efecto_deseado: string | null;
  beneficio: number | null;
  factibilidad: number | null;
  indice: number | null;
  alineacion_estrategica: string | null;
  se_decide_abordar: boolean | null;
  accion_planificada: string | null;
  plazo_accion: string | null;
  es_demostracion: boolean;
  procesos: { nombre: string } | null;
  responsable: { nombre_completo: string } | null;
}

export default async function PaginaOportunidades({
  searchParams,
}: {
  searchParams: { q?: string; estado?: string; prioridad?: string; proceso?: string };
}) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: procesos } = await supabase
    .from("procesos")
    .select("id, nombre")
    .eq("activo", true)
    .order("nombre");

  let consulta = supabase
    .from("riesgos")
    .select(
      "id, codigo, titulo, estado, origen, efecto_deseado, beneficio, factibilidad, indice, " +
        "alineacion_estrategica, se_decide_abordar, accion_planificada, plazo_accion, " +
        "es_demostracion, procesos:proceso_id (nombre), responsable:responsable_id (nombre_completo)",
    )
    .eq("tipo", "oportunidad")
    // Por índice descendente: lo que más conviene hacer va arriba. Es el
    // orden en el que se decide, no el orden en que se cargaron.
    .order("indice", { ascending: false, nullsFirst: false });

  if (searchParams.estado) consulta = consulta.eq("estado", searchParams.estado);
  if (searchParams.proceso) consulta = consulta.eq("proceso_id", searchParams.proceso);
  if (searchParams.prioridad === "alta") consulta = consulta.gte("indice", 15);
  if (searchParams.prioridad === "media") {
    consulta = consulta.gte("indice", 7).lte("indice", 14);
  }
  if (searchParams.prioridad === "baja") consulta = consulta.lte("indice", 6);
  if (searchParams.q) {
    const texto = `%${searchParams.q}%`;
    consulta = consulta.or(`codigo.ilike.${texto},titulo.ilike.${texto}`);
  }

  const { data } = await consulta;
  const oportunidades = (data as FilaOportunidad[] | null) ?? [];

  const sinValorar = oportunidades.filter((fila) => fila.indice === null).length;

  return (
    <>
      <EncabezadoPagina
        titulo="Matriz de oportunidades"
        acciones={
          <>
            <Boton variante="fantasma" comoHijo>
              <Link href="/riesgos">Riesgos</Link>
            </Boton>
            {puedeGestionar(usuario) ? (
              <Boton comoHijo>
                <Link href="/oportunidades/nueva">
                  <Plus /> Nueva oportunidad
                </Link>
              </Boton>
            ) : null}
          </>
        }
      />

      <FiltrosListado
        marcadorBusqueda="Buscar por código o título…"
        campos={[
          {
            nombre: "prioridad",
            etiqueta: "Prioridad",
            opciones: [
              { valor: "alta", etiqueta: "Alta (15 o más)" },
              { valor: "media", etiqueta: "Media (7 a 14)" },
              { valor: "baja", etiqueta: "Baja (6 o menos)" },
            ],
          },
          {
            nombre: "estado",
            etiqueta: "Estado",
            opciones: Object.entries(ETIQUETAS_ESTADO_RIESGO).map(([valor, etiqueta]) => ({
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

      {oportunidades.length === 0 ? (
        <EstadoVacio
          icono={<Lightbulb className="size-6" />}
          titulo="No hay oportunidades que coincidan"
          descripcion="Ajuste los filtros o registre la primera. Una oportunidad es una forma de hacer las cosas mejor, no un problema a resolver."
          accion={
            puedeGestionar(usuario) ? (
              <Boton comoHijo tamano="pequeno">
                <Link href="/oportunidades/nueva">
                  <Plus /> Nueva oportunidad
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
                <TablaEncabezado className="w-[7.5rem]">Código</TablaEncabezado>
                <TablaEncabezado>Oportunidad</TablaEncabezado>
                <TablaEncabezado className="hidden xl:table-cell">Origen</TablaEncabezado>
                <TablaEncabezado className="hidden lg:table-cell">Proceso</TablaEncabezado>
                <TablaEncabezado className="w-[4.5rem] text-center">B × F</TablaEncabezado>
                <TablaEncabezado className="w-[4rem] text-right">Índice</TablaEncabezado>
                <TablaEncabezado className="w-[6rem]">Prioridad</TablaEncabezado>
                <TablaEncabezado className="w-[6rem]">Alineación</TablaEncabezado>
                <TablaEncabezado className="w-[8rem]">¿Se aborda?</TablaEncabezado>
                <TablaEncabezado className="w-[8rem]">Estado</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {oportunidades.map((fila) => {
                const prioridad = prioridadOportunidad(fila.indice);

                // Índice alto y alineación baja: el instructivo dice que
                // no se aborda. Si igual se decidió hacerlo, se marca,
                // porque esa decisión tiene que tener fundamento escrito.
                const contradice =
                  fila.alineacion_estrategica === "baja" && fila.se_decide_abordar === true;

                return (
                  <TablaFila key={fila.id}>
                    <TablaCelda className="font-medium tabular">
                      <Link href={`/riesgos/${fila.id}`} className="hover:text-primario">
                        {fila.codigo}
                      </Link>
                    </TablaCelda>
                    <TablaCelda>
                      <Link
                        href={`/riesgos/${fila.id}`}
                        className="flex flex-wrap items-center gap-2 hover:text-primario"
                      >
                        <span>{recortar(fila.titulo, 65)}</span>
                        {fila.es_demostracion ? <InsigniaDemostracion /> : null}
                      </Link>
                      {fila.efecto_deseado ? (
                        <p className="mt-0.5 text-[11px] text-atenuado-contraste">
                          {recortar(fila.efecto_deseado, 90)}
                        </p>
                      ) : null}
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste xl:table-cell">
                      {fila.origen ?? "—"}
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                      {fila.procesos?.nombre ?? "—"}
                    </TablaCelda>
                    <TablaCelda className="text-center text-xs tabular">
                      {fila.beneficio !== null && fila.factibilidad !== null ? (
                        `${fila.beneficio} × ${fila.factibilidad}`
                      ) : (
                        <span className="text-semaforo-alto">Sin valorar</span>
                      )}
                    </TablaCelda>
                    <TablaCelda className="text-right text-xs font-medium tabular">
                      {fila.indice ?? "—"}
                    </TablaCelda>
                    <TablaCelda>
                      {prioridad ? (
                        <span
                          className={cn(
                            "inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium",
                            CLASES_PRIORIDAD[prioridad],
                          )}
                        >
                          {ETIQUETAS_PRIORIDAD[prioridad]}
                        </span>
                      ) : (
                        <span className="text-xs text-atenuado-contraste">—</span>
                      )}
                    </TablaCelda>
                    <TablaCelda className="text-xs text-atenuado-contraste">
                      {fila.alineacion_estrategica
                        ? ETIQUETAS_ALINEACION[fila.alineacion_estrategica]
                        : "—"}
                    </TablaCelda>
                    <TablaCelda className="text-xs">
                      {fila.se_decide_abordar === null ? (
                        <span className="text-atenuado-contraste">Sin decidir</span>
                      ) : fila.se_decide_abordar ? (
                        <span className={contradice ? "text-semaforo-alto" : undefined}>
                          {contradice ? "Sí, pese a la alineación" : "Sí"}
                        </span>
                      ) : (
                        <span className="text-atenuado-contraste">No</span>
                      )}
                      {fila.se_decide_abordar && fila.plazo_accion ? (
                        <span className="block text-[10px] text-atenuado-contraste">
                          {formatearFecha(fila.plazo_accion)}
                        </span>
                      ) : null}
                    </TablaCelda>
                    <TablaCelda>
                      <InsigniaEstadoRiesgo estado={fila.estado} />
                    </TablaCelda>
                  </TablaFila>
                );
              })}
            </TablaCuerpo>
          </Tabla>
        </Tarjeta>
      )}

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {oportunidades.length} oportunidad{oportunidades.length === 1 ? "" : "es"} en el listado.
        {sinValorar > 0 ? (
          <span className="text-semaforo-alto">
            {" "}
            {sinValorar} sin valorar: sin beneficio y factibilidad no hay índice ni prioridad.
          </span>
        ) : null}{" "}
        La eficacia se evalúa comparando el resultado obtenido contra el efecto deseado
        declarado al inicio, no contra el índice.
      </p>
    </>
  );
}
