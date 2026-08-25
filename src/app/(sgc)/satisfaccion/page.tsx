import type { Metadata } from "next";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { GraficoTendencia, type PuntoTendencia } from "@/components/comunes/grafico-tendencia";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import { Aviso, AvisoDescripcion, AvisoTitulo } from "@/components/ui/aviso";
import {
  Pestanas,
  PestanaContenido,
  PestanaDisparador,
  PestanasLista,
} from "@/components/ui/pestanas";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
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
import { formatearMes, formatearNumero } from "@/lib/formato";
import {
  META_NPS,
  RESPUESTAS_MINIMAS_NPS,
  resumirNps,
  tonoNps,
} from "@/lib/satisfaccion";
import { PanelEncuestas, type FilaEncuesta } from "./panel-encuestas";
import { PanelRespuestas, type Respuesta } from "./panel-respuestas";

export const metadata: Metadata = { title: "Satisfacción del cliente" };
export const dynamic = "force-dynamic";

/** Meses hacia atras que cubre la tendencia. */
const MESES_TENDENCIA = 12;

interface FilaEncuestaCruda {
  id: string;
  codigo: string;
  nombre: string;
  tipo: FilaEncuesta["tipo"];
  descripcion: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activa: boolean;
  fuente_externa: string | null;
}

/** Devuelve los ultimos N meses como "aaaa-mm", del mas viejo al actual. */
function ultimosMeses(cantidad: number, hoy: string): string[] {
  const [anioHoy, mesHoy] = hoy.split("-").map(Number);
  const meses: string[] = [];

  for (let atras = cantidad - 1; atras >= 0; atras--) {
    const indice = anioHoy * 12 + (mesHoy - 1) - atras;
    const anio = Math.floor(indice / 12);
    const mes = (indice % 12) + 1;
    meses.push(`${anio}-${String(mes).padStart(2, "0")}`);
  }

  return meses;
}

