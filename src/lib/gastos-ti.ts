/**
 * Reglas de los gastos de TI y del costo de las licencias.
 *
 * LAS CATEGORÍAS Y LAS MONEDAS ESTÁN TAMBIÉN EN LOS `CHECK` DE
 * `gastos_ti` y de `activos`: si cambian, cambian en los dos lados.
 */

export const CATEGORIAS_GASTO = [
  "licencias",
  "soporte",
  "equipos",
  "servicios",
  "desarrollo",
  "comunicaciones",
  "otros",
] as const;
export type CategoriaGasto = (typeof CATEGORIAS_GASTO)[number];

export const ETIQUETAS_CATEGORIA_GASTO: Record<CategoriaGasto, string> = {
  licencias: "Licencias y suscripciones",
  soporte: "Soporte y mantenimiento",
  equipos: "Equipos y repuestos",
  servicios: "Servicios (hosting, dominios, nube)",
  desarrollo: "Desarrollos a terceros",
  comunicaciones: "Telefonía e internet",
  otros: "Otros",
};

export const MONEDAS = ["USD", "PYG"] as const;
export type Moneda = (typeof MONEDAS)[number];

export const ETIQUETAS_MONEDA: Record<Moneda, string> = {
  USD: "Dólares (USD)",
  PYG: "Guaraníes (Gs.)",
};

export function esCategoriaGasto(valor: string): valor is CategoriaGasto {
  return (CATEGORIAS_GASTO as readonly string[]).includes(valor);
}

export function esMoneda(valor: string): valor is Moneda {
  return (MONEDAS as readonly string[]).includes(valor);
}

/**
 * Un monto en su moneda. Los dólares van con dos decimales y los
 * guaraníes con `formatearGuaranies`, que es la regla del proyecto: no
 * se formatea a mano en ningún componente.
 */
export function formatearMonto(
  monto: number | string | null | undefined,
  moneda: string | null | undefined,
  formatearGuaranies: (valor: number) => string,
): string {
  if (monto === null || monto === undefined || monto === "") return "—";
  const numero = typeof monto === "string" ? Number(monto) : monto;
  if (Number.isNaN(numero)) return "—";
  if (moneda === "PYG") return formatearGuaranies(numero);
  return `USD ${new Intl.NumberFormat("es-PY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numero)}`;
}

/**
 * Un importe que viene del formulario, escrito como lo escribe la gente
 * en Paraguay: «1.224.000», «504,57», «9019.20». Devuelve `null` si no se
 * puede leer.
 *
 * Con una sola coma, la coma es el decimal. Con puntos y sin coma, los
 * puntos son de miles salvo que haya uno solo seguido de uno o dos
 * dígitos, que es un decimal escrito a la inglesa.
 */
export function leerImporte(texto: string): number | null {
  const limpio = texto.trim().replace(/\s/g, "").replace(/^(USD|Gs\.?|US\$|\$)/i, "");
  if (!limpio) return null;
  let normalizado: string;
  if (limpio.includes(",")) {
    normalizado = limpio.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+\.\d{1,2}$/.test(limpio)) {
    normalizado = limpio;
  } else {
    normalizado = limpio.replace(/\./g, "");
  }
  if (!/^\d+(\.\d+)?$/.test(normalizado)) return null;
  const numero = Number(normalizado);
  return Number.isFinite(numero) ? numero : null;
}

// ---------------------------------------------------------------------
// Licencias
// ---------------------------------------------------------------------

/** Los ciclos de pago que acepta el `CHECK` `activos_licencia_costo`. */
export const CICLOS_LICENCIA = [
  { meses: 1, etiqueta: "Mensual" },
  { meses: 3, etiqueta: "Trimestral" },
  { meses: 6, etiqueta: "Semestral" },
  { meses: 12, etiqueta: "Anual" },
  { meses: 24, etiqueta: "Cada 2 años" },
  { meses: 36, etiqueta: "Cada 3 años" },
  { meses: 0, etiqueta: "Sin costo" },
] as const;

export function etiquetaCiclo(meses: number | null): string {
  if (meses === null) return "—";
  return CICLOS_LICENCIA.find((ciclo) => ciclo.meses === meses)?.etiqueta ?? `${meses} meses`;
}

export function esCicloLicencia(meses: number): boolean {
  return CICLOS_LICENCIA.some((ciclo) => ciclo.meses === meses);
}

/** Lo que cuesta por mes una licencia, en su moneda. `null` si falta el dato. */
export function costoMensual(costoCiclo: number | null, cicloMeses: number | null): number | null {
  if (costoCiclo === null || cicloMeses === null) return null;
  if (cicloMeses === 0) return 0;
  return costoCiclo / cicloMeses;
}

/** Los intangibles: los que van en la pantalla de licencias. */
export const CATEGORIAS_LICENCIA = ["Licencia", "Certificado", "Dominio"] as const;

/** Días antes del vencimiento en que se avisa, el mismo de la alerta. */
export const DIAS_AVISO_VENCIMIENTO_LICENCIA = 30;
