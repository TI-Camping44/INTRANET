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
  AREAS_ORGANIZACIONALES,
  ETIQUETAS_EFICACIA,
  ETIQUETAS_ORIGEN_NC,
} from "@/lib/constantes";
import { describirVencimiento, formatearFecha } from "@/lib/formato";
import type {
  AreaOrganizacional,
  EstadoNoConformidad,
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
  area: AreaOrganizacional | null;
  empresa_afectada_id: string | null;
  correccion_inmediata: string | null;
  conclusion_causa_raiz: string | null;
  fecha_deteccion: string;
  fecha_limite_cierre: string | null;
  fecha_cierre: string | null;
  eficacia: ResultadoEficacia;
  observacion_eficacia: string | null;
  es_demostracion: boolean;
  detectado_por: string | null;
  responsable_id: string | null;
  proceso_id: string | null;
  procesos: { id: string; nombre: string } | null;
  empresa_afectada: { razon_social: string } | null;
  clientes: { razon_social: string } | null;
  responsable: { nombre_completo: string } | null;
  detector: { nombre_completo: string } | null;
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
      "*, procesos:proceso_id (id, nombre), " +
        "empresa_afectada:empresa_afectada_id (razon_social), " +
        "clientes:cliente_id (razon_social), responsable:responsable_id (nombre_completo), " +
        "detector:detectado_por (nombre_completo)",
    )
    .eq("id", params.id)
    .maybeSingle();

  const noConformidad = consulta as unknown as NoConformidadDetalle | null;
  if (!noConformidad) notFound();

  const [
    { data: porques },
    { data: acciones },
    { data: personas },
    { data: empresas },
  ] = await Promise.all([
    supabase.from("nc_porques").select("*").eq("no_conformidad_id", params.id).order("orden"),
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
    supabase.from("empresas").select("id, razon_social").order("nombre"),
  ]);

  // Puede tratar la desviación quien la levantó, el responsable de la
  // acción correctiva, el responsable del proceso afectado y Calidad.
  //
  // Quien la levantó estaba de más en esta lista y no debía: registraba
  // la desviación y después no podía completar el análisis. RLS ya lo
  // permitía; era la interfaz la que dejaba los campos apagados.
  const esCalidad = usuario.rol === "administrador_sgc";
  const gestiona =
    esCalidad ||
    noConformidad.detectado_por === usuario.id ||
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
                <Dato
                  etiqueta="Área"
                  valor={
                    noConformidad.area ? AREAS_ORGANIZACIONALES[noConformidad.area] : "—"
                  }
                />
                <Dato
                  etiqueta="Empresa"
                  valor={noConformidad.empresa_afectada?.razon_social ?? "—"}
                />
                <Dato etiqueta="Proceso" valor={noConformidad.procesos?.nombre ?? "—"} />
                {/* El cliente solo aparece cuando lo hay: las no conformidades
                    que nacen de un reclamo lo traen, las demás no. */}
                {noConformidad.clientes ? (
                  <Dato etiqueta="Cliente" valor={noConformidad.clientes.razon_social} />
                ) : null}
                <Dato
                  etiqueta="Detectada por"
                  valor={noConformidad.detector?.nombre_completo ?? "—"}
                />
                <Dato
                  etiqueta="Responsable de la AC"
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
                  area={noConformidad.area}
                  empresaAfectadaId={noConformidad.empresa_afectada_id}
                  empresas={(empresas as { id: string; razon_social: string }[] | null) ?? []}
                  esCalidad={esCalidad}
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
