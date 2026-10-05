import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ListChecks, Plus } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import { CeldaTexto } from "@/components/comunes/celda-texto";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { describirVencimiento, formatearFecha, hoyEnAsuncion } from "@/lib/formato";
import {
  CLASES_ESTADO_PLAN,
  ETIQUETAS_ESTADO_PLAN,
  type EstadoPlan,
} from "@/lib/objetivos";
import { cn } from "@/lib/utilidades";
import { AccionesDelPlan } from "@/app/(sgc)/indicadores/plan/acciones-del-plan";

export const metadata: Metadata = { title: "Plan de objetivos" };
export const dynamic = "force-dynamic";

export interface FilaPlan {
  id: string;
  objetivo_id: string | null;
  objetivo_declarado: string | null;
  que_se_va_a_hacer: string;
  recursos_necesarios: string | null;
  responsable_declarado: string | null;
  fecha_finalizacion: string | null;
  como_se_evaluan_resultados: string | null;
  fecha_real_finalizacion: string | null;
  resultado_evaluacion: string | null;
  responsable_id: string | null;
  avance_porcentaje: number;
  estado: EstadoPlan;
  observaciones: string | null;
  objetivos: { codigo: string; nombre: string } | null;
  responsable: { nombre_completo: string } | null;
}

/**
 * El plan de acción para el logro de los objetivos, hoja 6.2.2.
 *
 * Son los cinco incisos del apartado 6.2.2 de la norma, con su letra:
 * a) qué se va a hacer, b) qué recursos, c) quién es responsable,
 * d) cuándo se finaliza y e) cómo se evalúan los resultados. La hoja los
 * rotula así y acá se mantienen las letras, porque es como los busca un
 * auditor.
 *
 * VA APARTE DE LA HOJA DE OBJETIVOS y no como una pestaña: son dos
 * formularios distintos de Calidad —F-EST-01-05 y F-EST-01-06— y el plan
 * tiene una fila por acción, no por indicador. Una sola tabla con las dos
 * cosas tendría la mitad de las columnas vacías en cada fila.
 *
 * El N.º no se guarda: es el orden de la fila, como en la planilla.
 */
