import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/** Dominio unico autorizado para ingresar al sistema. */
export const DOMINIO_AUTORIZADO = "camping44.com.py";

/** Rutas accesibles sin sesion iniciada. */
const RUTAS_PUBLICAS = ["/ingresar", "/auth", "/sin-acceso", "/api/cron"];

function esRutaPublica(ruta: string) {
  return RUTAS_PUBLICAS.some((publica) => ruta === publica || ruta.startsWith(`${publica}/`));
}

/**
 * Renueva la sesion en cada peticion y corta el paso a quien no tenga
 * sesion valida o no pertenezca al dominio autorizado. La validacion de
 * dominio se repite aqui, en el servidor, ademas de en la base de datos:
 * la interfaz por si sola no es un control de acceso.
 */
export async function actualizarSesion(peticion: NextRequest) {
  let respuesta = NextResponse.next({ request: peticion });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return peticion.cookies.getAll();
        },
        setAll(cookiesNuevas: { name: string; value: string; options: CookieOptions }[]) {
          cookiesNuevas.forEach(({ name, value }) => peticion.cookies.set(name, value));
          respuesta = NextResponse.next({ request: peticion });
          cookiesNuevas.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user: usuario },
  } = await supabase.auth.getUser();

  const ruta = peticion.nextUrl.pathname;

  if (!usuario) {
    if (esRutaPublica(ruta)) return respuesta;
    const destino = peticion.nextUrl.clone();
    destino.pathname = "/ingresar";
    destino.searchParams.set("continuar", ruta);
    return NextResponse.redirect(destino);
  }

  const dominio = usuario.email?.split("@")[1]?.toLowerCase();
  if (dominio !== DOMINIO_AUTORIZADO) {
    await supabase.auth.signOut();
    const destino = peticion.nextUrl.clone();
    destino.pathname = "/sin-acceso";
    destino.searchParams.set("motivo", "dominio");
    return NextResponse.redirect(destino);
  }

  // Con sesion valida, la pantalla de ingreso pierde sentido.
  if (ruta === "/ingresar") {
    const destino = peticion.nextUrl.clone();
    destino.pathname = "/panel";
    destino.search = "";
    return NextResponse.redirect(destino);
  }

  return respuesta;
}
