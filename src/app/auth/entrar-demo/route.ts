// TEMPORAL · solo para capturar pantallas en local. Se elimina al terminar.
import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export async function GET(peticion: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "no disponible" }, { status: 404 });
  }
  const correo = peticion.nextUrl.searchParams.get("correo");
  const destino = peticion.nextUrl.searchParams.get("ir") ?? "/panel";
  if (!correo) return NextResponse.json({ error: "falta correo" }, { status: 400 });
  const supabase = crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: correo, password: "demo" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.redirect(new URL(destino, peticion.nextUrl.origin));
}
