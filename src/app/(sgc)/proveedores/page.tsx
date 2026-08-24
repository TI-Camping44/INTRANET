import type { Metadata } from "next";
import { Truck } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { ModuloEnConstruccion } from "@/components/comunes/modulo-en-construccion";
import {
  InsigniaDemostracion,
  InsigniaEstadoProveedor,
} from "@/components/comunes/insignias-estado";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta } from "@/components/ui/tarjeta";
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
import { ETIQUETAS_ESTADO_PROVEEDOR } from "@/lib/constantes";
import { describirVencimiento, diasHasta, formatearFecha, formatearNumero } from "@/lib/formato";
import type { EstadoProveedor } from "@/lib/tipos";

export const metadata: Metadata = { title: "Proveedores" };
export const dynamic = "force-dynamic";

export default async function PaginaProveedores({
  searchParams,
}: {
  searchParams: { q?: string; estado?: string };
}) {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  let consulta = supabase.from("proveedores").select("*").order("razon_social");

  if (searchParams.estado) consulta = consulta.eq("estado", searchParams.estado);
  if (searchParams.q) {
    const texto = `%${searchParams.q}%`;
    consulta = consulta.or(
      `codigo.ilike.${texto},razon_social.ilike.${texto},ruc.ilike.${texto}`,
    );
  }

  const { data } = await consulta;
  const proveedores = (data ?? []) as any[];

  return (
    <>
      <EncabezadoPagina
        titulo="Proveedores"
        descripcion="Evaluación y reevaluación periódica de proveedores, con calificación sobre cinco criterios."
      />

      <ModuloEnConstruccion nota={entradaPorRuta("/proveedores")?.notaFase} />

      <FiltrosListado
        marcadorBusqueda="Buscar por razón social, código o RUC…"
        campos={[
          {
            nombre: "estado",
            etiqueta: "Estado",
            opciones: Object.entries(ETIQUETAS_ESTADO_PROVEEDOR).map(([valor, etiqueta]) => ({
              valor,
              etiqueta,
            })),
          },
        ]}
      />

      {proveedores.length === 0 ? (
        <EstadoVacio
          icono={<Truck className="size-6" />}
          titulo="Sin proveedores registrados"
          descripcion="El padrón se completa con la importación desde Sofidya o con la carga manual."
        />
      ) : (
        <Tarjeta>
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado className="w-[7rem]">Código</TablaEncabezado>
                <TablaEncabezado>Razón social</TablaEncabezado>
                <TablaEncabezado className="hidden lg:table-cell">Rubro</TablaEncabezado>
                <TablaEncabezado className="hidden xl:table-cell">RUC</TablaEncabezado>
                <TablaEncabezado className="w-[6rem] text-right">Calificación</TablaEncabezado>
                <TablaEncabezado className="w-[8rem]">Estado</TablaEncabezado>
                <TablaEncabezado className="hidden md:table-cell">Reevaluación</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {proveedores.map((proveedor) => {
                const dias = diasHasta(proveedor.fecha_proxima_evaluacion);
                const vencida = dias !== null && dias <= 0;

                return (
                  <TablaFila key={proveedor.id}>
                    <TablaCelda className="font-medium tabular">{proveedor.codigo}</TablaCelda>
                    <TablaCelda>
                      <span className="flex flex-wrap items-center gap-2 text-xs">
                        {proveedor.razon_social}
                        {proveedor.critico ? (
                          <Insignia variante="atencion">Crítico</Insignia>
                        ) : null}
                        {proveedor.es_demostracion ? <InsigniaDemostracion /> : null}
                      </span>
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs text-atenuado-contraste lg:table-cell">
                      {proveedor.rubro ?? "—"}
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs tabular text-atenuado-contraste xl:table-cell">
                      {proveedor.ruc ?? "—"}
                    </TablaCelda>
                    <TablaCelda className="text-right text-xs font-medium tabular">
                      {proveedor.calificacion_actual !== null
                        ? `${formatearNumero(proveedor.calificacion_actual, 0)} / 100`
                        : "—"}
                    </TablaCelda>
                    <TablaCelda>
                      <InsigniaEstadoProveedor estado={proveedor.estado as EstadoProveedor} />
                    </TablaCelda>
                    <TablaCelda className="hidden text-xs md:table-cell">
                      {proveedor.fecha_proxima_evaluacion ? (
                        <span className={vencida ? "text-semaforo-alto" : "text-atenuado-contraste"}>
                          {formatearFecha(proveedor.fecha_proxima_evaluacion)}
                          <span className="block text-[10px]">
                            {describirVencimiento(proveedor.fecha_proxima_evaluacion)}
                          </span>
                        </span>
                      ) : (
                        <span className="text-atenuado-contraste">Sin evaluar</span>
                      )}
                    </TablaCelda>
                  </TablaFila>
                );
              })}
            </TablaCuerpo>
          </Tabla>
        </Tarjeta>
      )}

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {proveedores.length} proveedor{proveedores.length === 1 ? "" : "es"} en el padrón.
      </p>
    </>
  );
}
