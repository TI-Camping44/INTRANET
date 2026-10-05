import Link from "next/link";
import { cn } from "@/lib/utilidades";

export interface DiaMarcado {
  /** La fecha tal como viene de PostgreSQL: «2026-08-31». */
  fecha: string;
  codigo: string;
  detalle: string;
  enlace: string;
  /** Pinta el día. `atencion` para lo que ya pasó sin cerrarse. */
  tono?: "normal" | "atencion" | "cumplido";
}

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** La semana arranca el lunes, como el calendario de pared. */
const DIAS = ["L", "M", "M", "J", "V", "S", "D"];

const TONOS = {
  normal: "bg-primario text-primario-contraste hover:bg-primario/85",
  atencion: "bg-semaforo-alto text-fondo hover:bg-semaforo-alto/85",
  cumplido: "bg-semaforo-bajo text-fondo hover:bg-semaforo-bajo/85",
} as const;

/**
 * Los doce meses del año, con los días marcados.
 *
 * Es el calendario del programa anual de auditorías: de un vistazo se ve
 * en qué semanas del año hay algo agendado y dónde quedaron huecos de
 * meses enteros, que es la pregunta que el programa tiene que contestar.
 *
 * LAS FECHAS SE LEEN DEL TEXTO, NO CON `new Date()`. Una columna `date`
 * de PostgreSQL llega como «2026-08-31» y `new Date()` la interpreta en
 * UTC: en Asunción, que está tres horas atrás, el día 1 de cada mes se
 * dibujaría en el mes anterior. Se parte la cadena y listo. La grilla
 * misma sí se calcula con `Date.UTC`, que no depende de ninguna zona.
 */
export function CalendarioAnual({ anio, dias }: { anio: number; dias: DiaMarcado[] }) {
  // Varias auditorías pueden caer el mismo día.
  const porFecha = new Map<string, DiaMarcado[]>();
  for (const dia of dias) {
    porFecha.set(dia.fecha, [...(porFecha.get(dia.fecha) ?? []), dia]);
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {MESES.map((nombreMes, mes) => {
        // `getUTCDay()` devuelve 0 para domingo; acá la semana empieza
        // el lunes, así que el domingo pasa a ser el séptimo.
        const primerDia = (new Date(Date.UTC(anio, mes, 1)).getUTCDay() + 6) % 7;
        const cuantosDias = new Date(Date.UTC(anio, mes + 1, 0)).getUTCDate();
        const mesTexto = String(mes + 1).padStart(2, "0");

        const marcadosDelMes = dias.filter(
          (dia) => dia.fecha.slice(0, 7) === `${anio}-${mesTexto}`,
        ).length;

        return (
          <div key={nombreMes} className="min-w-0">
            <p className="mb-1.5 flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold">{nombreMes}</span>
              {marcadosDelMes > 0 ? (
                <span className="text-[10px] tabular text-atenuado-contraste">
                  {marcadosDelMes}
                </span>
              ) : null}
            </p>

            <div className="grid grid-cols-7 gap-0.5">
              {DIAS.map((dia, indice) => (
                <span
                  key={`${dia}-${indice}`}
                  className="pb-0.5 text-center text-[9px] font-semibold uppercase
                             text-atenuado-contraste"
                >
                  {dia}
                </span>
              ))}

              {Array.from({ length: primerDia }, (_, hueco) => (
                <span key={`hueco-${hueco}`} />
              ))}

              {Array.from({ length: cuantosDias }, (_, indice) => {
                const numero = indice + 1;
                const fecha = `${anio}-${mesTexto}-${String(numero).padStart(2, "0")}`;
                const marcados = porFecha.get(fecha);

                if (!marcados || marcados.length === 0) {
                  return (
                    <span
                      key={fecha}
                      className="flex h-6 items-center justify-center rounded text-[10px]
                                 tabular text-atenuado-contraste"
                    >
                      {numero}
                    </span>
                  );
                }

                const principal = marcados[0];
                const titulo = marcados
                  .map((marcado) => `${marcado.codigo} · ${marcado.detalle}`)
                  .join("\n");

                return (
                  <Link
                    key={fecha}
                    href={principal.enlace}
                    title={titulo}
                    className={cn(
                      "flex h-6 items-center justify-center rounded text-[10px] font-semibold",
                      "tabular transition-colors",
                      TONOS[principal.tono ?? "normal"],
                    )}
                  >
                    {numero}
                  </Link>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
