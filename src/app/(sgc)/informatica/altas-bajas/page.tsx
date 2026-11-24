import type { Metadata } from "next";
import Link from "next/link";
import { Plus, UserPlus } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { NombreDeEmpresa } from "@/components/comunes/marca-empresa";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta, TarjetaContenido } from "@/components/ui/tarjeta";
import { obtenerPermisos, requerirModulo } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha, hoyEnAsuncion } from "@/lib/formato";
import { nombrePorEmpresa, type EmpresaDelGrupo } from "@/lib/empresas";
import { sinTildes } from "@/lib/utilidades";
import {
  ETIQUETAS_TIPO_MOVIMIENTO,
  TIPOS_MOVIMIENTO,
  esTipoMovimiento,
  pendientes,
} from "@/lib/altas-bajas-ti";

export const metadata: Metadata = { title: "Altas y bajas de accesos" };
export const dynamic = "force-dynamic";

interface FilaMovimiento {
  id: string;
  tipo: string;
  persona_nombre: string;
  empresa_de_la_persona_id: string | null;
  fecha_efectiva: string;
  ticket: string | null;
  puesto: { nombre: string } | null;
  pasos: { estado: string }[];
}

/**
 * Altas y bajas de accesos: cada persona que entra o sale, con lo que TI
 * tiene que hacer en cada sistema.
 *
 * La matriz de accesos por puesto dice qué corresponde; esto registra qué
 * se hizo con cada persona. Juntas son la evidencia que pidió la
 * NC-2026-019: que los accesos se dan y se quitan contra una regla, y
 * que queda constancia.
 */
