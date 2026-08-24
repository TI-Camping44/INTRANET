import type { Metadata } from "next";
import { Wrench } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { ModuloEnConstruccion } from "@/components/comunes/modulo-en-construccion";
import { InsigniaEstadoActivo } from "@/components/comunes/insignias-estado";
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
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { entradaPorRuta } from "@/lib/navegacion";
import { ETIQUETAS_ESTADO_ACTIVO } from "@/lib/constantes";
import { describirVencimiento, formatearFecha, formatearGuaranies } from "@/lib/formato";
import type { EstadoActivo } from "@/lib/tipos";

export const metadata: Metadata = { title: "Infraestructura y activos" };
export const dynamic = "force-dynamic";

export default async function PaginaActivos({
  searchParams,
}: {
  searchParams: { q?: string; estado?: string };
}) {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  let consulta = supabase
    .from("activos")
    .select("*, sedes:sede_id (nombre), responsable:responsable_id (nombre_completo)")
    .order("codigo");

  if (searchParams.estado) consulta = consulta.eq("estado", searchParams.estado);
  if (searchParams.q) {
    const texto = `%${searchParams.q}%`;
    consulta = consulta.or(`codigo.ilike.${texto},nombre.ilike.${texto}`);
  }

  const [{ data }, { data: mantenimientos }] = await Promise.all([
    consulta,
    supabase
      .from("mantenimientos")
      .select("*, activos:activo_id (codigo, nombre)")
      .eq("estado", "programado")
      .order("fecha_programada")
      .limit(10),
  ]);

  const activos = (data ?? []) as any[];
  const valorTotal = activos.reduce((suma, activo) => suma + Number(activo.valor_gs ?? 0), 0);

  return (
    <>
      <EncabezadoPagina
        titulo="Infraestructura y activos"
        descripcion="Inventario de activos con mantenimientos preventivos y alertas por calendario."
      />

      <ModuloEnConstruccion nota={entradaPorRuta("/activos")?.notaFase} />

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
                  <TablaCelda className="font-medium tabular">{activo.codigo}</TablaCelda>
                  <TablaCelda>
                    <p className="text-xs font-medium">{activo.nombre}</p>
                    {activo.categoria ? (
                      <p className="text-[11px] text-atenuado-contraste">{activo.categoria}</p>
                    ) : null}
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

      {(mantenimientos ?? []).length > 0 ? (
        <Tarjeta className="mt-4">
          <TarjetaCabecera>
            <TarjetaTitulo>Mantenimientos programados</TarjetaTitulo>
          </TarjetaCabecera>
          <TarjetaContenido>
            <ul className="space-y-2">
              {(mantenimientos as any[]).map((mantenimiento) => (
                <li
                  key={mantenimiento.id}
                  className="flex items-start justify-between gap-3 border-b border-borde pb-2
                             last:border-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-medium">
                      <span className="tabular text-atenuado-contraste">
                        {mantenimiento.activos?.codigo}
                      </span>{" "}
                      {mantenimiento.activos?.nombre}
                    </p>
                    <p className="mt-0.5 text-[11px] text-atenuado-contraste">
                      {mantenimiento.descripcion ?? "Mantenimiento preventivo"} ·{" "}
                      {formatearFecha(mantenimiento.fecha_programada)}
                    </p>
                  </div>
                  <Insignia variante="advertencia">
                    {describirVencimiento(mantenimiento.fecha_programada)}
                  </Insignia>
                </li>
              ))}
            </ul>
          </TarjetaContenido>
        </Tarjeta>
      ) : null}

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {activos.length} activo{activos.length === 1 ? "" : "s"} · Valor inventariado:{" "}
        {formatearGuaranies(valorTotal)}.
      </p>
    </>
  );
}
