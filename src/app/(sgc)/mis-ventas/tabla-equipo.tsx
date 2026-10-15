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
import { formatearGuaranies } from "@/lib/formato";
import { sinTildes } from "@/lib/utilidades";
import {
  alcance,
  CLASES_NIVEL_ALCANCE,
  ETIQUETAS_NIVEL_ALCANCE,
  esperadoAHoy,
  nivelDeAlcance,
  type VentaDelMes,
} from "@/lib/ventas";

/** Por qué se ordena la tabla del equipo. */
export const ORDENES_EQUIPO = {
  alcance: "Alcance",
  vendido: "Vendido",
  objetivo: "Objetivo",
  vendedor: "Vendedor (A-Z)",
} as const;

export type OrdenEquipo = keyof typeof ORDENES_EQUIPO;

export function esOrdenDeEquipo(valor: string): valor is OrdenEquipo {
  return valor in ORDENES_EQUIPO;
}

/**
 * Como va el equipo, para quien tiene canales asignados.
 *
 * SE ORDENA POR ALCANCE Y NO POR MONTO por omisión, y a propósito: quien
 * mira esto lo mira para saber a quién hay que ayudar, y el que está más
 * lejos de su meta puede ser el que más factura. Pedir otro orden es una
 * decisión explícita, no lo que la pantalla hace sola.
 *
 * Quien no tiene objetivo cargado va al final y sin porcentaje, no con un
 * cero: son cosas distintas y mezclarlas haría que alguien le reclame a
 * quien no tiene meta. Por la misma razón queda último también cuando se
 * ordena por objetivo.
 *
 * EL TOTAL ES DE LO QUE SE ESTÁ VIENDO, no del equipo entero: una suma
 * que no corresponde a las filas de arriba es peor que no poner suma. El
 * pie dice sobre cuántos está calculada.
 */
