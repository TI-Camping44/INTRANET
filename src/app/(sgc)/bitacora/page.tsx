import type { Metadata } from "next";
import { History } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
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
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFechaHora } from "@/lib/formato";
import { humanizar } from "@/lib/utilidades";
import type { RegistroBitacora } from "@/lib/tipos";

export const metadata: Metadata = { title: "Bitácora" };
export const dynamic = "force-dynamic";

const TABLAS_CONSULTABLES = [
  "documentos",
  "documento_versiones",
  "no_conformidades",
  "nc_acciones",
  "riesgos",
  "riesgo_acciones",
  "auditorias",
  "auditoria_hallazgos",
  "indicadores",
  "indicador_mediciones",
  "proveedores",
  "activos",
  "usuarios",
  "procesos",
];

export default async function PaginaBitacora({
  searchParams,
}: {
  searchParams: { q?: string; tabla?: string; accion?: string };
}) {
  // Requisito de auditoría: la bitácora es de consulta restringida.
  await requerirRol(["administrador_sgc", "auditor", "direccion"]);
  const supabase = crearClienteServidor();

  let consulta = supabase
    .from("bitacora")
    .select("*")
    .order("creado_en", { ascending: false })
    .limit(200);

  if (searchParams.tabla) consulta = consulta.eq("tabla", searchParams.tabla);
  if (searchParams.accion) consulta = consulta.eq("accion", searchParams.accion);
  if (searchParams.q) consulta = consulta.ilike("usuario_correo", `%${searchParams.q}%`);

  const { data } = await consulta;
  const registros = (data as RegistroBitacora[] | null) ?? [];

  return (
    <>
      <EncabezadoPagina
        titulo="Bitácora de trazabilidad"
        descripcion="Registro de toda creación, edición y cambio de estado del sistema, con usuario, fecha y valores anterior y nuevo. Se escribe por disparadores en la base de datos: ningún camino de la aplicación puede evadirla."
      />

      <FiltrosListado
        marcadorBusqueda="Buscar por correo del usuario…"
        campos={[
          {
            nombre: "tabla",
            etiqueta: "Entidad",
            opciones: TABLAS_CONSULTABLES.map((tabla) => ({
              valor: tabla,
              etiqueta: humanizar(tabla),
            })),
          },
          {
            nombre: "accion",
            etiqueta: "Acción",
            opciones: [
              { valor: "creacion", etiqueta: "Creación" },
              { valor: "edicion", etiqueta: "Edición" },
              { valor: "eliminacion", etiqueta: "Eliminación" },
            ],
          },
        ]}
      />

      {registros.length === 0 ? (
        <EstadoVacio
          icono={<History className="size-6" />}
          titulo="Sin movimientos registrados"
          descripcion="Todavía no hay actividad que coincida con los filtros aplicados."
        />
      ) : (
        <Tarjeta>
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado className="w-[10rem]">Fecha y hora</TablaEncabezado>
                <TablaEncabezado className="w-[9rem]">Entidad</TablaEncabezado>
                <TablaEncabezado className="w-[6rem]">Acción</TablaEncabezado>
                <TablaEncabezado className="hidden md:table-cell">Usuario</TablaEncabezado>
                <TablaEncabezado>Campos modificados</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {registros.map((registro) => (
                <TablaFila key={registro.id}>
                  <TablaCelda className="whitespace-nowrap text-xs tabular">
                    {formatearFechaHora(registro.creado_en)}
                  </TablaCelda>
                  <TablaCelda className="text-xs">{humanizar(registro.tabla)}</TablaCelda>
                  <TablaCelda>
                    <Insignia
                      variante={
                        registro.accion === "creacion"
                          ? "exito"
                          : registro.accion === "eliminacion"
                            ? "peligro"
                            : "neutra"
                      }
                    >
                      {humanizar(registro.accion)}
                    </Insignia>
                  </TablaCelda>
                  <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                    {registro.usuario_correo ?? "proceso automático"}
                  </TablaCelda>
                  <TablaCelda className="text-[11px] text-atenuado-contraste">
                    {registro.campos_modificados?.length
                      ? registro.campos_modificados.map(humanizar).join(", ")
                      : "—"}
                  </TablaCelda>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </Tarjeta>
      )}

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        Se muestran los últimos {registros.length} movimientos.
      </p>
    </>
  );
}
