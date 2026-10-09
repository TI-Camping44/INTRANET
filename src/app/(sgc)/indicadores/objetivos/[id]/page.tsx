import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil } from "lucide-react";

import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { HistorialBitacora } from "@/components/comunes/historial-bitacora";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { AccionesDelPlan } from "@/app/(sgc)/indicadores/plan/acciones-del-plan";
import { EliminarObjetivo } from "@/app/(sgc)/indicadores/objetivos/[id]/eliminar-objetivo";
import { EstadoDelObjetivo } from "@/app/(sgc)/indicadores/objetivos/[id]/estado-del-objetivo";
import {
  SeguimientoDeLaAccion,
  type EvidenciaDeLaAccion,
} from "@/app/(sgc)/indicadores/objetivos/[id]/seguimiento-de-la-accion";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha } from "@/lib/formato";
import {
  ETIQUETAS_ESTADO_OBJETIVO,
  ETIQUETAS_ESTADO_PLAN,
  ETIQUETAS_FRECUENCIA_MEDICION,
  ETIQUETAS_TIPO_RESULTADO,
  resultadoEsperado,
  type EstadoObjetivo,
  type EstadoPlan,
  type FrecuenciaMedicion,
  type TipoResultadoObjetivo,
} from "@/lib/objetivos";

export const metadata: Metadata = { title: "Objetivo de la calidad" };
export const dynamic = "force-dynamic";

/**
 * La ficha del objetivo: el resumen de lo declarado, su estado y su plan.
 *
 * SE ABRE SOLA AL CREARLO. Es el paso siguiente natural: el alta declara
 * qué se mide, y acá se carga qué se va a hacer para lograrlo y se mueve
 * el estado a medida que avanza.
 *
 * EL PLAN ES `objetivo_planes`, la tabla que ya existía para la hoja
 * 6.2.2 del F-EST-01-06. No se creó una tabla nueva: lo que el objetivo
 * necesita —acción, responsable y plazo— ya estaba ahí.
 */
