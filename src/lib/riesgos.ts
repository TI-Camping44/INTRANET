import type { NivelRiesgo } from "@/lib/tipos";

/**
 * Matriz 5x5 de riesgos. Nivel = Probabilidad x Impacto.
 * Los umbrales del semaforo replican los de la base de datos
 * (funcion public.etiqueta_nivel_riesgo en la migracion 005): si se
 * modifican aqui, deben modificarse alli tambien.
 */
export function nivelDeRiesgo(probabilidad: number, impacto: number): number {
  return probabilidad * impacto;
}

export function etiquetaNivelRiesgo(nivel: number | null | undefined): NivelRiesgo | null {
  if (nivel === null || nivel === undefined) return null;
  if (nivel <= 4) return "bajo";
  if (nivel <= 9) return "medio";
  if (nivel <= 14) return "alto";
  return "critico";
}

/** Clases de Tailwind para el semaforo, con contraste suficiente en ambos temas. */
export const CLASES_NIVEL_RIESGO: Record<NivelRiesgo, string> = {
  bajo: "bg-semaforo-bajo/15 text-semaforo-bajo border-semaforo-bajo/30",
  medio: "bg-semaforo-medio/15 text-semaforo-medio border-semaforo-medio/30",
  alto: "bg-semaforo-alto/15 text-semaforo-alto border-semaforo-alto/30",
  critico: "bg-semaforo-critico/15 text-semaforo-critico border-semaforo-critico/30",
};

/** Relleno solido para las celdas de la matriz. */
export const RELLENO_NIVEL_RIESGO: Record<NivelRiesgo, string> = {
  bajo: "bg-semaforo-bajo/25 hover:bg-semaforo-bajo/40",
  medio: "bg-semaforo-medio/25 hover:bg-semaforo-medio/40",
  alto: "bg-semaforo-alto/30 hover:bg-semaforo-alto/45",
  critico: "bg-semaforo-critico/30 hover:bg-semaforo-critico/45",
};

/** Periodicidad de reevaluacion en dias, segun nivel. */
export function diasReevaluacion(nivel: number | null | undefined): number {
  const etiqueta = etiquetaNivelRiesgo(nivel);
  switch (etiqueta) {
    case "critico":
      return 30;
    case "alto":
      return 90;
    case "medio":
      return 180;
    default:
      return 365;
  }
}

/** Un riesgo alto o critico exige atencion en el tablero de Direccion. */
export function esRiesgoRelevante(nivel: number | null | undefined): boolean {
  const etiqueta = etiquetaNivelRiesgo(nivel);
  return etiqueta === "alto" || etiqueta === "critico";
}
