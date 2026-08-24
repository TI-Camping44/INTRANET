import Link from "next/link";
import { cn } from "@/lib/utilidades";
import { etiquetaNivelRiesgo, RELLENO_NIVEL_RIESGO } from "@/lib/riesgos";
import { ESCALA_IMPACTO, ESCALA_PROBABILIDAD, ETIQUETAS_NIVEL_RIESGO } from "@/lib/constantes";

interface RiesgoEnMatriz {
  id: string;
  codigo: string;
  titulo: string;
  probabilidad: number;
  impacto: number;
  nivel: number;
}

/**
 * Mapa de calor 5x5. El eje vertical es la probabilidad (de mayor a menor
 * hacia abajo) y el horizontal el impacto, que es la disposicion habitual
 * de las matrices de riesgo en los sistemas de gestion.
 */
export function MatrizRiesgos({ riesgos }: { riesgos: RiesgoEnMatriz[] }) {
  const celdas = new Map<string, RiesgoEnMatriz[]>();

  for (const riesgo of riesgos) {
    const clave = `${riesgo.probabilidad}-${riesgo.impacto}`;
    celdas.set(clave, [...(celdas.get(clave) ?? []), riesgo]);
  }

  const probabilidades = [...ESCALA_PROBABILIDAD].reverse();

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[42rem] border-separate border-spacing-1">
          <caption className="sr-only">
            Matriz de riesgos de 5 por 5: probabilidad contra impacto
          </caption>
          <thead>
            <tr>
              <th className="w-28" />
              {ESCALA_IMPACTO.map((nivel) => (
                <th
                  key={nivel.valor}
                  scope="col"
                  className="px-1 pb-1 text-center text-[10px] font-semibold uppercase
                             tracking-wide text-atenuado-contraste"
                >
                  {nivel.valor} · {nivel.etiqueta}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {probabilidades.map((probabilidad) => (
              <tr key={probabilidad.valor}>
                <th
                  scope="row"
                  className="pr-2 text-right text-[10px] font-semibold uppercase tracking-wide
                             text-atenuado-contraste"
                >
                  {probabilidad.valor} · {probabilidad.etiqueta}
                </th>
                {ESCALA_IMPACTO.map((impacto) => {
                  const nivel = probabilidad.valor * impacto.valor;
                  const etiqueta = etiquetaNivelRiesgo(nivel)!;
                  const contenido = celdas.get(`${probabilidad.valor}-${impacto.valor}`) ?? [];

                  return (
                    <td
                      key={impacto.valor}
                      className={cn(
                        "h-20 rounded-md border border-borde/60 p-1 align-top transition-colors",
                        RELLENO_NIVEL_RIESGO[etiqueta],
                      )}
                    >
                      <span className="block text-right text-[9px] font-semibold opacity-60">
                        {nivel}
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {contenido.map((riesgo) => (
                          <Link
                            key={riesgo.id}
                            href={`/riesgos/${riesgo.id}`}
                            title={`${riesgo.codigo} · ${riesgo.titulo}`}
                            className="rounded bg-fondo/85 px-1.5 py-0.5 text-[10px] font-semibold
                                       tabular shadow-sm transition-colors hover:bg-fondo"
                          >
                            {riesgo.codigo}
                          </Link>
                        ))}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Referencia del semáforo */}
      <div className="flex flex-wrap items-center gap-3 text-[11px]">
        <span className="font-medium text-atenuado-contraste">Nivel = Probabilidad × Impacto</span>
        {(
          [
            ["bajo", "1 a 4"],
            ["medio", "5 a 9"],
            ["alto", "10 a 14"],
            ["critico", "15 a 25"],
          ] as const
        ).map(([clave, rango]) => (
          <span key={clave} className="flex items-center gap-1.5">
            <span className={cn("size-3 rounded", RELLENO_NIVEL_RIESGO[clave])} />
            {ETIQUETAS_NIVEL_RIESGO[clave]} ({rango})
          </span>
        ))}
      </div>
    </div>
  );
}