export function TablaEquipo({
  filas,
  diasMes,
  diasTranscurridos,
  busqueda = "",
  canal = "",
  orden = "alcance",
}: {
  filas: VentaDelMes[];
  diasMes: number;
  diasTranscurridos: number;
  /** Texto del buscador: se compara sin tildes y por partes. */
  busqueda?: string;
  canal?: string;
  orden?: OrdenEquipo;
}) {
  const partes = sinTildes(busqueda).split(/\s+/).filter(Boolean);

  const filtradas = filas.filter((fila) => {
    if (canal && fila.canal !== canal) return false;
    if (partes.length === 0) return true;
    const texto = sinTildes(fila.vendedor);
    return partes.every((parte) => texto.includes(parte));
  });

  // Quien no tiene el dato cargado va al final en todos los órdenes: un
  // nulo no es un cero, y ponerlo entre los ceros lo haría parecer uno.
  function porNumero(a: number | null, b: number | null) {
    if (a === null && b === null) return 0;
    if (a === null) return 1;
    if (b === null) return -1;
    return b - a;
  }

  const ordenadas = [...filtradas].sort((a, b) => {
    if (orden === "vendedor") return a.vendedor.localeCompare(b.vendedor, "es");
    if (orden === "vendido") {
      return porNumero(a.venta, b.venta) || a.vendedor.localeCompare(b.vendedor, "es");
    }
    if (orden === "objetivo") {
      return porNumero(a.meta, b.meta) || a.vendedor.localeCompare(b.vendedor, "es");
    }
    return (
      porNumero(alcance(a.meta, a.venta), alcance(b.meta, b.venta)) ||
      a.vendedor.localeCompare(b.vendedor, "es")
    );
  });

  const totalVenta = filtradas.reduce((suma, f) => suma + (f.venta ?? 0), 0);
  const totalMeta = filtradas.reduce((suma, f) => suma + (f.meta ?? 0), 0);
  const totalAlcance = alcance(totalMeta || null, totalVenta);
  const acotada = filtradas.length !== filas.length;

  if (filtradas.length === 0) {
    return (
      <Tarjeta className="p-6 text-center text-xs text-atenuado-contraste">
        Ningún vendedor de los {filas.length} coincide con lo que buscó.
      </Tarjeta>
    );
  }

  return (
    <Tarjeta>
      <Tabla>
        <TablaCabecera>
          <TablaFila>
            <TablaEncabezado>Vendedor</TablaEncabezado>
            <TablaEncabezado>Canal</TablaEncabezado>
            <TablaEncabezado className="text-right">Objetivo</TablaEncabezado>
            <TablaEncabezado className="text-right">Vendido</TablaEncabezado>
            <TablaEncabezado className="text-right">Debería llevar</TablaEncabezado>
            <TablaEncabezado className="text-right">Alcance</TablaEncabezado>
            <TablaEncabezado>Estado</TablaEncabezado>
          </TablaFila>
        </TablaCabecera>
        <TablaCuerpo>
          {ordenadas.map((fila) => {
            const porcentaje = alcance(fila.meta, fila.venta);
            const nivel = nivelDeAlcance(porcentaje);
            const esperado = esperadoAHoy(fila.meta, diasMes, diasTranscurridos);
            return (
              <TablaFila key={`${fila.vendedor}-${fila.canal}`}>
                <TablaCelda className="text-xs font-medium">{fila.vendedor}</TablaCelda>
                <TablaCelda className="whitespace-nowrap text-xs text-atenuado-contraste">
                  {fila.canal}
                </TablaCelda>
                <TablaCelda className="whitespace-nowrap text-right text-xs tabular">
                  {fila.meta === null ? "—" : formatearGuaranies(fila.meta)}
                </TablaCelda>
                <TablaCelda className="whitespace-nowrap text-right text-xs tabular">
                  {fila.venta === null ? "—" : formatearGuaranies(fila.venta)}
                </TablaCelda>
                <TablaCelda className="whitespace-nowrap text-right text-xs tabular text-atenuado-contraste">
                  {esperado === null ? "—" : formatearGuaranies(esperado)}
                </TablaCelda>
                <TablaCelda
                  className={`whitespace-nowrap text-right text-xs font-semibold tabular ${CLASES_NIVEL_ALCANCE[nivel]}`}
                >
                  {porcentaje === null ? "—" : `${Math.round(porcentaje)}%`}
                </TablaCelda>
                <TablaCelda>
                  <Insignia variante="contorno">{ETIQUETAS_NIVEL_ALCANCE[nivel]}</Insignia>
                </TablaCelda>
              </TablaFila>
            );
          })}

          <TablaFila>
            <TablaCelda className="text-xs font-semibold">Total</TablaCelda>
            <TablaCelda />
            <TablaCelda className="whitespace-nowrap text-right text-xs font-semibold tabular">
              {totalMeta === 0 ? "—" : formatearGuaranies(totalMeta)}
            </TablaCelda>
            <TablaCelda className="whitespace-nowrap text-right text-xs font-semibold tabular">
              {formatearGuaranies(totalVenta)}
            </TablaCelda>
            <TablaCelda />
            <TablaCelda className="whitespace-nowrap text-right text-xs font-semibold tabular">
              {totalAlcance === null ? "—" : `${Math.round(totalAlcance)}%`}
            </TablaCelda>
            <TablaCelda />
          </TablaFila>
        </TablaCuerpo>
      </Tabla>

      {/* Sobre cuántos está hecha la suma de arriba. Sin esto, un total
          de tres vendedores filtrados se lee como el del equipo. */}
      <p className="border-t border-borde px-3 py-2 text-xs text-atenuado-contraste">
        {acotada
          ? `${filtradas.length} de ${filas.length} vendedores · ordenados por ${ORDENES_EQUIPO[orden].toLowerCase()}`
          : `${filas.length} vendedores · ordenados por ${ORDENES_EQUIPO[orden].toLowerCase()}`}
      </p>
    </Tarjeta>
  );
}
