/**
 * A quién más se le avisa de una acción correctiva.
 *
 * Lo pidió Carlos el 5 de noviembre: cada acción del plan tenía un solo
 * responsable y no había dónde anotar a quién hay que mantener al tanto.
 *
 * INFORMAR NO ES RESPONDER, y de ahí sale todo lo demás. El responsable
 * ejecuta la acción y es contra quien corren el plazo y el escalamiento;
 * el informado se entera. Por eso `informados_ids` no entra en ninguna
 * política: estar informado no habilita a cerrar la tarea de otro.
 *
 * Vive en `lib/` y no en el módulo porque lo usan las dos acciones de
 * servidor que escriben el plan —el alta de la respuesta y su edición— y
 * un archivo `"use server"` solo puede exportar funciones asíncronas.
 */

import { MAXIMO_INFORMADOS } from "@/lib/constantes";

/**
 * Deja la lista de informados en algo que se pueda guardar.
 *
 * Saca tres cosas, y cada una por su motivo:
 *
 * · **Los vacíos**, que es lo que manda el formulario cuando se eligió
 *   «Sin informar a nadie más». Son opcionales: no es un error.
 *
 * · **Los repetidos**, porque los dos desplegables ofrecen la misma
 *   lista y nada impide elegir a la misma persona dos veces. Guardarla
 *   duplicada le mandaría dos correos iguales.
 *
 * · **Al responsable**, si lo eligieron también como informado. Ya
 *   recibe el aviso de asignación, que además dice que la acción es
 *   suya: sumarle el de informado sería mandarle dos correos sobre lo
 *   mismo, y el segundo diciéndole algo más débil que el primero.
 *
 * El tope se aplica al final, y también está en el `CHECK` de la base:
 * la validación de acá da el mensaje en castellano, la de allá es la que
 * no se puede evadir.
 */
export function depurarInformados(
  crudos: (string | null | undefined)[],
  responsableId: string | null,
): string[] {
  const limpios = crudos
    .map((valor) => String(valor ?? "").trim())
    .filter(Boolean)
    .filter((id) => id !== responsableId);

  return Array.from(new Set(limpios)).slice(0, MAXIMO_INFORMADOS);
}

/**
 * Los ids de todas las acciones, sin repetir, para comprobarlos de una
 * sola consulta contra `usuarios`.
 *
 * La columna es un arreglo y PostgreSQL no admite clave foránea sobre un
 * arreglo, así que el control vive en la aplicación, igual que en
 * `guardarAplicacion()`. Un id que no existe no rompe nada, pero
 * guardarlo sería guardar basura que después nadie puede explicar —y el
 * aviso no le llegaría a nadie—.
 */
export function idsAComprobar(porAccion: string[][]): string[] {
  return Array.from(new Set(porAccion.flat()));
}
