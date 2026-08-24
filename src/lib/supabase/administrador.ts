import { createClient } from "@supabase/supabase-js";

/**
 * Cliente con clave de servicio. Ignora las politicas RLS, por lo que su
 * uso queda limitado a procesos sin sesion de usuario:
 *   · el trabajo programado de alertas por vencimiento;
 *   · el script de importacion desde Sofidya.
 *
 * Nunca debe usarse para atender una peticion de la interfaz.
 */
export function crearClienteAdministrador() {
  const clave = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!clave) {
    throw new Error(
      "Falta la variable de entorno SUPABASE_SERVICE_ROLE_KEY. " +
        "Se necesita para los procesos programados.",
    );
  }

  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
