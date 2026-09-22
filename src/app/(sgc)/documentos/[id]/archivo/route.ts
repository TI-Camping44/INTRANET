import { NextResponse, type NextRequest } from "next/server";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/**
 * Abre el archivo del documento.
 *
 * En el listado, tocar el código o el título lleva acá y no a la ficha.
 * Lo que la gente busca cuando entra al control documental es el
 * procedimiento, no su historial de versiones: la ficha sigue a un clic,
 * en la columna de la derecha, pero deja de ser el peaje obligatorio.
 *
 * El enlace firmado se genera recién acá, en el momento del clic, y dura
 * cinco minutos. Nunca se dibuja en el HTML del listado: eso pondría
 * cincuenta y ocho enlaces vivos a archivos privados en una página que
 * queda en la caché del navegador.
 *
 * Se firma SIN `download`, a diferencia del panel de la ficha: acá se
 * quiere ver el PDF en el navegador, no bajarlo a la carpeta de descargas.
 *
 * La consulta va con el cliente de sesión, así que RLS decide. Quien no
 * pueda ver el documento no ve el archivo: la redirección no agrega
 * permisos.
 */
export async function GET(
  peticion: NextRequest,
  { params }: { params: { id: string } },
) {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const ficha = new URL(`/documentos/${params.id}`, peticion.nextUrl.origin);

  const { data: adjunto } = await supabase
    .from("adjuntos")
    .select("bucket, ruta")
    .eq("entidad", "documentos")
    .eq("entidad_id", params.id)
    // El último que se subió es la versión que rige: al aprobar una
    // versión nueva se adjunta el archivo nuevo.
    .order("creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Sin archivo cargado no hay nada que abrir, y un error tampoco sirve:
  // se cae a la ficha, que explica el estado del documento.
  if (!adjunto) return NextResponse.redirect(ficha);

  const { data } = await supabase.storage
    .from(adjunto.bucket)
    .createSignedUrl(adjunto.ruta, 300);

  if (!data) return NextResponse.redirect(ficha);

  return NextResponse.redirect(data.signedUrl);
}
