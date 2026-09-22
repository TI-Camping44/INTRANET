import Link from "next/link";
import { Tarjeta } from "@/components/ui/tarjeta";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { formatearNumero } from "@/lib/formato";
import { ETIQUETAS_FRECUENCIA, ETIQUETAS_SENTIDO } from "@/lib/constantes";
import {
  CLASES_SEMAFORO,
  ETIQUETAS_CONSOLIDACION,
  ETIQUETAS_NIVEL_OBJETIVO,
  ETIQUETAS_SEMAFORO,
  MESES_ABREVIADOS,
} from "@/lib/objetivos";
import { cn } from "@/lib/utilidades";
import type { Hoja } from "@/app/(sgc)/indicadores/hoja";

/**
 * El F-EST-01-05 tal como lo tiene Calidad.
 *
 * Treinta columnas. No se recorta ni se reordena a propósito: quien
 * abrió la hoja en el Drive durante dos años tiene que reconocerla, y
 * una columna que acá no está es una columna que se sigue llevando en
 * el Drive, que es lo que se quiere terminar.
 *
 * La tabla se desplaza en horizontal dentro de su propia caja; el cuerpo
 * de la página no. Las tres primeras columnas quedan fijas al desplazar,
 * porque perder de vista el objetivo mientras se leen los meses deja los
 * números sin dueño.
 */