export default async function PaginaAltasYBajas({
  searchParams,
}: {
  searchParams: { q?: string; tipo?: string; situacion?: string };
}) {
  await requerirModulo("informatica");
  const permisos = await obtenerPermisos();
  const puedeEditar = permisos.informatica.editar;
  const supabase = crearClienteServidor();

  const [{ data }, { data: datosEmpresas }] = await Promise.all([
    supabase
      .from("movimientos_accesos_ti")
      .select(
        "id, tipo, persona_nombre, empresa_de_la_persona_id, fecha_efectiva, ticket, " +
          "puesto:puesto_id (nombre), pasos:movimiento_accesos_pasos (estado)",
      )
      .order("fecha_efectiva", { ascending: false })
      .order("creado_en", { ascending: false }),
    supabase.rpc("empresas_del_grupo"),
  ]);

  const listaEmpresas = (datosEmpresas as EmpresaDelGrupo[] | null) ?? [];
  const empresas = nombrePorEmpresa(listaEmpresas);
  const movimientos = ((data ?? []) as unknown as FilaMovimiento[]).map((movimiento) => ({
    ...movimiento,
    faltan: pendientes(movimiento.pasos),
  }));

  const enCurso = movimientos.filter((movimiento) => movimiento.faltan > 0);
  const pasosPendientes = enCurso.reduce((suma, movimiento) => suma + movimiento.faltan, 0);
  const mes = hoyEnAsuncion().slice(0, 7);
  const completosDelMes = movimientos.filter(
    (movimiento) => movimiento.faltan === 0 && movimiento.fecha_efectiva.startsWith(mes),
  ).length;

  const partes = sinTildes(searchParams.q ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const filtrados = movimientos.filter((movimiento) => {
    if (searchParams.tipo && movimiento.tipo !== searchParams.tipo) return false;
    if (searchParams.situacion === "en_curso" && movimiento.faltan === 0) return false;
    if (searchParams.situacion === "completos" && movimiento.faltan > 0) return false;
    if (partes.length > 0) {
      const texto = sinTildes(
        `${movimiento.persona_nombre} ${movimiento.puesto?.nombre ?? ""} ${movimiento.ticket ?? ""}`,
      );
      if (!partes.every((parte) => texto.includes(parte))) return false;
    }
    return true;
  });

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Altas y bajas de accesos"
        descripcion={
          "Cada persona que entra o sale, con lo que hay que hacer en cada sistema según la matriz " +
          "de accesos de su puesto, y quién lo hizo."
        }
        acciones={
          puedeEditar ? (
            <Boton comoHijo tamano="pequeno">
              <Link href="/informatica/altas-bajas/nuevo">
                <Plus aria-hidden />
                Registrar alta o baja
              </Link>
            </Boton>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          titulo="En curso"
          valor={enCurso.length}
          tono={enCurso.length > 0 ? "advertencia" : "neutro"}
          contexto="Con algún paso pendiente"
          enlace={enCurso.length > 0 ? "/informatica/altas-bajas?situacion=en_curso" : undefined}
        />
        <TarjetaIndicador
          titulo="Pasos pendientes"
          valor={pasosPendientes}
          tono={pasosPendientes > 0 ? "advertencia" : "neutro"}
          contexto="Entre todos los registros"
        />
        <TarjetaIndicador
          titulo="Completos este mes"
          valor={completosDelMes}
          tono={completosDelMes > 0 ? "exito" : "neutro"}
          contexto="Todos los pasos resueltos"
        />
        <TarjetaIndicador
          titulo="Registros"
          valor={movimientos.length}
          contexto={`${movimientos.filter((m) => m.tipo === "alta").length} ingresos · ${
            movimientos.filter((m) => m.tipo === "baja").length
          } salidas`}
        />
      </div>

      <FiltrosListado
        marcadorBusqueda="Buscar por persona, puesto o ticket…"
        campos={[
          {
            nombre: "tipo",
            etiqueta: "Tipo",
            opciones: TIPOS_MOVIMIENTO.map((tipo) => ({
              valor: tipo,
              etiqueta: ETIQUETAS_TIPO_MOVIMIENTO[tipo],
            })),
          },
          {
            nombre: "situacion",
            etiqueta: "Situación",
            opciones: [
              { valor: "en_curso", etiqueta: "En curso" },
              { valor: "completos", etiqueta: "Completos" },
            ],
          },
        ]}
      />

      <Tarjeta>
        <TarjetaContenido className="pt-4">
          {filtrados.length === 0 ? (
            <EstadoVacio
              icono={<UserPlus className="size-6" aria-hidden />}
              titulo={movimientos.length === 0 ? "Todavía no hay altas ni bajas" : "Nada coincide"}
              descripcion={
                movimientos.length === 0
                  ? "Registre cada ingreso y cada salida para dejar constancia de los accesos."
                  : "Pruebe con otros filtros o límpielos para ver todo."
              }
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border border-borde">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-borde bg-atenuado/50 text-left">
                      <th scope="col" className="whitespace-nowrap px-3 py-2 font-semibold">
                        Fecha
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Persona
                      </th>
                      <th scope="col" className="hidden px-3 py-2 font-semibold md:table-cell">
                        Tipo
                      </th>
                      <th scope="col" className="hidden px-3 py-2 font-semibold lg:table-cell">
                        Empresa
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Situación
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((movimiento) => (
                      <tr key={movimiento.id} className="border-b border-borde last:border-b-0">
                        <td className="tabular whitespace-nowrap px-3 py-2 align-top text-atenuado-contraste">
                          {formatearFecha(movimiento.fecha_efectiva)}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Link
                            href={`/informatica/altas-bajas/${movimiento.id}`}
                            className="font-medium hover:underline"
                          >
                            {movimiento.persona_nombre}
                          </Link>
                          <span className="mt-0.5 block text-[11px] text-atenuado-contraste">
                            <span className="md:hidden">
                              {esTipoMovimiento(movimiento.tipo)
                                ? ETIQUETAS_TIPO_MOVIMIENTO[movimiento.tipo]
                                : movimiento.tipo}{" "}
                              ·{" "}
                            </span>
                            {movimiento.puesto?.nombre ?? "Sin puesto definido"}
                            {movimiento.ticket ? ` · ${movimiento.ticket}` : ""}
                          </span>
                        </td>
                        <td className="hidden px-3 py-2 align-top md:table-cell">
                          <Insignia variante={movimiento.tipo === "baja" ? "neutra" : "primaria"}>
                            {esTipoMovimiento(movimiento.tipo)
                              ? ETIQUETAS_TIPO_MOVIMIENTO[movimiento.tipo]
                              : movimiento.tipo}
                          </Insignia>
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-2 align-top lg:table-cell">
                          <NombreDeEmpresa
                            nombre={
                              movimiento.empresa_de_la_persona_id
                                ? (empresas.get(movimiento.empresa_de_la_persona_id) ?? null)
                                : null
                            }
                            vacio="—"
                          />
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 align-top">
                          <Insignia variante={movimiento.faltan === 0 ? "exito" : "advertencia"}>
                            {movimiento.faltan === 0
                              ? "Completo"
                              : `${movimiento.faltan} ${movimiento.faltan === 1 ? "pendiente" : "pendientes"}`}
                          </Insignia>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px] text-atenuado-contraste">
                {filtrados.length === movimientos.length
                  ? `${movimientos.length} ${movimientos.length === 1 ? "registro" : "registros"}`
                  : `${filtrados.length} de ${movimientos.length} registros`}
              </p>
            </>
          )}
        </TarjetaContenido>
      </Tarjeta>
    </div>
  );
}
