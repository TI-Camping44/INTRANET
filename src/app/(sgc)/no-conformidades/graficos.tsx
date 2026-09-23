import { cn } from "@/lib/utilidades";

/**
 * Los gráficos del tablero de no conformidades.
 *
 * Son SVG escritos a mano, sin librería, como el resto de los del
 * proyecto. No hay estado ni interacción: son componentes de servidor y
 * el detalle al señalar lo da el `<title>` del propio SVG, que el
 * navegador muestra solo.
 *
 * Dos formas, y la elección no es estética:
 *
 *   · **Torta** donde las porciones son pocas —estado y severidad—. Una
 *     torta se lee de un vistazo cuando son cuatro pedazos; con catorce
 *     es un círculo de colores que nadie puede comparar.
 *   · **Barras** donde son muchas —área y origen—. La barra se compara
 *     por longitud, que el ojo mide bien, y admite tantas filas como
 *     haga falta.
 *
 * En los dos casos va la tabla de datos al lado, con el conteo y el
 * porcentaje. Es regla del proyecto y acá además es necesaria: el color
 * nunca es lo único que identifica a una porción.
 */
export interface Porcion {
  etiqueta: string;
  valor: number;
  /** Color CSS ya resuelto. Sale de las variables del tema. */
  color: string;
}

function porcentaje(valor: number, total: number): string {
  if (total === 0) return "0%";
  const bruto = (valor * 100) / total;
  // Un decimal solo cuando hace falta: «12,5%» dice algo, «12,0%» no.
  const redondeado = Math.round(bruto * 10) / 10;
  return `${String(redondeado).replace(".", ",")}%`;
}

/**
 * Torta con agujero, con el total en el medio.
 *
 * El agujero no es decoración: es donde va el total, que es el dato que
 * se pregunta primero y que en una torta llena no tiene dónde ir.
 *
 * Se dibuja con el trazo de un solo círculo y `stroke-dasharray`. Cada
 * porción acorta su trazo dos píxeles para dejar el espacio entre
 * porciones que pide la guía del proyecto, y así dos porciones vecinas
 * de color parecido no se leen como una sola.
 */
export function Torta({
  titulo,
  porciones,
  vacio = "Sin datos",
}: {
  titulo: string;
  porciones: Porcion[];
  vacio?: string;
}) {
  const total = porciones.reduce((suma, porcion) => suma + porcion.valor, 0);
  const conDatos = porciones.filter((porcion) => porcion.valor > 0);

  const radio = 56;
  const grosor = 22;
  const circunferencia = 2 * Math.PI * radio;

  let acumulado = 0;
  const arcos = conDatos.map((porcion) => {
    const largo = (porcion.valor / total) * circunferencia;
    const desde = acumulado;
    acumulado += largo;
    // Se descuentan 2 px de separación, salvo cuando la porción es tan
    // chica que el hueco se la comería.
    const dibujado = conDatos.length > 1 && largo > 6 ? largo - 2 : largo;
    return { porcion, desde, dibujado };
  });

  return (
    <div className="rounded-lg border border-borde bg-fondo p-4">
      <p className="mb-3 text-xs font-semibold">{titulo}</p>

      {total === 0 ? (
        <p className="py-6 text-center text-xs text-atenuado-contraste">{vacio}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-5">
          <svg
            viewBox="0 0 140 140"
            className="size-[140px] shrink-0"
            role="img"
            aria-label={`${titulo}: ${conDatos
              .map((p) => `${p.etiqueta} ${porcentaje(p.valor, total)}`)
              .join(", ")}`}
          >
            <g transform="rotate(-90 70 70)">
              {arcos.map(({ porcion, desde, dibujado }) => (
                <circle
                  key={porcion.etiqueta}
                  cx="70"
                  cy="70"
                  r={radio}
                  fill="none"
                  stroke={porcion.color}
                  strokeWidth={grosor}
                  strokeDasharray={`${dibujado} ${circunferencia - dibujado}`}
                  strokeDashoffset={-desde}
                >
                  {/* Una sola cadena y no varios nodos de texto: partido
                      en trozos, el servidor y el navegador arman el
                      `title` distinto y React rehace la pagina entera
                      del lado del cliente. */}
                  <title>
                    {`${porcion.etiqueta}: ${porcion.valor} (${porcentaje(porcion.valor, total)})`}
                  </title>
                </circle>
              ))}
            </g>
            <text
              x="70"
              y="66"
              textAnchor="middle"
              className="fill-texto text-[22px] font-semibold tabular"
            >
              {total}
            </text>
            <text
              x="70"
              y="82"
              textAnchor="middle"
              className="fill-atenuado-contraste text-[10px]"
            >
              {total === 1 ? "registro" : "registros"}
            </text>
          </svg>

          <table className="min-w-[11rem] flex-1 text-xs">
            <tbody>
              {porciones.map((porcion) => (
                <tr key={porcion.etiqueta} className="border-b border-borde/60 last:border-b-0">
                  <td className="py-1 pr-2">
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden
                        className="size-2.5 shrink-0 rounded-sm"
                        style={{ backgroundColor: porcion.color }}
                      />
                      <span className={cn(porcion.valor === 0 && "text-atenuado-contraste")}>
                        {porcion.etiqueta}
                      </span>
                    </span>
                  </td>
                  <td className="py-1 pr-2 text-right tabular text-atenuado-contraste">
                    {porcion.valor}
                  </td>
                  <td className="py-1 text-right font-medium tabular">
                    {porcentaje(porcion.valor, total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/**
 * Barras horizontales con su porcentaje.
 *
 * Para las dimensiones de muchas categorías —las trece áreas, los seis
 * orígenes—. Un solo color: acá lo que se compara es el largo, y pintar
 * cada fila de un color distinto sería inventar trece colores que además
 * no significan nada.
 *
 * Ordenadas de mayor a menor, que es como se las lee, y sin las que
 * están en cero: una lista de ceros ocupa lugar y no dice nada.
 */
export function BarrasPorcentaje({
  titulo,
  filas,
  vacio = "Sin datos",
}: {
  titulo: string;
  filas: { etiqueta: string; valor: number }[];
  vacio?: string;
}) {
  const total = filas.reduce((suma, fila) => suma + fila.valor, 0);
  const conDatos = filas
    .filter((fila) => fila.valor > 0)
    .sort((una, otra) => otra.valor - una.valor);
  const mayor = conDatos[0]?.valor ?? 0;

  return (
    <div className="rounded-lg border border-borde bg-fondo p-4">
      <p className="mb-3 text-xs font-semibold">{titulo}</p>

      {conDatos.length === 0 ? (
        <p className="py-6 text-center text-xs text-atenuado-contraste">{vacio}</p>
      ) : (
        <div className="space-y-1.5">
          {conDatos.map((fila) => (
            <div key={fila.etiqueta} className="flex items-center gap-2 text-xs">
              <span className="w-[10rem] shrink-0 truncate" title={fila.etiqueta}>
                {fila.etiqueta}
              </span>
              <span className="h-3 flex-1 rounded-sm bg-acento">
                <span
                  className="block h-3 rounded-sm bg-primario"
                  style={{ width: `${mayor === 0 ? 0 : (fila.valor * 100) / mayor}%` }}
                />
              </span>
              <span className="w-6 shrink-0 text-right tabular text-atenuado-contraste">
                {fila.valor}
              </span>
              <span className="w-12 shrink-0 text-right font-medium tabular">
                {porcentaje(fila.valor, total)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
