import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { HistorialBitacora } from "@/components/comunes/historial-bitacora";
import {
  InsigniaDemostracion,
  InsigniaEstadoProveedor,
} from "@/components/comunes/insignias-estado";
import { PanelEvaluaciones } from "@/app/(sgc)/proveedores/[id]/panel-evaluaciones";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
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
import { describirVencimiento, formatearFecha, formatearNumero } from "@/lib/formato";
import type { EstadoProveedor } from "@/lib/tipos";

export const dynamic = "force-dynamic";

interface ProveedorDetalle {
  id: string;
  codigo: string;
  razon_social: string;
  nombre_comercial: string | null;
  ruc: string | null;
  rubro: string | null;
  critico: boolean;
  correo: string | null;
  telefono: string | null;
  ciudad: string | null;
  pais: string | null;
  contacto: string | null;
  estado: EstadoProveedor;
  calificacion_actual: number | null;
  fecha_ultima_evaluacion: string | null;
  fecha_proxima_evaluacion: string | null;
  periodicidad_evaluacion_meses: number;
  impacto_en_calidad: string | null;
  observaciones: string | null;
  es_demostracion: boolean;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("proveedores")
    .select("codigo, razon_social")
    .eq("id", params.id)
    .maybeSingle();

  return { title: data ? `${data.codigo} · ${data.razon_social}` : "Proveedor" };
}

export default async function PaginaProveedor({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: consulta } = await supabase
    .from("proveedores")
    .select("*")
    .eq("id", params.id)
    .maybeSingle();

  const proveedor = consulta as unknown as ProveedorDetalle | null;
  if (!proveedor) notFound();

  const [{ data: evaluaciones }, { data: noConformidades }] = await Promise.all([
    supabase
      .from("proveedor_evaluaciones")
      .select("*, evaluador:evaluado_por (nombre_completo)")
      .eq("proveedor_id", params.id)
      .order("fecha", { ascending: false }),
    supabase
      .from("no_conformidades")
      .select("id, codigo, titulo, estado")
      .eq("origen", "proveedor")
      .order("fecha_deteccion", { ascending: false })
      .limit(5),
  ]);

  const listaEvaluaciones = (evaluaciones as any[] | null) ?? [];
  const gestiona = puedeGestionar(usuario);

  const promedio =
    listaEvaluaciones.length > 0
      ? listaEvaluaciones.reduce((suma, evaluacion) => suma + Number(evaluacion.puntaje), 0) /
        listaEvaluaciones.length
      : null;

  return (
    <div className="mx-auto max-w-6xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/proveedores">
          <ArrowLeft /> Volver al listado
        </Link>
      </Boton>

      <EncabezadoPagina
        titulo={proveedor.razon_social}
        descripcion={proveedor.nombre_comercial ?? undefined}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Insignia variante="primaria" className="tabular text-xs">
          {proveedor.codigo}
        </Insignia>
        <InsigniaEstadoProveedor estado={proveedor.estado} />
        {proveedor.critico ? <Insignia variante="atencion">Crítico</Insignia> : null}
        {proveedor.rubro ? <Insignia variante="contorno">{proveedor.rubro}</Insignia> : null}
        {proveedor.es_demostracion ? <InsigniaDemostracion /> : null}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          titulo="Calificación actual"
          valor={
            proveedor.calificacion_actual !== null
              ? `${formatearNumero(proveedor.calificacion_actual, 0)} / 100`
              : "—"
          }
          contexto={
            proveedor.fecha_ultima_evaluacion
              ? `Evaluado el ${formatearFecha(proveedor.fecha_ultima_evaluacion)}`
              : "Sin evaluar"
          }
          tono={
            proveedor.calificacion_actual === null
              ? "neutro"
              : proveedor.calificacion_actual >= 80
                ? "exito"
                : proveedor.calificacion_actual >= 60
                  ? "advertencia"
                  : "peligro"
          }
        />
        <TarjetaIndicador
          titulo="Promedio histórico"
          valor={promedio !== null ? `${formatearNumero(promedio, 0)} / 100` : "—"}
          contexto={`${listaEvaluaciones.length} evaluaciones`}
        />
        <TarjetaIndicador
          titulo="Próxima evaluación"
          valor={
            proveedor.fecha_proxima_evaluacion
              ? formatearFecha(proveedor.fecha_proxima_evaluacion)
              : "—"
          }
          contexto={
            proveedor.fecha_proxima_evaluacion
              ? describirVencimiento(proveedor.fecha_proxima_evaluacion)
              : "Se agenda con la primera evaluación"
          }
        />
        <TarjetaIndicador
          titulo="Periodicidad"
          valor={`${proveedor.periodicidad_evaluacion_meses} meses`}
          contexto={proveedor.critico ? "Proveedor crítico" : "Proveedor estándar"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Historial de evaluaciones</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <PanelEvaluaciones
                proveedorId={proveedor.id}
                evaluaciones={listaEvaluaciones}
                puedeEditar={gestiona}
              />
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Trazabilidad</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <HistorialBitacora tablas={["proveedores"]} registroId={proveedor.id} />
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
                <Dato etiqueta="RUC" valor={proveedor.ruc ?? "—"} />
                <Dato etiqueta="Contacto" valor={proveedor.contacto ?? "—"} />
                <Dato etiqueta="Correo" valor={proveedor.correo ?? "—"} />
                <Dato etiqueta="Teléfono" valor={proveedor.telefono ?? "—"} />
                <Dato
                  etiqueta="Ubicación"
                  valor={[proveedor.ciudad, proveedor.pais].filter(Boolean).join(", ") || "—"}
                />
              </dl>

              {proveedor.impacto_en_calidad ? (
                <div className="mt-3 border-t border-borde pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste">
                    Impacto en la calidad
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">{proveedor.impacto_en_calidad}</p>
                </div>
              ) : null}

              {proveedor.observaciones ? (
                <div className="mt-3 border-t border-borde pt-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste">
                    Observaciones
                  </p>
                  <p className="mt-1 text-xs leading-relaxed">{proveedor.observaciones}</p>
                </div>
              ) : null}
            </TarjetaContenido>
          </Tarjeta>

          {((noConformidades as any[] | null) ?? []).length > 0 ? (
            <Tarjeta>
              <TarjetaCabecera>
                <TarjetaTitulo>No conformidades de proveedores</TarjetaTitulo>
              </TarjetaCabecera>
              <TarjetaContenido>
                <ul className="space-y-2">
                  {((noConformidades as any[] | null) ?? []).map((nc) => (
                    <li key={nc.id}>
                      <Link
                        href={`/no-conformidades/${nc.id}`}
                        className="text-xs hover:text-primario"
                      >
                        <span className="tabular text-atenuado-contraste">{nc.codigo}</span>{" "}
                        {nc.titulo}
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 text-[10px] text-atenuado-contraste">
                  Se listan las desviaciones cuyo origen es un proveedor.
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
