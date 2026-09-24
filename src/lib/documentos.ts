/**
 * La jerarquía de la lista maestra, leída del código.
 *
 * Calidad codifica así:
 *
 *   MP-EST-01      Información Documentada      ← el manual del proceso
 *     F-EST-01-02  Minuta de Reunión            ← un formulario suyo
 *     IT-EST-01-01 Instructivo de archivo       ← un instructivo suyo
 *
 * El código ya dice de quién depende cada documento, así que el árbol no
 * hay que armarlo a mano: la clave del proceso son los dos tramos del
 * medio —`EST-01`— y lo que cambia adelante es el tipo y atrás el
 * correlativo.
 *
 * Se usa el código y no la columna `proceso_id` a propósito. El código es
 * lo que Calidad escribe y revisa, está impreso en el documento y es lo
 * que un auditor busca; `proceso_id` es un campo que alguien puede
 * olvidarse de completar, y de hecho se olvida.
 */

/** Los dos tramos del medio: `F-EST-01-02` → `EST-01`. */
export function claveDeProceso(codigo: string | null): string | null {
  if (!codigo) return null;
  const tramos = codigo.split("-");
  if (tramos.length < 3) return null;
  return `${tramos[1]}-${tramos[2]}`;
}

/**
 * Si el código es el del manual del proceso, es decir tres tramos:
 * `MP-EST-01` sí, `F-EST-01-02` no.
 */
export function esCodigoDeProceso(codigo: string | null): boolean {
  if (!codigo) return false;
  return codigo.split("-").length === 3;
}

export interface DocumentoConCodigo {
  id: string;
  codigo: string | null;
}

/**
 * Arma el árbol: devuelve, para cada documento padre, sus hijos, y el
 * conjunto de los que son hijos de alguien.
 *
 * Un documento es hijo cuando su clave de proceso tiene un padre cargado
 * y él mismo no es ese padre. Si el manual del proceso no existe todavía
 * —se cargó el formulario antes que el manual— el formulario no cuelga
 * de nadie y se muestra donde le toque: colgarlo de un padre que no está
 * lo haría desaparecer del listado.
 */
export function armarJerarquia<T extends DocumentoConCodigo>(
  documentos: T[],
): { hijosPorPadre: Map<string, T[]>; esHijo: Set<string> } {
  const padrePorClave = new Map<string, T>();

  for (const documento of documentos) {
    if (!esCodigoDeProceso(documento.codigo)) continue;
    const clave = claveDeProceso(documento.codigo);
    // El primero gana. Dos manuales con el mismo código no deberían
    // existir —el código es único— pero si pasara, no se pierde ninguno:
    // el segundo queda como documento suelto y se ve.
    if (clave && !padrePorClave.has(clave)) padrePorClave.set(clave, documento);
  }

  const hijosPorPadre = new Map<string, T[]>();
  const esHijo = new Set<string>();

  for (const documento of documentos) {
    if (esCodigoDeProceso(documento.codigo)) continue;
    const clave = claveDeProceso(documento.codigo);
    if (!clave) continue;

    const padre = padrePorClave.get(clave);
    if (!padre || padre.id === documento.id) continue;

    const suyos = hijosPorPadre.get(padre.id) ?? [];
    suyos.push(documento);
    hijosPorPadre.set(padre.id, suyos);
    esHijo.add(documento.id);
  }

  // Los hijos van por código, que es como Calidad los numera y como se
  // los espera leer: 01, 02, 03.
  for (const suyos of Array.from(hijosPorPadre.values())) {
    suyos.sort((uno, otro) => (uno.codigo ?? "").localeCompare(otro.codigo ?? "", "es"));
  }

  return { hijosPorPadre, esHijo };
}
