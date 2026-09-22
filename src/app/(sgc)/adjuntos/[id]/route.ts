import { NextResponse, type NextRequest } from "next/server";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/**
 * Abre cualquier archivo del bucket por su id de adjunto.
 *
 * Una sola ruta para todos los módulos: la evidencia de un hallazgo, el
 * archivo de un documento, lo que venga. Lo que decide si se puede o no
 * es RLS sobre `adjuntos`, con la sesión de la persona: si la consulta no
 * devuelve la fila, no hay enlace que firmar.
 *
 * El enlace firmado se genera recién acá, en el momento del clic, y dura
 * cinco minutos. Nunca se dibuja en el HTML de una página: eso dejaría
 * enlaces vivos a archivos privados en la caché del navegador.
 */
export async function GET(_peticion: NextRequest, { params }: { params: { id: string } }) {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const { data: adjunto } = await supabase
    .from("adjuntos")
    .select("bucket, ruta")
    .eq("id", params.id)
    .maybeSingle();

  if (!adjunto) {
    return NextResponse.json({ error: "El archivo no existe o no tiene acceso." }, { status: 404 });
  }

  const { data } = await supabase.storage.from(adjunto.bucket).createSignedUrl(adjunto.ruta, 300);

  if (!data) {
    return NextResponse.json({ error: "No se pudo generar el enlace." }, { status: 500 });
  }

  return NextResponse.redirect(data.signedUrl);
}
