import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, Plus } from "lucide-react";
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
  ETIQUETAS_SISTEMA_AVANCE,
  ETIQUETAS_TIPO_AVANCE,
  SISTEMAS_AVANCE,
  TIPOS_AVANCE,
  VARIANTE_TIPO_AVANCE,
  esSistemaAvance,
  esTipoAvance,
} from "@/lib/avances-ti";

export const metadata: Metadata = { title: "Avances y cambios de TI" };
export const dynamic = "force-dynamic";

interface FilaAvance {
  id: string;
  fecha: string;
  titulo: string;
  tipo: string;
  sistema: string;
  empresa_afectada_id: string | null;
  ticket: string | null;
  descripcion: string;
}

/** El valor del filtro «Empresa» que trae lo que vale para las dos. */
const EMPRESA_GRUPO = "grupo";

/**
 * Registro de los avances y cambios del área de TI.
 *
 * ES LO QUE QUEDÓ HECHO, no lo que se pidió: el pedido y su seguimiento
 * viven en la ticketera, y cada registro dice de qué ticket salió. Acá
 * Dirección y la auditoría ven qué cambió en los sistemas, en qué
 * empresa y cuándo, sin pedirle a nadie que lo cuente.
 *
 * El filtrado corre en el servidor y no en la consulta porque la
 * búsqueda va sin tildes y por partes, que es justo lo que `ilike` no
 * hace. Son pocas filas por año: traerlas todas es barato.
 */
