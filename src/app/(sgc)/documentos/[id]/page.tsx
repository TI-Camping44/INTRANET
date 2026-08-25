import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { HistorialBitacora } from "@/components/comunes/historial-bitacora";
import {
  InsigniaDemostracion,
  InsigniaEstadoDocumento,
} from "@/components/comunes/insignias-estado";
import { AccionesDocumento } from "@/app/(sgc)/documentos/[id]/acciones-documento";
import { PanelDifusion } from "@/app/(sgc)/documentos/[id]/panel-difusion";
import { PanelRevision } from "@/app/(sgc)/documentos/[id]/panel-revision";
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
  ETIQUETAS_ESTADO_REVISION,
  ETIQUETAS_TIPO_DOCUMENTO,
} from "@/lib/constantes";
import { describirVencimiento, formatearFecha, formatearFechaHora } from "@/lib/formato";

export const dynamic = "force-dynamic";

/**
 * Forma del documento con sus relaciones incorporadas. Se declara a mano
 * porque el proyecto no usa tipos generados desde la base de datos.
 */
interface DocumentoDetalle {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string | null;
  tipo: keyof typeof ETIQUETAS_TIPO_DOCUMENTO;
  estado: "borrador" | "en_revision" | "vigente" | "obsoleto";
  version_actual: number;
  fecha_aprobacion: string | null;
  fecha_proxima_revision: string | null;
  periodicidad_revision_meses: number;
  es_demostracion: boolean;
  responsable_id: string | null;
  elaborador_id: string | null;
  procesos: { id: string; nombre: string; codigo: string } | null;
  normas: { codigo: string } | null;
  responsable: { id: string; nombre_completo: string } | null;
  elaborador: { nombre_completo: string } | null;
  aprobador: { nombre_completo: string } | null;
  url_documento: string | null;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("documentos")
    .select("codigo, titulo")
    .eq("id", params.id)
    .maybeSingle();

  if (!data) return { title: "Documento" };
  return { title: data.codigo ? `${data.codigo} · ${data.titulo}` : data.titulo };
}

