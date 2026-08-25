import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Wrench } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { InsigniaEstadoActivo } from "@/components/comunes/insignias-estado";
import {
  CalendarioMantenimientos,
  type MantenimientoAgendado,
} from "@/components/comunes/calendario-mantenimientos";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import { Boton } from "@/components/ui/boton";
import {
  Pestanas,
  PestanaContenido,
  PestanaDisparador,
  PestanasLista,
} from "@/components/ui/pestanas";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ETIQUETAS_ESTADO_ACTIVO } from "@/lib/constantes";
import {
  describirVencimiento,
  formatearFecha,
  formatearGuaranies,
  hoyEnAsuncion,
} from "@/lib/formato";
import type { EstadoActivo } from "@/lib/tipos";

export const metadata: Metadata = { title: "Infraestructura y activos" };
export const dynamic = "force-dynamic";

export default async function PaginaActivos({
  searchParams,
}: {
  searchParams: { q?: string; estado?: string; mantenimiento?: string };
}) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  let consulta = supabase
    .from("activos")
    .select("*, sedes:sede_id (nombre), responsable:responsable_id (nombre_completo)")
    .order("codigo");

  if (searchParams.estado) consulta = consulta.eq("estado", searchParams.estado);
  if (searchParams.mantenimiento === "vencido") {
    consulta = consulta
      .eq("requiere_mantenimiento", true)
      .lte("fecha_proximo_mantenimiento", hoyEnAsuncion());
  }
  if (searchParams.q) {
    const texto = `%${searchParams.q}%`;
    consulta = consulta.or(`codigo.ilike.${texto},nombre.ilike.${texto}`);
  }

  const [{ data }, { data: mantenimientos }] = await Promise.all([
    consulta,
    supabase
      .from("mantenimientos")
      .select("id, activo_id, tipo, estado, fecha_programada, descripcion, activos:activo_id (codigo, nombre)")
      .in("estado", ["programado", "en_curso", "vencido"])
      .order("fecha_programada"),
  ]);

  const activos = (data ?? []) as any[];
  const valorTotal = activos.reduce((suma, activo) => suma + Number(activo.valor_gs ?? 0), 0);
  const hoy = hoyEnAsuncion();
  const gestiona = puedeGestionar(usuario);

  const agenda: MantenimientoAgendado[] = ((mantenimientos as any[] | null) ?? []).map(
    (mantenimiento) => ({
      id: mantenimiento.id,
      activo_id: mantenimiento.activo_id,
      tipo: mantenimiento.tipo,
      estado: mantenimiento.estado,
      fecha_programada: mantenimiento.fecha_programada,
      descripcion: mantenimiento.descripcion,
      activo_codigo: mantenimiento.activos?.codigo ?? "",
      activo_nombre: mantenimiento.activos?.nombre ?? "",
    }),
  );

  const conMantenimiento = activos.filter((activo) => activo.requiere_mantenimiento).length;
  const vencidos = activos.filter(
    (activo) =>
      activo.requiere_mantenimiento &&
      activo.fecha_proximo_mantenimiento !== null &&
      activo.fecha_proximo_mantenimiento <= hoy,
  ).length;
  const fueraDeServicio = activos.filter(
    (activo) => activo.estado === "fuera_de_servicio" || activo.estado === "en_mantenimiento",
  ).length;

  return (
    <>
      <EncabezadoPagina
        titulo="Infraestructura y activos"
        descripcion="Inventario de activos con mantenimientos preventivos, calendario y alertas por vencimiento."
        acciones={
          gestiona ? (
            <Boton comoHijo>
              <Link href="/activos/nuevo">
                <Plus /> Nuevo activo
              </Link>
            </Boton>
          ) : null
        }
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          titulo="Activos"
          valor={activos.length}
          contexto={formatearGuaranies(valorTotal)}
        />
        <TarjetaIndicador
          titulo="Con preventivo"
          valor={conMantenimiento}
          contexto="En el calendario"
        />
        <TarjetaIndicador
          titulo="Mantenimiento vencido"
          valor={vencidos}
          contexto={vencidos > 0 ? "Fecha alcanzada" : "Al día"}
          tono={vencidos > 0 ? "peligro" : "exito"}
          enlace="/activos?mantenimiento=vencido"
        />
        <TarjetaIndicador
          titulo="No operativos"
          valor={fueraDeServicio}
          contexto="En mantenimiento o fuera de servicio"
          tono={fueraDeServicio > 0 ? "advertencia" : "exito"}
        />
      </div>

      <Pestanas defaultValue="inventario">
        <PestanasLista>
          <PestanaDisparador value="inventario">Inventario ({activos.length})</PestanaDisparador>
          <PestanaDisparador value="calendario">Calendario ({agenda.length})</PestanaDisparador>
        </PestanasLista>

        <PestanaContenido value="inventario">
      <FiltrosListado
        marcadorBusqueda="Buscar por código o nombre del activo…"
        campos={[
          {
            nombre: "estado",
            etiqueta: "Estado",
            opciones: Object.entries(ETIQUETAS_ESTADO_ACTIVO).map(([valor, etiqueta]) => ({
              valor,
              etiqueta,
            })),
          },
        ]}
      />

      {activos.length === 0 ? (
        <EstadoVacio
          icono={<Wrench className="size-6" />}
          titulo="Sin activos registrados"
          descripcion="El inventario se completa con la importación desde Sofidya o con la carga manual."
          accion={
            gestiona ? (
              <Boton comoHijo tamano="pequeno">
                <Link href="/activos/nuevo">
                  <Plus /> Nuevo activo
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
                <TablaEncabezado className="w-[8rem]">Código</TablaEncabezado>
                <TablaEncabezado>Activo</TablaEncabezado>
                <TablaEncabezado className="hidden lg:table-cell">Sede</TablaEncabezado>
                <TablaEncabezado className="hidden xl:table-cell">Responsable</TablaEncabezado>
                <TablaEncabezado className="w-[9rem]">Estado</TablaEncabezado>
                <TablaEncabezado className="hidden md:table-cell">
                  Próximo mantenimiento
                </TablaEncabezado>
                <TablaEncabezado className="w-[9rem] text-right">Valor</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {activos.map((activo) => (
                <TablaFila key={activo.id}>
                  <TablaCelda className="font-medium tabular">
                    <Link href={`/activos/${activo.id}`} className="hover:text-primario">
                      {activo.codigo}
                    </Link>
                  </TablaCelda>
                  <TablaCelda>
                    <Link href={`/activos/${activo.id}`} className="hover:text-primario">
                      <p className="text-xs font-medium">{activo.nombre}</p>
                    {activo.categoria ? (
                      <p className="text-[11px] text-atenuado-contraste">{activo.categoria}</p>
                    ) : null}
                    </Link>
                  </TablaCelda>
                  <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                    {activo.sedes?.nombre ?? "—"}
                  </TablaCelda>
                  <TablaCelda className="hidden text-xs text-atenuado-contraste xl:table-cell">
                    {activo.responsable?.nombre_completo ?? "—"}
                  </TablaCelda>
                  <TablaCelda>
                    <InsigniaEstadoActivo estado={activo.estado as EstadoActivo} />
                  </TablaCelda>
                  <TablaCelda className="hidden text-xs md:table-cell">
                    {activo.requiere_mantenimiento && activo.fecha_proximo_mantenimiento ? (
                      <span className="text-atenuado-contraste">
                        {formatearFecha(activo.fecha_proximo_mantenimiento)}
                        <span className="block text-[10px]">
                          {describirVencimiento(activo.fecha_proximo_mantenimiento)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-atenuado-contraste">No aplica</span>
                    )}
                  </TablaCelda>
                  <TablaCelda className="text-right text-xs tabular">
                    {formatearGuaranies(activo.valor_gs)}
                  </TablaCelda>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </Tarjeta>
      )}

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {activos.length} activo{activos.length === 1 ? "" : "s"} · Valor inventariado:{" "}
        {formatearGuaranies(valorTotal)}.
      </p>
        </PestanaContenido>

        <PestanaContenido value="calendario">
          <Tarjeta className="p-4">
            <CalendarioMantenimientos mantenimientos={agenda} />
          </Tarjeta>
        </PestanaContenido>
      </Pestanas>
    </>
  );
}
