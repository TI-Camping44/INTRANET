import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, ClipboardCheck, Plus } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import { CeldaTexto } from "@/components/comunes/celda-texto";
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
import { ETIQUETAS_ESTADO_AUDITORIA, ETIQUETAS_TIPO_AUDITORIA } from "@/lib/constantes";
import { describirVencimiento, diasHasta, formatearFecha, hoyEnAsuncion } from "@/lib/formato";
import { recortar } from "@/lib/utilidades";
import type { EstadoAuditoria } from "@/lib/tipos";

export const metadata: Metadata = { title: "Auditoría" };
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
  auditoria_procesos: { procesos: { nombre: string } | null }[];
  auditoria_documentos: { documentos: { codigo: string | null; titulo: string } | null }[];
}

export default async function PaginaAuditorias({
  searchParams,
}: {
  searchParams: { q?: string; estado?: string; anio?: string; tipo?: string };
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
        "auditoria_hallazgos (id, tipo, no_conformidad_id), " +
        // Todos los procesos que abarca, no solo el primero.
        // `auditorias.proceso_id` guarda uno —el primero que se eligio— y
        // la columna del listado mostraba ese y nada mas: una auditoria
        // de ocho procesos se leia como una de uno.
        "auditoria_procesos (procesos:proceso_id (nombre)), " +
        "auditoria_documentos (documentos:documento_id (codigo, titulo))",
    )
    .order("fecha_planificada", { ascending: true });

  if (searchParams.estado) consulta = consulta.eq("estado", searchParams.estado);
  if (searchParams.tipo) consulta = consulta.eq("tipo", searchParams.tipo);
  if (searchParams.q) {
    const texto = `%${searchParams.q}%`;
    consulta = consulta.or(
      `codigo.ilike.${texto},objetivo.ilike.${texto},alcance.ilike.${texto},criterios.ilike.${texto}`,
    );
  }

  const [{ data: auditoriasDatos }, { data: programas }] = await Promise.all([
    consulta,
    supabase.from("programas_auditoria").select("*").order("anio", { ascending: false }),
  ]);

  const auditorias = (auditoriasDatos as unknown as FilaAuditoria[] | null) ?? [];
  const listaProgramas = (programas ?? []) as any[];
  const programaVigente =
    listaProgramas.find((programa) => programa.anio === anio) ?? listaProgramas[0] ?? null;

  // Los años que ofrece el filtro: los de los programas y los de las
  // auditorías planificadas, mas el corriente, sin repetir y de mayor a
  // menor.
  const aniosConRegistros = Array.from(
    new Set<number>([
      anioActual,
      ...listaProgramas.map((programa) => Number(programa.anio)),
      ...auditorias
        .map((auditoria) => Number((auditoria.fecha_planificada ?? "").slice(0, 4)))
        .filter((valor) => !Number.isNaN(valor) && valor > 0),
    ]),
  ).sort((a, b) => b - a);

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
        titulo="Auditoría"
        descripcion="Programa anual, planes de auditoría, hallazgos e informes. Los hallazgos de no conformidad generan la NC correspondiente en un paso."
        acciones={
          gestiona ? (
            <>
              <PanelPrograma
                programaId={programaVigente?.id ?? null}
                estado={programaVigente?.estado ?? null}
                anioSugerido={anioActual}
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

      {/* Los programas anuales. Cada uno se abre: adentro está el
          calendario del año con los días agendados, y de cada día se
          llega a la auditoría para completar su plan. */}
      {listaProgramas.length > 0 ? (
        <div className="mb-4 space-y-2">
          {listaProgramas.map((programa) => {
            const suyas = auditorias.filter(
              (auditoria) => (auditoria.fecha_planificada ?? "").slice(0, 4) === String(programa.anio),
            );
            const suyasCerradas = suyas.filter(
              (auditoria) => auditoria.estado === "cerrada",
            ).length;
            const suAvance =
              suyas.length > 0 ? Math.round((suyasCerradas / suyas.length) * 100) : 0;

            return (
              <Link
                key={programa.id}
                href={`/auditorias/programas/${programa.id}`}
                className="block"
              >
                <Tarjeta className="p-4 transition-colors hover:border-primario/40">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                        {programa.nombre}
                        <InsigniaEstadoAuditoria estado={programa.estado as EstadoAuditoria} />
                      </p>
                      <p className="mt-0.5 text-[11px] leading-relaxed text-atenuado-contraste">
                        {programa.objetivo ?? "Sin objetivo declarado."}
                      </p>
                      {programa.fecha_aprobacion ? (
                        <p className="mt-1 text-[11px] text-atenuado-contraste">
                          Aprobado el {formatearFecha(programa.fecha_aprobacion)} ·{" "}
                          {suyas.length} auditoría{suyas.length === 1 ? "" : "s"}
                        </p>
                      ) : (
                        <p className="mt-1 text-[11px] text-semaforo-medio">
                          Pendiente de aprobación del Administrador SGC ·{" "}
                          {suyas.length} auditoría{suyas.length === 1 ? "" : "s"}
                        </p>
                      )}
                    </div>
                    <span className="flex items-center gap-2">
                      <span className="text-2xl font-semibold tabular">{suAvance}%</span>
                      <ChevronRight className="size-4 text-atenuado-contraste" />
                    </span>
                  </div>
                  <Progreso value={suAvance} className="mt-3" />
                </Tarjeta>
              </Link>
            );
          })}
        </div>
      ) : null}

      {/* EL AÑO ESTABA EN LA URL PERO NO TENÍA DÓNDE ELEGIRSE: la
          pantalla leía `anio` y siempre mostraba el corriente. Los años
          que se ofrecen salen de lo que hay cargado —programas y
          auditorías—, así no aparece un año vacío ni falta uno con
          registros. */}
      <FiltrosListado
        marcadorBusqueda="Buscar por código, objetivo, alcance o criterios…"
        campos={[
          {
            nombre: "estado",
            etiqueta: "Estado",
            opciones: Object.entries(ETIQUETAS_ESTADO_AUDITORIA).map(([valor, etiqueta]) => ({
              valor,
              etiqueta,
            })),
          },
          {
            nombre: "tipo",
            etiqueta: "Tipo",
            opciones: Object.entries(ETIQUETAS_TIPO_AUDITORIA).map(([valor, etiqueta]) => ({
              valor,
              etiqueta,
            })),
          },
          {
            nombre: "anio",
            etiqueta: "Año",
            opciones: aniosConRegistros.map((valor) => ({
              valor: String(valor),
              etiqueta: String(valor),
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
                <TablaEncabezado className="hidden lg:table-cell">
                  Documentos auditados
                </TablaEncabezado>
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
                    {/* Lo que la auditoría abarca. Desde el 6 de octubre
                        se declara por documento; los procesos quedan como
                        respaldo para las auditorías cargadas antes, que no
                        tienen documentos. `CeldaTexto` recorta a una línea
                        y deja el listado completo al señalar. */}
                    <TablaCelda className="hidden max-w-[16rem] lg:table-cell">
                      <CeldaTexto>
                        {(auditoria.auditoria_documentos ?? [])
                          .map((fila) =>
                            [fila.documentos?.codigo, fila.documentos?.titulo]
                              .filter(Boolean)
                              .join(" "),
                          )
                          .filter(Boolean)
                          .join(" · ") ||
                          (auditoria.auditoria_procesos ?? [])
                            .map((fila) => fila.procesos?.nombre)
                            .filter(Boolean)
                            .join(" · ") ||
                          auditoria.procesos?.nombre ||
                          null}
                      </CeldaTexto>
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste xl:table-cell">
                      {auditoria.auditor?.nombre_completo ?? "—"}
                    </TablaCelda>
                    {/* El total y el aviso van en RENGLONES DISTINTOS. Pegados
                        con un margen, «1» seguido de «1 sin NC» se leia «11 sin
                        NC»: los conteos estaban bien y la pantalla mentia. Lo
                        reporto Calidad leyendo once hallazgos donde habia uno. */}
                    <TablaCelda className="text-center">
                      <span className="block text-xs tabular">{propios.length}</span>
                      {pendientes > 0 ? (
                        <Insignia variante="peligro" className="mt-1">
                          {pendientes === 1 ? "1 sin NC" : `${pendientes} sin NC`}
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
