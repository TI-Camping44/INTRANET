import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { PanelEstado } from "@/app/(sgc)/cambios/[id]/panel-estado";
import { AccionesDelCambio } from "@/app/(sgc)/cambios/[id]/acciones-del-cambio";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha } from "@/lib/formato";
import {
  CLASES_ESTADO_CAMBIO,
  ETIQUETAS_DECISION_CAMBIO,
  ETIQUETAS_ESTADO_CAMBIO,
  ETIQUETAS_RESULTADO_CAMBIO,
  ETIQUETAS_TIPO_CAMBIO,
  seguimientoVencido,
  type DecisionCambio,
  type EstadoCambio,
  type ResultadoCambio,
  type TipoCambio,
} from "@/lib/cambios";

export const dynamic = "force-dynamic";

interface Cambio {
  id: string;
  codigo: string;
  titulo: string;
  tipo: TipoCambio;
  estado: EstadoCambio;
  proposito: string;
  consecuencias_potenciales: string;
  impacto_integridad_sgc: string;
  recursos_necesarios: string;
  responsabilidades: string;
  comunicacion_a_quien: string;
  comunicacion_cuando: string;
  comunicacion_canal: string;
  afecta_material_controlado: boolean;
  impacto_trazabilidad: string | null;
  indicador_exito: string;
  criterio_exito: string;
  fecha_revision: string;
  fecha_aprobacion: string | null;
  motivo_rechazo: string | null;
  fecha_implementacion: string | null;
  capacitacion_detalle: string | null;
  resultado: ResultadoCambio;
  seguimiento_observacion: string | null;
  decision: DecisionCambio | null;
  fecha_seguimiento: string | null;
  documentacion_actualizada: string | null;
  requiere_actualizar_documentacion: boolean;
  no_conformidad: { id: string; codigo: string } | null;
  procesos: { nombre: string } | null;
  responsable: { nombre_completo: string } | null;
  solicitante: { nombre_completo: string } | null;
  fecha_solicitud: string | null;
  seguidor: { nombre_completo: string } | null;
}

const CAMPOS = "id, codigo, titulo, tipo, estado, proposito, consecuencias_potenciales, "
  + "impacto_integridad_sgc, recursos_necesarios, responsabilidades, comunicacion_a_quien, "
  + "comunicacion_cuando, comunicacion_canal, afecta_material_controlado, impacto_trazabilidad, "
  + "indicador_exito, criterio_exito, fecha_revision, fecha_solicitud, motivo_rechazo, "
  + "fecha_implementacion, capacitacion_detalle, resultado, seguimiento_observacion, decision, "
  + "fecha_seguimiento, documentacion_actualizada, requiere_actualizar_documentacion, "
  + "no_conformidad:no_conformidad_id (id, codigo), "
  + "procesos:proceso_id (nombre), responsable:responsable_id (nombre_completo), "
  + "solicitante:solicitante_id (nombre_completo), seguidor:seguido_por (nombre_completo)";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("cambios")
    .select("codigo, titulo")
    .eq("id", params.id)
    .maybeSingle();

  const cambio = data as { codigo: string; titulo: string } | null;
  return { title: cambio ? `${cambio.codigo} · ${cambio.titulo}` : "Cambio" };
}

/** Un bloque de texto de la ficha. Vacío no se dibuja. */
function Bloque({ titulo, texto }: { titulo: string; texto: string | null }) {
  if (!texto) return null;
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste">
        {titulo}
      </p>
      <p className="mt-0.5 whitespace-pre-line text-xs leading-relaxed">{texto}</p>
    </div>
  );
}

