/**
 * Reglas del seguimiento de tickets de TI (sección Informática).
 *
 * Los tickets son un ESPEJO de la ticketera de TI —la planilla
 * «TICKETS - BASE»—: los escribe `recibir_ticketera()` desde el Apps
 * Script de la planilla y la intranet solo los muestra. Los estados son
 * texto libre porque los define la planilla; acá solo se los agrupa.
 */

/** Los estados que trae la ticketera, en el orden del circuito. */
export const ESTADOS_TICKET = [
  "Nuevo",
  "En análisis",
  "En espera del usuario",
  "Resuelto",
  "Cerrado",
  "Rechazado",
] as const;

/** Un ticket está abierto mientras no se resolvió, cerró ni rechazó. */
const ESTADOS_TERMINADOS = new Set(["resuelto", "cerrado", "rechazado"]);

function normalizar(texto: string | null | undefined): string {
  return (texto ?? "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

export function ticketAbierto(estado: string | null | undefined): boolean {
  return !ESTADOS_TERMINADOS.has(normalizar(estado));
}

/** La variante de la insignia según el estado. */
export function varianteEstadoTicket(
  estado: string | null | undefined,
): "neutra" | "primaria" | "exito" | "advertencia" | "atencion" | "peligro" {
  switch (normalizar(estado)) {
    case "nuevo":
      return "primaria";
    case "en analisis":
      return "advertencia";
    case "en espera del usuario":
      return "atencion";
    case "resuelto":
    case "cerrado":
      return "exito";
    case "rechazado":
      return "peligro";
    default:
      return "neutra";
  }
}

/** La variante de la insignia según la prioridad. */
export function variantePrioridad(
  prioridad: string | null | undefined,
): "neutra" | "advertencia" | "peligro" {
  const valor = normalizar(prioridad);
  if (valor.startsWith("alta") || valor.startsWith("urgente") || valor.startsWith("critica")) {
    return "peligro";
  }
  if (valor.startsWith("media")) return "advertencia";
  return "neutra";
}

/**
 * Compara sin tildes ni mayúsculas y por partes: «solicitud credito»
 * encuentra «Solicitud de Crédito», como el resto de los buscadores.
 */
export function coincideBusqueda(textos: (string | null | undefined)[], busqueda: string): boolean {
  const partes = normalizar(busqueda).split(/\s+/).filter(Boolean);
  if (partes.length === 0) return true;
  const pajar = normalizar(textos.filter(Boolean).join(" "));
  return partes.every((parte) => pajar.includes(parte));
}

/** La parte del correo antes de la arroba, para mostrar a la persona. */
export function nombreDeCorreo(correo: string | null | undefined): string {
  if (!correo) return "—";
  return correo.split("@")[0] ?? correo;
}
