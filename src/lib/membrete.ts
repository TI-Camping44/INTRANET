import { existsSync } from "node:fs";
import { join } from "node:path";

/**
 * El membrete de los documentos que salen de la empresa.
 *
 * SON DOS EMPRESAS Y DOS LOGOTIPOS. Camping 44 S.A. y Vitálica E.A.S.
 * comparten el sistema, y un documento que se entrega a un tercero tiene
 * que salir con el logotipo de la empresa que lo firma, no con el de la
 * otra.
 *
 * LA BÚSQUEDA IGNORA TILDES Y MAYÚSCULAS. En la base la empresa se llama
 * «Vitálica», con tilde; buscar por el texto exacto es la forma de que el
 * membrete salga sin logotipo el día que alguien escriba «Vitalica» o
 * «VITÁLICA» al cargar la empresa.
 */
const LOGOTIPO_POR_EMPRESA: Record<string, string> = {
  "camping 44": "/logotipo-camping44.png",
  vitalica: "/logotipo-vitalica.png",
};

/** Baja a minúsculas y saca las tildes, para comparar nombres de empresa. */
function normalizar(texto: string): string {
  return texto
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

/**
 * La dirección del logotipo de la empresa, o null si el archivo no está.
 *
 * Se comprueba contra el disco y no se confía en el nombre: un `<img>`
 * apuntando a un archivo que no existe deja un ícono de imagen rota en
 * medio del membrete, que es lo peor que puede llevar una carta que se
 * manda afuera. Es una lectura de `public/`, que es contenido del propio
 * proyecto; no toca nada del sistema de archivos del servidor.
 */
export function logotipoDeEmpresa(nombreEmpresa: string | null | undefined): string | null {
  if (!nombreEmpresa) return null;

  const archivo = LOGOTIPO_POR_EMPRESA[normalizar(nombreEmpresa)];
  if (!archivo) return null;

  return existsSync(join(process.cwd(), "public", archivo.replace(/^\//, ""))) ? archivo : null;
}
