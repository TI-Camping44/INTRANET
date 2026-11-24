import type { Metadata } from "next";
import Link from "next/link";
import { BadgeCheck } from "lucide-react";
import { EncabezadoPagina } from "@/components/comunes/encabezado-pagina";
import { TarjetaIndicador } from "@/components/comunes/tarjeta-indicador";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import { Tarjeta, TarjetaContenido } from "@/components/ui/tarjeta";
import { obtenerPermisos, requerirModulo } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { diasHasta, formatearFecha, formatearGuaranies } from "@/lib/formato";
import {
  CATEGORIAS_LICENCIA,
  DIAS_AVISO_VENCIMIENTO_LICENCIA,
  costoMensual,
  etiquetaCiclo,
  formatearMonto,
} from "@/lib/gastos-ti";

export const metadata: Metadata = { title: "Licencias y vencimientos" };
export const dynamic = "force-dynamic";

interface Licencia {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  marca: string | null;
  estado: string;
  vencimiento_garantia: string | null;
  cantidad_contratada: number | null;
  cantidad_en_uso: number | null;
  costo_ciclo: number | null;
  moneda_costo: string | null;
  ciclo_meses: number | null;
}

/**
 * Licencias, dominios y certificados: el control 3.3.
 *
 * NO TIENEN TABLA PROPIA: son los activos intangibles de Infraestructura
 * y activos, que ya tienen su vencimiento y la alerta a 30 días que pidió
 * la NC-2026-024. Esta pantalla los mira del lado de TI —cuántas hay,
 * cuántas se usan, cuánto cuestan por mes y cuándo vencen— y edita solo
 * esas cifras. El resto de la ficha sigue en Activos.
 */
