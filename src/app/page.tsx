import { redirect } from "next/navigation";

/**
 * La raiz lleva al inicio de la intranet. Direccion pidio que lo
 * primero que se vea al entrar sean los anuncios internos, no el tablero
 * de calidad: el SGC es una seccion, no la portada.
 */
export default function PaginaRaiz() {
  redirect("/inicio");
}
