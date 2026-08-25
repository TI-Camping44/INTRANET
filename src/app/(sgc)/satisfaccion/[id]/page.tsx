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
import { formatearFecha, formatearNumero } from "@/lib/formato";
import {
  ETIQUETAS_TIPO_ENCUESTA,
  META_NPS,
  resumirNps,
  tonoNps,
} from "@/lib/satisfaccion";
import type { TipoEncuesta } from "@/lib/tipos";
import { PanelRespuestas, type Respuesta } from "../panel-respuestas";

export const dynamic = "force-dynamic";

interface EncuestaDetalle {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  tipo: TipoEncuesta;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activa: boolean;
  fuente_externa: string | null;
  es_demostracion: boolean;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("encuestas")
    .select("codigo, nombre")
    .eq("id", params.id)
    .maybeSingle();

  return { title: data ? `${data.codigo} · ${data.nombre}` : "Encuesta" };
}

export default async function PaginaEncuesta({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: consulta } = await supabase
    .from("encuestas")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  const encuesta = consulta as unknown as EncuestaDetalle | null;
  if (!encuesta) notFound();

  const [{ data: respuestas }, { data: clientes }, { data: sedes }, { data: personas }] =
    await Promise.all([
      supabase
        .from("encuesta_respuestas")
        .select(
          "id, encuesta_id, fecha, puntaje, categoria_nps, comentario, canal, no_conformidad_id," +
            " clientes:cliente_id (razon_social), sedes:sede_id (nombre)," +
            " no_conformidades:no_conformidad_id (codigo)",
        )
        .eq("encuesta_id", params.id)
        .order("fecha", { ascending: false }),
      supabase.from("clientes").select("id, razon_social").order("razon_social"),
      supabase.from("sedes").select("id, nombre").order("nombre"),
      supabase
        .from("usuarios")
        .select("id, nombre_completo")
        .eq("activo", true)
        .order("nombre_completo"),
    ]);

  const listaRespuestas = (respuestas ?? []) as unknown as Respuesta[];
  const resumen = resumirNps(listaRespuestas.map((respuesta) => respuesta.puntaje));
  const gestiona = puedeGestionar(usuario);

  // Distribucion de los once puntajes posibles. Es lo que el NPS oculta:
  // dos encuestas con el mismo indice pueden repartirse muy distinto.
  const distribucion = Array.from({ length: 11 }, (_, puntaje) => ({
    puntaje,
    cantidad: listaRespuestas.filter((respuesta) => respuesta.puntaje === puntaje).length,
  }));
  const maximo = Math.max(...distribucion.map((fila) => fila.cantidad), 1);

  const sinTratar = listaRespuestas.filter(
    (respuesta) =>
      respuesta.categoria_nps === "detractor" &&
      respuesta.comentario !== null &&
      respuesta.no_conformidad_id === null,
  ).length;

  return (
    <div className="mx-auto max-w-6xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/satisfaccion">
          <ArrowLeft /> Volver a satisfacción
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={encuesta.nombre}
        descripcion={encuesta.descripcion ?? undefined}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Insignia variante="primaria" className="tabular text-xs">
          {encuesta.codigo}
        </Insignia>
        <Insignia variante={encuesta.activa ? "primaria" : "neutra"}>
          {encuesta.activa ? "Abierta" : "Cerrada"}
        </Insignia>
        <Insignia variante="contorno">
          {ETIQUETAS_TIPO_ENCUESTA[encuesta.tipo] ?? encuesta.tipo}
        </Insignia>
        {encuesta.fuente_externa ? (
          <Insignia variante="contorno">Origen: {encuesta.fuente_externa}</Insignia>
        ) : null}
        {encuesta.es_demostracion ? <InsigniaDemostracion /> : null}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          titulo="NPS"
          valor={resumen.nps === null ? "—" : resumen.nps}
          contexto={`Meta ${META_NPS} · ${resumen.total} respuestas`}
          tono={tonoNps(resumen.nps)}
        />
        <TarjetaIndicador
          titulo="Promotores"
          valor={resumen.promotores}
          contexto={`${resumen.pasivos} pasivos`}
          tono="exito"
        />
        <TarjetaIndicador
          titulo="Detractores"
          valor={resumen.detractores}
          contexto={
            resumen.total > 0
              ? `${formatearNumero((resumen.detractores / resumen.total) * 100, 0)} % del total`
              : "Sin respuestas"
          }
          tono={resumen.detractores > 0 ? "peligro" : "exito"}
        />
        <TarjetaIndicador
          titulo="Reclamos sin abrir"
          valor={sinTratar}
          contexto="detractores con comentario y sin no conformidad"
          tono={sinTratar > 0 ? "atencion" : "exito"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Respuestas</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <PanelRespuestas
                respuestas={listaRespuestas}
                encuestas={[encuesta]}
                clientes={(clientes ?? []) as { id: string; razon_social: string }[]}
                sedes={(sedes ?? []) as { id: string; nombre: string }[]}
                responsables={(personas ?? []) as { id: string; nombre_completo: string }[]}
                puedeGestionar={gestiona}
                encuestaFija={encuesta.id}
              />
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Trazabilidad</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <HistorialBitacora tablas={["encuestas"]} registroId={encuesta.id} />
            </TarjetaContenido>
          </Tarjeta>
        </div>

        <div className="space-y-4">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Distribución de puntajes</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <ul className="space-y-1">
                {distribucion.map((fila) => (
                  <li key={fila.puntaje} className="flex items-center gap-2 text-[11px]">
                    <span className="w-4 shrink-0 text-right tabular text-atenuado-contraste">
                      {fila.puntaje}
                    </span>
                    <span className="h-3 flex-1 overflow-hidden rounded-sm bg-atenuado">
                      <span
                        className={
                          "block h-full rounded-sm " +
                          (fila.puntaje >= 9
                            ? "bg-semaforo-bajo"
                            : fila.puntaje >= 7
                              ? "bg-semaforo-medio"
                              : "bg-semaforo-critico")
                        }
                        style={{ width: `${(fila.cantidad / maximo) * 100}%` }}
                      />
                    </span>
                    <span className="w-6 shrink-0 text-right tabular">
                      {fila.cantidad || ""}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-[11px] leading-relaxed text-atenuado-contraste">
                El índice resume, la distribución explica: dos encuestas con el mismo NPS pueden
                repartirse de forma muy distinta.
              </p>
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Ficha</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <dl className="space-y-2.5 text-xs">
                <Dato
                  etiqueta="Desde"
                  valor={encuesta.fecha_inicio ? formatearFecha(encuesta.fecha_inicio) : "—"}
                />
                <Dato
                  etiqueta="Hasta"
                  valor={encuesta.fecha_fin ? formatearFecha(encuesta.fecha_fin) : "Abierta"}
                />
                <Dato
                  etiqueta="Fuente"
                  valor={encuesta.fuente_externa ?? "Carga en la intranet"}
                />
              </dl>
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
