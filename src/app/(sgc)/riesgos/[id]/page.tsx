import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { HistorialBitacora } from "@/components/comunes/historial-bitacora";
import {
  InsigniaDemostracion,
  InsigniaEstadoRiesgo,
  InsigniaNivelRiesgo,
} from "@/components/comunes/insignias-estado";
import { AccionesTratamiento } from "@/app/(sgc)/riesgos/[id]/acciones-tratamiento";
import { PanelReevaluacion } from "@/app/(sgc)/riesgos/[id]/panel-reevaluacion";
import { EliminarRiesgo } from "@/app/(sgc)/riesgos/[id]/eliminar-riesgo";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import {
  ETIQUETAS_TIPO_RIESGO,
  ETIQUETAS_TRATAMIENTO_RIESGO,
} from "@/lib/constantes";
import { describirVencimiento, formatearFecha } from "@/lib/formato";
import {
  DECISION_POR_PRIORIDAD,
  ETIQUETAS_ALINEACION,
  ETIQUETAS_PRIORIDAD,
  prioridadOportunidad,
} from "@/lib/riesgos";
import type { EstadoRiesgo, TipoRiesgo, TratamientoRiesgo } from "@/lib/tipos";

export const dynamic = "force-dynamic";

interface RiesgoDetalle {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoRiesgo;
  beneficio: number | null;
  factibilidad: number | null;
  indice: number | null;
  alineacion_estrategica: string | null;
  se_decide_abordar: boolean | null;
  efecto_deseado: string | null;
  resultado_obtenido: string | null;
  categoria: string | null;
  estado: EstadoRiesgo;
  tratamiento: TratamientoRiesgo;
  causas: string | null;
  consecuencias: string | null;
  controles_existentes: string | null;
  probabilidad: number | null;
  severidad: number;
  nivel: number;
  probabilidad_residual: number | null;
  severidad_residual: number | null;
  nivel_residual: number | null;
  fecha_identificacion: string;
  fecha_ultima_evaluacion: string;
  fecha_proxima_revision: string | null;
  es_demostracion: boolean;
  responsable_id: string | null;
  proceso_id: string | null;
  procesos: { id: string; nombre: string } | null;
  responsable: { nombre_completo: string } | null;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("riesgos")
    .select("codigo, titulo")
    .eq("id", params.id)
    .maybeSingle();

  return { title: data ? `${data.codigo} · ${data.titulo}` : "Riesgo" };
}

