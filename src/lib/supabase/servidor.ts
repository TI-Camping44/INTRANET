import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

/**
 * Cliente de Supabase para componentes de servidor y acciones de servidor.
 * Opera siempre con la sesion de la persona, de modo que las politicas RLS
 * se aplican en cada consulta.
 */
export function crearClienteServidor() {
  const almacenCookies = cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return almacenCookies.getAll();
        },
        setAll(cookiesNuevas: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesNuevas.forEach(({ name, value, options }) => {
              almacenCookies.set(name, value, options);
            });
          } catch {
            // Los componentes de servidor no pueden escribir cookies.
            // La renovacion de sesion la resuelve el middleware.
          }
        },
      },
    },
  );
}
