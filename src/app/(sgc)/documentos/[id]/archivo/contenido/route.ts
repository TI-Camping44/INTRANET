import { NextResponse } from "next/server";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/**
 * Entrega el archivo del documento para verlo en pantalla.
 *
 * Existe porque el enlace firmado de Storage no sirve para mostrar: el
 * navegador recibe el archivo como descarga y, dentro del visor, dibuja
 * su propio cuadro con el nombre y un boton «Abrir» en vez del PDF. No
 * alcanza con no pedir la descarga; hay que decir explicitamente que el
 * contenido va en linea, y eso solo se puede hacer sirviendolo nosotros.
 *
 * El archivo pasa por el servidor en vez de ir directo desde Storage.
 * Cuesta una lectura de hasta 20 MB por vez que alguien abre un
 * documento, y a cambio la direccion firmada no llega nunca al
 * navegador: lo que se ve es una direccion de la intranet, que sin
 * sesion no devuelve nada.
 *
 * La consulta va con el cliente de sesion, asi que RLS decide. Quien no
 * pueda ver el documento tampoco puede ver su archivo.
 */
export async function GET(
  peticion: Request,
  { params }: { params: { id: string } },
) {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  // Sin `adjunto` se entrega el ultimo cargado, que es la version que
  // rige; con el, ese archivo en particular. La ficha tiene varios y el
  // listado uno solo, y los dos usan esta misma direccion.
  const cual = new URL(peticion.url).searchParams.get("adjunto");

  let consulta = supabase
    .from("adjuntos")
    .select("bucket, ruta, nombre_archivo, tipo_mime")
    .eq("entidad", "documentos")
    .eq("entidad_id", params.id);

  consulta = cual
    ? consulta.eq("id", cual)
    : consulta.order("creado_en", { ascending: false });

  const { data: adjunto } = await consulta.limit(1).maybeSingle();

  if (!adjunto) {
    return new NextResponse("Este documento no tiene archivo cargado.", { status: 404 });
  }

  const { data, error } = await supabase.storage.from(adjunto.bucket).download(adjunto.ruta);

  if (error || !data) {
    return new NextResponse("No se pudo leer el archivo.", { status: 502 });
  }

  // El nombre viaja entre comillas y ademas en la forma `filename*`, que
  // es la unica que admite acentos y eñes sin romperse.
  const nombre = adjunto.nombre_archivo ?? "documento";
  const nombreSeguro = nombre.replace(/["\\]/g, "");

  return new NextResponse(data, {
    headers: {
      "Content-Type": adjunto.tipo_mime ?? "application/octet-stream",
      "Content-Disposition":
        `inline; filename="${nombreSeguro}"; ` +
        `filename*=UTF-8''${encodeURIComponent(nombre)}`,
      // Privado y corto: el archivo es interno y puede cambiar al
      // aprobarse una version nueva.
      "Cache-Control": "private, max-age=60",
    },
  });
}
