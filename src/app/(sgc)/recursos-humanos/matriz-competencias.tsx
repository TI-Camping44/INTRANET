"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Seleccion } from "@/components/ui/campo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { definirRequisito } from "@/app/(sgc)/recursos-humanos/acciones";
import { cn } from "@/lib/utilidades";

interface Puesto {
  id: string;
  codigo: string;
  nombre: string;
  area: string | null;
}

interface Competencia {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
}

export interface Requisito {
  puesto_id: string;
  competencia_id: string;
  nivel_requerido: number;
  critica: boolean;
}

/**
 * Matriz de competencias: puestos en las filas, competencias en las
 * columnas, y en cada celda el nivel exigido de 1 a 5.
 *
 * Se colorea por intensidad de un solo tono, no por categoria: el nivel
 * es una magnitud ordenada y un color por nivel obligaria a leer una
 * leyenda para entender que 4 es mas que 3.
 */
export function MatrizCompetencias({
  puestos,
  competencias,
  requisitos,
  puedeEditar,
}: {
  puestos: Puesto[];
  competencias: Competencia[];
  requisitos: Requisito[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);

  const porCelda = React.useMemo(() => {
    const mapa = new Map<string, Requisito>();
    for (const requisito of requisitos) {
      mapa.set(`${requisito.puesto_id}|${requisito.competencia_id}`, requisito);
    }
    return mapa;
  }, [requisitos]);

  async function guardar(puestoId: string, competenciaId: string, nivel: number) {
    const actual = porCelda.get(`${puestoId}|${competenciaId}`);
    definirProcesando(true);
    const resultado = await definirRequisito(
      puestoId,
      competenciaId,
      nivel,
      actual?.critica ?? false,
    );
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Matriz actualizada.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  if (puestos.length === 0 || competencias.length === 0) {
    return (
      <EstadoVacio
        titulo="La matriz necesita puestos y competencias"
        descripcion="Defina al menos un puesto y una competencia para poder cruzar los niveles exigidos."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="w-full overflow-x-auto">
        <table className="w-auto border-separate border-spacing-0.5 text-xs">
          <caption className="sr-only">
            Matriz de competencias: nivel exigido de cada competencia por puesto
          </caption>
          <thead>
            <tr>
              <th
                className="sticky left-0 z-10 min-w-[13rem] bg-tarjeta p-2 text-left text-[10px]
                           font-semibold uppercase tracking-wide text-atenuado-contraste"
              >
                Puesto
              </th>
              {competencias.map((competencia) => (
                <th
                  key={competencia.id}
                  scope="col"
                  className="w-[6.5rem] min-w-[6.5rem] p-1 align-bottom"
                >
                  <span className="block text-[10px] font-semibold tabular text-atenuado-contraste">
                    {competencia.codigo}
                  </span>
                  <span className="mt-0.5 block text-[10px] font-normal leading-tight text-atenuado-contraste">
                    {competencia.nombre}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {puestos.map((puesto) => (
              <tr key={puesto.id}>
                <th
                  scope="row"
                  className="sticky left-0 z-10 bg-tarjeta p-2 text-left align-middle font-normal"
                >
                  <span className="block text-xs font-medium">{puesto.nombre}</span>
                  <span className="block text-[10px] text-atenuado-contraste">
                    {puesto.codigo}
                    {puesto.area ? ` · ${puesto.area}` : ""}
                  </span>
                </th>

                {competencias.map((competencia) => {
                  const requisito = porCelda.get(`${puesto.id}|${competencia.id}`);
                  const nivel = requisito?.nivel_requerido ?? 0;

                  return (
                    <td key={competencia.id} className="p-0 text-center">
                      {puedeEditar ? (
                        <Seleccion
                          aria-label={`Nivel de ${competencia.nombre} exigido en ${puesto.nombre}`}
                          value={nivel}
                          disabled={procesando}
                          onChange={(evento) =>
                            guardar(puesto.id, competencia.id, Number(evento.target.value))
                          }
                          className={cn(
                            "h-8 w-full cursor-pointer border-0 px-1 text-center shadow-none",
                            "text-xs font-semibold tabular",
                            claseNivel(nivel),
                          )}
                        >
                          <option value={0}>—</option>
                          {[1, 2, 3, 4, 5].map((valor) => (
                            <option key={valor} value={valor}>
                              {valor}
                            </option>
                          ))}
                        </Seleccion>
                      ) : (
                        <span
                          className={cn(
                            "flex h-8 items-center justify-center rounded",
                            "text-xs font-semibold tabular",
                            claseNivel(nivel),
                          )}
                        >
                          {nivel === 0 ? "—" : nivel}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Referencia de la escala */}
      <div className="flex flex-wrap items-center gap-3 text-[11px] text-atenuado-contraste">
        <span className="font-medium">Nivel exigido</span>
        {[1, 2, 3, 4, 5].map((nivel) => (
          <span key={nivel} className="flex items-center gap-1.5">
            <span className={cn("flex size-5 items-center justify-center rounded text-[10px] font-semibold", claseNivel(nivel))}>
              {nivel}
            </span>
            {ESCALA[nivel]}
          </span>
        ))}
      </div>

      <p className="text-[11px] leading-relaxed text-atenuado-contraste">
        Cada columna es una competencia y cada celda, el nivel que el puesto exige. Un guion
        significa que ese puesto no la necesita.
      </p>
    </div>
  );
}

const ESCALA: Record<number, string> = {
  1: "Básico",
  2: "En desarrollo",
  3: "Competente",
  4: "Avanzado",
  5: "Referente",
};

/**
 * Intensidad creciente de un solo tono. El nivel es una magnitud
 * ordenada, no una categoria: mas oscuro es mas exigente.
 */
function claseNivel(nivel: number): string {
  switch (nivel) {
    case 1:
      return "bg-primario/10 text-texto";
    case 2:
      return "bg-primario/20 text-texto";
    case 3:
      return "bg-primario/35 text-texto";
    case 4:
      return "bg-primario/55 text-primario-contraste";
    case 5:
      return "bg-primario/80 text-primario-contraste";
    default:
      return "bg-transparent text-atenuado-contraste";
  }
}
