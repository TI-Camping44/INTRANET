import type { NextRequest } from "next/server";
import { actualizarSesion } from "@/lib/supabase/middleware";

export async function middleware(peticion: NextRequest) {
  return actualizarSesion(peticion);
}

export const config = {
  matcher: [
    /*
     * Se excluyen los archivos estaticos y las imagenes; todo lo demas
     * pasa por la validacion de sesion y de dominio.
     *
     * `pdf.worker.min.mjs` va en la lista por su nombre. Es el hilo que
     * dibuja los PDF, un archivo de la biblioteca sin nada privado
     * adentro. Si pasara por acá, cada vez que alguien abre un documento
     * se dispararia una revalidacion de sesion contra Supabase para
     * entregar un archivo que es igual para todos, y en el momento en que
     * la sesion estuviera vencida el visor quedaria sin su hilo y no
     * dibujaria nada. Lo que el visor pide DENTRO —el documento— si pasa
     * por el control: eso es lo privado.
     */
    "/((?!_next/static|_next/image|favicon.ico|pdf\\.worker\\.min\\.mjs|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
