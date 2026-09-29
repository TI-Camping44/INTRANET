import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";

import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { PanelCaso, type AccionDelPlan } from "@/app/(sgc)/reclamos/[id]/panel-caso";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha, formatearGuaranies } from "@/lib/formato";
import { DEPARTAMENTOS } from "@/lib/constantes";
import type { Departamento } from "@/lib/tipos";
import {
  CLASES_ESTADO_RECLAMO,
  DIAS_VERIFICACION_PLAN_C,
  ETIQUETAS_ESTADO_CLIENTE_RECLAMO,
  ETIQUETAS_ESTADO_RECLAMO,
  ETIQUETAS_GRAVEDAD_RECLAMO,
  ETIQUETAS_ORIGEN_RECLAMO,
  ETIQUETAS_PLAN_RECLAMO,
  ETIQUETAS_TIPO_FALLA,
  excedeTopePorcentual,
  exigeNoConformidad,
  RESPONSABLE_POR_TIPO_FALLA,
  tramoDeAutorizacion,
  vencido,
  type EstadoClienteReclamo,
  type EstadoReclamo,
  type GravedadReclamo,
  type OrigenReclamo,
  type PlanReclamo,
  type TipoFallaReclamo,
} from "@/lib/reclamos";

export const dynamic = "force-dynamic";

interface Reclamo {
  id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  cliente_nombre: string;
  origen: OrigenReclamo;
  tipo_falla: TipoFallaReclamo;
  departamentos_intervinientes: string[];
  gravedad: GravedadReclamo;
  plan: PlanReclamo;
  estado: EstadoReclamo;
  estado_cliente: EstadoClienteReclamo;
  es_reincidencia: boolean;
  rechazos: number;
  material_controlado: boolean;
  tramite_digemabel: boolean;
  suspendido_desde: string | null;
  notificado_gerencia: boolean;
  fecha_deteccion: string;
  fecha_limite_contacto: string;
  fecha_contacto: string | null;
  fecha_limite_plan: string;
  fecha_definicion_plan: string | null;
  fecha_limite_resolucion: string;
  fecha_resolucion: string | null;
  fecha_cierre: string | null;
  fecha_verificacion: string | null;
  verificacion_observacion: string | null;
  compensacion_detalle: string | null;
  compensacion_monto: number | null;
  monto_factura: number | null;
  conformidad_firmada: boolean;
  motivo_no_conciliado: string | null;
  cliente: { id: string; razon_social: string } | null;
  gestor: { nombre_completo: string } | null;
  responsable_area: { nombre_completo: string } | null;
  autorizante: { nombre_completo: string } | null;
  no_conformidad: { id: string; codigo: string; estado: string } | null;
}

const CAMPOS =
  "id, codigo, titulo, descripcion, cliente_nombre, origen, tipo_falla, " +
  "departamentos_intervinientes, gravedad, plan, estado, estado_cliente, es_reincidencia, " +
  "rechazos, material_controlado, tramite_digemabel, suspendido_desde, notificado_gerencia, " +
  "fecha_deteccion, fecha_limite_contacto, fecha_contacto, fecha_limite_plan, " +
  "fecha_definicion_plan, fecha_limite_resolucion, fecha_resolucion, fecha_cierre, " +
  "fecha_verificacion, verificacion_observacion, compensacion_detalle, compensacion_monto, " +
  "monto_factura, conformidad_firmada, motivo_no_conciliado, " +
  "cliente:cliente_id (id, razon_social), gestor:gestor_id (nombre_completo), " +
  "responsable_area:responsable_area_id (nombre_completo), " +
  "autorizante:autorizado_por (nombre_completo), " +
  "no_conformidad:no_conformidad_id (id, codigo, estado)";

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("reclamos")
    .select("codigo, titulo")
    .eq("id", params.id)
    .maybeSingle();

  const reclamo = data as { codigo: string; titulo: string } | null;
  return { title: reclamo ? `${reclamo.codigo} · ${reclamo.titulo}` : "Reclamo" };
}

/**
 * El nombre del departamento.
 *
 * La columna es `text[]` y no un enumerado: si Calidad renombra un
 * departamento, los casos viejos conservan el valor con el que se
 * cargaron y la ficha lo muestra tal cual en vez de quedar en blanco.
 */