export default async function PaginaLicencias() {
  await requerirModulo("informatica");
  const permisos = await obtenerPermisos();
  const puedeEditar = permisos.activos.editar;
  const supabase = crearClienteServidor();

  const { data } = await supabase
    .from("activos")
    .select(
      "id, codigo, nombre, categoria, marca, estado, vencimiento_garantia, cantidad_contratada, " +
        "cantidad_en_uso, costo_ciclo, moneda_costo, ciclo_meses",
    )
    .in("categoria", [...CATEGORIAS_LICENCIA])
    .neq("estado", "dado_de_baja")
    .order("categoria")
    .order("nombre");

  const licencias = ((data ?? []) as unknown as Licencia[]).map((licencia) => {
    const costo = licencia.costo_ciclo === null ? null : Number(licencia.costo_ciclo);
    return {
      ...licencia,
      mensual: costoMensual(costo, licencia.ciclo_meses),
      dias: diasHasta(licencia.vencimiento_garantia),
    };
  });

  const mensualUsd = licencias
    .filter((licencia) => licencia.moneda_costo === "USD")
    .reduce((suma, licencia) => suma + (licencia.mensual ?? 0), 0);
  const mensualGs = licencias
    .filter((licencia) => licencia.moneda_costo === "PYG")
    .reduce((suma, licencia) => suma + (licencia.mensual ?? 0), 0);
  const porVencer = licencias.filter(
    (licencia) =>
      licencia.dias !== null && licencia.dias >= 0 && licencia.dias <= DIAS_AVISO_VENCIMIENTO_LICENCIA,
  ).length;
  const vencidas = licencias.filter((licencia) => licencia.dias !== null && licencia.dias < 0).length;
  const libres = licencias.reduce(
    (suma, licencia) =>
      licencia.cantidad_contratada !== null && licencia.cantidad_en_uso !== null
        ? suma + (licencia.cantidad_contratada - licencia.cantidad_en_uso)
        : suma,
    0,
  );
  const sinCosto = licencias.filter((licencia) => licencia.costo_ciclo === null).length;

  function vencimiento(dias: number | null, fecha: string | null) {
    if (dias === null) return <span className="text-atenuado-contraste">Se renueva con cada pago</span>;
    const variante =
      dias < 0 ? "peligro" : dias <= DIAS_AVISO_VENCIMIENTO_LICENCIA ? "advertencia" : "neutra";
    const texto = dias < 0 ? `Venció hace ${-dias} d` : dias === 0 ? "Vence hoy" : `En ${dias} d`;
    return (
      <span className="flex flex-col gap-0.5">
        <span className="tabular">{formatearFecha(fecha)}</span>
        <Insignia variante={variante} className="w-fit">
          {texto}
        </Insignia>
      </span>
    );
  }

  return (
    <div className="space-y-5">
      <EncabezadoPagina
        titulo="Licencias y vencimientos"
        descripcion={
          "Licencias, dominios y certificados: cuántas hay, cuántas se usan, cuánto cuestan por mes " +
          "y cuándo vencen. Son los activos intangibles de Infraestructura y activos, vistos desde TI."
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <TarjetaIndicador
          titulo="Costo mensual"
          valor={formatearMonto(mensualUsd, "USD", formatearGuaranies)}
          contexto={
            mensualGs > 0
              ? `Más ${formatearGuaranies(Math.round(mensualGs))} en guaraníes`
              : "Equivalente mensual"
          }
        />
        <TarjetaIndicador
          titulo="Por vencer"
          valor={porVencer}
          tono={porVencer > 0 ? "advertencia" : "neutro"}
          contexto={`En los próximos ${DIAS_AVISO_VENCIMIENTO_LICENCIA} días`}
        />
        <TarjetaIndicador
          titulo="Vencidas"
          valor={vencidas}
          tono={vencidas > 0 ? "peligro" : "neutro"}
          contexto="Renovar o dar de baja"
        />
        <TarjetaIndicador
          titulo="Licencias libres"
          valor={libres}
          contexto={sinCosto > 0 ? `${sinCosto} sin costo cargado` : "Contratadas y sin asignar"}
        />
      </div>

      <Tarjeta>
        <TarjetaContenido className="pt-4">
          {licencias.length === 0 ? (
            <EstadoVacio
              icono={<BadgeCheck className="size-6" aria-hidden />}
              titulo="No hay licencias cargadas"
              descripcion="Las licencias, dominios y certificados se cargan como activos de esas categorías."
            />
          ) : (
            <>
              <div className="overflow-x-auto rounded-md border border-borde">
                <table className="w-full border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-borde bg-atenuado/50 text-left">
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Licencia
                      </th>
                      <th scope="col" className="hidden px-3 py-2 text-right font-semibold md:table-cell">
                        En uso / contratadas
                      </th>
                      <th scope="col" className="hidden px-3 py-2 font-semibold lg:table-cell">
                        Ciclo
                      </th>
                      <th scope="col" className="hidden whitespace-nowrap px-3 py-2 text-right font-semibold lg:table-cell">
                        Costo del ciclo
                      </th>
                      <th scope="col" className="whitespace-nowrap px-3 py-2 text-right font-semibold">
                        Por mes
                      </th>
                      <th scope="col" className="px-3 py-2 font-semibold">
                        Vencimiento
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {licencias.map((licencia) => (
                      <tr key={licencia.id} className="border-b border-borde last:border-b-0">
                        <td className="px-3 py-2 align-top">
                          {puedeEditar ? (
                            <Link
                              href={`/informatica/licencias/${licencia.id}`}
                              className="font-medium hover:underline"
                            >
                              {licencia.nombre}
                            </Link>
                          ) : (
                            <span className="font-medium">{licencia.nombre}</span>
                          )}
                          <span className="mt-0.5 block text-[11px] text-atenuado-contraste">
                            <span className="tabular">{licencia.codigo}</span> · {licencia.categoria}
                            {licencia.marca ? ` · ${licencia.marca}` : ""}
                          </span>
                          <span className="tabular mt-0.5 block text-[11px] text-atenuado-contraste md:hidden">
                            {licencia.cantidad_contratada !== null
                              ? `${licencia.cantidad_en_uso ?? "—"} de ${licencia.cantidad_contratada} en uso`
                              : null}
                          </span>
                        </td>
                        <td className="tabular hidden whitespace-nowrap px-3 py-2 text-right align-top md:table-cell">
                          {licencia.cantidad_contratada === null ? (
                            "—"
                          ) : (
                            <>
                              {licencia.cantidad_en_uso ?? "—"} / {licencia.cantidad_contratada}
                              {licencia.cantidad_en_uso !== null &&
                              licencia.cantidad_contratada - licencia.cantidad_en_uso > 0 ? (
                                <span className="block text-[11px] text-atenuado-contraste">
                                  {licencia.cantidad_contratada - licencia.cantidad_en_uso} libres
                                </span>
                              ) : null}
                            </>
                          )}
                        </td>
                        <td className="hidden whitespace-nowrap px-3 py-2 align-top lg:table-cell">
                          {etiquetaCiclo(licencia.ciclo_meses)}
                        </td>
                        <td className="tabular hidden whitespace-nowrap px-3 py-2 text-right align-top lg:table-cell">
                          {formatearMonto(licencia.costo_ciclo, licencia.moneda_costo, formatearGuaranies)}
                        </td>
                        <td className="tabular whitespace-nowrap px-3 py-2 text-right align-top font-medium">
                          {licencia.mensual === null
                            ? "—"
                            : formatearMonto(
                                licencia.moneda_costo === "PYG"
                                  ? Math.round(licencia.mensual)
                                  : licencia.mensual,
                                licencia.moneda_costo,
                                formatearGuaranies,
                              )}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 align-top">
                          {vencimiento(licencia.dias, licencia.vencimiento_garantia)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="mt-3 text-[11px] text-atenuado-contraste">
                {licencias.length} {licencias.length === 1 ? "intangible" : "intangibles"}. «—» es un
                dato que falta relevar, no un cero. El vencimiento se corrige en la ficha del activo.
              </p>
            </>
          )}
        </TarjetaContenido>
      </Tarjeta>
    </div>
  );
}
