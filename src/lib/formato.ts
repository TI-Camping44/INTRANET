/**
 * Formatos del negocio: fechas en dd/mm/aaaa sobre la zona horaria
 * America/Asuncion y montos en guaranies con separador de miles.
 */

export const ZONA_HORARIA = "America/Asuncion";
export const IDIOMA = "es-PY";

const formateadorFecha = new Intl.DateTimeFormat(IDIOMA, {
  timeZone: ZONA_HORARIA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const formateadorFechaHora = new Intl.DateTimeFormat(IDIOMA, {
  timeZone: ZONA_HORARIA,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

const formateadorMesLargo = new Intl.DateTimeFormat(IDIOMA, {
  timeZone: ZONA_HORARIA,
  month: "long",
  year: "numeric",
});

/**
 * Las columnas `date` de PostgreSQL llegan como "2026-08-31". Si se las
 * pasa directamente a `new Date()` se interpretan como UTC y en Asuncion
 * (UTC-3 / UTC-4) se muestran un dia antes. Por eso se las ancla al
 * mediodia antes de formatear.
 */
function aFecha(valor: string | Date | null | undefined): Date | null {
  if (!valor) return null;
  if (valor instanceof Date) return valor;
  if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) return new Date(`${valor}T12:00:00`);
  const fecha = new Date(valor);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

/** dd/mm/aaaa */
export function formatearFecha(valor: string | Date | null | undefined) {
  const fecha = aFecha(valor);
  return fecha ? formateadorFecha.format(fecha) : "—";
}

/** dd/mm/aaaa hh:mm */
export function formatearFechaHora(valor: string | Date | null | undefined) {
  const fecha = aFecha(valor);
  return fecha ? formateadorFechaHora.format(fecha).replace(",", "") : "—";
}

/** "agosto de 2026" */
export function formatearMes(valor: string | Date | null | undefined) {
  const fecha = aFecha(valor);
  return fecha ? formateadorMesLargo.format(fecha) : "—";
}

/** Gs. 3.711.850 */
export function formatearGuaranies(valor: number | string | null | undefined) {
  if (valor === null || valor === undefined || valor === "") return "—";
  const numero = typeof valor === "string" ? Number(valor) : valor;
  if (Number.isNaN(numero)) return "—";
  return `Gs. ${new Intl.NumberFormat(IDIOMA, { maximumFractionDigits: 0 }).format(numero)}`;
}

/** Numeros con separador de miles y hasta dos decimales. */
export function formatearNumero(valor: number | string | null | undefined, decimales = 2) {
  if (valor === null || valor === undefined || valor === "") return "—";
  const numero = typeof valor === "string" ? Number(valor) : valor;
  if (Number.isNaN(numero)) return "—";
  return new Intl.NumberFormat(IDIOMA, {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimales,
  }).format(numero);
}

/** Fecha de hoy en Asuncion, como "aaaa-mm-dd" (formato de PostgreSQL). */
export function hoyEnAsuncion(): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: ZONA_HORARIA,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return partes;
}

/**
 * Dias que faltan para una fecha (negativo si ya paso).
 * Se calcula sobre fechas sin hora para que "hoy" siempre sea 0.
 */
export function diasHasta(valor: string | Date | null | undefined): number | null {
  const fecha = aFecha(valor);
  if (!fecha) return null;
  const hoy = aFecha(hoyEnAsuncion());
  if (!hoy) return null;
  const milisegundosPorDia = 86_400_000;
  return Math.round((fecha.getTime() - hoy.getTime()) / milisegundosPorDia);
}

/** "vence en 5 días" / "vencida hace 3 días" */
export function describirVencimiento(valor: string | Date | null | undefined) {
  const dias = diasHasta(valor);
  if (dias === null) return "Sin fecha";
  if (dias === 0) return "Vence hoy";
  if (dias > 0) return `Vence en ${dias} ${dias === 1 ? "día" : "días"}`;
  const atraso = Math.abs(dias);
  return `Vencida hace ${atraso} ${atraso === 1 ? "día" : "días"}`;
}

/** Suma meses a una fecha "aaaa-mm-dd" y devuelve el mismo formato. */
export function sumarMeses(fechaIso: string, meses: number): string {
  const fecha = new Date(`${fechaIso}T12:00:00`);
  fecha.setMonth(fecha.getMonth() + meses);
  return fecha.toISOString().slice(0, 10);
}

/** Suma dias a una fecha "aaaa-mm-dd" y devuelve el mismo formato. */
export function sumarDias(fechaIso: string, dias: number): string {
  const fecha = new Date(`${fechaIso}T12:00:00`);
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}