function etiquetaDeDepartamento(valor: string): string {
  return DEPARTAMENTOS[valor as Departamento] ?? valor;
}

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

/**
 * Una fila de la línea de plazos: qué había que hacer, para cuándo y si se hizo.
 *
 * ES EL CORAZÓN DE LA FICHA. El procedimiento no se incumple por no
 * resolver: se incumple por dejar pasar el plazo sin que nadie lo vea. Un
 * paso vencido y sin hacer se muestra en rojo con los días de atraso; uno
 * hecho después del plazo queda marcado igual, porque para el indicador
 * cuenta como fuera de plazo.
 */
function Plazo({
  etiqueta,
  limite,
  hecho,
  suspendido,
}: {
  etiqueta: string;
  limite: string | null;
  hecho: string | null;
  suspendido?: boolean;
}) {
  const atrasado = limite !== null && !suspendido && vencido(limite, hecho);
  const tarde = limite !== null && hecho !== null && hecho > limite;

  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="text-atenuado-contraste">{etiqueta}</span>
      <span className="text-right">
        {hecho ? (
          <span className={tarde ? "font-medium text-semaforo-alto" : "font-medium"}>
            {formatearFecha(hecho)}
            {tarde ? " · fuera de plazo" : null}
          </span>
        ) : limite === null ? (
          <span className="text-atenuado-contraste">—</span>
        ) : suspendido ? (
          <span className="text-semaforo-medio">suspendido</span>
        ) : (
          <span className={atrasado ? "font-medium text-semaforo-critico" : ""}>
            vence el {formatearFecha(limite)}
          </span>
        )}
      </span>
    </div>
  );
}