export default async function PaginaSatisfaccion() {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const [
    { data: encuestas },
    { data: respuestas },
    { data: clientes },
    { data: sedes },
    { data: personas },
  ] = await Promise.all([
    supabase.from("encuestas").select("*").order("fecha_inicio", { ascending: false }),
    supabase
      .from("encuesta_respuestas")
      .select(
        "id, encuesta_id, fecha, puntaje, categoria_nps, comentario, canal, no_conformidad_id," +
          " clientes:cliente_id (razon_social), sedes:sede_id (nombre)," +
          " no_conformidades:no_conformidad_id (codigo)",
      )
      .order("fecha", { ascending: false }),
    supabase.from("clientes").select("id, razon_social").order("razon_social"),
    supabase.from("sedes").select("id, nombre").order("nombre"),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
  ]);

  const listaEncuestas = (encuestas ?? []) as unknown as FilaEncuestaCruda[];
  const listaRespuestas = (respuestas ?? []) as unknown as Respuesta[];

  // La tendencia solo mira el ultimo ano: mas atras el dato es historia,
  // no gestion.
  const hoy = new Date().toISOString().slice(0, 7);
  const meses = ultimosMeses(MESES_TENDENCIA, hoy);
  const desde = `${meses[0]}-01`;

  const porMes = new Map<string, number[]>();
  for (const respuesta of listaRespuestas) {
    const mes = respuesta.fecha.slice(0, 7);
    if (!porMes.has(mes)) porMes.set(mes, []);
    porMes.get(mes)!.push(respuesta.puntaje);
  }

  const puntos: PuntoTendencia[] = meses
    .filter((mes) => (porMes.get(mes) ?? []).length >= RESPUESTAS_MINIMAS_NPS)
    .map((mes) => {
      const resumen = resumirNps(porMes.get(mes) ?? []);
      return {
        periodo: `${mes}-01`,
        valor: resumen.nps ?? 0,
        meta: META_NPS,
        cumple: (resumen.nps ?? 0) >= META_NPS,
      };
    });

  // El acumulado del ano es el numero que mira Direccion; el del mes en
  // curso todavia se mueve.
  const delAno = listaRespuestas.filter((respuesta) => respuesta.fecha >= desde);
  const resumenAno = resumirNps(delAno.map((respuesta) => respuesta.puntaje));

  const detractoresSinTratar = listaRespuestas.filter(
    (respuesta) =>
      respuesta.categoria_nps === "detractor" &&
      respuesta.comentario !== null &&
      respuesta.no_conformidad_id === null,
  ).length;

  const conNc = listaRespuestas.filter(
    (respuesta) => respuesta.no_conformidad_id !== null,
  ).length;

  const filasEncuesta: FilaEncuesta[] = listaEncuestas.map((encuesta) => {
    const suyas = listaRespuestas.filter(
      (respuesta) => respuesta.encuesta_id === encuesta.id,
    );
    return {
      ...encuesta,
      respuestas: suyas.length,
      nps: resumirNps(suyas.map((respuesta) => respuesta.puntaje)).nps,
    };
  });

  const gestiona = puedeGestionar(usuario);

  return (
    <>
      <EncabezadoPagina
        titulo="Satisfacción del cliente"
        descripcion="Encuestas, NPS y tratamiento de los reclamos que surgen de las respuestas."
      />

      <Aviso className="mb-4">
        <div>
          <AvisoTitulo>El panel de NPS actual sigue siendo la fuente</AvisoTitulo>
          <AvisoDescripcion>
            Camping 44 ya opera un panel de NPS propio sobre Apps Script y GitHub Pages, y este
            módulo no lo reemplaza. Lo que agrega es el paso siguiente: convertir el comentario de
            un cliente detractor en una no conformidad con responsable y plazo. Las respuestas se
            ingieren por los campos <code>fuente_externa</code> y <code>referencia_externa</code>,
            que evitan cargarlas dos veces.
          </AvisoDescripcion>
        </div>
      </Aviso>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          titulo="NPS del año"
          valor={resumenAno.nps === null ? "—" : resumenAno.nps}
          contexto={`Meta ${META_NPS} · ${resumenAno.total} respuestas`}
          tono={tonoNps(resumenAno.nps)}
        />
        <TarjetaIndicador
          titulo="Promotores"
          valor={resumenAno.promotores}
          contexto={
            resumenAno.total > 0
              ? `${formatearNumero((resumenAno.promotores / resumenAno.total) * 100, 0)} % del total`
              : "Sin respuestas"
          }
          tono="exito"
        />
        <TarjetaIndicador
          titulo="Detractores"
          valor={resumenAno.detractores}
          contexto={
            resumenAno.total > 0
              ? `${formatearNumero((resumenAno.detractores / resumenAno.total) * 100, 0)} % del total`
              : "Sin respuestas"
          }
          tono={resumenAno.detractores > 0 ? "peligro" : "exito"}
        />
        <TarjetaIndicador
          titulo="Reclamos sin abrir"
          valor={detractoresSinTratar}
          contexto={`${conNc} ya derivaron en no conformidad`}
          tono={detractoresSinTratar > 0 ? "atencion" : "exito"}
        />
      </div>

      <Pestanas defaultValue="tendencia">
        <PestanasLista>
          <PestanaDisparador value="tendencia">Tendencia</PestanaDisparador>
          <PestanaDisparador value="respuestas">
            Respuestas ({listaRespuestas.length})
          </PestanaDisparador>
          <PestanaDisparador value="encuestas">
            Encuestas ({listaEncuestas.length})
          </PestanaDisparador>
        </PestanasLista>

        <PestanaContenido value="tendencia">
          <div className="grid gap-4 lg:grid-cols-3">
            <Tarjeta className="min-w-0 lg:col-span-2">
              <TarjetaCabecera>
                <TarjetaTitulo>NPS mes a mes</TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido>
                <GraficoTendencia puntos={puntos} unidad="NPS" />
                <p className="mt-2 text-[11px] leading-relaxed text-atenuado-contraste">
                  Se grafican los meses con al menos {RESPUESTAS_MINIMAS_NPS} respuestas: con
                  menos, un solo detractor mueve el resultado veinte puntos y la línea deja de
                  significar algo. La meta de {META_NPS} es un umbral, no una serie.
                </p>
              </TarjetaContenido>
            </Tarjeta>

            <Tarjeta className="min-w-0">
              <TarjetaCabecera>
                <TarjetaTitulo>Detalle mensual</TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido className="p-0">
                <div className="max-h-[22rem] overflow-y-auto">
                  <Tabla>
                    <TablaCabecera>
                      <TablaFila>
                        <TablaEncabezado>Mes</TablaEncabezado>
                        <TablaEncabezado className="w-[4rem] text-right">Resp.</TablaEncabezado>
                        <TablaEncabezado className="w-[4rem] text-right">Prom.</TablaEncabezado>
                        <TablaEncabezado className="w-[4rem] text-right">Detr.</TablaEncabezado>
                        <TablaEncabezado className="w-[4rem] text-right">NPS</TablaEncabezado>
                      </TablaFila>
                    </TablaCabecera>
                    <TablaCuerpo>
                      {[...meses].reverse().map((mes) => {
                        const resumen = resumirNps(porMes.get(mes) ?? []);
                        return (
                          <TablaFila key={mes}>
                            <TablaCelda className="text-xs first-letter:uppercase">
                              {formatearMes(`${mes}-01`)}
                            </TablaCelda>
                            <TablaCelda className="text-right text-xs tabular">
                              {resumen.total}
                            </TablaCelda>
                            <TablaCelda className="text-right text-xs tabular text-semaforo-bajo">
                              {resumen.promotores}
                            </TablaCelda>
                            <TablaCelda className="text-right text-xs tabular text-semaforo-critico">
                              {resumen.detractores}
                            </TablaCelda>
                            <TablaCelda className="text-right text-xs font-semibold tabular">
                              {resumen.total < RESPUESTAS_MINIMAS_NPS ? "—" : resumen.nps}
                            </TablaCelda>
                          </TablaFila>
                        );
                      })}
                    </TablaCuerpo>
                  </Tabla>
                </div>
              </TarjetaContenido>
            </Tarjeta>
          </div>
        </PestanaContenido>

        <PestanaContenido value="respuestas">
          <PanelRespuestas
            respuestas={listaRespuestas}
            encuestas={listaEncuestas}
            clientes={(clientes ?? []) as { id: string; razon_social: string }[]}
            sedes={(sedes ?? []) as { id: string; nombre: string }[]}
            responsables={(personas ?? []) as { id: string; nombre_completo: string }[]}
            puedeGestionar={gestiona}
          />
        </PestanaContenido>

        <PestanaContenido value="encuestas">
          <PanelEncuestas encuestas={filasEncuesta} puedeGestionar={gestiona} />
        </PestanaContenido>
      </Pestanas>
    </>
  );
}
