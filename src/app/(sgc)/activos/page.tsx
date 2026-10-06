import type { Metadata } from "next";
import Link from "next/link";
import { Plus, Wrench } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import {
  InsigniaCriticidadActivo,
  InsigniaEstadoActivo,
} from "@/components/comunes/insignias-estado";
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
import { CeldaTexto } from "@/components/comunes/celda-texto";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import {
  CLASES_ACTIVO,
  CRITICIDADES_ACTIVO,
  ESTADOS_ACTIVO,
  ETIQUETAS_CLASE_ACTIVO,
  ETIQUETAS_CRITICIDAD_ACTIVO,
  ETIQUETAS_ESTADO_ACTIVO,
} from "@/lib/constantes";
import {
  describirVencimiento,
  formatearFecha,
  formatearGuaranies,
  hoyEnAsuncion,
} from "@/lib/formato";
import type { ClaseActivo, CriticidadActivo, EstadoActivo } from "@/lib/tipos";

export const metadata: Metadata = { title: "Infraestructura y Tecnología" };
export const dynamic = "force-dynamic";

export default async function PaginaActivos({
  searchParams,
}: {
  searchParams: {
    q?: string;
    estado?: string;
    mantenimiento?: string;
    clase?: string;
    criticidad?: string;
  };
}) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  let consulta = supabase
    .from("activos")
    .select("*, sedes:sede_id (nombre), responsable:responsable_id (nombre_completo)")
    .order("codigo");

  if (searchParams.estado) consulta = consulta.eq("estado", searchParams.estado);
  // EDILICIOS Y TECNOLÓGICOS SE MIRAN POR SEPARADO. Son las dos entradas
  // del menú; el filtro es el mismo corte, para poder combinarlo con los
  // demás.
  const claseMirada = CLASES_ACTIVO.includes(searchParams.clase as ClaseActivo)
    ? (searchParams.clase as ClaseActivo)
    : null;
  if (claseMirada) consulta = consulta.eq("clase", claseMirada);
  if (searchParams.criticidad) consulta = consulta.eq("criticidad", searchParams.criticidad);
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
        titulo={
          claseMirada
            ? `Activos ${ETIQUETAS_CLASE_ACTIVO[claseMirada]}s`
            : "Infraestructura y Tecnología"
        }
        acciones={
          gestiona ? (
            <Boton comoHijo>
              <Link href={claseMirada ? `/activos/nuevo?clase=${claseMirada}` : "/activos/nuevo"}>
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
            nombre: "clase",
            etiqueta: "Clase",
            opciones: CLASES_ACTIVO.map((valor) => ({
              valor,
              etiqueta: ETIQUETAS_CLASE_ACTIVO[valor],
            })),
          },
          {
            nombre: "estado",
            etiqueta: "Estado",
            opciones: ESTADOS_ACTIVO.map((valor) => ({
              valor,
              etiqueta: ETIQUETAS_ESTADO_ACTIVO[valor],
            })),
          },
          {
            nombre: "criticidad",
            etiqueta: "Criticidad",
            opciones: CRITICIDADES_ACTIVO.map((valor) => ({
              valor,
              etiqueta: ETIQUETAS_CRITICIDAD_ACTIVO[valor],
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
                {/* LAS COLUMNAS QUE PIDIÓ DIRECCIÓN EL 6 DE OCTUBRE,
                    en su orden. La tabla se desplaza sola en horizontal:
                    son diez y en un celular no entran. */}
                <TablaEncabezado className="w-[7rem]">Código</TablaEncabezado>
                <TablaEncabezado className="min-w-[14rem]">Descripción</TablaEncabezado>
                <TablaEncabezado className="min-w-[9rem]">Ubicación</TablaEncabezado>
                <TablaEncabezado className="min-w-[10rem]">Responsable</TablaEncabezado>
                <TablaEncabezado className="w-[6rem]">Criticidad</TablaEncabezado>
                <TablaEncabezado className="w-[11rem]">Estado</TablaEncabezado>
                <TablaEncabezado className="w-[7rem]">Último mant.</TablaEncabezado>
                <TablaEncabezado className="w-[8rem]">Próximo mant.</TablaEncabezado>
                <TablaEncabezado className="w-[8rem]">Garantía o licencia</TablaEncabezado>
                <TablaEncabezado className="min-w-[12rem]">Observaciones</TablaEncabezado>
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
                      {activo.descripcion ? (
                        <p className="text-[11px] text-atenuado-contraste">{activo.descripcion}</p>
                      ) : activo.categoria ? (
                        <p className="text-[11px] text-atenuado-contraste">{activo.categoria}</p>
                      ) : null}
                    </Link>
                  </TablaCelda>
                  <TablaCelda className="text-xs text-atenuado-contraste">
                    {activo.ubicacion ?? activo.sedes?.nombre ?? "—"}
                  </TablaCelda>
                  <TablaCelda className="text-xs text-atenuado-contraste">
                    {activo.responsable?.nombre_completo ?? "—"}
                  </TablaCelda>
                  <TablaCelda className="text-xs">
                    <InsigniaCriticidadActivo criticidad={activo.criticidad as CriticidadActivo} />
                  </TablaCelda>
                  <TablaCelda>
                    <InsigniaEstadoActivo estado={activo.estado as EstadoActivo} />
                  </TablaCelda>
                  <TablaCelda className="text-xs tabular text-atenuado-contraste">
                    {activo.fecha_ultimo_mantenimiento
                      ? formatearFecha(activo.fecha_ultimo_mantenimiento)
                      : "—"}
                  </TablaCelda>
                  <TablaCelda className="text-xs">
                    {activo.requiere_mantenimiento && activo.fecha_proximo_mantenimiento ? (
                      <span className="text-atenuado-contraste tabular">
                        {formatearFecha(activo.fecha_proximo_mantenimiento)}
                        <span className="block text-[10px]">
                          {describirVencimiento(activo.fecha_proximo_mantenimiento)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-atenuado-contraste">No aplica</span>
                    )}
                  </TablaCelda>
                  <TablaCelda className="text-xs">
                    {activo.vencimiento_garantia ? (
                      <span className="text-atenuado-contraste tabular">
                        {formatearFecha(activo.vencimiento_garantia)}
                        <span className="block text-[10px]">
                          {describirVencimiento(activo.vencimiento_garantia)}
                        </span>
                      </span>
                    ) : (
                      <span className="text-atenuado-contraste">—</span>
                    )}
                  </TablaCelda>
                  <CeldaTexto ancho="12rem">{activo.observaciones}</CeldaTexto>
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
