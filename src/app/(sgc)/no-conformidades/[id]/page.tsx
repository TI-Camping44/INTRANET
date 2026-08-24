import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { HistorialBitacora } from "@/components/comunes/historial-bitacora";
import {
  InsigniaDemostracion,
  InsigniaEstadoNC,
  InsigniaSeveridad,
} from "@/components/comunes/insignias-estado";
import { AnalisisCausaRaiz } from "@/app/(sgc)/no-conformidades/[id]/analisis-causa-raiz";
import { ControlEstado } from "@/app/(sgc)/no-conformidades/[id]/control-estado";
import { PlanAccion } from "@/app/(sgc)/no-conformidades/[id]/plan-accion";
import { VinculoRiesgo } from "@/app/(sgc)/no-conformidades/[id]/vinculo-riesgo";
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
import { ETIQUETAS_EFICACIA, ETIQUETAS_ORIGEN_NC } from "@/lib/constantes";
import { describirVencimiento, formatearFecha } from "@/lib/formato";
import type {
  EstadoNoConformidad,
  NcIshikawa,
  NcPorque,
  OrigenNoConformidad,
  ResultadoEficacia,
  SeveridadNoConformidad,
} from "@/lib/tipos";

export const dynamic = "force-dynamic";

interface NoConformidadDetalle {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  origen: OrigenNoConformidad;
  severidad: SeveridadNoConformidad;
  estado: EstadoNoConformidad;
  requisito_incumplido: string | null;
  correccion_inmediata: string | null;
  conclusion_causa_raiz: string | null;
  fecha_deteccion: string;
  fecha_limite_cierre: string | null;
  fecha_cierre: string | null;
  eficacia: ResultadoEficacia;
  observacion_eficacia: string | null;
  riesgo_id: string | null;
  es_demostracion: boolean;
  responsable_id: string | null;
  proceso_id: string | null;
  procesos: { id: string; nombre: string } | null;
  sedes: { nombre: string } | null;
  normas: { codigo: string } | null;
  clientes: { razon_social: string } | null;
  responsable: { nombre_completo: string } | null;
  detector: { nombre_completo: string } | null;
  riesgo: { id: string; codigo: string; titulo: string; nivel: number } | null;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("no_conformidades")
    .select("codigo, titulo")
    .eq("id", params.id)
    .maybeSingle();

  return { title: data ? `${data.codigo} · ${data.titulo}` : "No conformidad" };
}