export default async function PaginaCambio({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const gestiona = puedeGestionar(usuario);
  const supabase = crearClienteServidor();

  const { data } = await supabase.from("cambios").select(CAMPOS).eq("id", params.id).maybeSingle();
  const cambio = data as unknown as Cambio | null;
  if (!cambio) notFound();

  const vencido = seguimientoVencido(cambio.estado, cambio.fecha_revision);

  return (
    <div className="mx-auto max-w-4xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/cambios">
          <ArrowLeft /> Volver al listado
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={`${cambio.codigo} · ${cambio.titulo}`}
        descripcion={ETIQUETAS_TIPO_CAMBIO[cambio.tipo]}
        acciones={
          <span className="flex flex-wrap items-center gap-2">
            <Insignia variante="contorno">
              <span className={CLASES_ESTADO_CAMBIO[cambio.estado]}>
                {ETIQUETAS_ESTADO_CAMBIO[cambio.estado]}
              </span>
            </Insignia>
            {gestiona ? (
              <AccionesDelCambio
                cambioId={cambio.id}
                codigo={cambio.codigo}
                estado={cambio.estado}
              />
            ) : null}
          </span>
        }
      />

      {vencido ? (
        <p className="mb-3 rounded-md border border-semaforo-critico/40 bg-semaforo-critico/5 p-2.5 text-xs text-semaforo-critico">
          La fecha de revisión era el {formatearFecha(cambio.fecha_revision)} y el seguimiento
          sigue sin hacerse. Un cambio implementado y sin revisar es lo que este módulo existe para
          evitar.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="space-y-4">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Qué se cambia y por qué</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido className="space-y-3">
              <Bloque titulo="Propósito" texto={cambio.proposito} />
              <Bloque
                titulo="Consecuencias potenciales"
                texto={cambio.consecuencias_potenciales}
              />
              <Bloque
                titulo="Impacto en la integridad del SGC"
                texto={cambio.impacto_integridad_sgc}
              />
              <Bloque titulo="Recursos e información necesarios" texto={cambio.recursos_necesarios} />
              <Bloque titulo="Responsabilidades a asignar" texto={cambio.responsabilidades} />
              {cambio.afecta_material_controlado ? (
                <Bloque
                  titulo="Impacto en la trazabilidad de la Ley N° 7411/2024"
                  texto={cambio.impacto_trazabilidad}
                />
              ) : null}
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Plan de comunicación</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido className="grid gap-3 sm:grid-cols-3">
              <Bloque titulo="A quién" texto={cambio.comunicacion_a_quien} />
              <Bloque titulo="Cuándo" texto={cambio.comunicacion_cuando} />
              <Bloque titulo="Por qué canal" texto={cambio.comunicacion_canal} />
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Cómo se sabe si funcionó</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido className="grid gap-3 sm:grid-cols-3">
              <Bloque titulo="Indicador" texto={cambio.indicador_exito} />
              <Bloque titulo="Criterio de éxito" texto={cambio.criterio_exito} />
              <Bloque titulo="Fecha de revisión" texto={formatearFecha(cambio.fecha_revision)} />
            </TarjetaContenido>
          </Tarjeta>

          {cambio.motivo_rechazo ||
          cambio.capacitacion_detalle ||
          cambio.seguimiento_observacion ? (
            <Tarjeta>
              <TarjetaCabecera>
                <TarjetaTitulo>Recorrido</TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido className="space-y-3">
                <Bloque titulo="Motivo del rechazo" texto={cambio.motivo_rechazo} />
                <Bloque
                  titulo="Capacitación del personal afectado"
                  texto={cambio.capacitacion_detalle}
                />
                {cambio.seguimiento_observacion ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste">
                      Seguimiento de la eficacia
                    </p>
                    <p className="mt-0.5 text-xs">
                      {ETIQUETAS_RESULTADO_CAMBIO[cambio.resultado]}
                      {cambio.decision
                        ? ` · Decisión: ${ETIQUETAS_DECISION_CAMBIO[cambio.decision]}`
                        : ""}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-xs leading-relaxed">
                      {cambio.seguimiento_observacion}
                    </p>
                  </div>
                ) : null}
                {cambio.no_conformidad ? (
                  <div>
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste">
                      No conformidad abierta por este cambio
                    </p>
                    <p className="mt-0.5 text-xs">
                      <Link
                        href={`/no-conformidades/${cambio.no_conformidad.id}`}
                        className="text-primario hover:underline"
                      >
                        {cambio.no_conformidad.codigo}
                      </Link>
                    </p>
                  </div>
                ) : null}

                <Bloque
                  titulo="Información documentada actualizada"
                  texto={cambio.documentacion_actualizada}
                />
                {cambio.requiere_actualizar_documentacion ? (
                  <p className="text-xs text-semaforo-medio">
                    Queda pendiente actualizar la información documentada pertinente (MP-SOP-01).{" "}
                    <Link href="/documentos" className="text-primario hover:underline">
                      Ir a Documentación
                    </Link>
                  </p>
                ) : null}
              </TarjetaContenido>
            </Tarjeta>
          ) : null}
        </div>

        <div className="space-y-4">
          <PanelEstado cambioId={cambio.id} estado={cambio.estado} />

          <Tarjeta className="p-4">
            <dl className="space-y-2 text-xs">
              {[
                ["Proceso", cambio.procesos?.nombre ?? "—"],
                ["Responsable", cambio.responsable?.nombre_completo ?? "—"],
                ["Solicitante", cambio.solicitante?.nombre_completo ?? "—"],
                [
                  "Fecha de solicitud",
                  cambio.fecha_solicitud ? formatearFecha(cambio.fecha_solicitud) : "—",
                ],
                ["Seguimiento por", cambio.seguidor?.nombre_completo ?? "—"],
                [
                  "Fecha de seguimiento",
                  cambio.fecha_seguimiento ? formatearFecha(cambio.fecha_seguimiento) : "—",
                ],
              ].map(([etiqueta, valor]) => (
                <div key={etiqueta} className="flex justify-between gap-3">
                  <dt className="text-atenuado-contraste">{etiqueta}</dt>
                  <dd className="text-right font-medium">{valor}</dd>
                </div>
              ))}
            </dl>
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}