export default async function PaginaObjetivo({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: consulta } = await supabase
    .from("objetivos")
    .select("*, responsable:responsable_id (nombre_completo)")
    .eq("id", params.id)
    .maybeSingle();

  const objetivo = consulta as unknown as
    | {
        id: string;
        codigo: string;
        nombre: string;
        estado: EstadoObjetivo;
        empresa_objetivo_id: string | null;
        fecha_inicio_medicion: string | null;
        fecha_fin_medicion: string | null;
        tipo_resultado: TipoResultadoObjetivo | null;
        resultado_esperado_si_no: boolean | null;
        resultado_esperado_texto: string | null;
        valor_minimo: number | null;
        valor_maximo: number | null;
        unidad_valor: string | null;
        frecuencia_medicion: FrecuenciaMedicion | null;
        fuente_datos: string | null;
        recursos_requeridos: string | null;
        proveedor_recursos: string | null;
        objetivo_alcanzado: boolean | null;
        comentario_cierre: string | null;
        responsable: { nombre_completo: string } | null;
      }
    | null;

  if (!objetivo) notFound();

  const [{ data: datosEmpresas }, { data: planes }, { data: personas }] = await Promise.all([
    supabase.rpc("empresas_del_grupo"),
    supabase
      .from("objetivo_planes")
      .select("*, responsable:responsable_id (nombre_completo)")
      .eq("objetivo_id", params.id)
      .order("fecha_finalizacion", { nullsFirst: false }),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
  ]);

  const empresa = ((datosEmpresas as { id: string; nombre: string }[] | null) ?? []).find(
    (candidata) => candidata.id === objetivo.empresa_objetivo_id,
  )?.nombre;

  const lista = (planes as any[] | null) ?? [];
  const gestiona = puedeGestionar(usuario);

  // QUÉ SE LLEVA UN BORRADO. Se cuenta acá para que el aviso lo diga con
  // números: «se borran 12 mediciones» frena a quien «¿Está seguro?» no
  // frena. Son dos `head: true`, así que no traen filas.
  const [{ count: medicionesCargadas }, { count: indicadoresColgando }] = await Promise.all([
    supabase
      .from("objetivo_mediciones")
      .select("id", { count: "exact", head: true })
      .eq("objetivo_id", params.id),
    supabase
      .from("indicadores")
      .select("id", { count: "exact", head: true })
      .eq("objetivo_id", params.id),
  ]);

  // LA EVIDENCIA DE CADA ACCIÓN. Una sola consulta para todas, acotada a
  // las de este objetivo, y se reparte por `entidad_id`. Va después y no
  // en el lote de arriba porque necesita los ids que ese lote trae.
  const { data: archivos } = lista.length
    ? await supabase
        .from("adjuntos")
        .select("id, entidad_id, nombre_archivo, tamano_bytes, descripcion")
        .eq("entidad", "objetivo_planes")
        .in(
          "entidad_id",
          lista.map((plan) => plan.id as string),
        )
        .order("creado_en")
    : { data: null };

  const evidenciaPorAccion = new Map<string, EvidenciaDeLaAccion[]>();
  for (const adjunto of (archivos as (EvidenciaDeLaAccion & { entidad_id: string })[] | null) ??
    []) {
    const suyas = evidenciaPorAccion.get(adjunto.entidad_id) ?? [];
    suyas.push(adjunto);
    evidenciaPorAccion.set(adjunto.entidad_id, suyas);
  }

  return (
    <div className="mx-auto max-w-6xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/indicadores">
          <ArrowLeft /> Volver al listado
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={objetivo.nombre}
        acciones={
          gestiona ? (
            <>
              <Boton variante="contorno" tamano="pequeno" comoHijo>
                <Link href={`/indicadores/objetivos/${params.id}/editar`}>
                  <Pencil /> Editar
                </Link>
              </Boton>
              <EliminarObjetivo
                objetivoId={params.id}
                codigo={objetivo.codigo}
                acciones={lista.length}
                mediciones={medicionesCargadas ?? 0}
                indicadores={indicadoresColgando ?? 0}
              />
            </>
          ) : null
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Insignia variante="primaria" className="tabular text-xs">
          {objetivo.codigo}
        </Insignia>
        <Insignia variante="contorno">{ETIQUETAS_ESTADO_OBJETIVO[objetivo.estado]}</Insignia>
        {empresa ? <Insignia variante="contorno">{empresa}</Insignia> : null}
        {objetivo.estado === "cerrado" && objetivo.objetivo_alcanzado !== null ? (
          <Insignia variante={objetivo.objetivo_alcanzado ? "exito" : "peligro"}>
            {objetivo.objetivo_alcanzado ? "Alcanzado" : "No alcanzado"}
          </Insignia>
        ) : null}
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Resumen</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <dl className="grid gap-2.5 text-xs sm:grid-cols-2">
                <Dato
                  etiqueta="Período de medición"
                  valor={
                    objetivo.fecha_inicio_medicion && objetivo.fecha_fin_medicion
                      ? `${formatearFecha(objetivo.fecha_inicio_medicion)} al ${formatearFecha(objetivo.fecha_fin_medicion)}`
                      : "—"
                  }
                />
                <Dato
                  etiqueta="Frecuencia"
                  valor={
                    objetivo.frecuencia_medicion
                      ? ETIQUETAS_FRECUENCIA_MEDICION[objetivo.frecuencia_medicion]
                      : "—"
                  }
                />
                <Dato
                  etiqueta="Tipo de objetivo"
                  valor={
                    objetivo.tipo_resultado
                      ? ETIQUETAS_TIPO_RESULTADO[objetivo.tipo_resultado]
                      : "—"
                  }
                />
                <Dato etiqueta="Resultado esperado" valor={resultadoEsperado(objetivo)} />
                <Dato
                  etiqueta="Responsable"
                  valor={objetivo.responsable?.nombre_completo ?? "—"}
                />
                <Dato etiqueta="Provee los recursos" valor={objetivo.proveedor_recursos ?? "—"} />
                <Bloque titulo="Fuente de datos" texto={objetivo.fuente_datos} />
                <Bloque titulo="Recursos requeridos" texto={objetivo.recursos_requeridos} />
                {objetivo.estado === "cerrado" ? (
                  <Bloque titulo="Comentarios del cierre" texto={objetivo.comentario_cierre} />
                ) : null}
              </dl>
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera className="flex-row items-center justify-between">
              <TarjetaTitulo>Acciones</TarjetaTitulo>
              {gestiona ? (
                <AccionesDelPlan
                  objetivos={[
                    { id: objetivo.id, codigo: objetivo.codigo, nombre: objetivo.nombre },
                  ]}
                  personas={(personas as { id: string; nombre_completo: string }[] | null) ?? []}
                  soloAlta
                />
              ) : null}
            </TarjetaCabecera>
            <TarjetaContenido>
              {lista.length === 0 ? (
                <p className="text-xs leading-relaxed text-atenuado-contraste">
                  Todavía no hay acciones. Cargue qué se va a hacer para alcanzar el objetivo,
                  con su responsable y su plazo.
                </p>
              ) : (
                <ul className="divide-y divide-borde">
                  {lista.map((plan) => (
                    <li key={plan.id} className="py-2.5 first:pt-0 last:pb-0">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <p className="min-w-0 flex-1 text-xs">{plan.que_se_va_a_hacer}</p>
                        {gestiona ? (
                          <AccionesDelPlan
                            objetivos={[
                              { id: objetivo.id, codigo: objetivo.codigo, nombre: objetivo.nombre },
                            ]}
                            personas={
                              (personas as { id: string; nombre_completo: string }[] | null) ?? []
                            }
                            plan={plan}
                          />
                        ) : null}
                      </div>
                      <p className="mt-1 text-[11px] text-atenuado-contraste">
                        {plan.responsable?.nombre_completo ??
                          plan.responsable_declarado ??
                          "Sin responsable"}
                        {plan.fecha_finalizacion
                          ? ` · Plazo ${formatearFecha(plan.fecha_finalizacion)}`
                          : ""}
                      </p>

                      {/* El seguimiento, como en una acción correctiva:
                          evidencia, estado y, al final, la eficacia. */}
                      <SeguimientoDeLaAccion
                        accionId={plan.id}
                        estado={(plan.estado as EstadoPlan) ?? "pendiente"}
                        fechaRealFinalizacion={plan.fecha_real_finalizacion ?? null}
                        eficacia={plan.eficacia ?? null}
                        fechaEvaluacionEficacia={plan.fecha_evaluacion_eficacia ?? null}
                        observacionEficacia={plan.observacion_eficacia ?? null}
                        evidencias={evidenciaPorAccion.get(plan.id) ?? []}
                        puedeGestionar={gestiona}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </TarjetaContenido>
          </Tarjeta>

        </div>

        <div className="space-y-4">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Estado</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <EstadoDelObjetivo
                objetivoId={objetivo.id}
                estado={objetivo.estado}
                alcanzado={objetivo.objetivo_alcanzado}
                comentario={objetivo.comentario_cierre}
                puedeGestionar={gestiona}
              />
            </TarjetaContenido>
          </Tarjeta>

          <HistorialBitacora tablas={["objetivos"]} registroId={objetivo.id} />
        </div>
      </div>
    </div>
  );
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div>
      <dt className="text-[11px] text-atenuado-contraste">{etiqueta}</dt>
      <dd className="font-medium">{valor}</dd>
    </div>
  );
}

function Bloque({ titulo, texto }: { titulo: string; texto: string | null }) {
  return (
    <div className="sm:col-span-2">
      <dt className="text-[11px] text-atenuado-contraste">{titulo}</dt>
      <dd className="whitespace-pre-line leading-relaxed">{texto?.trim() || "—"}</dd>
    </div>
  );
}
