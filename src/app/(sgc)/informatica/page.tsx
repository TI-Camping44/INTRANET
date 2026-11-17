import { redirect } from "next/navigation";

/**
 * Informática todavía no tiene pantalla propia: tiene un submódulo, los
 * controles periódicos. La ruta del grupo lleva a ese, así un enlace a
 * `/informatica` no termina en un 404 mientras la sección crece.
 */
export default function PaginaInformatica() {
  redirect("/informatica/controles");
}