export default async function PaginaAvancesTi({
  searchParams,
}: {
  searchParams: { q?: string; tipo?: string; sistema?: string; empresa?: string; anio?: string };
}) {
  await requerirModulo("informatica");
  const permisos = await obtenerPermisos();
  const puedeEditar = permisos.informatica.editar;
  const supabase = crearClienteServidor();

  const [{ data: datosAvances }, { data: datosEmpresas }] = await Promise.all([
    supabase
      .from("avances_ti")
      .select("id, fecha, titulo, tipo, sistema, empresa_afectada_id, ticket, descripcion")
      .order("fecha", { ascending: false })
      .order("creado_en", { ascending: false }),
    supabase.rpc("empresas_del_grupo"),
  ]);

  const avances = (datosAvances ?? []) as FilaAvance[];
  const listaEmpresas = (datosEmpresas as EmpresaDelGrupo[] | null) ?? [];
  const empresas = nombrePorEmpresa(listaEmpresas);

  const hoy = hoyEnAsuncion();
  const anioActual = hoy.slice(0, 4);
  const mesActual = hoy.slice(0, 7);

  // Las tarjetas miran el año en curso y no lo filtrado: dicen cuánto se
  // hizo, y eso no cambia porque alguien acote la tabla.
  const delAnio = avances.filter((avance) => avance.fecha.startsWith(anioActual));
  const delMes = avances.filter((avance) => avance.fecha.startsWith(mesActual));
  const queSuman = delAnio.filter((avance) =>
    ["implementacion", "mejora"].includes(avance.tipo),
  ).length;
  const queArreglan = delAnio.filter((avance) =>
    ["correccion", "incidente"].includes(avance.tipo),
  ).length;

  const anios = Array.from(new Set(avances.map((avance) => avance.fecha.slice(0, 4))));

  const partes = sinTildes(searchParams.q ?? "")
    .split(/\s+/)
    .filter(Boolean);

  const filtrados = avances.filter((avance) => {
    if (searchParams.tipo && avance.tipo !== searchParams.tipo) return false;
    if (searchParams.sistema && avance.sistema !== searchParams.sistema) return false;
    if (searchParams.anio && !avance.fecha.startsWith(searchParams.anio)) return false;
    if (searchParams.empresa) {
      const esperada = searchParams.empresa === EMPRESA_GRUPO ? null : searchParams.empresa;
      if (avance.empresa_afectada_id !== esperada) return false;
    }
    if (partes.length > 0) {
      const texto = sinTildes(`${avance.titulo} ${avance.ticket ?? ""} ${avance.descripcion}`);
      if (!partes.every((parte) => texto.includes(parte))) return false;
    }
    return true;
  });

  function etiquetaTipo(tipo: string) {
    return esTipoAvance(tipo) ? ETIQUETAS_TIPO_AVANCE[tipo] : tipo;
  }
  function etiquetaSistema(sistema: string) {
    return esSistemaAvance(sistema) ? ETIQUETAS_SISTEMA_AVANCE[sistema] : sistema;
  }
  function nombreEmpresa(id: string | null) {
    return id ? (empresas.get(id) ?? null) : null;
  }

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Avances y cambios de TI"
        descripcion={
          "Lo que el área de TI dejó hecho en los sistemas: implementaciones, mejoras, " +
          "correcciones y ajustes, con su fecha, la empresa y el ticket del que salieron."
        }
        acciones={
          puedeEditar ? (
            <Boton comoHijo tamano="pequeno">
              <Link href="/informatica/avances/nuevo">
                <Plus aria-hidden />
                Registrar avance
              </Link>
            </Boton>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador titulo="Este mes" valor={delMes.length} contexto="Registros del mes" />
        <TarjetaIndicador
          titulo={`En ${anioActual}`}
          valor={delAnio.length}
          contexto="Registros del año"
        />
        <TarjetaIndicador
          titulo="Implementaciones y mejoras"
          valor={queSuman}
          tono={queSuman > 0 ? "exito" : "neutro"}
          contexto={`En ${anioActual}`}
        />
        <TarjetaIndicador
          titulo="Correcciones e incidentes"
          valor={queArreglan}
          tono={queArreglan > 0 ? "advertencia" : "neutro"}
          contexto={`En ${anioActual}`}
        />
      </div>

      <FiltrosListado
        marcadorBusqueda="Buscar por título, ticket o detalle…"
        campos={[
          {
            nombre: "tipo",
            etiqueta: "Tipo",
            opciones: TIPOS_AVANCE.map((tipo) => ({
              valor: tipo,
              etiqueta: ETIQUETAS_TIPO_AVANCE[tipo],
            })),
          },
          {
            nombre: "sistema",
            etiqueta: "Sistema",
            opciones: SISTEMAS_AVANCE.map((sistema) => ({
              valor: sistema,
              etiqueta: ETIQUETAS_SISTEMA_AVANCE[sistema],
            })),
          },
          {
            nombre: "empresa",
            etiqueta: "Empresa",
            opciones: [
              ...listaEmpresas.map((empresa) => ({ valor: empresa.id, etiqueta: empresa.nombre })),
              { valor: EMPRESA_GRUPO, etiqueta: "Las dos" },
            ],
          },
          {
            nombre: "anio",
            etiqueta: "Año",
            opciones: anios.map((anio) => ({ valor: anio, etiqueta: anio })),
          },
        ]}
      />

      <Tarjeta>
        <TarjetaContenido className="pt-4">
          {filtrados.length === 0 ? (
            <EstadoVacio
              icono={<ClipboardList className="size-6" aria-hidden />}
              titulo={avances.length === 0 ? "Todavía no hay avances registrados" : "Nada coincide"}
              descripcion={
                avances.length === 0
                  ? "Registre lo que se deja hecho en cada sistema para que quede a la vista."
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
                        Avance
                      </th>
                      <th scope="col" className="hidden px-3 py-2 font-semibold md:table-cell">
                        Tipo
                      </th>
                      <th scope="col" className="hidden px-3 py-2 font-semibold md:table-cell">
                        Sistema
                      </th>
                      <th scope="col" className="hidden px-3 py-2 font-semibold lg:table-cell">
                        Empresa
                      </th>
                      <th scope="col" className="hidden px-3 py-2 font-semibold lg:table-cell">
                        Ticket
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((avance) => (
                      <tr key={avance.id} className="border-b border-borde last:border-b-0">
                        <td className="tabular whitespace-nowrap px-3 py-2 align-top text-atenuado-contraste">
                          {formatearFecha(avance.fecha)}
                        </td>
                        <td className="px-3 py-2 align-top">
                          <Link
                            href={`/informatica/avances/${avance.id}`}
                            className="font-medium hover:underline"
                          >
                            {avance.titulo}
                          </Link>
                          {/* Lo que la pantalla chica esconde en columnas
                              reaparece acá: esconderlo del todo sería
                              perderlo, no ordenarlo. */}
                          <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-atenuado-contraste lg:hidden">
                            <span className="md:hidden">
                              {esTipoAvance(avance.tipo) ? (
                                <Insignia variante={VARIANTE_TIPO_AVANCE[avance.tipo]}>
                                  {etiquetaTipo(avance.tipo)}
                                </Insignia>
                              ) : (
                                avance.tipo
                              )}
                            </span>
                            <span className="md:hidden">{etiquetaSistema(avance.sistema)}</span>
                            <NombreDeEmpresa
                              nombre={nombreEmpresa(avance.empresa_afectada_id)}
                              vacio="Las dos"
                            />
                            {avance.ticket ? <span className="tabular">{avance.ticket}</span> : null}
                          </span>
                        </td>
                        <td className="hidden px-3 py-2 align-top md:table-cell">
                          {esTipoAvance(avance.tipo) ? (
                            <Insignia variante={VARIANTE_TIPO_AVANCE[avance.tipo]}>
                              {etiquetaTipo(avance.tipo)}
                            </Insignia>
                          ) : (
                            avance.tipo
                          )}
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-2 align-top md:table-cell">
                          {etiquetaSistema(avance.sistema)}
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-2 align-top lg:table-cell">
                          <NombreDeEmpresa
                            nombre={nombreEmpresa(avance.empresa_afectada_id)}
                            vacio="Las dos"
                          />
                        </td>
                        <td className="tabular hidden whitespace-nowrap px-3 py-2 align-top text-atenuado-contraste lg:table-cell">
                          {avance.ticket ?? "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px] text-atenuado-contraste">
                {filtrados.length === avances.length
                  ? `${avances.length} ${avances.length === 1 ? "registro" : "registros"}`
                  : `${filtrados.length} de ${avances.length} registros`}
              </p>
            </>
          )}
        </TarjetaContenido>
      </Tarjeta>
    </div>
  );
}