export function TablaHoja({ hoja, puedeEditar }: { hoja: Hoja; puedeEditar: boolean }) {
  if (hoja.filas.length === 0) {
    return (
      <EstadoVacio
        titulo={`Sin objetivos cargados para ${hoja.anio}`}
        descripcion="Cargue los objetivos de la calidad del año y asócieles su indicador."
      />
    );
  }

  const sinIndicador = hoja.filas.filter((fila) => fila.indicadorId === null).length;

  return (
    <>
      <Tarjeta>
        <div className="w-full overflow-x-auto">
          <table className="w-max min-w-full border-collapse text-[11px]">
            <thead>
              <tr className="border-b border-borde">
                <Encabezado className="sticky left-0 z-20 w-10 bg-tarjeta">Nº</Encabezado>
                <Encabezado className="sticky left-10 z-20 min-w-[16rem] bg-tarjeta">
                  Objetivo de la calidad
                </Encabezado>
                <Encabezado className="min-w-[6rem]">Nivel</Encabezado>
                <Encabezado className="min-w-[10rem]">Función / Proceso</Encabezado>
                <Encabezado className="min-w-[14rem]">Indicador</Encabezado>
                <Encabezado className="min-w-[12rem]">Fórmula de cálculo</Encabezado>
                <Encabezado className="min-w-[4rem]">Unidad</Encabezado>
                <Encabezado className="min-w-[5rem] text-right">Línea base</Encabezado>
                <Encabezado className="min-w-[5rem] text-right">Meta</Encabezado>
                <Encabezado className="min-w-[8rem]">Sentido</Encabezado>
                <Encabezado className="min-w-[6rem]">Consolidación</Encabezado>
                <Encabezado className="min-w-[6rem]">Frecuencia</Encabezado>
                <Encabezado className="min-w-[10rem]">Fuente del dato</Encabezado>
                <Encabezado className="min-w-[10rem]">Responsable</Encabezado>
                {MESES_ABREVIADOS.map((mes) => (
                  <Encabezado key={mes} className="w-14 text-right">
                    {mes}
                  </Encabezado>
                ))}
                <Encabezado className="min-w-[6rem] text-right">Resultado</Encabezado>
                <Encabezado className="min-w-[6rem] text-right">% Cumpl.</Encabezado>
                <Encabezado className="min-w-[7rem]">Semáforo</Encabezado>
                <Encabezado className="min-w-[12rem]">Observaciones</Encabezado>
              </tr>
            </thead>

            <tbody>
              {hoja.filas.map((fila) => (
                <tr
                  key={`${fila.objetivoId ?? "x"}-${fila.indicadorId ?? fila.numero}`}
                  className="border-b border-borde transition-colors hover:bg-acento/40"
                >
                  <Celda className="sticky left-0 z-10 bg-tarjeta text-atenuado-contraste tabular">
                    {fila.numero}
                  </Celda>
                  <Celda className="sticky left-10 z-10 bg-tarjeta">
                    {fila.objetivoId && fila.objetivo ? (
                      <span className="font-medium">{fila.objetivo}</span>
                    ) : (
                      <span className="text-atenuado-contraste">{fila.objetivo}</span>
                    )}
                  </Celda>
                  <Celda>
                    {fila.nivel ? (
                      ETIQUETAS_NIVEL_OBJETIVO[fila.nivel]
                    ) : (
                      <Vacio puedeEditar={puedeEditar} />
                    )}
                  </Celda>
                  <Celda className="text-atenuado-contraste">
                    {fila.ambito ?? <Vacio puedeEditar={puedeEditar} />}
                  </Celda>
                  <Celda>
                    {fila.indicadorId ? (
                      <Link
                        href={`/indicadores/${fila.indicadorId}`}
                        className="hover:text-primario"
                      >
                        <span className="tabular text-atenuado-contraste">{fila.codigo}</span>{" "}
                        {fila.indicador}
                      </Link>
                    ) : (
                      <span className="text-semaforo-alto">Sin indicador definido</span>
                    )}
                  </Celda>
                  <Celda className="text-atenuado-contraste">
                    {fila.formula ?? <Vacio puedeEditar={puedeEditar} />}
                  </Celda>
                  <Celda className="text-atenuado-contraste">{fila.unidad ?? "—"}</Celda>
                  <Celda className="text-right tabular">
                    {fila.lineaBase === null ? (
                      <Vacio puedeEditar={puedeEditar} />
                    ) : (
                      formatearNumero(fila.lineaBase, 2)
                    )}
                  </Celda>
                  <Celda className="text-right font-medium tabular">
                    {fila.meta === null ? (
                      <Vacio puedeEditar={puedeEditar} />
                    ) : (
                      formatearNumero(fila.meta, 2)
                    )}
                  </Celda>
                  <Celda className="text-atenuado-contraste">
                    {fila.sentido ? ETIQUETAS_SENTIDO[fila.sentido] : "—"}
                  </Celda>
                  <Celda className="text-atenuado-contraste">
                    {fila.consolidacion ? ETIQUETAS_CONSOLIDACION[fila.consolidacion] : "—"}
                  </Celda>
                  <Celda className="text-atenuado-contraste">
                    {fila.frecuencia ? ETIQUETAS_FRECUENCIA[fila.frecuencia] : "—"}
                  </Celda>
                  <Celda className="text-atenuado-contraste">
                    {fila.fuenteDato ?? <Vacio puedeEditar={puedeEditar} />}
                  </Celda>
                  <Celda className="text-atenuado-contraste">{fila.responsable ?? "—"}</Celda>

                  {/* Los doce meses. Un mes sin cargar va en blanco y no
                      en cero: cero es un resultado, vacío es que nadie lo
                      midió, y confundirlos hunde el promedio del año. */}
                  {fila.meses.map((valor, indice) => (
                    <Celda key={indice} className="text-right tabular">
                      {valor === null ? (
                        <span className="text-atenuado-contraste/50">·</span>
                      ) : (
                        formatearNumero(valor, 2)
                      )}
                    </Celda>
                  ))}

                  <Celda className="text-right font-medium tabular">
                    {fila.resultado === null ? "—" : formatearNumero(fila.resultado, 2)}
                  </Celda>
                  <Celda className="text-right font-medium tabular">
                    {fila.cumplimiento === null
                      ? "—"
                      : `${formatearNumero(fila.cumplimiento, 0)} %`}
                  </Celda>
                  <Celda>
                    {fila.semaforo ? (
                      <span
                        className={cn(
                          "inline-flex rounded border px-1.5 py-0.5 text-[10px] font-medium",
                          CLASES_SEMAFORO[fila.semaforo],
                        )}
                      >
                        {ETIQUETAS_SEMAFORO[fila.semaforo]}
                      </span>
                    ) : (
                      <span className="text-atenuado-contraste">Sin medir</span>
                    )}
                  </Celda>
                  <Celda className="text-atenuado-contraste">{fila.observaciones ?? "—"}</Celda>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      <p className="mt-3 text-[11px] text-atenuado-contraste">
        {hoja.filas.length} {hoja.filas.length === 1 ? "fila" : "filas"} en el F-EST-01-05 de{" "}
        {hoja.anio}.{" "}
        {sinIndicador > 0 ? (
          <span className="text-semaforo-alto">
            {sinIndicador} {sinIndicador === 1 ? "objetivo todavía no tiene" : "objetivos todavía no tienen"}{" "}
            indicador: sin él, el objetivo no se puede medir ni cerrar el año.
          </span>
        ) : null}
      </p>
    </>
  );
}

function Encabezado({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <th
      className={cn(
        "whitespace-nowrap border-r border-borde px-2 py-2 text-left align-bottom",
        "text-[10px] font-semibold uppercase tracking-wide text-atenuado-contraste",
        className,
      )}
    >
      {children}
    </th>
  );
}

function Celda({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <td className={cn("border-r border-borde px-2 py-1.5 align-top", className)}>{children}</td>
  );
}

/** Un dato que falta. Se marca solo a quien puede completarlo. */
function Vacio({ puedeEditar }: { puedeEditar: boolean }) {
  return (
    <span className={puedeEditar ? "text-semaforo-alto" : "text-atenuado-contraste"}>
      {puedeEditar ? "Completar" : "—"}
    </span>
  );
}
