import { redirect } from "next/navigation";

/** La raiz lleva siempre al panel; el middleware resuelve la sesion. */
export default function PaginaRaiz() {
  redirect("/panel");
}
