import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { HistorialBitacora } from "@/components/comunes/historial-bitacora";
import {
  InsigniaDemostracion,
  InsigniaEstadoRiesgo,
  InsigniaNivelRiesgo,
} from "@/components/comunes/insignias-estado";
import { AccionesTratamiento } from "@/app/(sgc)/riesgos/[id]/acciones-tratamiento";
import { PanelReevaluacion } from "@/app/(sgc)/riesgos/[id]/panel-reevaluacion";
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
import type { EstadoRiesgo, TipoRiesgo, TratamientoRiesgo } from "@/lib/tipos";

export const dynamic = "force-dynamic";

interface RiesgoDetalle {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoRiesgo;
  categoria: string | null;
  estado: EstadoRiesgo;
  tratamiento: TratamientoRiesgo;
  causas: string | null;
  consecuencias: string | null;
  controles_existentes: string | null;
  probabilidad: number;
  impacto: number;
  nivel: number;
  probabilidad_residual: number | null;
  impacto_residual: number | null;
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

  return (
    <div className="mx-auto max-w-6xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/riesgos">
          <ArrowLeft /> Volver al listado
        </Link>
      </Boton>

      <EncabezadoPagina titulo={riesgo.titulo} descripcion={riesgo.descripcion ?? undefined} />

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
          {/* Evaluación inherente y residual */}
          <div className="grid gap-4 sm:grid-cols-2">
            <Tarjeta className="p-4">
              <p className="text-[11px] font-medium uppercase tracking-wide text-atenuado-contraste">
                Riesgo inherente
              </p>
              <p className="mt-2 text-3xl font-semibold tabular leading-none">{riesgo.nivel}</p>
              <p className="mt-2 text-[11px] text-atenuado-contraste">
                Probabilidad {riesgo.probabilidad} × Impacto {riesgo.impacto}
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
                    Probabilidad {riesgo.probabilidad_residual} × Impacto{" "}
                    {riesgo.impacto_residual}
                  </p>
                  <div className="mt-2">
                    <InsigniaNivelRiesgo nivel={riesgo.nivel_residual} mostrarValor={false} />
                  </div>
                </>
              ) : (
                <p className="mt-3 text-xs text-atenuado-contraste">
                  Todavía no se evaluó el riesgo residual. Se registra después de ejecutar las
                  acciones de tratamiento.
                </p>
              )}
            </Tarjeta>
          </div>

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
                          {evaluacion.probabilidad} × {evaluacion.impacto}
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

          {gestiona ? (
            <Tarjeta>
              <TarjetaCabecera>
                <TarjetaTitulo>Seguimiento</TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido>
                <PanelReevaluacion
                  riesgoId={riesgo.id}
                  probabilidadActual={riesgo.probabilidad}
                  impactoActual={riesgo.impacto}
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
