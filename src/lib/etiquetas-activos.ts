/**
 * Etiquetas de los activos: qué se imprime y en qué formato.
 *
 * Lo pidió la auditoría interna en la NC-2026-015: «las etiquetas de los
 * activos no existen o no coinciden con el detalle registrado en la
 * Intranet». El MP-SOP-03 (actividad 1) exige que cada activo se
 * codifique, se etiquete y se registre. La forma de que la etiqueta y el
 * registro no se separen es que la etiqueta salga del registro: el
 * código que se imprime es el de la Intranet, y el QR abre su ficha.
 */

/**
 * Lo que no se etiqueta: los intangibles no tienen dónde pegar nada. Se
 * comparan sin mayúsculas porque la categoría es texto libre.
 */
export const CATEGORIAS_SIN_ETIQUETA = ["licencia", "certificado", "dominio"];

export function llevaEtiqueta(categoria: string | null | undefined): boolean {
  return !CATEGORIAS_SIN_ETIQUETA.includes((categoria ?? "").trim().toLowerCase());
}

export type FormatoEtiqueta = "a4" | "cinta";

export interface DefinicionFormato {
  nombre: string;
  descripcion: string;
  /** El `@page` de la impresión. */
  pagina: string;
  /** El tamaño de cada etiqueta, en milímetros. */
  ancho: number;
  alto: number;
}

/**
 * Dos formatos, porque las dos formas de imprimir que hay en la empresa
 * son distintas:
 *
 * - `a4`: hoja autoadhesiva A4 de 24 etiquetas de 70 × 37 mm, la más
 *   común en librería. Sale en cualquier impresora.
 * - `cinta`: una etiqueta por página, de 62 × 29 mm, para una
 *   etiquetadora de rollo. El navegador corta una página por etiqueta.
 */
export const FORMATOS_ETIQUETA: Record<FormatoEtiqueta, DefinicionFormato> = {
  a4: {
    nombre: "Hoja A4 · 24 etiquetas",
    descripcion: "Hoja autoadhesiva de 3 × 8 etiquetas de 70 × 37 mm.",
    pagina: "size: A4; margin: 0.5mm 0 0 0;",
    ancho: 70,
    alto: 37,
  },
  cinta: {
    nombre: "Etiquetadora · 62 × 29 mm",
    descripcion: "Una etiqueta por página, para impresora de rollo.",
    pagina: "size: 62mm 29mm; margin: 0;",
    ancho: 62,
    alto: 29,
  },
};

export function esFormatoEtiqueta(valor: string | undefined): valor is FormatoEtiqueta {
  return valor === "a4" || valor === "cinta";
}

/** Tope de etiquetas por tanda: más que eso deja la página lenta y no se imprime de una vez. */
export const MAXIMO_ETIQUETAS_POR_TANDA = 240;
