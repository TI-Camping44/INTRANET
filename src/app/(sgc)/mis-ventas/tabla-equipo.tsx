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
import {
  alcance,
  CLASES_NIVEL_ALCANCE,
  ETIQUETAS_NIVEL_ALCANCE,
  esperadoAHoy,
  nivelDeAlcance,
  type VentaDelMes,
} from "@/lib/ventas";

/**
 * Como va el equipo, para quien tiene canales asignados.
 *
 * Se ordena por alcance y no por monto a proposito: quien mira esto lo
 * mira para saber a quien hay que ayudar, y el que esta mas lejos de su
 * meta puede ser el que mas factura.
 *
 * Quien no tiene objetivo cargado va al final y sin porcentaje, no con un
 * cero: son cosas distintas y mezclarlas haria que alguien le reclame a
 * quien no tiene meta.
 */
export function TablaEquipo({
  filas,
  diasMes,
  diasTranscurridos,
}: {
  filas: VentaDelMes[];
  diasMes: number;
  diasTranscurridos: number;
}) {
  const ordenadas = [...filas].sort((a, b) => {
    const alcanceA = alcance(a.meta, a.venta);
    const alcanceB = alcance(b.meta, b.venta);
    if (alcanceA === null && alcanceB === null) return a.vendedor.localeCompare(b.vendedor);
    if (alcanceA === null) return 1;
    if (alcanceB === null) return -1;
    return alcanceB - alcanceA;
  });

  const totalVenta = filas.reduce((suma, f) => suma + (f.venta ?? 0), 0);
  const totalMeta = filas.reduce((suma, f) => suma + (f.meta ?? 0), 0);
  const totalAlcance = alcance(totalMeta || null, totalVenta);

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
    </Tarjeta>
  );
}
