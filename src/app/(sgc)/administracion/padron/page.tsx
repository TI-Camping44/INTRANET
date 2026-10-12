import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

/**
 * El padrón se unificó con Usuarios el 12 de octubre.
 *
 * ERAN DOS LISTAS DE LA MISMA GENTE. «Padrón de la nómina» mostraba las
 * 55 personas que pueden entrar y «Usuarios y roles» las que ya entraron,
 * en dos entradas distintas del menú: quien iba a configurar a alguien
 * tenía que saber de antemano en cuál de las dos caía esa persona, que es
 * justo lo que no se sabe.
 *
 * LA RUTA SE DEJA Y REDIRIGE en vez de borrarse: está en el historial de
 * los navegadores, en la bitácora y en los enlaces que alguien pudo
 * haberse guardado. Una ruta que deja de existir devuelve un 404 que no
 * explica nada; esta lleva a donde está ahora lo que se buscaba.
 */
export default function PaginaPadron() {
  redirect("/administracion/usuarios");
}