export default async function PaginaNoConformidad({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: consulta } = await supabase
    .from("no_conformidades")
    .select(
      "*, procesos:proceso_id (id, nombre), sedes:sede_id (nombre), normas:norma_id (codigo), " +
        "clientes:cliente_id (razon_social), responsable:responsable_id (nombre_completo), " +
        "detector:detectado_por (nombre_completo), " +
        "riesgo:riesgo_id (id, codigo, titulo, nivel)",
    )
    .eq("id", params.id)
    .maybeSingle();

  const noConformidad = consulta as unknown as NoConformidadDetalle | null;
  if (!noConformidad) notFound();

  const [{ data: porques }, { data: causas }, { data: acciones }, { data: personas }, { data: riesgos }] =
    await Promise.all([
      supabase.from("nc_porques").select("*").eq("no_conformidad_id", params.id).order("orden"),
      supabase
        .from("nc_ishikawa")
        .select("*")
        .eq("no_conformidad_id", params.id)
        .order("creado_en"),
      supabase
        .from("nc_acciones")
        .select("*, responsable:responsable_id (nombre_completo)")
        .eq("no_conformidad_id", params.id)
        .order("fecha_limite"),
      supabase
        .from("usuarios")
        .select("id, nombre_completo")
        .eq("activo", true)
        .order("nombre_completo"),
      supabase
        .from("riesgos")
        .select("id, codigo, titulo, nivel")
        .not("estado", "eq", "cerrado")
        .order("codigo"),
    ]);

  // Puede tratar la desviación quien la detectó, su responsable, el
  // responsable del proceso afectado o Calidad.
  const gestiona =
    usuario.rol === "administrador_sgc" ||
    noConformidad.responsable_id === usuario.id ||
    (puedeGestionar(usuario) && noConformidad.proceso_id === usuario.proceso_id);

  return (
    <div className="mx-auto max-w-6xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/no-conformidades">
          <ArrowLeft /> Volver al listado
        </Link>
      </Boton>

      <EncabezadoPagina titulo={noConformidad.titulo} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Insignia variante="primaria" className="tabular text-xs">
          {noConformidad.codigo}
        </Insignia>
        <InsigniaEstadoNC estado={noConformidad.estado} />
        <InsigniaSeveridad severidad={noConformidad.severidad} />
        <Insignia variante="contorno">{ETIQUETAS_ORIGEN_NC[noConformidad.origen]}</Insignia>
        {noConformidad.es_demostracion ? <InsigniaDemostracion /> : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Descripción de la desviación</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido className="space-y-3">
              <p className="whitespace-pre-line text-xs leading-relaxed">
                {noConformidad.descripcion}
              </p>

              {noConformidad.requisito_incumplido ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste">
                    Requisito incumplido
                  </p>
                  <p className="mt-0.5 text-xs">{noConformidad.requisito_incumplido}</p>
                </div>
              ) : null}

              {noConformidad.correccion_inmediata ? (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste">
                    Corrección inmediata aplicada
                  </p>
                  <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed">
                    {noConformidad.correccion_inmediata}
                  </p>
                </div>
              ) : null}
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Análisis de causa raíz</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <AnalisisCausaRaiz
                noConformidadId={noConformidad.id}
                porques={(porques as NcPorque[] | null) ?? []}
                causas={(causas as NcIshikawa[] | null) ?? []}
                conclusion={noConformidad.conclusion_causa_raiz}
                puedeEditar={gestiona}
              />
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Plan de acción</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <PlanAccion
                noConformidadId={noConformidad.id}
                acciones={(acciones as any[] | null) ?? []}
                personas={(personas as { id: string; nombre_completo: string }[] | null) ?? []}
                usuarioActual={usuario.id}
                puedeGestionar={gestiona}
              />
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Trazabilidad</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <HistorialBitacora
                tablas={["no_conformidades"]}
                registroId={noConformidad.id}
              />
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
                <Dato etiqueta="Proceso" valor={noConformidad.procesos?.nombre ?? "—"} />
                <Dato etiqueta="Sede" valor={noConformidad.sedes?.nombre ?? "—"} />
                <Dato etiqueta="Norma" valor={noConformidad.normas?.codigo ?? "—"} />
                <Dato etiqueta="Cliente" valor={noConformidad.clientes?.razon_social ?? "—"} />
                <Dato
                  etiqueta="Detectada por"
                  valor={noConformidad.detector?.nombre_completo ?? "—"}
                />
                <Dato
                  etiqueta="Responsable"
                  valor={noConformidad.responsable?.nombre_completo ?? "Sin asignar"}
                />
                <Dato etiqueta="Detección" valor={formatearFecha(noConformidad.fecha_deteccion)} />
                <Dato
                  etiqueta="Límite de cierre"
                  valor={
                    noConformidad.fecha_limite_cierre
                      ? `${formatearFecha(noConformidad.fecha_limite_cierre)} · ${describirVencimiento(noConformidad.fecha_limite_cierre)}`
                      : "—"
                  }
                />
                <Dato etiqueta="Cierre" valor={formatearFecha(noConformidad.fecha_cierre)} />
                <Dato etiqueta="Eficacia" valor={ETIQUETAS_EFICACIA[noConformidad.eficacia]} />
              </dl>
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Riesgo asociado</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <VinculoRiesgo
                noConformidadId={noConformidad.id}
                riesgoVinculado={noConformidad.riesgo}
                riesgosExistentes={
                  (riesgos as { id: string; codigo: string; titulo: string; nivel: number }[] | null) ??
                  []
                }
                causaRaiz={noConformidad.conclusion_causa_raiz}
                puedeEditar={gestiona}
              />
            </TarjetaContenido>
          </Tarjeta>

          {gestiona ? (
            <Tarjeta>
              <TarjetaCabecera>
                <TarjetaTitulo>Seguimiento</TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido>
                <ControlEstado
                  noConformidadId={noConformidad.id}
                  estado={noConformidad.estado}
                  eficacia={noConformidad.eficacia}
                  observacionEficacia={noConformidad.observacion_eficacia}
                  puedeGestionar={gestiona}
                />
              </TarjetaContenido>
            </Tarjeta>
          ) : null}
        </div>
      </div>
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
