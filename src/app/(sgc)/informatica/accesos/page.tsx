import type { Metadata } from "next";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta, TarjetaContenido } from "@/components/ui/tarjeta";
import { obtenerPermisos, requerirModulo } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ETIQUETAS_ROL } from "@/lib/constantes";
import {
  ABREVIATURA_NIVEL,
  COLUMNAS_SENSIBLES,
  ETIQUETAS_EMPRESA_ODOO,
  ETIQUETAS_NIVEL,
  MODULOS_ODOO,
  PESO_NIVEL,
  type ColumnaOdoo,
  type EmpresaOdoo,
  type NivelAcceso,
} from "@/lib/accesos";
import { cn } from "@/lib/utilidades";
import type { RolUsuario } from "@/lib/tipos";

export const metadata: Metadata = { title: "Accesos por puesto" };
export const dynamic = "force-dynamic";

type FilaAccesos = {
  puesto_id: string;
  google_workspace: boolean;
  intranet_rol: RolUsuario | null;
  odoo_empresas: EmpresaOdoo | null;
  estado: "propuesta" | "validada";
  validado_en: string | null;
} & Record<ColumnaOdoo, NivelAcceso>;

interface Puesto {
  id: string;
  nombre: string;
  departamento: string | null;
  area: string | null;
}

/**
 * La celda se pinta por cuánto abre el nivel, de menos a más. NUNCA SOLO
 * POR EL COLOR: la celda lleva el nivel escrito, abreviado.
 */
const CLASE_NIVEL: Record<NivelAcceso, string> = {
  sin_acceso: "text-atenuado-contraste",
  solo_lectura: "bg-atenuado/60",
  usuario: "bg-atenuado/60",
  facturacion: "bg-atenuado",
  responsable: "bg-semaforo-medio/15 text-semaforo-medio font-semibold",
  administrador: "bg-semaforo-alto/15 text-semaforo-alto font-semibold",
};

/**
 * Matriz de accesos por puesto.
 *
 * ES LA RESPUESTA A LA NC-2026-019: «No existe un listado de los accesos
 * que corresponden a cada puesto que respalde el mínimo privilegio». Una
 * fila por puesto del Perfil de Resultados de Puesto y una columna por
 * sistema; Nómina y Empleados van marcadas porque son las que abren
 * sueldos y legajos.
 */
