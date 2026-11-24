import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Plus, Wallet } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { FiltrosListado } from "@/components/comunes/filtros-listado";
import { NombreDeEmpresa } from "@/components/comunes/marca-empresa";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import { obtenerPermisos, requerirModulo } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { formatearFecha, formatearGuaranies, hoyEnAsuncion } from "@/lib/formato";
import { nombrePorEmpresa, type EmpresaDelGrupo } from "@/lib/empresas";
import { sinTildes } from "@/lib/utilidades";
import {
  CATEGORIAS_GASTO,
  CATEGORIAS_LICENCIA,
  ETIQUETAS_CATEGORIA_GASTO,
  costoMensual,
  esCategoriaGasto,
  formatearMonto,
} from "@/lib/gastos-ti";

export const metadata: Metadata = { title: "Gastos de TI" };
export const dynamic = "force-dynamic";

interface FilaGasto {
  id: string;
  fecha: string;
  proveedor: string;
  concepto: string;
  categoria: string;
  monto: number;
  moneda: string;
  empresa_imputada_id: string | null;
  comprobante: string | null;
}

const COMPARTIDO = "compartido";

/**
 * Gastos del área de TI: cada factura o pago, en su moneda y con la
 * empresa del grupo a la que se imputa.
 *
 * LAS MONEDAS NO SE SUMAN ENTRE SÍ. Convertir dólares a guaraníes pide un
 * tipo de cambio de una fecha, y elegir uno acá sería inventar el número
 * que después alguien va a comparar con la contabilidad. Cada total va en
 * su moneda.
 *
 * Lo ven quien edita Informática y Dirección: es un dato económico.
 */
