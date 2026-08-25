import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { HistorialBitacora } from "@/components/comunes/historial-bitacora";
import {
  InsigniaDemostracion,
  InsigniaEstadoActivo,
} from "@/components/comunes/insignias-estado";
import { PanelMantenimientos } from "@/app/(sgc)/activos/[id]/panel-mantenimientos";
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
import { describirVencimiento, formatearFecha, formatearGuaranies } from "@/lib/formato";
import type { EstadoActivo } from "@/lib/tipos";

export const dynamic = "force-dynamic";

interface ActivoDetalle {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string | null;
  descripcion: string | null;
  ubicacion: string | null;
  numero_serie: string | null;
  marca: string | null;
  modelo: string | null;
  estado: EstadoActivo;
  fecha_adquisicion: string | null;
  valor_gs: number | null;
  requiere_mantenimiento: boolean;
  frecuencia_mantenimiento_dias: number | null;
  fecha_ultimo_mantenimiento: string | null;
  fecha_proximo_mantenimiento: string | null;
  es_demostracion: boolean;
  responsable_id: string | null;
  sedes: { nombre: string } | null;
  responsable: { nombre_completo: string } | null;
  proveedores: { razon_social: string } | null;
}

export async function generateMetadata({
  params,
}: {
  params: { id: string };
}): Promise<Metadata> {
  const supabase = crearClienteServidor();
  const { data } = await supabase
    .from("activos")
    .select("codigo, nombre")
    .eq("id", params.id)
    .maybeSingle();

  return { title: data ? `${data.codigo} · ${data.nombre}` : "Activo" };
}

export default async function PaginaActivo({ params }: { params: { id: string } }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: consulta } = await supabase
    .from("activos")
    .select(
      "*, sedes:sede_id (nombre), responsable:responsable_id (nombre_completo), " +
        "proveedores:proveedor_id (razon_social)",
    )
    .eq("id", params.id)
    .maybeSingle();

  const activo = consulta as unknown as ActivoDetalle | null;
  if (!activo) notFound();

  const [{ data: mantenimientos }, { data: personas }, { data: proveedores }] = await Promise.all([
    supabase
      .from("mantenimientos")
      .select(
        "*, responsable:responsable_id (nombre_completo), proveedores:proveedor_id (razon_social)",
      )
      .eq("activo_id", params.id)
      .order("fecha_programada", { ascending: false }),
    supabase
      .from("usuarios")
      .select("id, nombre_completo")
      .eq("activo", true)
      .order("nombre_completo"),
    supabase
      .from("proveedores")
      .select("id, razon_social")
      .neq("estado", "inactivo")
      .order("razon_social"),
  ]);

  const lista = (mantenimientos as any[] | null) ?? [];
  const ejecutados = lista.filter((mantenimiento) => mantenimiento.estado === "ejecutado");
  const costoAcumulado = ejecutados.reduce(
    (suma, mantenimiento) => suma + Number(mantenimiento.costo_gs ?? 0),
    0,
  );

  const gestiona = puedeGestionar(usuario) || activo.responsable_id === usuario.id;

  return (
    <div className="mx-auto max-w-6xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/activos">
          <ArrowLeft /> Volver al inventario
        </Link>
      </Boton>

      <EncabezadoPagina titulo={activo.nombre} descripcion={activo.descripcion ?? undefined} />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Insignia variante="primaria" className="tabular text-xs">
          {activo.codigo}
        </Insignia>
        <InsigniaEstadoActivo estado={activo.estado} />
        {activo.categoria ? <Insignia variante="contorno">{activo.categoria}</Insignia> : null}
        {activo.requiere_mantenimiento ? (
          <Insignia variante="neutra">
            Preventivo cada {activo.frecuencia_mantenimiento_dias} días
          </Insignia>
        ) : null}
        {activo.es_demostracion ? <InsigniaDemostracion /> : null}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          titulo="Próximo mantenimiento"
          valor={
            activo.fecha_proximo_mantenimiento
              ? formatearFecha(activo.fecha_proximo_mantenimiento)
              : "—"
          }
          contexto={
            activo.fecha_proximo_mantenimiento
              ? describirVencimiento(activo.fecha_proximo_mantenimiento)
              : "No requiere mantenimiento"
          }
          tono={
            !activo.fecha_proximo_mantenimiento
              ? "neutro"
              : activo.fecha_proximo_mantenimiento < new Date().toISOString().slice(0, 10)
                ? "peligro"
                : "exito"
          }
        />
        <TarjetaIndicador
          titulo="Último mantenimiento"
          valor={
            activo.fecha_ultimo_mantenimiento
              ? formatearFecha(activo.fecha_ultimo_mantenimiento)
              : "—"
          }
          contexto={`${ejecutados.length} ejecutados`}
        />
        <TarjetaIndicador
          titulo="Costo acumulado"
          valor={formatearGuaranies(costoAcumulado)}
          contexto="Mantenimientos ejecutados"
        />
        <TarjetaIndicador
          titulo="Valor del activo"
          valor={formatearGuaranies(activo.valor_gs)}
          contexto={
            activo.fecha_adquisicion
              ? `Adquirido el ${formatearFecha(activo.fecha_adquisicion)}`
              : "Sin fecha de adquisición"
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Mantenimientos</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <PanelMantenimientos
                activoId={activo.id}
                mantenimientos={lista}
                personas={(personas as { id: string; nombre_completo: string }[] | null) ?? []}
                proveedores={
                  (proveedores as { id: string; razon_social: string }[] | null) ?? []
                }
                frecuenciaDias={activo.frecuencia_mantenimiento_dias}
                puedeEditar={gestiona}
              />
            </TarjetaContenido>
          </Tarjeta>

          <Tarjeta>
            <TarjetaCabecera>
              <TarjetaTitulo>Trazabilidad</TarjetaTitulo>
            </TarjetaCabecera>
            <TarjetaContenido>
              <HistorialBitacora tablas={["activos"]} registroId={activo.id} />
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
                <Dato etiqueta="Sede" valor={activo.sedes?.nombre ?? "—"} />
                <Dato etiqueta="Ubicación" valor={activo.ubicacion ?? "—"} />
                <Dato etiqueta="Responsable" valor={activo.responsable?.nombre_completo ?? "—"} />
                <Dato etiqueta="Marca" valor={activo.marca ?? "—"} />
                <Dato etiqueta="Modelo" valor={activo.modelo ?? "—"} />
                <Dato etiqueta="Número de serie" valor={activo.numero_serie ?? "—"} />
                <Dato etiqueta="Proveedor" valor={activo.proveedores?.razon_social ?? "—"} />
              </dl>
            </TarjetaContenido>
          </Tarjeta>
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
