/**
 * Secreto de los trabajos programados.
 *
 * El nombre de la variable no es una eleccion nuestra sino un contrato
 * con Vercel: cuando dispara un trabajo de `vercel.json`, agrega la
 * cabecera `Authorization: Bearer …` con el valor de `CRON_SECRET`, y
 * solo si la variable se llama asi, en ingles y exactamente asi.
 *
 * El proyecto la habia llamado `CRON_SECRETO`, siguiendo la convencion
 * de escribir todo en espanol. La consecuencia fue silenciosa y grave:
 * Vercel no encontraba `CRON_SECRET`, no mandaba la cabecera, la ruta de
 * alertas devolvia 401 y el trabajo diario no corrio nunca. Sin aviso,
 * porque un 401 en un trabajo programado no se lo cuenta a nadie.
 *
 * Asi que aca mandan las reglas de Vercel: se lee `CRON_SECRET`. Se
 * acepta `CRON_SECRETO` como alternativa para no romper los despliegues
 * que ya la tienen cargada, pero la buena es la primera.
 */
export function secretoDeTrabajosProgramados(): string | undefined {
  return process.env.CRON_SECRET ?? process.env.CRON_SECRETO;
}

/** Motivo por el que una peticion a un trabajo programado no procede. */
export type RechazoDeTrabajo = "sin_secreto" | "secreto_incorrecto";

/**
 * Comprueba el secreto de una peticion. Devuelve `null` si esta en
 * regla, y si no, por que no.
 *
 * Los dos motivos se distinguen a proposito: «no autorizado» a secas
 * manda a buscar el problema donde no esta.
 */
export function revisarSecreto(
  cabeceraAutorizacion: string | null,
  secretoEnElEnlace?: string | null,
): RechazoDeTrabajo | null {
  const secreto = secretoDeTrabajosProgramados();
  if (!secreto) return "sin_secreto";

  if (cabeceraAutorizacion === `Bearer ${secreto}`) return null;
  if (secretoEnElEnlace && secretoEnElEnlace === secreto) return null;

  return "secreto_incorrecto";
}
