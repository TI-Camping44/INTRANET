import { Cabecera } from "@/components/comunes/cabecera";
import { NavegacionSuperior } from "@/components/comunes/navegacion-superior";
import { navegacionParaRol } from "@/lib/navegacion";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import type { Notificacion } from "@/lib/tipos";

/**
 * Estructura comun de todas las pantallas con sesion iniciada.
 *
 * El menu es horizontal y no lateral. Se cambio a pedido de Direccion, y
 * ademas devuelve 240 px de ancho a las pantallas: en un sistema hecho de
 * tablas densas eso son dos o tres columnas mas que se leen sin
 * desplazar.
 *
 * En pantalla chica la barra horizontal no se dibuja y queda el cajon
 * lateral de la cabecera, que muestra el arbol completo. Los dos salen de
 * la misma estructura de `lib/navegacion.ts`.
 */
export default async function SgcLayout({ children }: { children: React.ReactNode }) {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();
  const [{ data: notificaciones }, { count: sinLeer }, { data: perfil }] = await Promise.all([
    supabase
      .from("notificaciones")
      .select("*")
      .eq("usuario_id", usuario.id)
      .order("creado_en", { ascending: false })
      .limit(12),
    supabase
      .from("notificaciones")
      .select("id", { count: "exact", head: true })
      .eq("usuario_id", usuario.id)
      .eq("leida", false),
    // Si esta vinculado al informe comercial, ve «Mis ventas» en el menu.
    supabase.from("usuarios").select("vendedor_planilla").eq("id", usuario.id).maybeSingle(),
  ]);

  const grupos = navegacionParaRol(usuario.rol, {
    esComercial: Boolean((perfil as { vendedor_planilla: string | null } | null)?.vendedor_planilla),
  });

  return (
    <div className="min-h-dvh bg-fondo">
      {/* La cabecera y el menu viajan juntos: al desplazar la pagina
          quedan los dos arriba, no solo uno. */}
      <div className="sticky top-0 z-40">
        <Cabecera
          usuario={usuario}
          grupos={grupos}
          notificaciones={(notificaciones as Notificacion[] | null) ?? []}
          sinLeer={sinLeer ?? 0}
        />
        <NavegacionSuperior grupos={grupos} />
      </div>

      <main className="mx-auto max-w-[110rem] px-3 py-5 sm:px-5 lg:px-6">{children}</main>
    </div>
  );
}