export default async function PaginaPlanDeObjetivos() {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();
  const gestiona = puedeGestionar(usuario);
  const hoy = hoyEnAsuncion();

  const [{ data: datos }, { data: objetivos }, { data: personas }] = await Promise.all([
    supabase
      .from("objetivo_planes")
      .select(
        "*, objetivos:objetivo_id (codigo, nombre), " +
          "responsable:responsable_id (nombre_completo)",
      )
      // Por fecha de finalización: lo que vence primero va arriba, que es
      // el orden en que hay que ocuparse. Las filas sin fecha al final.
      .order("fecha_finalizacion", { nullsFirst: false })
      .order("creado_en"),
    supabase.from("objetivos").select("id, codigo, nombre").order("codigo"),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
  ]);

  const planes = (datos as FilaPlan[] | null) ?? [];

  return (
    <>
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/indicadores">
          <ArrowLeft /> Volver a Objetivos e Indicadores
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo="Plan de Objetivos"
        descripcion="F-EST-01-06. Los cinco incisos del apartado 6.2.2: qué se va a hacer, con qué recursos, quién es responsable, cuándo se finaliza y cómo se evalúan los resultados."
        acciones={
          gestiona ? (
            <AccionesDelPlan
              objetivos={(objetivos as { id: string; codigo: string; nombre: string }[]) ?? []}
              personas={(personas as { id: string; nombre_completo: string }[]) ?? []}
            />
          ) : null
        }
      />

      {planes.length === 0 ? (
        <EstadoVacio
          icono={<ListChecks className="size-6" />}
          titulo="El plan está vacío"
          descripcion="Un objetivo sin plan es una intención. Cargue qué se va a hacer para alcanzarlo, con responsable y plazo."
          accion={
            gestiona ? (
              <AccionesDelPlan
                objetivos={(objetivos as { id: string; codigo: string; nombre: string }[]) ?? []}
                personas={(personas as { id: string; nombre_completo: string }[]) ?? []}
                soloAlta
              />
            ) : null
          }
        />
      ) : (
        <Tarjeta>
          {/* Las columnas de la hoja 6.2.2, en su orden. El N.º es el de
              la fila: no se guarda, como pidió Calidad. */}
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado className="sticky left-0 z-10 w-10 bg-fondo text-right">
                  Nº
                </TablaEncabezado>
                <TablaEncabezado className="w-[11rem]">Objetivo relacionado</TablaEncabezado>
                <TablaEncabezado className="w-[20rem]">a) Qué se va a hacer</TablaEncabezado>
                <TablaEncabezado className="w-[14rem]">
                  b) Qué recursos se requerirán
                </TablaEncabezado>
                <TablaEncabezado className="w-[13rem]">c) Quién será responsable</TablaEncabezado>
                <TablaEncabezado className="w-[7rem]">d) Cuándo se finalizará</TablaEncabezado>
                <TablaEncabezado className="w-[16rem]">
                  e) Cómo se evaluarán los resultados
                </TablaEncabezado>
                <TablaEncabezado className="w-[7rem]">Fecha real</TablaEncabezado>
                <TablaEncabezado className="w-[14rem]">
                  Resultado de la evaluación
                </TablaEncabezado>
                <TablaEncabezado className="w-[5rem] text-right">% Avance</TablaEncabezado>
                <TablaEncabezado className="w-[8rem]">Estado</TablaEncabezado>
                <TablaEncabezado className="w-[12rem]">Observaciones</TablaEncabezado>
                {gestiona ? <TablaEncabezado className="w-[4rem]" /> : null}
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {planes.map((plan, indice) => {
                const vencido =
                  plan.fecha_real_finalizacion === null &&
                  plan.fecha_finalizacion !== null &&
                  plan.fecha_finalizacion < hoy &&
                  plan.estado !== "cancelado";

                return (
                  <TablaFila key={plan.id}>
                    <TablaCelda className="sticky left-0 z-10 bg-fondo text-right text-xs tabular text-atenuado-contraste">
                      {indice + 1}
                    </TablaCelda>

                    {/* «Todos» es una fila real de la planilla: aplica a
                        los ocho objetivos a la vez, y eso una clave ajena
                        no lo puede decir. */}
                    <TablaCelda className="text-xs">
                      {plan.objetivos ? (
                        <span>
                          <span className="font-medium tabular">{plan.objetivos.codigo}</span>
                          <span className="block text-[11px] text-atenuado-contraste">
                            {plan.objetivos.nombre}
                          </span>
                        </span>
                      ) : (
                        <span className="text-atenuado-contraste">
                          {plan.objetivo_declarado ?? "Sin objetivo"}
                        </span>
                      )}
                    </TablaCelda>

                    <CeldaTexto ancho="20rem">{plan.que_se_va_a_hacer}</CeldaTexto>
                    <CeldaTexto ancho="14rem">{plan.recursos_necesarios}</CeldaTexto>
                    <CeldaTexto ancho="13rem">
                      {plan.responsable_declarado ?? plan.responsable?.nombre_completo}
                    </CeldaTexto>

                    <TablaCelda className="text-xs tabular">
                      {plan.fecha_finalizacion ? (
                        <span className={vencido ? "font-medium text-semaforo-critico" : ""}>
                          {formatearFecha(plan.fecha_finalizacion)}
                          {vencido ? (
                            <span className="block text-[10px]">
                              {describirVencimiento(plan.fecha_finalizacion)}
                            </span>
                          ) : null}
                        </span>
                      ) : (
                        <span className="text-atenuado-contraste">—</span>
                      )}
                    </TablaCelda>

                    <CeldaTexto ancho="16rem">{plan.como_se_evaluan_resultados}</CeldaTexto>

                    <TablaCelda className="text-xs tabular text-atenuado-contraste">
                      {plan.fecha_real_finalizacion
                        ? formatearFecha(plan.fecha_real_finalizacion)
                        : "—"}
                    </TablaCelda>

                    <CeldaTexto ancho="14rem">{plan.resultado_evaluacion}</CeldaTexto>

                    <TablaCelda className="text-right text-xs font-medium tabular">
                      {Number(plan.avance_porcentaje)} %
                    </TablaCelda>

                    <TablaCelda>
                      <span
                        className={cn(
                          "inline-flex whitespace-nowrap rounded border px-1.5 py-0.5 text-[10px] font-medium",
                          CLASES_ESTADO_PLAN[plan.estado],
                        )}
                      >
                        {ETIQUETAS_ESTADO_PLAN[plan.estado]}
                      </span>
                    </TablaCelda>

                    <CeldaTexto ancho="12rem">{plan.observaciones}</CeldaTexto>

                    {gestiona ? (
                      <TablaCelda>
                        <AccionesDelPlan
                          objetivos={
                            (objetivos as { id: string; codigo: string; nombre: string }[]) ?? []
                          }
                          personas={(personas as { id: string; nombre_completo: string }[]) ?? []}
                          plan={plan}
                        />
                      </TablaCelda>
                    ) : null}
                  </TablaFila>
                );
              })}
            </TablaCuerpo>
          </Tabla>
        </Tarjeta>
      )}

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {planes.length} acción{planes.length === 1 ? "" : "es"} en el plan. El N.º es el orden de
        la fila, como en la planilla: no se escribe.
      </p>
    </>
  );
}
