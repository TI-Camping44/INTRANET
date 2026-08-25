import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { GraficoTendencia, type PuntoTendencia } from "@/components/comunes/grafico-tendencia";
import { HistorialBitacora } from "@/components/comunes/historial-bitacora";
import { PanelMediciones } from "@/app/(sgc)/indicadores/[id]/panel-mediciones";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
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
import { ETIQUETAS_FRECUENCIA, ETIQUETAS_SENTIDO } from "@/lib/constantes";
import { formatearMes, formatearNumero } from "@/lib/formato";
import type { FrecuenciaMedicion, SentidoIndicador } from "@/lib/tipos";

export const dynamic = "force-dynamic";

interface IndicadorDetalle {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  formula: string | null;
  unidad: string;
  frecuencia: FrecuenciaMedicion;
  sentido: SentidoIndicador;
  meta: number | null;
  meta_minima: number | null;
  meta_maxima: number | null;
  activo: boolean;
  responsable_id: string | null;
  procesos: { nombre: string } | null;
  responsable: { nombre_completo: string } | null;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("indicadores")
    .select("codigo, nombre")
    .eq("id", params.id)
    .maybeSingle();

  return { title: data ? `${data.codigo} · ${data.nombre}` : "Indicador" };
}

export default async function PaginaIndicador({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: consulta } = await supabase
    .from("indicadores")
    .select("*, procesos:proceso_id (nombre), responsable:responsable_id (nombre_completo)")
    .eq("id", params.id)
    .maybeSingle();

  const indicador = consulta as unknown as IndicadorDetalle | null;
  if (!indicador) notFound();

  const [{ data: mediciones }, { data: vista }] = await Promise.all([
    supabase
      .from("indicador_mediciones")
      .select("*, cargado:cargado_por (nombre_completo)")
      .eq("indicador_id", params.id)
      .order("periodo", { ascending: false }),
    supabase
      .from("vista_indicadores_looker")
      .select("periodo, valor_real, meta, cumple_meta")
      .eq("indicador_codigo", indicador.codigo)
      .order("periodo", { ascending: true }),
  ]);

  const filasVista = (vista as any[] | null) ?? [];

  const puntos: PuntoTendencia[] = filasVista.map((fila) => ({
    periodo: fila.periodo,
    valor: Number(fila.valor_real),
    meta: fila.meta === null ? null : Number(fila.meta),
    cumple: fila.cumple_meta,
  }));

  // El cumplimiento lo calcula la vista, con la misma regla que la base.
  const cumplimiento = new Map(
    filasVista.map((fila) => [String(fila.periodo), fila.cumple_meta as boolean | null]),
  );

  const listaMediciones = ((mediciones as any[] | null) ?? []).map((medicion) => ({
    ...medicion,
    cumple: cumplimiento.get(String(medicion.periodo)) ?? null,
  }));

  const enMeta = puntos.filter((punto) => punto.cumple === true).length;
  const evaluadas = puntos.filter((punto) => punto.cumple !== null).length;
  const ultimo = puntos[puntos.length - 1];
  const anterior = puntos[puntos.length - 2];

  const variacion =
    ultimo && anterior && anterior.valor !== 0
      ? ((ultimo.valor - anterior.valor) / Math.abs(anterior.valor)) * 100
      : null;

  const gestiona =
    puedeGestionar(usuario) || indicador.responsable_id === usuario.id;

  const metaTexto =
    indicador.sentido === "rango"
      ? `${formatearNumero(indicador.meta_minima, 0)} a ${formatearNumero(indicador.meta_maxima, 0)}`
      : formatearNumero(indicador.meta, 0);

  return (
    <div className="mx-auto max-w-6xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/indicadores">
          <ArrowLeft /> Volver al listado
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={indicador.nombre}
        descripcion={indicador.descripcion ?? undefined}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Insignia variante="primaria" className="tabular text-xs">
          {indicador.codigo}
        </Insignia>
        <Insignia variante="contorno">
          {ETIQUETAS_FRECUENCIA[indicador.frecuencia]}
        </Insignia>
        <Insignia variante="neutra">{ETIQUETAS_SENTIDO[indicador.sentido]}</Insignia>
        {!indicador.activo ? <Insignia variante="advertencia">Inactivo</Insignia> : null}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          titulo="Último valor"
          valor={ultimo ? `${formatearNumero(ultimo.valor)} ${indicador.unidad}` : "—"}
          contexto={ultimo ? formatearMes(ultimo.periodo) : "Sin mediciones"}
          tono={ultimo?.cumple === false ? "peligro" : ultimo?.cumple === true ? "exito" : "neutro"}
        />
        <TarjetaIndicador
          titulo="Meta"
          valor={`${metaTexto} ${indicador.unidad}`}
          contexto={ETIQUETAS_SENTIDO[indicador.sentido]}
        />
        <TarjetaIndicador
          titulo="Variación"
          valor={
            variacion === null
              ? "—"
              : `${variacion > 0 ? "+" : ""}${formatearNumero(variacion, 1)} %`
          }
          contexto="Contra el período anterior"
        />
        <TarjetaIndicador
          titulo="Cumplimiento"
          valor={evaluadas > 0 ? `${Math.round((enMeta / evaluadas) * 100)}%` : "—"}
          contexto={`${enMeta} de ${evaluadas} mediciones en meta`}
          tono={
            evaluadas === 0
              ? "neutro"
              : enMeta / evaluadas >= 0.8
                ? "exito"
                : enMeta / evaluadas >= 0.5
                  ? "advertencia"
                  : "atencion"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* min-w-0: sin eso el ancho minimo del grafico estira la columna
            y arrastra la pagina al desplazamiento horizontal en celular. */}
        <div className="min-w-0 space-y-4 lg:col-span-2">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Tendencia</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <GraficoTendencia puntos={puntos} unidad={indicador.unidad} />
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Mediciones</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <PanelMediciones
                indicadorId={indicador.id}
                mediciones={listaMediciones}
                unidad={indicador.unidad}
                metaPorDefecto={indicador.meta}
                puedeEditar={gestiona}
              />
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Trazabilidad</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <HistorialBitacora tablas={["indicadores"]} registroId={indicador.id} />
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
                <Dato etiqueta="Proceso" valor={indicador.procesos?.nombre ?? "—"} />
                <Dato
                  etiqueta="Responsable"
                  valor={indicador.responsable?.nombre_completo ?? "—"}
                />
                <Dato etiqueta="Unidad" valor={indicador.unidad} />
                <Dato
                  etiqueta="Frecuencia"
                  valor={ETIQUETAS_FRECUENCIA[indicador.frecuencia]}
                />
                <Dato etiqueta="Mediciones" valor={String(listaMediciones.length)} />
              </dl>

              {indicador.formula ? (
                <div className="mt-3 border-t border-borde pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste">
                    Fórmula de cálculo
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">{indicador.formula}</p>
                </div>
              ) : null}
            </TarjetaContenido>
          </Tarjeta>
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
