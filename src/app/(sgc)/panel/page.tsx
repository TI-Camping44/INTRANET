import type { Metadata } from "next";
import Link from "next/link";
import {
  CalendarClock,
  ClipboardCheck,
  FileText,
  ShieldAlert,
  TrendingUp,
  TriangleAlert,
} from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import {
  InsigniaEstadoAccion,
  InsigniaEstadoNC,
  InsigniaNivelRiesgo,
} from "@/components/comunes/insignias-estado";
import { Tarjeta, TarjetaCabecera, TarjetaTitulo } from "@/components/ui/tarjeta";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Progreso } from "@/components/ui/progreso";
import { obtenerResumenPanel } from "@/app/(sgc)/panel/datos";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { describirVencimiento, formatearFecha, hoyEnAsuncion, sumarDias } from "@/lib/formato";
import { DIAS_AVISO_REVISION_DOCUMENTO, ESTADOS_NC_ABIERTOS } from "@/lib/constantes";
import { recortar } from "@/lib/utilidades";

export const metadata: Metadata = { title: "Panel" };
export const dynamic = "force-dynamic";

export default async function PaginaPanel() {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();
  const hoy = hoyEnAsuncion();

  const [resumen, ncRecientes, riesgosCriticos, documentosPorRevisar, misAcciones] =
    await Promise.all([
      obtenerResumenPanel(usuario),
      supabase
        .from("no_conformidades")
        .select("id, codigo, titulo, estado, severidad, fecha_limite_cierre")
        .in("estado", ESTADOS_NC_ABIERTOS)
        .order("fecha_deteccion", { ascending: false })
        .limit(6),
      supabase
        .from("riesgos")
        .select("id, codigo, titulo, nivel, probabilidad, impacto, estado")
        .gte("nivel", 10)
        .in("estado", ["identificado", "en_tratamiento", "materializado"])
        .order("nivel", { ascending: false })
        .limit(6),
      supabase
        .from("documentos")
        .select("id, codigo, titulo, fecha_proxima_revision, version_actual")
        .eq("estado", "vigente")
        .lte("fecha_proxima_revision", sumarDias(hoy, DIAS_AVISO_REVISION_DOCUMENTO))
        .order("fecha_proxima_revision", { ascending: true })
        .limit(6),
      supabase
        .from("nc_acciones")
        .select("id, descripcion, fecha_limite, estado, no_conformidad_id")
        .eq("responsable_id", usuario.id)
        .in("estado", ["pendiente", "en_curso"])
        .order("fecha_limite", { ascending: true })
        .limit(6),
    ]);

  const avanceAuditorias =
    resumen.auditoriasTotales > 0
      ? Math.round((resumen.auditoriasCerradas / resumen.auditoriasTotales) * 100)
      : 0;

  const nombreCorto = usuario.nombre_completo.split(" ")[0];

  return (
    <>
      <EncabezadoPagina
        titulo={`Buen día, ${nombreCorto}`}
        descripcion={`Estado del Sistema de Gestión de Calidad al ${formatearFecha(hoy)}.`}
      />

      {/* Tarjetas de estado general */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-5">
        <TarjetaIndicador
          titulo="NC abiertas"
          valor={resumen.ncAbiertas}
          contexto={
            resumen.ncVencidas > 0
              ? `${resumen.ncVencidas} fuera de plazo`
              : "Ninguna fuera de plazo"
          }
          tono={resumen.ncVencidas > 0 ? "peligro" : "neutro"}
          enlace="/no-conformidades?estado=abiertas"
          icono={<TriangleAlert className="size-4" />}
        />
        <TarjetaIndicador
          titulo="Riesgos altos"
          valor={resumen.riesgosAltos}
          contexto={
            resumen.riesgosPorReevaluar > 0
              ? `${resumen.riesgosPorReevaluar} por reevaluar`
              : "Reevaluaciones al día"
          }
          tono={resumen.riesgosAltos > 0 ? "atencion" : "exito"}
          enlace="/riesgos?nivel=altos"
          icono={<ShieldAlert className="size-4" />}
        />
        <TarjetaIndicador
          titulo="Documentos por revisar"
          valor={resumen.documentosPorRevisar}
          contexto={`De ${resumen.documentosVigentes} vigentes`}
          tono={resumen.documentosPorRevisar > 0 ? "advertencia" : "exito"}
          enlace="/documentos?filtro=por-revisar"
          icono={<FileText className="size-4" />}
        />
        <TarjetaIndicador
          titulo="Avance de auditorías"
          valor={`${avanceAuditorias}%`}
          contexto={`${resumen.auditoriasCerradas} de ${resumen.auditoriasTotales} cerradas`}
          tono={avanceAuditorias >= 60 ? "exito" : "advertencia"}
          enlace="/auditorias"
          icono={<ClipboardCheck className="size-4" />}
        />
        <TarjetaIndicador
          titulo="KPI fuera de meta"
          valor={resumen.indicadoresFueraDeMeta}
          contexto={`De ${resumen.indicadoresMedidos} mediciones del año`}
          tono={resumen.indicadoresFueraDeMeta > 0 ? "atencion" : "exito"}
          enlace="/indicadores"
          icono={<TrendingUp className="size-4" />}
        />
      </div>

      {/* Listados de trabajo */}
      <div className="mt-5 grid gap-4 xl:grid-cols-2">
        <Tarjeta>
          <TarjetaCabecera className="flex-row items-center justify-between">
            <TarjetaTitulo>No conformidades abiertas</TarjetaTitulo>
            <Link href="/no-conformidades" className="text-[11px] text-primario hover:underline">
              Ver todas
            </Link>
          </TarjetaCabecera>
          <div className="px-4 pb-4">
            {(ncRecientes.data ?? []).length === 0 ? (
              <EstadoVacio
                titulo="Sin no conformidades abiertas"
                descripcion="No hay desviaciones pendientes de tratamiento."
              />
            ) : (
              <ul className="divide-y divide-borde">
                {(ncRecientes.data ?? []).map((nc) => (
                  <li key={nc.id}>
                    <Link
                      href={`/no-conformidades/${nc.id}`}
                      className="flex items-start gap-3 py-2.5 transition-colors hover:bg-acento/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">
                          <span className="text-atenuado-contraste">{nc.codigo}</span>{" "}
                          {recortar(nc.titulo, 70)}
                        </p>
                        <p className="mt-1 text-[11px] text-atenuado-contraste">
                          {nc.fecha_limite_cierre
                            ? describirVencimiento(nc.fecha_limite_cierre)
                            : "Sin fecha límite"}
                        </p>
                      </div>
                      <InsigniaEstadoNC estado={nc.estado} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Tarjeta>

        <Tarjeta>
          <TarjetaCabecera className="flex-row items-center justify-between">
            <TarjetaTitulo>Riesgos altos y críticos</TarjetaTitulo>
            <Link href="/riesgos/matriz" className="text-[11px] text-primario hover:underline">
              Ver matriz
            </Link>
          </TarjetaCabecera>
          <div className="px-4 pb-4">
            {(riesgosCriticos.data ?? []).length === 0 ? (
              <EstadoVacio
                titulo="Sin riesgos altos"
                descripcion="Ningún riesgo supera el umbral de nivel 10 en la matriz."
              />
            ) : (
              <ul className="divide-y divide-borde">
                {(riesgosCriticos.data ?? []).map((riesgo) => (
                  <li key={riesgo.id}>
                    <Link
                      href={`/riesgos/${riesgo.id}`}
                      className="flex items-start gap-3 py-2.5 transition-colors hover:bg-acento/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">
                          <span className="text-atenuado-contraste">{riesgo.codigo}</span>{" "}
                          {recortar(riesgo.titulo, 70)}
                        </p>
                        <p className="mt-1 text-[11px] text-atenuado-contraste">
                          Probabilidad {riesgo.probabilidad} × Impacto {riesgo.impacto}
                        </p>
                      </div>
                      <InsigniaNivelRiesgo nivel={riesgo.nivel} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Tarjeta>

        <Tarjeta>
          <TarjetaCabecera className="flex-row items-center justify-between">
            <TarjetaTitulo>Documentos próximos a revisión</TarjetaTitulo>
            <Link href="/documentos" className="text-[11px] text-primario hover:underline">
              Ver todos
            </Link>
          </TarjetaCabecera>
          <div className="px-4 pb-4">
            {(documentosPorRevisar.data ?? []).length === 0 ? (
              <EstadoVacio
                titulo="Documentación al día"
                descripcion={`Ningún documento vigente vence su revisión en los próximos ${DIAS_AVISO_REVISION_DOCUMENTO} días.`}
              />
            ) : (
              <ul className="divide-y divide-borde">
                {(documentosPorRevisar.data ?? []).map((documento) => (
                  <li key={documento.id}>
                    <Link
                      href={`/documentos/${documento.id}`}
                      className="flex items-start gap-3 py-2.5 transition-colors hover:bg-acento/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">
                          <span className="text-atenuado-contraste">{documento.codigo}</span>{" "}
                          {recortar(documento.titulo, 70)}
                        </p>
                        <p className="mt-1 text-[11px] text-atenuado-contraste">
                          {describirVencimiento(documento.fecha_proxima_revision)} ·{" "}
                          {formatearFecha(documento.fecha_proxima_revision)}
                        </p>
                      </div>
                      <CalendarClock className="size-4 shrink-0 text-atenuado-contraste" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Tarjeta>

        <Tarjeta>
          <TarjetaCabecera className="flex-row items-center justify-between">
            <TarjetaTitulo>Mis acciones pendientes</TarjetaTitulo>
            <span className="text-[11px] text-atenuado-contraste">
              {resumen.misAccionesPendientes} asignadas
            </span>
          </TarjetaCabecera>
          <div className="px-4 pb-4">
            {(misAcciones.data ?? []).length === 0 ? (
              <EstadoVacio
                titulo="Sin acciones a su cargo"
                descripcion="No tiene acciones correctivas pendientes de ejecución."
              />
            ) : (
              <ul className="divide-y divide-borde">
                {(misAcciones.data ?? []).map((accion) => (
                  <li key={accion.id}>
                    <Link
                      href={`/no-conformidades/${accion.no_conformidad_id}`}
                      className="flex items-start gap-3 py-2.5 transition-colors hover:bg-acento/40"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium">{recortar(accion.descripcion, 80)}</p>
                        <p className="mt-1 text-[11px] text-atenuado-contraste">
                          {describirVencimiento(accion.fecha_limite)}
                        </p>
                      </div>
                      <InsigniaEstadoAccion estado={accion.estado} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Tarjeta>
      </div>

      {/* Avance del programa de auditorías */}
      <Tarjeta className="mt-4 p-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold">Programa anual de auditorías internas</p>
            <p className="mt-0.5 text-[11px] text-atenuado-contraste">
              {resumen.auditoriasCerradas} de {resumen.auditoriasTotales} auditorías cerradas en{" "}
              {hoy.slice(0, 4)}
            </p>
          </div>
          <span className="text-2xl font-semibold tabular">{avanceAuditorias}%</span>
        </div>
        <Progreso value={avanceAuditorias} className="mt-3" />
      </Tarjeta>
    </>
  );
}