export default async function PaginaDocumento({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: documentoConsulta } = await supabase
    .from("documentos")
    .select(
      "*, procesos:proceso_id (id, nombre, codigo), normas:norma_id (codigo), " +
        "responsable:responsable_id (id, nombre_completo), " +
        "elaborador:elaborador_id (nombre_completo), aprobador:aprobador_id (nombre_completo)",
    )
    .eq("id", params.id)
    .maybeSingle();

  const documento = documentoConsulta as unknown as DocumentoDetalle | null;
  if (!documento) notFound();

  const [
    { data: versiones },
    { data: revisores },
    { data: difusion },
    { data: personas },
    { data: procesos },
  ] = await Promise.all([
    supabase
      .from("documento_versiones")
      .select("*, elaborador:elaborado_por (nombre_completo), aprobador:aprobado_por (nombre_completo)")
      .eq("documento_id", params.id)
      .order("version", { ascending: false }),
    supabase
      .from("documento_revisores")
      .select("*, usuario:usuario_id (id, nombre_completo), version:version_id (id, version)")
      .order("creado_en"),
    supabase.from("documento_difusion").select("usuario_id, proceso_id").eq("documento_id", params.id),
    supabase.from("usuarios").select("id, nombre_completo").eq("activo", true).order("nombre_completo"),
    supabase.from("procesos").select("id, nombre").eq("activo", true).order("nombre"),
  ]);

  const listaVersiones = versiones ?? [];
  const idsVersiones = new Set(listaVersiones.map((version: { id: string }) => version.id));
  const revisionesDelDocumento = (revisores ?? []).filter((revision: { version_id: string }) =>
    idsVersiones.has(revision.version_id),
  );

  const versionEditable = listaVersiones.find(
    (version: { estado: string }) => version.estado === "borrador",
  );
  const versionEnRevision = listaVersiones.find(
    (version: { estado: string }) => version.estado === "en_revision",
  );
  const versionVigente = listaVersiones.find(
    (version: { estado: string }) => version.estado === "vigente",
  );

  const revisionesVersionActual = revisionesDelDocumento.filter(
    (revision: { version_id: string }) => revision.version_id === versionEnRevision?.id,
  );
  const pendientes = revisionesVersionActual.filter(
    (revision: { estado: string }) => revision.estado !== "aprobado",
  ).length;

  const miRevision = revisionesVersionActual.find(
    (revision: { usuario_id: string; estado: string }) =>
      revision.usuario_id === usuario.id && revision.estado === "pendiente",
  );

  const gestiona =
    puedeGestionar(usuario) &&
    (usuario.rol === "administrador_sgc" ||
      documento.responsable_id === usuario.id ||
      documento.elaborador_id === usuario.id ||
      documento.procesos?.id === usuario.proceso_id);

  return (
    <div className="mx-auto max-w-6xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/documentos">
          <ArrowLeft /> Volver al listado
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={documento.titulo}
        descripcion={documento.descripcion ?? undefined}
        acciones={
          <div className="flex flex-wrap items-center gap-2">
            {documento.url_documento ? (
              <Boton variante="contorno" tamano="pequeno" comoHijo>
                <a href={documento.url_documento} target="_blank" rel="noreferrer">
                  <ExternalLink /> Abrir el archivo
                </a>
              </Boton>
            ) : null}
          <AccionesDocumento
            documentoId={documento.id}
            estadoDocumento={documento.estado}
            versionEditableId={versionEditable?.id ?? null}
            versionEnRevisionId={versionEnRevision?.id ?? null}
            revisionesPendientes={pendientes}
            personas={(personas ?? []).filter(
              (persona: { id: string }) => persona.id !== usuario.id,
            )}
            puedeGestionar={gestiona}
          />
          </div>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {documento.codigo ? (
          <Insignia variante="primaria" className="tabular text-xs">
            {documento.codigo}
          </Insignia>
        ) : null}
        <InsigniaEstadoDocumento estado={documento.estado} />
        <Insignia variante="contorno">
          {ETIQUETAS_TIPO_DOCUMENTO[documento.tipo as keyof typeof ETIQUETAS_TIPO_DOCUMENTO]}
        </Insignia>
        <Insignia variante="neutra" className="tabular">
          Versión vigente v{String(documento.version_actual).padStart(2, "0")}
        </Insignia>
        {documento.es_demostracion ? <InsigniaDemostracion /> : null}
      </div>

      {miRevision ? (
        <div className="mb-4">
          <PanelRevision
            revisionId={miRevision.id}
            etiquetaVersion={`v${String(versionEnRevision?.version ?? 0).padStart(2, "0")}`}
          />
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Historial de versiones */}
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Historial de versiones</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido className="space-y-2">
              {listaVersiones.map((version: any) => (
                <div
                  key={version.id}
                  className="flex flex-col gap-1 rounded-md border border-borde p-3 sm:flex-row
                             sm:items-start sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="flex items-center gap-2 text-xs font-semibold tabular">
                      {version.etiqueta}
                      <InsigniaEstadoDocumento estado={version.estado} />
                    </p>
                    <p className="mt-1 text-[11px] leading-relaxed text-atenuado-contraste">
                      {version.resumen_cambios ?? "Sin detalle de cambios."}
                    </p>
                    <p className="mt-1 text-[11px] text-atenuado-contraste">
                      Elaborada por {version.elaborador?.nombre_completo ?? "—"} ·{" "}
                      {formatearFechaHora(version.creado_en)}
                      {version.aprobado_por
                        ? ` · Aprobada por ${version.aprobador?.nombre_completo ?? "—"} el ${formatearFecha(version.fecha_aprobacion)}`
                        : ""}
                    </p>
                  </div>
                </div>
              ))}
            </TarjetaContenido>
          </Tarjeta>

          {/* Revisiones de la versión en curso */}
          {revisionesVersionActual.length > 0 ? (
            <Tarjeta>
              <TarjetaCabecera>
                <TarjetaTitulo>
                  Revisiones de la versión v
                  {String(versionEnRevision?.version ?? 0).padStart(2, "0")}
                </TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido className="space-y-2">
                {revisionesVersionActual.map((revision: any) => (
                  <div
                    key={revision.id}
                    className="flex items-start justify-between gap-3 rounded-md border
                               border-borde p-2.5"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-medium">
                        {revision.usuario?.nombre_completo ?? "—"}
                      </p>
                      {revision.comentario ? (
                        <p className="mt-0.5 text-[11px] text-atenuado-contraste">
                          {revision.comentario}
                        </p>
                      ) : null}
                      {revision.fecha_respuesta ? (
                        <p className="mt-0.5 text-[10px] text-atenuado-contraste">
                          {formatearFechaHora(revision.fecha_respuesta)}
                        </p>
                      ) : null}
                    </div>
                    <Insignia
                      variante={
                        revision.estado === "aprobado"
                          ? "exito"
                          : revision.estado === "rechazado"
                            ? "peligro"
                            : "advertencia"
                      }
                    >
                      {ETIQUETAS_ESTADO_REVISION[revision.estado as "pendiente"]}
                    </Insignia>
                  </div>
                ))}
              </TarjetaContenido>
            </Tarjeta>
          ) : null}

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Trazabilidad</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <HistorialBitacora tablas={["documentos"]} registroId={documento.id} />
            </TarjetaContenido>
          </Tarjeta>
        </div>

        {/* Ficha lateral */}
        <div className="space-y-4">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Ficha del documento</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <dl className="space-y-2.5 text-xs">
                <Dato etiqueta="Proceso" valor={documento.procesos?.nombre ?? "—"} />
                <Dato etiqueta="Norma" valor={documento.normas?.codigo ?? "—"} />
                <Dato
                  etiqueta="Responsable"
                  valor={documento.responsable?.nombre_completo ?? "—"}
                />
                <Dato
                  etiqueta="Elaborado por"
                  valor={documento.elaborador?.nombre_completo ?? "—"}
                />
                <Dato etiqueta="Aprobado por" valor={documento.aprobador?.nombre_completo ?? "—"} />
                <Dato
                  etiqueta="Fecha de aprobación"
                  valor={formatearFecha(documento.fecha_aprobacion)}
                />
                <Dato
                  etiqueta="Próxima revisión"
                  valor={
                    documento.fecha_proxima_revision
                      ? `${formatearFecha(documento.fecha_proxima_revision)} · ${describirVencimiento(documento.fecha_proxima_revision)}`
                      : "—"
                  }
                />
                <Dato
                  etiqueta="Periodicidad"
                  valor={`Cada ${documento.periodicidad_revision_meses} meses`}
                />
              </dl>
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Lista de difusión</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <PanelDifusion
                documentoId={documento.id}
                personas={(personas ?? []).map((persona: any) => ({
                  id: persona.id,
                  nombre: persona.nombre_completo,
                }))}
                procesos={(procesos ?? []).map((proceso: any) => ({
                  id: proceso.id,
                  nombre: proceso.nombre,
                }))}
                usuariosSeleccionados={(difusion ?? [])
                  .filter((fila: any) => fila.usuario_id)
                  .map((fila: any) => fila.usuario_id)}
                procesosSeleccionados={(difusion ?? [])
                  .filter((fila: any) => fila.proceso_id)
                  .map((fila: any) => fila.proceso_id)}
                puedeEditar={gestiona}
              />
            </TarjetaContenido>
          </Tarjeta>

          {versionVigente ? (
            <Tarjeta>
              <TarjetaCabecera>
                <TarjetaTitulo>Versión vigente</TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido>
                <p className="text-xs">
                  <span className="font-semibold tabular">{versionVigente.etiqueta}</span> ·{" "}
                  {versionVigente.resumen_cambios ?? "Sin detalle de cambios."}
                </p>
                <p className="mt-1 text-[11px] text-atenuado-contraste">
                  Aprobada el {formatearFecha(versionVigente.fecha_aprobacion)}
                </p>
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
