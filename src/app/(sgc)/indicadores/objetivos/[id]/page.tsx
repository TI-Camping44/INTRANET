import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Pencil, Plus } from "lucide-react";

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
import { EliminarIndicador } from "@/app/(sgc)/indicadores/[id]/eliminar-indicador";
import { EstadoDelObjetivo } from "@/app/(sgc)/indicadores/objetivos/[id]/estado-del-objetivo";
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import { ETIQUETAS_FRECUENCIA, ETIQUETAS_SENTIDO } from "@/lib/constantes";
import { formatearMes, formatearNumero } from "@/lib/formato";
import type { FrecuenciaMedicion as FrecuenciaIndicador, SentidoIndicador } from "@/lib/tipos";
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

  const [
    { data: datosEmpresas },
    { data: planes },
    { data: personas },
    { data: indicadoresDatos },
  ] = await Promise.all([
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
    // LOS INDICADORES DEL OBJETIVO. Se cargan acá, en su ficha: el
    // objetivo dice qué se quiere lograr y el indicador con qué se mide.
    supabase
      .from("indicadores")
      .select("id, codigo, nombre, unidad, frecuencia, sentido, meta, meta_minima, meta_maxima")
      .eq("objetivo_id", params.id)
      .order("codigo"),
  ]);

  const indicadores =
    (indicadoresDatos as
      | {
          id: string;
          codigo: string;
          nombre: string;
          unidad: string | null;
          frecuencia: FrecuenciaIndicador;
          sentido: SentidoIndicador;
          meta: number | null;
          meta_minima: number | null;
          meta_maxima: number | null;
        }[]
      | null) ?? [];

  // La última medición de cada uno y cuántas tiene. La cuenta es lo que
  // el aviso de eliminar necesita para decir qué se lleva por delante.
  const { data: medicionesDatos } = indicadores.length
    ? await supabase
        .from("indicador_mediciones")
        .select("indicador_id, periodo, valor_real")
        .in(
          "indicador_id",
          indicadores.map((indicador) => indicador.id),
        )
        .order("periodo", { ascending: false })
    : { data: [] };

  const mediciones =
    (medicionesDatos as { indicador_id: string; periodo: string; valor_real: number }[] | null) ??
    [];

  const ultima = new Map<string, { periodo: string; valor_real: number }>();
  const cuantas = new Map<string, number>();
  for (const fila of mediciones) {
    if (!ultima.has(fila.indicador_id)) ultima.set(fila.indicador_id, fila);
    cuantas.set(fila.indicador_id, (cuantas.get(fila.indicador_id) ?? 0) + 1);
  }

  const empresa = ((datosEmpresas as { id: string; nombre: string }[] | null) ?? []).find(
    (candidata) => candidata.id === objetivo.empresa_objetivo_id,
  )?.nombre;

  const lista = (planes as any[] | null) ?? [];
  const gestiona = puedeGestionar(usuario);

  return (
    <div className="mx-auto max-w-6xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/indicadores">
          <ArrowLeft /> Volver al listado
        </Link>
      </Boton>

      <EncabezadoPagina titulo={objetivo.nombre} />

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
                        {` · ${ETIQUETAS_ESTADO_PLAN[plan.estado as EstadoPlan] ?? plan.estado}`}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </TarjetaContenido>
          </Tarjeta>

          {/* LOS INDICADORES DEL OBJETIVO. Van acá y no en una pantalla
              aparte: tenerlos sueltos obligaba a acordarse de vincular
              cada indicador con su objetivo después de darlo de alta, y
              el que no se vinculaba no medía nada. */}
          <Tarjeta>
            <TarjetaCabecera className="flex-row items-center justify-between">
              <TarjetaTitulo>
                Indicadores{" "}
                <span className="font-normal text-atenuado-contraste">
                  ({indicadores.length})
                </span>
              </TarjetaTitulo>
              {gestiona ? (
                <Boton tamano="pequeno" variante="contorno" comoHijo>
                  <Link href={`/indicadores/nuevo?objetivo=${objetivo.id}`}>
                    <Plus /> Nuevo indicador
                  </Link>
                </Boton>
              ) : null}
            </TarjetaCabecera>
            <TarjetaContenido>
              {indicadores.length === 0 ? (
                <p className="text-xs leading-relaxed text-atenuado-contraste">
                  Todavía no hay indicadores. Cargue con qué se va a medir este objetivo: cada
                  indicador lleva su meta, su frecuencia y sus mediciones.
                </p>
              ) : (
                <Tabla>
                  <TablaCabecera>
                    <TablaFila>
                      <TablaEncabezado className="w-[6rem]">Código</TablaEncabezado>
                      <TablaEncabezado>Indicador</TablaEncabezado>
                      <TablaEncabezado className="hidden w-[7rem] sm:table-cell">
                        Frecuencia
                      </TablaEncabezado>
                      <TablaEncabezado className="w-[7rem] text-right">Meta</TablaEncabezado>
                      <TablaEncabezado className="w-[8rem] text-right">
                        Último real
                      </TablaEncabezado>
                      <TablaEncabezado className="w-[13rem] text-right" />
                    </TablaFila>
                  </TablaCabecera>
                  <TablaCuerpo>
                    {indicadores.map((indicador) => {
                      const dato = ultima.get(indicador.id);
                      const metaTexto =
                        indicador.sentido === "rango"
                          ? `${formatearNumero(indicador.meta_minima, 0)} a ${formatearNumero(indicador.meta_maxima, 0)}`
                          : formatearNumero(indicador.meta, 0);

                      return (
                        <TablaFila key={indicador.id}>
                          <TablaCelda className="font-medium tabular">
                            <Link
                              href={`/indicadores/${indicador.id}`}
                              className="hover:text-primario"
                            >
                              {indicador.codigo}
                            </Link>
                          </TablaCelda>
                          <TablaCelda>
                            <Link
                              href={`/indicadores/${indicador.id}`}
                              className="hover:text-primario"
                            >
                              <p className="text-xs font-medium">{indicador.nombre}</p>
                              <p className="text-[11px] text-atenuado-contraste">
                                {ETIQUETAS_SENTIDO[indicador.sentido]}
                              </p>
                            </Link>
                          </TablaCelda>
                          <TablaCelda className="hidden text-xs text-atenuado-contraste sm:table-cell">
                            {ETIQUETAS_FRECUENCIA[indicador.frecuencia]}
                          </TablaCelda>
                          <TablaCelda className="text-right text-xs tabular">
                            {metaTexto} {indicador.unidad}
                          </TablaCelda>
                          <TablaCelda className="text-right text-xs tabular">
                            {dato ? (
                              <>
                                <span className="font-medium">
                                  {formatearNumero(dato.valor_real)} {indicador.unidad}
                                </span>
                                <span className="block text-[11px] text-atenuado-contraste">
                                  {formatearMes(dato.periodo)}
                                </span>
                              </>
                            ) : (
                              <span className="text-atenuado-contraste">Sin mediciones</span>
                            )}
                          </TablaCelda>
                          <TablaCelda className="text-right">
                            {gestiona ? (
                              <div className="flex justify-end gap-1.5">
                                <Boton tamano="pequeno" variante="contorno" comoHijo>
                                  <Link
                                    href={`/indicadores/${indicador.id}/editar?volver=objetivo`}
                                  >
                                    <Pencil /> Editar
                                  </Link>
                                </Boton>
                                {usuario.rol === "administrador_sgc" ? (
                                  <EliminarIndicador
                                    indicadorId={indicador.id}
                                    codigo={indicador.codigo}
                                    mediciones={cuantas.get(indicador.id) ?? 0}
                                    objetivos={1}
                                    volverA={`/indicadores/objetivos/${objetivo.id}`}
                                  />
                                ) : null}
                              </div>
                            ) : null}
                          </TablaCelda>
                        </TablaFila>
                      );
                    })}
                  </TablaCuerpo>
                </Tabla>
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