export default async function PaginaAccesosPorPuesto() {
  await requerirModulo("informatica");
  const permisos = await obtenerPermisos();
  const puedeEditar = permisos.informatica.editar;
  const supabase = crearClienteServidor();

  const [{ data: datosPuestos }, { data: datosAccesos }] = await Promise.all([
    supabase
      .from("puestos")
      .select("id, nombre, departamento, area")
      .eq("activo", true)
      .order("nombre"),
    supabase.from("accesos_por_puesto").select("*"),
  ]);

  const puestos = (datosPuestos ?? []) as Puesto[];
  const porPuesto = new Map(
    ((datosAccesos ?? []) as FilaAccesos[]).map((fila) => [fila.puesto_id, fila]),
  );

  const validados = puestos.filter((puesto) => porPuesto.get(puesto.id)?.estado === "validada");
  const propuestos = puestos.filter((puesto) => porPuesto.get(puesto.id)?.estado === "propuesta");
  const sinDefinir = puestos.filter((puesto) => !porPuesto.has(puesto.id));
  const conDatosDelPersonal = puestos.filter((puesto) => {
    const fila = porPuesto.get(puesto.id);
    return fila ? COLUMNAS_SENSIBLES.some((columna) => fila[columna] !== "sin_acceso") : false;
  });

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Accesos por puesto"
        descripcion={
          "Qué recibe cada puesto en Google Workspace, la Intranet y cada módulo de Odoo, " +
          "según el principio de mínimo privilegio del MP-SOP-07 (actividad 2). Cada fila " +
          "nace como propuesta y la valida el jefe del área."
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador titulo="Puestos" valor={puestos.length} contexto="Del Perfil de Resultados" />
        <TarjetaIndicador
          titulo="Validados"
          valor={validados.length}
          tono={validados.length === puestos.length && puestos.length > 0 ? "exito" : "neutro"}
          contexto="Confirmados por el jefe de área"
        />
        <TarjetaIndicador
          titulo="En propuesta"
          valor={propuestos.length}
          tono={propuestos.length > 0 ? "advertencia" : "neutro"}
          contexto={sinDefinir.length > 0 ? `${sinDefinir.length} sin definir` : "Falta validarlos"}
        />
        <TarjetaIndicador
          titulo="Ven sueldos o legajos"
          valor={conDatosDelPersonal.length}
          tono="atencion"
          contexto="Puestos con Nómina o Empleados"
        />
      </div>

      <Tarjeta>
        <TarjetaContenido className="pt-4">
          {puestos.length === 0 ? (
            <EstadoVacio
              icono={<KeyRound className="size-6" aria-hidden />}
              titulo="No hay puestos cargados"
              descripcion="La matriz se arma sobre los puestos del Perfil de Resultados de Puesto."
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border border-borde">
                <table className="w-full min-w-[1100px] border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-borde bg-atenuado/50 text-left">
                      <th scope="col" className="sticky left-0 z-10 min-w-[220px] bg-atenuado px-3 py-2 font-semibold">
                        Puesto
                      </th>
                      <th scope="col" className="px-2 py-2 font-semibold">Workspace</th>
                      <th scope="col" className="px-2 py-2 font-semibold">Intranet</th>
                      <th scope="col" className="px-2 py-2 font-semibold">Odoo</th>
                      {MODULOS_ODOO.map((modulo) => (
                        <th
                          key={modulo.columna}
                          scope="col"
                          className={cn(
                            "px-1.5 py-2 text-center font-semibold",
                            COLUMNAS_SENSIBLES.includes(modulo.columna) ? "text-semaforo-alto" : "",
                          )}
                          title={modulo.ayuda}
                        >
                          {modulo.nombre}
                        </th>
                      ))}
                      <th scope="col" className="px-2 py-2 font-semibold">Estado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {puestos.map((puesto) => {
                      const fila = porPuesto.get(puesto.id);
                      return (
                        <tr key={puesto.id} className="border-b border-borde last:border-b-0">
                          <th scope="row" className="sticky left-0 z-10 bg-tarjeta px-3 py-2 text-left font-normal">
                            {puedeEditar ? (
                              <Link
                                href={`/informatica/accesos/${puesto.id}`}
                                className="font-medium hover:underline"
                              >
                                {puesto.nombre}
                              </Link>
                            ) : (
                              <span className="font-medium">{puesto.nombre}</span>
                            )}
                            <span className="mt-0.5 block text-[11px] text-atenuado-contraste">
                              {puesto.departamento ?? puesto.area ?? "Sin área"}
                            </span>
                          </th>
                          {fila ? (
                            <>
                              <td className="px-2 py-2">{fila.google_workspace ? "Sí" : "No"}</td>
                              <td className="whitespace-nowrap px-2 py-2">
                                {fila.intranet_rol ? ETIQUETAS_ROL[fila.intranet_rol] : "No"}
                              </td>
                              <td className="whitespace-nowrap px-2 py-2">
                                {fila.odoo_empresas ? ETIQUETAS_EMPRESA_ODOO[fila.odoo_empresas] : "Sin usuario"}
                              </td>
                              {MODULOS_ODOO.map((modulo) => {
                                const nivel = fila[modulo.columna];
                                return (
                                  <td key={modulo.columna} className="px-1 py-1.5 text-center">
                                    <span
                                      title={`${modulo.nombre}: ${ETIQUETAS_NIVEL[nivel]}`}
                                      className={cn(
                                        "inline-block min-w-[3rem] rounded px-1 py-0.5",
                                        CLASE_NIVEL[nivel],
                                      )}
                                    >
                                      {ABREVIATURA_NIVEL[nivel]}
                                    </span>
                                  </td>
                                );
                              })}
                              <td className="px-2 py-2">
                                <Insignia variante={fila.estado === "validada" ? "exito" : "advertencia"}>
                                  {fila.estado === "validada" ? "Validada" : "Propuesta"}
                                </Insignia>
                              </td>
                            </>
                          ) : (
                            <td colSpan={MODULOS_ODOO.length + 4} className="px-2 py-2 text-atenuado-contraste">
                              Sin definir
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px] text-atenuado-contraste">
                {Object.entries(ABREVIATURA_NIVEL)
                  .filter(([nivel]) => nivel !== "sin_acceso")
                  .sort(([a], [b]) => PESO_NIVEL[a as NivelAcceso] - PESO_NIVEL[b as NivelAcceso])
                  .map(([nivel, abreviatura]) => `${abreviatura} ${ETIQUETAS_NIVEL[nivel as NivelAcceso]}`)
                  .join(" · ")}
                {" · — Sin acceso. "}Nómina y Empleados, en naranja, abren sueldos y legajos.
              </p>
            </>
          )}
        </TarjetaContenido>
      </Tarjeta>
    </div>
  );
}
