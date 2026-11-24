import { redirect } from "next/navigation";

/**
 * Informática no tiene pantalla de portada: tiene sus submódulos. La ruta
 * del grupo lleva al registro de avances y cambios, que es lo primero del
 * menú y lo que más se mira, así un enlace a `/informatica` no termina en
 * un 404.
 */
export default function PaginaInformatica() {
  redirect("/informatica/avances");
}
