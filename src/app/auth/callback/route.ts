import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { DOMINIO_AUTORIZADO } from "@/lib/constantes";

/**
 * Retorno del ingreso con Google.
 *
 * Aqui se valida el dominio del lado del servidor: aunque alguien logre
 * autenticarse con una cuenta ajena a camping44.com.py, la sesion se
 * cierra antes de entregar cookie alguna. Es la segunda de las tres
 * barreras (parametro hd en Google, esta validacion, y el disparador de
 * la base de datos).
 */
export async function GET(peticion: NextRequest) {
  const { searchParams, origin } = peticion.nextUrl;
  const codigo = searchParams.get("code");
  const continuar = searchParams.get("continuar") ?? "/panel";

  if (!codigo) {
    return NextResponse.redirect(`${origin}/ingresar?error=sin_codigo`);
  }

  let respuesta = NextResponse.redirect(`${origin}${continuar}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return peticion.cookies.getAll();
        },
        setAll(cookiesNuevas: { name: string; value: string; options: CookieOptions }[]) {
          cookiesNuevas.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(codigo);

  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/ingresar?error=intercambio`);
  }

  const dominio = data.user.email?.split("@")[1]?.toLowerCase();

  if (dominio !== DOMINIO_AUTORIZADO) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/sin-acceso?motivo=dominio`);
  }

  // Deja registrado el ingreso; si falla no impide el acceso.
  await supabase
    .from("usuarios")
    .update({ ultimo_ingreso: new Date().toISOString() })
    .eq("id", data.user.id);

  return respuesta;
}
