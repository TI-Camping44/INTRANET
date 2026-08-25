import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { HistorialBitacora } from "@/components/comunes/historial-bitacora";
import { InsigniaEstadoAuditoria } from "@/components/comunes/insignias-estado";
import { PanelEjecucion } from "@/app/(sgc)/auditorias/[id]/panel-ejecucion";
import { PanelHallazgos } from "@/app/(sgc)/auditorias/[id]/panel-hallazgos";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { puedeGestionarAuditorias, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ETIQUETAS_TIPO_HALLAZGO } from "@/lib/constantes";
import { formatearFecha } from "@/lib/formato";
import type { EstadoAuditoria, TipoHallazgo } from "@/lib/tipos";

export const dynamic = "force-dynamic";

const ETIQUETAS_TIPO_AUDITORIA: Record<string, string> = {
  interna: "Interna",
  externa: "Externa",
  proveedor: "A proveedor",
  seguimiento: "De seguimiento",
};

interface AuditoriaDetalle {
  id: string;
  codigo: string;
  tipo: string;
  objetivo: string | null;
  alcance: string | null;
  criterios: string | null;
  conclusiones: string | null;
  fecha_planificada: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: EstadoAuditoria;
  auditor_lider_id: string | null;
  procesos: { nombre: string } | null;
  normas: { codigo: string } | null;
  sedes: { nombre: string } | null;
  auditor: { nombre_completo: string } | null;
  programas_auditoria: { nombre: string; anio: number } | null;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("auditorias")
    .select("codigo, objetivo")
    .eq("id", params.id)
    .maybeSingle();

  return { title: data ? `${data.codigo} · Auditoría` : "Auditoría" };
}

