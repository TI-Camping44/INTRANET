import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Combina clases de Tailwind resolviendo los conflictos entre ellas. */
export function cn(...clases: ClassValue[]) {
  return twMerge(clsx(clases));
}

/** Convierte un valor de enumeracion (mayor_mejor) en texto legible. */
export function humanizar(valor: string | null | undefined) {
  if (!valor) return "";
  const texto = valor.replace(/_/g, " ");
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

/** Recorta un texto largo para las tablas densas. */
export function recortar(texto: string | null | undefined, largo = 90) {
  if (!texto) return "";
  return texto.length > largo ? `${texto.slice(0, largo).trimEnd()}…` : texto;
}

/** Iniciales de una persona, para el avatar. */
export function iniciales(nombre: string | null | undefined) {
  if (!nombre) return "?";
  return nombre
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((parte) => parte[0]?.toUpperCase() ?? "")
    .join("");
}

/**
 * El texto sin tildes y en minúsculas, para comparar lo que la gente
 * escribe. «Políticas» y «politicas» son lo mismo.
 *
 * El rango `̀-ͯ` son las marcas diacríticas que `NFD` separa
 * de su letra. Se escribe así y no con `\p{Diacritic}`, que necesita la
 * bandera `u` y el objetivo de TypeScript del proyecto no la admite.
 */
export function sinTildes(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
    .toLowerCase();
}