export default async function PaginaReclamo({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const [{ data }, { data: filasAcciones }, { data: personas }] = await Promise.all([
    supabase.from("reclamos").select(CAMPOS).eq("id", params.id).maybeSingle(),
    supabase
      .from("reclamo_acciones")
      .select("id, descripcion, responsable_id, fecha_limite, ejecutada_en")
      .eq("reclamo_id", params.id)
      .order("creado_en"),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
  ]);

  const reclamo = data as unknown as Reclamo | null;
  if (!reclamo) notFound();

  const acciones = (filasAcciones as AccionDelPlan[] | null) ?? [];
  const gestionable = puedeGestionar(usuario);

  const monto = reclamo.compensacion_monto ?? 0;
  const tramo = monto > 0 ? tramoDeAutorizacion(monto) : null;
  const excede = monto > 0 ? excedeTopePorcentual(monto, reclamo.monto_factura) : null;

  return (
    <div className="mx-auto max-w-5xl">
      <EncabezadoPagina
        titulo={`${reclamo.codigo} · ${reclamo.titulo}`}
        descripcion={`${ETIQUETAS_PLAN_RECLAMO[reclamo.plan]} · ${reclamo.cliente_nombre}`}
        acciones={
          <div className="flex items-center gap-2">
            <Insignia variante="contorno">
              <span className={CLASES_ESTADO_RECLAMO[reclamo.estado]}>
                {ETIQUETAS_ESTADO_RECLAMO[reclamo.estado]}
              </span>
            </Insignia>
            {gestionable ? (
              <Boton variante="contorno" tamano="pequeno" comoHijo>
                <Link href={`/reclamos/${reclamo.id}/editar`}>
                  <Pencil /> Editar
                </Link>
              </Boton>
            ) : null}
          </div>
        }
      />

      {reclamo.material_controlado ? (
        <p className="mb-3 rounded-md border border-semaforo-alto/40 bg-semaforo-alto/5 p-2.5 text-xs leading-relaxed text-semaforo-alto">
          El caso involucra material controlado. La Gerencia General tiene que estar notificada
          dentro de las 24 horas
          {reclamo.notificado_gerencia ? " · ya se notificó" : " · TODAVÍA NO SE NOTIFICÓ"}. Toda
          reposición o cambio se hace con las formalidades de la Ley N° 7411/2024.
        </p>
      ) : null}

      {reclamo.tramite_digemabel && reclamo.suspendido_desde ? (
        <p className="mb-3 rounded-md border border-semaforo-medio/40 bg-semaforo-medio/5 p-2.5 text-xs leading-relaxed text-semaforo-medio">
          Plazo suspendido desde el {formatearFecha(reclamo.suspendido_desde)} por trámite ante la
          DIGEMABEL. Hay que informárselo al cliente por escrito.
        </p>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-4">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Qué pasó</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido className="space-y-3">
              <Bloque titulo="Descripción del reclamo" texto={reclamo.descripcion} />
              <div className="grid gap-3 sm:grid-cols-2">
                <Bloque
                  titulo="Cómo nos enteramos"
                  texto={ETIQUETAS_ORIGEN_RECLAMO[reclamo.origen]}
                />
                <Bloque titulo="Gravedad" texto={ETIQUETAS_GRAVEDAD_RECLAMO[reclamo.gravedad]} />
              </div>
              <Bloque
                titulo="Tipo de falla"
                texto={`${ETIQUETAS_TIPO_FALLA[reclamo.tipo_falla]} · responde: ${
                  RESPONSABLE_POR_TIPO_FALLA[reclamo.tipo_falla]
                }`}
              />
              {reclamo.departamentos_intervinientes.length > 0 ? (
                <Bloque
                  titulo="Otros departamentos intervinientes"
                  texto={reclamo.departamentos_intervinientes
                    .map((valor) => etiquetaDeDepartamento(valor))
                    .join(" · ")}
                />
              ) : null}
              {reclamo.es_reincidencia ? (
                <p className="text-xs leading-relaxed text-semaforo-alto">
                  Es la segunda falla al mismo cliente en seis meses: por eso el plan subió un
                  nivel y con él los plazos.
                </p>
              ) : null}
              {reclamo.rechazos > 0 ? (
                <p className="text-xs leading-relaxed text-semaforo-alto">
                  El cliente rechazó {reclamo.rechazos === 1 ? "una propuesta" : `${reclamo.rechazos} propuestas`}.
                </p>
              ) : null}
            </TarjetaContenido>
          </Tarjeta>

          {reclamo.compensacion_detalle || monto > 0 ? (
            <Tarjeta>
              <TarjetaCabecera>
                <TarjetaTitulo>Compensación</TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido className="space-y-3">
                <Bloque titulo="Qué se acordó" texto={reclamo.compensacion_detalle} />
                {monto > 0 ? (
                  <>
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Bloque titulo="Monto" texto={formatearGuaranies(monto)} />
                      <Bloque
                        titulo="Factura afectada"
                        texto={
                          reclamo.monto_factura ? formatearGuaranies(reclamo.monto_factura) : "—"
                        }
                      />
                      <Bloque
                        titulo="Autorizó"
                        texto={reclamo.autorizante?.nombre_completo ?? "—"}
                      />
                    </div>
                    <p className="text-xs leading-relaxed text-atenuado-contraste">
                      Por el monto le corresponde a: {tramo?.autoriza}
                      {tramo?.requiereCofirma
                        ? ", con co-firma del Gerente de Administración y Finanzas o del Gerente General"
                        : null}
                      .
                    </p>
                    {excede === true ? (
                      <p className="text-xs leading-relaxed text-semaforo-critico">
                        Excede el tope del {tramo?.topePorcentaje}% de la factura para ese nivel:
                        correspondía la autorización del nivel siguiente.
                      </p>
                    ) : null}
                    {excede === null ? (
                      <p className="text-xs leading-relaxed text-semaforo-medio">
                        Sin el monto de la factura afectada no se puede verificar el tope
                        porcentual.
                      </p>
                    ) : null}
                    <p className="text-xs">
                      Conformidad firmada del cliente:{" "}
                      <span
                        className={
                          reclamo.conformidad_firmada
                            ? "font-medium text-semaforo-bajo"
                            : "font-medium text-semaforo-critico"
                        }
                      >
                        {reclamo.conformidad_firmada ? "sí" : "no"}
                      </span>
                    </p>
                  </>
                ) : null}
              </TarjetaContenido>
            </Tarjeta>
          ) : null}

          {reclamo.motivo_no_conciliado || reclamo.verificacion_observacion ? (
            <Tarjeta>
              <TarjetaCabecera>
                <TarjetaTitulo>Cierre</TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido className="space-y-3">
                <Bloque
                  titulo="Motivo del cierre sin conciliar"
                  texto={reclamo.motivo_no_conciliado}
                />
                <Bloque
                  titulo="Verificación con el cliente"
                  texto={reclamo.verificacion_observacion}
                />
              </TarjetaContenido>
            </Tarjeta>
          ) : null}

          {gestionable ? (
            <PanelCaso
              reclamoId={reclamo.id}
              estado={reclamo.estado}
              plan={reclamo.plan}
              gravedad={reclamo.gravedad}
              personas={(personas as { id: string; nombre_completo: string }[] | null) ?? []}
              acciones={acciones}
            />
          ) : acciones.length > 0 ? (
            <Tarjeta>
              <TarjetaCabecera>
                <TarjetaTitulo>Acciones del plan</TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido className="space-y-2">
                {acciones.map((accion) => (
                  <div key={accion.id} className="text-xs">
                    <p className="whitespace-pre-line leading-relaxed">{accion.descripcion}</p>
                    <p className="text-[11px] text-atenuado-contraste">
                      {accion.fecha_limite ? `Para el ${formatearFecha(accion.fecha_limite)}` : "Sin plazo"}
                      {accion.ejecutada_en
                        ? ` · ejecutada el ${formatearFecha(accion.ejecutada_en)}`
                        : " · pendiente"}
                    </p>
                  </div>
                ))}
              </TarjetaContenido>
            </Tarjeta>
          ) : null}
        </div>

        <div className="space-y-4">
          <Tarjeta className="p-4">
            <p className="mb-2 text-xs font-semibold">Plazos del caso</p>
            <div className="space-y-1.5">
              <Plazo etiqueta="Detección" limite={null} hecho={reclamo.fecha_deteccion} />
              <Plazo
                etiqueta="Primer contacto"
                limite={reclamo.fecha_limite_contacto}
                hecho={reclamo.fecha_contacto}
              />
              <Plazo
                etiqueta="Definición del plan"
                limite={reclamo.fecha_limite_plan}
                hecho={reclamo.fecha_definicion_plan}
                suspendido={reclamo.tramite_digemabel}
              />
              <Plazo
                etiqueta="Resolución"
                limite={reclamo.fecha_limite_resolucion}
                hecho={reclamo.fecha_resolucion}
                suspendido={reclamo.tramite_digemabel}
              />
              <Plazo etiqueta="Cierre" limite={null} hecho={reclamo.fecha_cierre} />
              {exigeNoConformidad(reclamo.plan) ? (
                <Plazo
                  etiqueta={`Verificación a los ${DIAS_VERIFICACION_PLAN_C} días`}
                  limite={null}
                  hecho={reclamo.fecha_verificacion}
                />
              ) : null}
            </div>
          </Tarjeta>

          <Tarjeta className="p-4">
            <dl className="space-y-2 text-xs">
              {[
                ["Cliente", reclamo.cliente?.razon_social ?? reclamo.cliente_nombre],
                ["Gestor del caso", reclamo.gestor?.nombre_completo ?? "—"],
                ["Responsable del área", reclamo.responsable_area?.nombre_completo ?? "—"],
                ["Estado del cliente", ETIQUETAS_ESTADO_CLIENTE_RECLAMO[reclamo.estado_cliente]],
              ].map(([etiqueta, valor]) => (
                <div key={etiqueta} className="flex justify-between gap-3">
                  <dt className="text-atenuado-contraste">{etiqueta}</dt>
                  <dd className="text-right font-medium">{valor}</dd>
                </div>
              ))}
            </dl>

            {reclamo.no_conformidad ? (
              <p className="mt-3 border-t border-borde pt-3 text-xs">
                <span className="text-atenuado-contraste">No conformidad del caso: </span>
                <Link
                  href={`/no-conformidades/${reclamo.no_conformidad.id}`}
                  className="font-medium text-primario hover:underline"
                >
                  {reclamo.no_conformidad.codigo}
                </Link>
              </p>
            ) : exigeNoConformidad(reclamo.plan) ? (
              <p className="mt-3 border-t border-borde pt-3 text-xs text-semaforo-medio">
                El Plan C abre una no conformidad al definirse el plan.
              </p>
            ) : null}
          </Tarjeta>
        </div>
      </div>
    </div>
  );
}