export default async function PaginaRiesgo({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: consulta } = await supabase
    .from("riesgos")
    .select(
      "*, procesos:proceso_id (id, nombre), responsable:responsable_id (nombre_completo)",
    )
    .eq("id", params.id)
    .maybeSingle();

  const riesgo = consulta as unknown as RiesgoDetalle | null;
  if (!riesgo) notFound();

  const [{ data: acciones }, { data: evaluaciones }, { data: personas }, { data: relacionadas }] =
    await Promise.all([
      supabase
        .from("riesgo_acciones")
        .select("*, responsable:responsable_id (nombre_completo)")
        .eq("riesgo_id", params.id)
        .order("creado_en"),
      supabase
        .from("riesgo_evaluaciones")
        .select("*, evaluador:evaluado_por (nombre_completo)")
        .eq("riesgo_id", params.id)
        .order("fecha", { ascending: false })
        .limit(12),
      supabase
        .from("usuarios")
        .select("id, nombre_completo")
        .eq("activo", true)
        .order("nombre_completo"),
      supabase
        .from("no_conformidades")
        .select("id, codigo, titulo, estado")
        .eq("riesgo_id", params.id),
    ]);

  const gestiona =
    usuario.rol === "administrador_sgc" ||
    riesgo.responsable_id === usuario.id ||
    (puedeGestionar(usuario) && riesgo.proceso_id === usuario.proceso_id);

  const prioridad = prioridadOportunidad(riesgo.indice);

  return (
    <div className="mx-auto max-w-6xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/riesgos">
          <ArrowLeft /> Volver al listado
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={riesgo.titulo}
        descripcion={riesgo.descripcion ?? undefined}
        acciones={
          <>
            {/* La ficha es una sola, pero la edición no: la oportunidad
                se valora por beneficio y factibilidad, el riesgo por
                probabilidad y severidad. Cada una va a su formulario. */}
            {gestiona ? (
              <Boton variante="contorno" tamano="pequeno" comoHijo>
                <Link
                  href={
                    riesgo.tipo === "oportunidad"
                      ? `/oportunidades/${params.id}/editar`
                      : `/riesgos/${params.id}/editar`
                  }
                >
                  <Pencil /> Editar {riesgo.tipo === "oportunidad" ? "Oportunidad" : "Riesgo"}
                </Link>
              </Boton>
            ) : null}
            {usuario.rol === "administrador_sgc" ? (
              <EliminarRiesgo
                riesgoId={params.id}
                codigo={riesgo.codigo}
                esOportunidad={riesgo.tipo === "oportunidad"}
              />
            ) : null}
          </>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Insignia variante="primaria" className="tabular text-xs">
          {riesgo.codigo}
        </Insignia>
        <InsigniaEstadoRiesgo estado={riesgo.estado} />
        <Insignia variante="contorno">{ETIQUETAS_TIPO_RIESGO[riesgo.tipo]}</Insignia>
        {riesgo.categoria ? <Insignia variante="neutra">{riesgo.categoria}</Insignia> : null}
        {riesgo.es_demostracion ? <InsigniaDemostracion /> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* La valoración. Una oportunidad no tiene riesgo inherente ni
              residual: tiene índice y prioridad. Mostrarle la matriz 5×5
              sería mostrarle dos tarjetas vacías y un semáforo que no
              significa nada para ella. */}
          {riesgo.tipo === "oportunidad" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <Tarjeta className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
                  Índice de prioridad
                </p>
                <p className="mt-2 text-3xl font-semibold tabular leading-none">
                  {riesgo.indice ?? "—"}
                </p>
                <p className="mt-2 text-[11px] text-atenuado-contraste">
                  {riesgo.beneficio !== null && riesgo.factibilidad !== null
                    ? `Beneficio ${riesgo.beneficio} × Factibilidad ${riesgo.factibilidad}`
                    : "Sin valorar"}
                </p>
                {prioridad ? (
                  <p className="mt-2 text-xs font-medium">
                    Prioridad {ETIQUETAS_PRIORIDAD[prioridad].toLowerCase()} ·{" "}
                    <span className="font-normal text-atenuado-contraste">
                      {DECISION_POR_PRIORIDAD[prioridad]}
                    </span>
                  </p>
                ) : null}
              </Tarjeta>

              <Tarjeta className="p-4">
                <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
                  Decisión
                </p>
                <p className="mt-2 text-xs">
                  Alineación estratégica:{" "}
                  <span className="font-medium">
                    {riesgo.alineacion_estrategica
                      ? ETIQUETAS_ALINEACION[riesgo.alineacion_estrategica]
                      : "sin definir"}
                  </span>
                </p>
                <p className="mt-1 text-xs">
                  {riesgo.se_decide_abordar === null
                    ? "Todavía no se decidió si se aborda."
                    : riesgo.se_decide_abordar
                      ? "Se decidió abordarla."
                      : "Se decidió no abordarla."}
                </p>
                {riesgo.efecto_deseado ? (
                  <p className="mt-2 text-[11px] leading-relaxed text-atenuado-contraste">
                    <span className="font-medium">Efecto deseado: </span>
                    {riesgo.efecto_deseado}
                  </p>
                ) : null}
                {riesgo.resultado_obtenido ? (
                  <p className="mt-1 text-[11px] leading-relaxed text-atenuado-contraste">
                    <span className="font-medium">Resultado obtenido: </span>
                    {riesgo.resultado_obtenido}
                  </p>
                ) : null}
              </Tarjeta>
            </div>
          ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            <Tarjeta className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
                Riesgo inherente
              </p>
              <p className="mt-2 text-3xl font-semibold tabular leading-none">{riesgo.nivel}</p>
              <p className="mt-2 text-[11px] text-atenuado-contraste">
                Probabilidad {riesgo.probabilidad} × Severidad {riesgo.severidad}
              </p>
              <div className="mt-2">
                <InsigniaNivelRiesgo nivel={riesgo.nivel} mostrarValor={false} />
              </div>
            </Tarjeta>

            <Tarjeta className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
                Riesgo residual
              </p>
              {riesgo.nivel_residual !== null ? (
                <>
                  <p className="mt-2 text-3xl font-semibold tabular leading-none">
                    {riesgo.nivel_residual}
                  </p>
                  <p className="mt-2 text-[11px] text-atenuado-contraste">
                    Probabilidad {riesgo.probabilidad_residual} × Severidad{" "}
                    {riesgo.severidad_residual}
                  </p>
                  <div className="mt-2">
                    <InsigniaNivelRiesgo nivel={riesgo.nivel_residual} mostrarValor={false} />
                  </div>
                </>
              ) : (
                <p className="mt-3 text-xs text-atenuado-contraste">
                  Todavía no se evaluó el riesgo residual. Se carga recién después de que la
                  acción operó un ciclo completo o un mínimo de tres meses: un residual cargado
                  el mismo día que se planificó la acción no es evidencia de nada.
                </p>
              )}
            </Tarjeta>
          </div>
          )}

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Análisis</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido className="space-y-3 text-xs leading-relaxed">
              <Bloque titulo="Causas" texto={riesgo.causas} />
              <Bloque titulo="Consecuencias" texto={riesgo.consecuencias} />
              <Bloque titulo="Controles existentes" texto={riesgo.controles_existentes} />
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Plan de tratamiento</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <AccionesTratamiento
                riesgoId={riesgo.id}
                acciones={(acciones as any[] | null) ?? []}
                personas={(personas as { id: string; nombre_completo: string }[] | null) ?? []}
                puedeEditar={gestiona}
              />
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Historial de evaluaciones</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              {((evaluaciones as any[] | null) ?? []).length === 0 ? (
                <p className="text-xs text-atenuado-contraste">Sin evaluaciones registradas.</p>
              ) : (
                <ul className="space-y-2">
                  {((evaluaciones as any[] | null) ?? []).map((evaluacion) => (
                    <li
                      key={evaluacion.id}
                      className="flex items-start justify-between gap-3 border-b border-borde
                                 pb-2 last:border-0 last:pb-0"
                    >
                      <div className="min-w-0">
                        <p className="text-xs">
                          {formatearFecha(evaluacion.fecha)} ·{" "}
                          <span className="text-atenuado-contraste">
                            {evaluacion.evaluador?.nombre_completo ?? "—"}
                          </span>
                        </p>
                        {evaluacion.comentario ? (
                          <p className="mt-0.5 text-[11px] text-atenuado-contraste">
                            {evaluacion.comentario}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <span className="text-[11px] tabular text-atenuado-contraste">
                          {evaluacion.probabilidad} × {evaluacion.severidad}
                        </span>
                        <InsigniaNivelRiesgo nivel={evaluacion.nivel} />
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Trazabilidad</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <HistorialBitacora tablas={["riesgos"]} registroId={riesgo.id} />
            </TarjetaContenido>
          </Tarjeta>
        </div>

        <div className="space-y-4">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Ficha</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <dl className="space-y-2.5 text-xs">
                <Dato etiqueta="Proceso" valor={riesgo.procesos?.nombre ?? "—"} />
                <Dato etiqueta="Responsable" valor={riesgo.responsable?.nombre_completo ?? "—"} />
                <Dato
                  etiqueta="Tratamiento"
                  valor={ETIQUETAS_TRATAMIENTO_RIESGO[riesgo.tratamiento]}
                />
                <Dato
                  etiqueta="Identificación"
                  valor={formatearFecha(riesgo.fecha_identificacion)}
                />
                <Dato
                  etiqueta="Última evaluación"
                  valor={formatearFecha(riesgo.fecha_ultima_evaluacion)}
                />
                <Dato
                  etiqueta="Próxima revisión"
                  valor={
                    riesgo.fecha_proxima_revision
                      ? `${formatearFecha(riesgo.fecha_proxima_revision)} · ${describirVencimiento(riesgo.fecha_proxima_revision)}`
                      : "—"
                  }
                />
              </dl>
            </TarjetaContenido>
          </Tarjeta>

          {((relacionadas as any[] | null) ?? []).length > 0 ? (
            <Tarjeta>
              <TarjetaCabecera>
                <TarjetaTitulo>No conformidades vinculadas</TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido>
                <ul className="space-y-2">
                  {((relacionadas as any[] | null) ?? []).map((nc) => (
                    <li key={nc.id}>
                      <Link
                        href={`/no-conformidades/${nc.id}`}
                        className="text-xs hover:text-primario"
                      >
                        <span className="tabular text-atenuado-contraste">{nc.codigo}</span>{" "}
                        {nc.titulo}
                      </Link>
                    </li>
                  ))}
                </ul>
              </TarjetaContenido>
            </Tarjeta>
          ) : null}

          {gestiona && riesgo.tipo === "riesgo" && riesgo.probabilidad !== null ? (
            <Tarjeta>
              <TarjetaCabecera>
                <TarjetaTitulo>Seguimiento</TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido>
                <PanelReevaluacion
                  riesgoId={riesgo.id}
                  probabilidadActual={riesgo.probabilidad ?? 3}
                  severidadActual={riesgo.severidad ?? 3}
                  estado={riesgo.estado}
                  puedeEditar={gestiona}
                />
              </TarjetaContenido>
            </Tarjeta>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function Bloque({ titulo, texto }: { titulo: string; texto: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste">
        {titulo}
      </p>
      <p className="mt-0.5 whitespace-pre-line">{texto ?? "—"}</p>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-atenuado-contraste">{etiqueta}</dt>
      <dd className="text-right font-medium">{valor}</dd>
    </div>
  );
}
