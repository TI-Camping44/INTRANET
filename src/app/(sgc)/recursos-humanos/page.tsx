import { redirect } from "next/navigation";

/**
 * Personas no tiene pantalla propia: tiene dos submódulos.
 *
 * Lo decidió Dirección el 5 de octubre. El perfil de puesto es
 * documental —el puesto y su PDF firmado— y la formación es un plan
 * anual con su calendario: no comparten ni una pantalla ni un criterio,
 * y el tablero que mezclaba las dos cosas más la matriz de competencias
 * no servía para ninguna.
 *
 * La ruta vieja sigue andando y lleva al primero, que es el que se mira
 * todos los días: hay enlaces a `/recursos-humanos` repartidos en
 * notificaciones ya enviadas y en marcadores de la gente.
 */
export default function PaginaPersonas() {
  redirect("/recursos-humanos/puestos");
}
