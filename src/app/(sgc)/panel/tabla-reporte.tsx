import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Tarjeta, TarjetaCabecera, TarjetaTitulo } from "@/components/ui/tarjeta";
import { cn } from "@/lib/utilidades";
import type { Reporte } from "@/app/(sgc)/panel/reportes";

/**
 * Un corte de la reporteria, como tabla.
 *
 * Sin gráfico. Son repartos de un total sobre pocas categorías: una tabla
 * con el número, el porcentaje y una barra de proporción dice lo mismo que
 * una torta y además se puede leer, copiar y auditar. El color queda para
 * lo que exige atención —vencido, fuera de plazo, sin clasificar—; el
 * resto va en gris.
 *
 * Cada fila con enlace lleva al listado que devuelve exactamente esas
 * filas. Donde el listado no tiene ese filtro no se pone enlace: uno que
 * llevara a otro recuento sería peor que ninguno.
 */
export function TablaReporte({ reporte }: { reporte: Reporte }) {
  const mayor = Math.max(1, ...reporte.filas.map((fila) => fila.cantidad));

  return (
    <Tarjeta className="flex flex-col">
      <TarjetaCabecera className="flex-row items-start justify-between gap-3 pb-3">
        <div className="min-w-0">
          <TarjetaTitulo>{reporte.titulo}</TarjetaTitulo>
          <p className="mt-0.5 text-xs text-atenuado-contraste">{reporte.descripcion}</p>
        </div>
        <Link
          href={reporte.modulo}
          className="flex shrink-0 items-center gap-1 text-xs text-primario hover:underline"
        >
          Ver todo <ArrowRight className="size-3" />
        </Link>
      </TarjetaCabecera>

      <div className="desplazable-x w-full overflow-x-auto">
        <table className="w-full text-xs">
          <tbody>
            {reporte.filas.length === 0 ? (
              <tr>
                <td className="px-4 py-3 text-atenuado-contraste">
                  Sin registros cargados todavía.
                </td>
              </tr>
            ) : (
              reporte.filas.map((fila) => {
                const porcentaje =
                  reporte.total > 0 ? Math.round((fila.cantidad / reporte.total) * 100) : 0;

                return (
                  <tr
                    key={fila.etiqueta}
                    className="border-t border-borde transition-colors hover:bg-acento/60"
                  >
                    <td className="max-w-0 px-4 py-1.5">
                      {fila.enlace ? (
                        <Link
                          href={fila.enlace}
                          className={cn(
                            "block truncate hover:underline",
                            fila.alerta && "font-medium text-semaforo-critico",
                          )}
                        >
                          {fila.etiqueta}
                        </Link>
                      ) : (
                        <span
                          className={cn(
                            "block truncate",
                            fila.alerta && "font-medium text-semaforo-critico",
                          )}
                        >
                          {fila.etiqueta}
                        </span>
                      )}
                    </td>
                    <td className="w-24 py-1.5 pr-2">
                      {/* La barra es proporción, no gráfico: no lleva eje ni
                          rótulo propio porque el número está al lado. */}
                      <span
                        aria-hidden
                        className="block h-1.5 rounded-sm bg-acento"
                      >
                        <span
                          className={cn(
                            "block h-full rounded-sm",
                            fila.alerta ? "bg-semaforo-critico" : "bg-primario/60",
                          )}
                          style={{ width: `${Math.round((fila.cantidad / mayor) * 100)}%` }}
                        />
                      </span>
                    </td>
                    <td
                      className={cn(
                        "w-12 py-1.5 pr-2 text-right tabular-nums",
                        fila.alerta && "font-medium text-semaforo-critico",
                      )}
                    >
                      {fila.cantidad}
                    </td>
                    <td className="w-14 py-1.5 pr-4 text-right tabular-nums text-atenuado-contraste">
                      {porcentaje}%
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
          <tfoot>
            <tr className="border-t border-borde bg-acento/30">
              <td className="px-4 py-1.5 text-atenuado-contraste">Total</td>
              <td />
              <td className="py-1.5 pr-2 text-right font-medium tabular-nums">{reporte.total}</td>
              <td className="py-1.5 pr-4" />
            </tr>
          </tfoot>
        </table>
      </div>
    </Tarjeta>
  );
}
