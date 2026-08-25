import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { HistorialBitacora } from "@/components/comunes/historial-bitacora";
import { InsigniaDemostracion } from "@/components/comunes/insignias-estado";
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
import { ETIQUETAS_ESTADO_CAPACITACION, ETIQUETAS_TIPO_CAPACITACION } from "@/lib/constantes";
import { formatearFecha, formatearGuaranies, formatearNumero } from "@/lib/formato";
import type { EstadoCapacitacion, TipoCapacitacion } from "@/lib/tipos";
import {
  PanelParticipantes,
  SelectorEstadoCapacitacion,
  type Participante,
} from "./panel-participantes";

export const dynamic = "force-dynamic";

interface CapacitacionDetalle {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipo: TipoCapacitacion;
  estado: EstadoCapacitacion;
  proveedor_nombre: string | null;
  instructor: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  horas: number | null;
  costo_gs: number;
  es_demostracion: boolean;
  competencias: { id: string; codigo: string; nombre: string } | null;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("capacitaciones")
    .select("codigo, nombre")
    .eq("id", params.id)
    .maybeSingle();

  return { title: data ? `${data.codigo} · ${data.nombre}` : "Capacitación" };
}

export default async function PaginaCapacitacion({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: consulta } = await supabase
    .from("capacitaciones")
    .select("*, competencias:competencia_id (id, codigo, nombre)")
    .eq("id", params.id)
    .maybeSingle();

  const capacitacion = consulta as unknown as CapacitacionDetalle | null;
  if (!capacitacion) notFound();

  const [{ data: participantes }, { data: personas }] = await Promise.all([
    supabase
      .from("capacitacion_participantes")
      .select(
        "id, usuario_id, asistio, calificacion, eficacia, fecha_evaluacion_eficacia, observacion," +
          " usuarios:usuario_id (nombre_completo, puestos:puesto_id (nombre))",
      )
      .eq("capacitacion_id", params.id),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
  ]);

  const listaParticipantes = ((participantes ?? []) as unknown as Participante[]).sort((a, b) =>
    (a.usuarios?.nombre_completo ?? "").localeCompare(b.usuarios?.nombre_completo ?? "", "es"),
  );
  const listaPersonas = (personas ?? []) as { id: string; nombre_completo: string }[];
  const gestiona = puedeGestionar(usuario);

  const asistentes = listaParticipantes.filter((participante) => participante.asistio);
  const eficaces = listaParticipantes.filter(
    (participante) => participante.eficacia === "eficaz",
  ).length;
  const verificados = listaParticipantes.filter(
    (participante) => participante.eficacia !== "pendiente",
  ).length;

  const calificados = asistentes.filter(
    (participante) => participante.calificacion !== null,
  );
  const promedio =
    calificados.length > 0
      ? calificados.reduce(
          (suma, participante) => suma + Number(participante.calificacion ?? 0),
          0,
        ) / calificados.length
      : null;

  const costoPorPersona =
    asistentes.length > 0 && capacitacion.costo_gs > 0
      ? Math.round(capacitacion.costo_gs / asistentes.length)
      : null;

  return (
    <div className="mx-auto max-w-6xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/recursos-humanos">
          <ArrowLeft /> Volver a recursos humanos
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={capacitacion.nombre}
        descripcion={capacitacion.descripcion ?? undefined}
        acciones={
          gestiona ? (
            <SelectorEstadoCapacitacion
              capacitacionId={capacitacion.id}
              estado={capacitacion.estado}
            />
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Insignia variante="primaria" className="tabular text-xs">
          {capacitacion.codigo}
        </Insignia>
        <Insignia
          variante={
            capacitacion.estado === "finalizada"
              ? "exito"
              : capacitacion.estado === "cancelada"
                ? "neutra"
                : capacitacion.estado === "en_curso"
                  ? "primaria"
                  : "contorno"
          }
        >
          {ETIQUETAS_ESTADO_CAPACITACION[capacitacion.estado]}
        </Insignia>
        <Insignia variante="contorno">
          {ETIQUETAS_TIPO_CAPACITACION[capacitacion.tipo]}
        </Insignia>
        {capacitacion.competencias ? (
          <Insignia variante="contorno">
            {capacitacion.competencias.codigo} · {capacitacion.competencias.nombre}
          </Insignia>
        ) : null}
        {capacitacion.es_demostracion ? <InsigniaDemostracion /> : null}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          titulo="Inscriptos"
          valor={listaParticipantes.length}
          contexto={`${asistentes.length} asistieron`}
        />
        <TarjetaIndicador
          titulo="Eficacia verificada"
          valor={`${verificados} / ${listaParticipantes.length}`}
          contexto={`${eficaces} con resultado eficaz`}
          tono={
            listaParticipantes.length === 0
              ? "neutro"
              : verificados === listaParticipantes.length
                ? "exito"
                : "advertencia"
          }
        />
        <TarjetaIndicador
          titulo="Calificación promedio"
          valor={promedio !== null ? formatearNumero(promedio, 1) : "—"}
          contexto={`${calificados.length} calificados`}
        />
        <TarjetaIndicador
          titulo="Costo por persona"
          valor={costoPorPersona !== null ? formatearGuaranies(costoPorPersona) : "—"}
          contexto={
            capacitacion.costo_gs > 0
              ? `${formatearGuaranies(capacitacion.costo_gs)} en total`
              : "Capacitación interna, sin costo externo"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Participantes y eficacia</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <PanelParticipantes
                capacitacionId={capacitacion.id}
                participantes={listaParticipantes}
                personas={listaPersonas}
                puedeEditar={gestiona}
              />
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Trazabilidad</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <HistorialBitacora
                tablas={["capacitaciones", "capacitacion_participantes"]}
                registroId={capacitacion.id}
                registrosRelacionados={listaParticipantes.map(
                  (participante) => participante.id,
                )}
                etiquetas={Object.fromEntries(
                  listaParticipantes.map((participante) => [
                    participante.id,
                    participante.usuarios?.nombre_completo ?? "Participante",
                  ]),
                )}
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
                  etiqueta="Inicio"
                  valor={
                    capacitacion.fecha_inicio ? formatearFecha(capacitacion.fecha_inicio) : "—"
                  }
                />
                <Dato
                  etiqueta="Fin"
                  valor={capacitacion.fecha_fin ? formatearFecha(capacitacion.fecha_fin) : "—"}
                />
                <Dato
                  etiqueta="Horas"
                  valor={
                    capacitacion.horas === null
                      ? "—"
                      : formatearNumero(Number(capacitacion.horas), 1)
                  }
                />
                <Dato etiqueta="Instructor" valor={capacitacion.instructor ?? "—"} />
                <Dato etiqueta="Proveedor" valor={capacitacion.proveedor_nombre ?? "—"} />
                <Dato
                  etiqueta="Costo"
                  valor={
                    capacitacion.costo_gs > 0
                      ? formatearGuaranies(capacitacion.costo_gs)
                      : "Sin costo externo"
                  }
                />
              </dl>

              <p className="mt-3 border-t border-borde pt-3 text-[11px] leading-relaxed text-atenuado-contraste">
                La eficacia se verifica por persona, no por curso: dictarla no alcanza, hay que
                comprobar que la brecha de competencia se cerró.
              </p>
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