export default async function PaginaAuditoria({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: consulta } = await supabase
    .from("auditorias")
    .select(
      "*, procesos:proceso_id (nombre), normas:norma_id (codigo), sedes:sede_id (nombre), " +
        "auditor:auditor_lider_id (nombre_completo), programas_auditoria:programa_id (nombre, anio)",
    )
    .eq("id", params.id)
    .maybeSingle();

  const auditoria = consulta as unknown as AuditoriaDetalle | null;
  if (!auditoria) notFound();

  const [{ data: hallazgos }, { data: equipo }, { data: personas }, { data: procesos }] =
    await Promise.all([
      supabase
        .from("auditoria_hallazgos")
        .select(
          "*, procesos:proceso_id (nombre), no_conformidad:no_conformidad_id (codigo, estado)",
        )
        .eq("auditoria_id", params.id)
        .order("codigo"),
      supabase
        .from("auditoria_equipo")
        .select("usuario_id, rol_equipo, usuarios:usuario_id (nombre_completo)")
        .eq("auditoria_id", params.id),
      supabase
        .from("usuarios")
        .select("id, nombre_completo")
        .eq("activo", true)
        .order("nombre_completo"),
      supabase.from("procesos").select("id, nombre").eq("activo", true).order("nombre"),
    ]);

  const listaHallazgos = (hallazgos as any[] | null) ?? [];
  const listaEquipo = (equipo as any[] | null) ?? [];
  const gestiona = puedeGestionarAuditorias(usuario);

  const resumen = listaHallazgos.reduce<Record<string, number>>((cuenta, hallazgo) => {
    cuenta[hallazgo.tipo] = (cuenta[hallazgo.tipo] ?? 0) + 1;
    return cuenta;
  }, {});

  return (
    <div className="mx-auto max-w-6xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/auditorias">
          <ArrowLeft /> Volver al listado
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={auditoria.objetivo ?? auditoria.codigo}
        acciones={
          <PanelEjecucion
            auditoriaId={auditoria.id}
            estado={auditoria.estado}
            equipoActual={listaEquipo.map((fila) => fila.usuario_id)}
            auditorLiderId={auditoria.auditor_lider_id}
            personas={(personas as { id: string; nombre_completo: string }[] | null) ?? []}
            puedeEditar={gestiona}
          />
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Insignia variante="primaria" className="tabular text-xs">
          {auditoria.codigo}
        </Insignia>
        <InsigniaEstadoAuditoria estado={auditoria.estado} />
        <Insignia variante="contorno">
          {ETIQUETAS_TIPO_AUDITORIA[auditoria.tipo] ?? auditoria.tipo}
        </Insignia>
        {auditoria.programas_auditoria ? (
          <Insignia variante="neutra">
            {auditoria.programas_auditoria.nombre} ({auditoria.programas_auditoria.anio})
          </Insignia>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Plan de auditoría</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido className="space-y-3 text-xs leading-relaxed">
              <Bloque titulo="Objetivo" texto={auditoria.objetivo} />
              <Bloque titulo="Alcance" texto={auditoria.alcance} />
              <Bloque titulo="Criterios" texto={auditoria.criterios} />
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera className="flex-row items-center justify-between">
              <TarjetaTitulo>Hallazgos</TarjetaTitulo>
              <span className="text-[11px] text-atenuado-contraste">
                {listaHallazgos.length} registrado{listaHallazgos.length === 1 ? "" : "s"}
              </span>
            </TarjetaCabecera>
            <TarjetaContenido>
              <PanelHallazgos
                auditoriaId={auditoria.id}
                hallazgos={listaHallazgos}
                procesos={(procesos as { id: string; nombre: string }[] | null) ?? []}
                personas={(personas as { id: string; nombre_completo: string }[] | null) ?? []}
                puedeEditar={gestiona && auditoria.estado !== "cerrada"}
              />
            </TarjetaContenido>
          </Tarjeta>

          {auditoria.conclusiones ? (
            <Tarjeta>
              <TarjetaCabecera>
                <TarjetaTitulo>Conclusiones del informe</TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido>
                <p className="whitespace-pre-line text-xs leading-relaxed">
                  {auditoria.conclusiones}
                </p>
              </TarjetaContenido>
            </Tarjeta>
          ) : null}

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Trazabilidad</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <HistorialBitacora tablas={["auditorias"]} registroId={auditoria.id} />
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
                <Dato etiqueta="Proceso auditado" valor={auditoria.procesos?.nombre ?? "—"} />
                <Dato etiqueta="Sede" valor={auditoria.sedes?.nombre ?? "—"} />
                <Dato etiqueta="Norma" valor={auditoria.normas?.codigo ?? "—"} />
                <Dato
                  etiqueta="Auditor líder"
                  valor={auditoria.auditor?.nombre_completo ?? "—"}
                />
                <Dato
                  etiqueta="Planificada"
                  valor={formatearFecha(auditoria.fecha_planificada)}
                />
                <Dato etiqueta="Inicio" valor={formatearFecha(auditoria.fecha_inicio)} />
                <Dato etiqueta="Fin" valor={formatearFecha(auditoria.fecha_fin)} />
              </dl>
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Equipo auditor</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              {listaEquipo.length === 0 ? (
                <p className="text-xs text-atenuado-contraste">Sin equipo definido.</p>
              ) : (
                <ul className="space-y-1.5">
                  {listaEquipo.map((integrante) => (
                    <li key={integrante.usuario_id} className="flex items-center justify-between gap-2">
                      <span className="text-xs">
                        {integrante.usuarios?.nombre_completo ?? "—"}
                      </span>
                      <span className="text-[10px] text-atenuado-contraste">
                        {integrante.rol_equipo}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </TarjetaContenido>
          </Tarjeta>

          {listaHallazgos.length > 0 ? (
            <Tarjeta>
              <TarjetaCabecera>
                <TarjetaTitulo>Resumen de hallazgos</TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido>
                <dl className="space-y-2 text-xs">
                  {Object.entries(resumen).map(([tipo, cantidad]) => (
                    <div key={tipo} className="flex items-baseline justify-between gap-3">
                      <dt className="text-atenuado-contraste">
                        {ETIQUETAS_TIPO_HALLAZGO[tipo as TipoHallazgo]}
                      </dt>
                      <dd className="font-semibold tabular">{cantidad}</dd>
                    </div>
                  ))}
                </dl>
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
