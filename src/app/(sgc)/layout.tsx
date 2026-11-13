import { Cabecera } from "@/components/comunes/cabecera";
import { NavegacionSuperior } from "@/components/comunes/navegacion-superior";
import { esJefeDeVentas } from "@/lib/permisos-ventas";
import { navegacionParaPermisos } from "@/lib/navegacion";
import { obtenerPermisos, requerirUsuario } from "@/lib/sesion";
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
  const permisos = await obtenerPermisos();
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
    // «Mis ventas» aparece para quien vende y tambien para quien
    // supervisa un canal sin vender, como un jefe comercial.
    supabase
      .from("usuarios")
      .select("vendedor_planilla, ventas_canales")
      .eq("id", usuario.id)
      .maybeSingle(),
  ]);

  const datosComerciales = perfil as {
    vendedor_planilla: string | null;
    ventas_canales: string[] | null;
  } | null;

  const grupos = navegacionParaPermisos(usuario.rol, permisos, {
    esComercial:
      Boolean(datosComerciales?.vendedor_planilla) ||
      esJefeDeVentas(usuario.rol, datosComerciales?.ventas_canales ?? null),
  });

  return (
    <div className="min-h-dvh bg-fondo">
      {/* La cabecera y el menu viajan juntos: al desplazar la pagina
          quedan los dos arriba, no solo uno.

          `no-imprimir` para que no salga al imprimir. Va marcado aca y
          no por la etiqueta en el CSS: ocultar todo <header> se llevaba
          por delante el membrete de la carta de evaluacion, que tambien
          es un <header>. */}
      {/* SALTAR LA NAVEGACION. Son sesenta y una entradas de menu entre
          el principio de la pagina y el contenido: quien navega con
          teclado las recorria todas en cada pantalla. Solo se ve al
          enfocarlo, asi que no ocupa lugar para el resto.

          `z-50` para quedar por encima de la cabecera pegajosa, que es
          `z-40`: un enlace de foco tapado por el encabezado no sirve. */}
      <a
        href="#contenido"
        className="no-imprimir sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3
                   focus:z-50 focus:rounded-md focus:bg-primario focus:px-3 focus:py-2
                   focus:text-sm focus:font-medium focus:text-primario-contraste
                   focus:outline-none focus:ring-2 focus:ring-anillo focus:ring-offset-2
                   focus:ring-offset-fondo"
      >
        Saltar al contenido
      </a>

      <div className="no-imprimir sticky top-0 z-40">
        <Cabecera
          usuario={usuario}
          grupos={grupos}
          notificaciones={(notificaciones as Notificacion[] | null) ?? []}
          sinLeer={sinLeer ?? 0}
        />
        <NavegacionSuperior grupos={grupos} />
      </div>

      {/* El relleno de los costados respeta la muesca y las esquinas
          redondeadas del celular: sin esto, en horizontal el borde de
          una tabla queda debajo del recorte de la pantalla.

          `tabIndex={-1}` para que «Saltar al contenido» pueda dejar el
          foco aca; sin eso el navegador mueve la vista pero el foco se
          queda en la barra y el siguiente tabulador vuelve al menu. */}
      <main
        id="contenido"
        tabIndex={-1}
        className="mx-auto max-w-[110rem] py-5 focus-visible:outline-none
                   ps-[max(0.75rem,env(safe-area-inset-left))]
                   pe-[max(0.75rem,env(safe-area-inset-right))]
                   sm:ps-[max(1.25rem,env(safe-area-inset-left))]
                   sm:pe-[max(1.25rem,env(safe-area-inset-right))]
                   lg:ps-[max(1.5rem,env(safe-area-inset-left))]
                   lg:pe-[max(1.5rem,env(safe-area-inset-right))]"
      >
        {children}
      </main>
    </div>
  );
}