export default async function PaginaGastosTi({
  searchParams,
}: {
  searchParams: { q?: string; categoria?: string; moneda?: string; empresa?: string; anio?: string };
}) {
  const usuario = await requerirModulo("informatica");
  const permisos = await obtenerPermisos();
  const puedeEditar = permisos.informatica.editar;
  if (!puedeEditar && usuario.rol !== "direccion") redirect("/sin-acceso?motivo=permisos");

  const supabase = crearClienteServidor();
  const [{ data: datosGastos }, { data: datosEmpresas }, { data: datosLicencias }] =
    await Promise.all([
      supabase
        .from("gastos_ti")
        .select(
          "id, fecha, proveedor, concepto, categoria, monto, moneda, empresa_imputada_id, comprobante",
        )
        .order("fecha", { ascending: false })
        .order("creado_en", { ascending: false }),
      supabase.rpc("empresas_del_grupo"),
      supabase
        .from("activos")
        .select("costo_ciclo, moneda_costo, ciclo_meses")
        .in("categoria", [...CATEGORIAS_LICENCIA])
        .neq("estado", "dado_de_baja")
        .not("costo_ciclo", "is", null),
    ]);

  const gastos = ((datosGastos ?? []) as FilaGasto[]).map((gasto) => ({
    ...gasto,
    monto: Number(gasto.monto),
  }));
  const listaEmpresas = (datosEmpresas as EmpresaDelGrupo[] | null) ?? [];
  const empresas = nombrePorEmpresa(listaEmpresas);

  const hoy = hoyEnAsuncion();
  const anioActual = hoy.slice(0, 4);
  const anioElegido = searchParams.anio ?? "";
  const anios = Array.from(new Set([anioActual, ...gastos.map((gasto) => gasto.fecha.slice(0, 4))]))
    .sort()
    .reverse();

  const partes = sinTildes(searchParams.q ?? "")
    .split(/\s+/)
    .filter(Boolean);
  const filtrados = gastos.filter((gasto) => {
    if (anioElegido && !gasto.fecha.startsWith(anioElegido)) return false;
    if (searchParams.categoria && gasto.categoria !== searchParams.categoria) return false;
    if (searchParams.moneda && gasto.moneda !== searchParams.moneda) return false;
    if (searchParams.empresa) {
      const esperada = searchParams.empresa === COMPARTIDO ? null : searchParams.empresa;
      if (gasto.empresa_imputada_id !== esperada) return false;
    }
    if (partes.length > 0) {
      const texto = sinTildes(`${gasto.proveedor} ${gasto.concepto} ${gasto.comprobante ?? ""}`);
      if (!partes.every((parte) => texto.includes(parte))) return false;
    }
    return true;
  });

  const suma = (lista: typeof gastos, moneda: string) =>
    lista.filter((gasto) => gasto.moneda === moneda).reduce((total, gasto) => total + gasto.monto, 0);

  const delAnio = gastos.filter((gasto) => gasto.fecha.startsWith(anioActual));
  const delMes = gastos.filter((gasto) => gasto.fecha.startsWith(hoy.slice(0, 7)));

  // El compromiso fijo sale de las licencias: lo que se paga todos los
  // meses aunque no se cargue ninguna factura.
  const licencias = (datosLicencias ?? []) as {
    costo_ciclo: number;
    moneda_costo: string;
    ciclo_meses: number | null;
  }[];
  const fijoUsd = licencias
    .filter((licencia) => licencia.moneda_costo === "USD")
    .reduce((total, l) => total + (costoMensual(Number(l.costo_ciclo), l.ciclo_meses) ?? 0), 0);
  const fijoGs = licencias
    .filter((licencia) => licencia.moneda_costo === "PYG")
    .reduce((total, l) => total + (costoMensual(Number(l.costo_ciclo), l.ciclo_meses) ?? 0), 0);

  const porCategoria = CATEGORIAS_GASTO.map((categoria) => {
    const deCategoria = filtrados.filter((gasto) => gasto.categoria === categoria);
    return {
      categoria,
      cantidad: deCategoria.length,
      usd: suma(deCategoria, "USD"),
      gs: suma(deCategoria, "PYG"),
    };
  }).filter((fila) => fila.cantidad > 0);

  const monto = (valor: number, moneda: string) => formatearMonto(valor, moneda, formatearGuaranies);

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Gastos de TI"
        descripcion={
          "Facturas y pagos del área de TI, en su moneda y con la empresa a la que se imputan. " +
          "El costo fijo de las licencias sale de Licencias y vencimientos."
        }
        acciones={
          puedeEditar ? (
            <Boton comoHijo tamano="pequeno">
              <Link href="/informatica/gastos/nuevo">
                <Plus aria-hidden />
                Registrar gasto
              </Link>
            </Boton>
          ) : null
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          titulo={`En ${anioActual} · USD`}
          valor={monto(suma(delAnio, "USD"), "USD")}
          contexto={`${delAnio.filter((gasto) => gasto.moneda === "USD").length} registros`}
        />
        <TarjetaIndicador
          titulo={`En ${anioActual} · Gs.`}
          valor={monto(suma(delAnio, "PYG"), "PYG")}
          contexto={`${delAnio.filter((gasto) => gasto.moneda === "PYG").length} registros`}
        />
        <TarjetaIndicador
          titulo="Este mes"
          valor={delMes.length}
          contexto={
            delMes.length > 0
              ? [suma(delMes, "USD") > 0 ? monto(suma(delMes, "USD"), "USD") : null,
                 suma(delMes, "PYG") > 0 ? monto(suma(delMes, "PYG"), "PYG") : null]
                  .filter(Boolean)
                  .join(" · ")
              : "Sin gastos registrados"
          }
        />
        <TarjetaIndicador
          titulo="Licencias por mes"
          valor={monto(fijoUsd, "USD")}
          contexto={fijoGs > 0 ? `Más ${monto(Math.round(fijoGs), "PYG")}` : "Costo fijo"}
          enlace="/informatica/licencias"
        />
      </div>

      <FiltrosListado
        marcadorBusqueda="Buscar por proveedor, concepto o comprobante…"
        campos={[
          {
            nombre: "anio",
            etiqueta: "Año",
            opciones: anios.map((anio) => ({ valor: anio, etiqueta: anio })),
          },
          {
            nombre: "categoria",
            etiqueta: "Categoría",
            opciones: CATEGORIAS_GASTO.map((categoria) => ({
              valor: categoria,
              etiqueta: ETIQUETAS_CATEGORIA_GASTO[categoria],
            })),
          },
          {
            nombre: "moneda",
            etiqueta: "Moneda",
            opciones: [
              { valor: "USD", etiqueta: "Dólares" },
              { valor: "PYG", etiqueta: "Guaraníes" },
            ],
          },
          {
            nombre: "empresa",
            etiqueta: "Se imputa a",
            opciones: [
              ...listaEmpresas.map((empresa) => ({ valor: empresa.id, etiqueta: empresa.nombre })),
              { valor: COMPARTIDO, etiqueta: "Compartido" },
            ],
          },
        ]}
      />

      {porCategoria.length > 0 ? (
        <Tarjeta>
          <TarjetaCabecera>
            <TarjetaTitulo>Por categoría</TarjetaTitulo>
          </TarjetaCabecera>
          <TarjetaContenido>
            <div className="overflow-x-auto rounded-md border border-borde">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-borde bg-atenuado/50 text-left">
                    <th scope="col" className="px-3 py-2 font-semibold">
                      Categoría
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Registros
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      USD
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-semibold">
                      Guaraníes
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {porCategoria.map((fila) => (
                    <tr key={fila.categoria} className="border-b border-borde last:border-b-0">
                      <td className="px-3 py-1.5">{ETIQUETAS_CATEGORIA_GASTO[fila.categoria]}</td>
                      <td className="tabular px-3 py-1.5 text-right">{fila.cantidad}</td>
                      <td className="tabular whitespace-nowrap px-3 py-1.5 text-right">
                        {fila.usd > 0 ? monto(fila.usd, "USD") : "—"}
                      </td>
                      <td className="tabular whitespace-nowrap px-3 py-1.5 text-right">
                        {fila.gs > 0 ? monto(fila.gs, "PYG") : "—"}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-atenuado/30 font-semibold">
                    <td className="px-3 py-1.5">Total de lo filtrado</td>
                    <td className="tabular px-3 py-1.5 text-right">{filtrados.length}</td>
                    <td className="tabular whitespace-nowrap px-3 py-1.5 text-right">
                      {monto(suma(filtrados, "USD"), "USD")}
                    </td>
                    <td className="tabular whitespace-nowrap px-3 py-1.5 text-right">
                      {monto(suma(filtrados, "PYG"), "PYG")}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </TarjetaContenido>
        </Tarjeta>
      ) : null}

      <Tarjeta>
        <TarjetaContenido className="pt-4">
          {filtrados.length === 0 ? (
            <EstadoVacio
              icono={<Wallet className="size-6" aria-hidden />}
              titulo={gastos.length === 0 ? "Todavía no hay gastos registrados" : "Nada coincide"}
              descripcion={
                gastos.length === 0
                  ? "Registre cada factura o pago del área para tener el gasto a la vista."
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
                        Gasto
                      </th>
                      <th scope="col" className="hidden px-3 py-2 font-semibold md:table-cell">
                        Categoría
                      </th>
                      <th scope="col" className="hidden px-3 py-2 font-semibold lg:table-cell">
                        Se imputa a
                      </th>
                      <th scope="col" className="px-3 py-2 text-right font-semibold">
                        Monto
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtrados.map((gasto) => (
                      <tr key={gasto.id} className="border-b border-borde last:border-b-0">
                        <td className="tabular whitespace-nowrap px-3 py-2 align-top text-atenuado-contraste">
                          {formatearFecha(gasto.fecha)}
                        </td>
                        <td className="px-3 py-2 align-top">
                          {puedeEditar ? (
                            <Link
                              href={`/informatica/gastos/${gasto.id}`}
                              className="font-medium hover:underline"
                            >
                              {gasto.concepto}
                            </Link>
                          ) : (
                            <span className="font-medium">{gasto.concepto}</span>
                          )}
                          <span className="mt-0.5 block text-[11px] text-atenuado-contraste">
                            {gasto.proveedor}
                            {gasto.comprobante ? ` · ${gasto.comprobante}` : ""}
                          </span>
                        </td>
                        <td className="hidden px-3 py-2 align-top md:table-cell">
                          {esCategoriaGasto(gasto.categoria)
                            ? ETIQUETAS_CATEGORIA_GASTO[gasto.categoria]
                            : gasto.categoria}
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-2 align-top lg:table-cell">
                          <NombreDeEmpresa
                            nombre={
                              gasto.empresa_imputada_id
                                ? (empresas.get(gasto.empresa_imputada_id) ?? null)
                                : null
                            }
                            vacio="Compartido"
                          />
                        </td>
                        <td className="tabular whitespace-nowrap px-3 py-2 text-right align-top font-medium">
                          {monto(gasto.monto, gasto.moneda)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px] text-atenuado-contraste">
                {filtrados.length === gastos.length
                  ? `${gastos.length} ${gastos.length === 1 ? "gasto" : "gastos"}`
                  : `${filtrados.length} de ${gastos.length} gastos`}
                . Los dólares y los guaraníes se suman por separado.
              </p>
            </>
          )}
        </TarjetaContenido>
      </Tarjeta>
    </div>
  );
}
