import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/** Cierra la sesion y devuelve a la pantalla de ingreso. */
export async function GET(peticion: NextRequest) {
  const supabase = crearClienteServidor();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${peticion.nextUrl.origin}/ingresar`);
}

export async function POST(peticion: NextRequest) {
  return GET(peticion);
}
