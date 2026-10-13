/**
 * Las dos empresas del grupo, y cómo se distingue una de la otra.
 *
 * VITALICA SE DISTINGUE POR COLOR, no por una pantalla aparte. La regla
 * la fijó Dirección y vale en todo el sistema: donde un registro declara
 * de qué empresa del grupo es, lo de Vitalica va en naranja.
 *
 * **Se compara por nombre y no por id.** El id no puede salir de un
 * `select` a `empresas`, porque RLS acota esa tabla a la propia y la fila
 * de Vitalica vuelve vacía; la lista llega por `empresas_del_grupo()`,
 * que es `SECURITY DEFINER`. Comparar por texto es además lo que hace
 * que la marca no aparezca el día que cambie la forma jurídica o alguien
 * escriba «VITALICA» al cargar la empresa.
 *
 * **El naranja es `--vitalica` y no `--semaforo-alto`**, que es del mismo
 * tono: un semáforo dice «cuidado», y acá el color solo dice de qué
 * empresa es el registro.
 *
 * Ojo con `empresa_id`: es el inquilino de RLS y **siempre** vale
 * Camping 44. De qué empresa habla el registro lo dice una columna
 * aparte —`empresa_auditada_id`, `empresa_del_puesto_id`,
 * `empresa_compradora_id`, `empresa_afectada_id`,
 * `empresa_documento_id`, `empresa_de_la_aplicacion_id`—. Mirando
 * `empresa_id` no se marcaría nunca nada.
 */

/** Una de las dos, como las devuelve `empresas_del_grupo()`. */
export interface EmpresaDelGrupo {
  id: string;
  nombre: string;
}

/** Si el nombre corresponde a Vitalica. */
export function esDeVitalica(nombre: string | null | undefined): boolean {
  return (nombre ?? "").trim().toLowerCase().startsWith("vitalica");
}

/**
 * El nombre de cada empresa por su id, para resolver una columna sin
 * repetir el `Map` en cada pantalla.
 */
export function nombrePorEmpresa(empresas: EmpresaDelGrupo[]): Map<string, string> {
  return new Map(empresas.map((empresa) => [empresa.id, empresa.nombre]));
}
