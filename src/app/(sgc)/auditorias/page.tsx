import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardCheck, Plus } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import { InsigniaEstadoAuditoria } from "@/components/comunes/insignias-estado";
import { PanelPrograma } from "@/app/(sgc)/auditorias/panel-programa";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Progreso } from "@/components/ui/progreso";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import { puedeGestionarAuditorias, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ETIQUETAS_ESTADO_AUDITORIA } from "@/lib/constantes";
import { describirVencimiento, diasHasta, formatearFecha, hoyEnAsuncion } from "@/lib/formato";
import { recortar } from "@/lib/utilidades";
import type { EstadoAuditoria } from "@/lib/tipos";

export const metadata: Metadata = { title: "Auditorías internas" };
export const dynamic = "force-dynamic";

interface FilaAuditoria {
  id: string;
  codigo: string;
  tipo: string;
  objetivo: string | null;
  fecha_planificada: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  estado: EstadoAuditoria;
  procesos: { nombre: string } | null;
  auditor: { nombre_completo: string } | null;
  auditoria_hallazgos: { id: string; tipo: string; no_conformidad_id: string | null }[];
}

export default async function PaginaAuditorias({
  searchParams,
}: {
  searchParams: { q?: string; estado?: string; anio?: string };
}) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();
  const anioActual = Number(hoyEnAsuncion().slice(0, 4));
  const anio = Number(searchParams.anio ?? anioActual);

  let consulta = supabase
    .from("auditorias")
    .select(
      "id, codigo, tipo, objetivo, fecha_planificada, fecha_inicio, fecha_fin, estado, " +
        "procesos:proceso_id (nombre), auditor:auditor_lider_id (nombre_completo), " +
        "auditoria_hallazgos (id, tipo, no_conformidad_id)",
    )
    .order("fecha_planificada", { ascending: true });

  if (searchParams.estado) consulta = consulta.eq("estado", searchParams.estado);
  if (searchParams.q) {
    const texto = `%${searchParams.q}%`;
    consulta = consulta.or(`codigo.ilike.${texto},objetivo.ilike.${texto}`);
  }

  const [{ data: auditoriasDatos }, { data: programas }] = await Promise.all([
    consulta,
    supabase.from("programas_auditoria").select("*").order("anio", { ascending: false }),
  ]);

  const auditorias = (auditoriasDatos as unknown as FilaAuditoria[] | null) ?? [];
  const listaProgramas = (programas ?? []) as any[];
  const programaVigente =
    listaProgramas.find((programa) => programa.anio === anio) ?? listaProgramas[0] ?? null;

  const delAnio = auditorias.filter(
    (auditoria) => (auditoria.fecha_planificada ?? "").slice(0, 4) === String(anio),
  );
  const cerradas = delAnio.filter((auditoria) => auditoria.estado === "cerrada").length;
  const avance = delAnio.length > 0 ? Math.round((cerradas / delAnio.length) * 100) : 0;

  const hallazgos = auditorias.flatMap((auditoria) => auditoria.auditoria_hallazgos ?? []);
  const noConformidadesPendientes = hallazgos.filter(
    (hallazgo) => hallazgo.tipo.startsWith("no_conformidad") && !hallazgo.no_conformidad_id,
  ).length;

  const gestiona = puedeGestionarAuditorias(usuario);

  return (
    <>
      <EncabezadoPagina
        titulo="Auditorías internas"
        descripcion="Programa anual, planes de auditoría, hallazgos e informes. Los hallazgos de no conformidad generan la NC correspondiente en un paso."
        acciones={
          gestiona ? (
            <>
              <PanelPrograma
                programaId={programaVigente?.id ?? null}
                estado={programaVigente?.estado ?? null}
                anioSugerido={anioActual}
                puedeAprobar={usuario.rol === "administrador_sgc"}
              />
              <Boton comoHijo>
                <Link href="/auditorias/nueva">
                  <Plus /> Nueva auditoría
                </Link>
              </Boton>
            </>
          ) : null
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          titulo={`Avance ${anio}`}
          valor={`${avance}%`}
          contexto={`${cerradas} de ${delAnio.length} cerradas`}
          tono={avance >= 75 ? "exito" : avance >= 40 ? "advertencia" : "atencion"}
        />
        <TarjetaIndicador
          titulo="Auditorías del año"
          valor={delAnio.length}
          contexto={programaVigente ? ETIQUETAS_ESTADO_AUDITORIA[programaVigente.estado as EstadoAuditoria] : "Sin programa"}
        />
        <TarjetaIndicador
          titulo="Hallazgos registrados"
          valor={hallazgos.length}
          contexto="En todas las auditorías"
        />
        <TarjetaIndicador
          titulo="NC por generar"
          valor={noConformidadesPendientes}
          contexto={
            noConformidadesPendientes > 0
              ? "Hallazgos sin tratar"
              : "Todos los hallazgos tratados"
          }
          tono={noConformidadesPendientes > 0 ? "peligro" : "exito"}
        />
      </div>

      {programaVigente ? (
        <Tarjeta className="mb-4 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-xs font-semibold">
                {programaVigente.nombre}
                <InsigniaEstadoAuditoria estado={programaVigente.estado as EstadoAuditoria} />
              </p>
              <p className="mt-0.5 text-[11px] leading-relaxed text-atenuado-contraste">
                {programaVigente.objetivo ?? "Sin objetivo declarado."}
              </p>
              {programaVigente.fecha_aprobacion ? (
                <p className="mt-1 text-[11px] text-atenuado-contraste">
                  Aprobado el {formatearFecha(programaVigente.fecha_aprobacion)}
                </p>
              ) : (
                <p className="mt-1 text-[11px] text-semaforo-medio">
                  Pendiente de aprobación del Administrador SGC
                </p>
              )}
            </div>
            <span className="text-2xl font-semibold tabular">{avance}%</span>
          </div>
          <Progreso value={avance} className="mt-3" />
        </Tarjeta>
      ) : null}

      <FiltrosListado
        marcadorBusqueda="Buscar por código u objetivo…"
        campos={[
          {
            nombre: "estado",
            etiqueta: "Estado",
            opciones: Object.entries(ETIQUETAS_ESTADO_AUDITORIA).map(([valor, etiqueta]) => ({
              valor,
              etiqueta,
            })),
          },
        ]}
      />

      {auditorias.length === 0 ? (
        <EstadoVacio
          icono={<ClipboardCheck className="size-6" />}
          titulo="Sin auditorías registradas"
          descripcion="Cree el programa anual y planifique la primera auditoría del ejercicio."
          accion={
            gestiona ? (
              <Boton comoHijo tamano="pequeno">
                <Link href="/auditorias/nueva">
                  <Plus /> Nueva auditoría
                </Link>
              </Boton>
            ) : null
          }
        />
      ) : (
        <Tarjeta>
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado className="w-[8.5rem]">Código</TablaEncabezado>
                <TablaEncabezado>Objetivo</TablaEncabezado>
                <TablaEncabezado className="hidden lg:table-cell">Proceso</TablaEncabezado>
                <TablaEncabezado className="hidden xl:table-cell">Auditor líder</TablaEncabezado>
                <TablaEncabezado className="w-[6rem] text-center">Hallazgos</TablaEncabezado>
                <TablaEncabezado className="w-[9rem]">Estado</TablaEncabezado>
                <TablaEncabezado className="w-[9rem]">Fecha</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {auditorias.map((auditoria) => {
                const propios = auditoria.auditoria_hallazgos ?? [];
                const pendientes = propios.filter(
                  (hallazgo) =>
                    hallazgo.tipo.startsWith("no_conformidad") && !hallazgo.no_conformidad_id,
                ).length;
                const fecha = auditoria.fecha_inicio ?? auditoria.fecha_planificada;
                const dias = diasHasta(fecha);
                const proxima =
                  auditoria.estado === "planificada" && dias !== null && dias <= 30;

                return (
                  <TablaFila key={auditoria.id}>
                    <TablaCelda className="font-medium tabular">
                      <Link href={`/auditorias/${auditoria.id}`} className="hover:text-primario">
                        {auditoria.codigo}
                      </Link>
                    </TablaCelda>
                    <TablaCelda>
                      <Link
                        href={`/auditorias/${auditoria.id}`}
                        className="hover:text-primario"
                      >
                        {recortar(auditoria.objetivo, 75) || "—"}
                      </Link>
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                      {auditoria.procesos?.nombre ?? "—"}
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste xl:table-cell">
                      {auditoria.auditor?.nombre_completo ?? "—"}
                    </TablaCelda>
                    <TablaCelda className="text-center">
                      <span className="text-xs tabular">{propios.length}</span>
                      {pendientes > 0 ? (
                        <Insignia variante="peligro" className="ml-1.5">
                          {pendientes} sin NC
                        </Insignia>
                      ) : null}
                    </TablaCelda>
                    <TablaCelda>
                      <InsigniaEstadoAuditoria estado={auditoria.estado} />
                    </TablaCelda>
                    <TablaCelda className="text-xs">
                      <span className={proxima ? "text-semaforo-medio" : "text-atenuado-contraste"}>
                        {formatearFecha(fecha)}
                        {proxima ? (
                          <span className="block text-[10px]">
                            {describirVencimiento(fecha)}
                          </span>
                        ) : null}
                      </span>
                    </TablaCelda>
                  </TablaFila>
                );
              })}
            </TablaCuerpo>
          </Tabla>
        </Tarjeta>
      )}

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {auditorias.length} auditoría{auditorias.length === 1 ? "" : "s"} en el listado.
      </p>
    </>
  );
}
