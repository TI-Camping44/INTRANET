import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";

export const metadata: Metadata = { title: "Archivo del documento" };
export const dynamic = "force-dynamic";

/**
 * El archivo del documento, abierto para leerlo.
 *
 * En el listado, tocar el código o el título lleva acá. Lo que la gente
 * busca cuando entra al control documental es el procedimiento, no su
 * historial de versiones: la ficha sigue a un clic, en su columna, pero
 * deja de ser el peaje obligatorio.
 *
 * Hasta ahora esto redirigía al enlace firmado y el navegador decidía:
 * con un PDF servido como descarga, el archivo caía en la carpeta de
 * descargas sin mostrarse nunca. Ahora se dibuja acá, con el botón de
 * bajarlo al lado, y la decisión es de la persona.
 *
 * El enlace firmado se genera recién acá, en el momento del clic, y dura
 * cinco minutos. Nunca se dibuja en el HTML del listado: eso pondría
 * cincuenta y ocho enlaces vivos a archivos privados en una página que
 * queda en la caché del navegador.
 *
 * La consulta va con el cliente de sesión, así que RLS decide. Quien no
 * pueda ver el documento no ve el archivo: esta pantalla no agrega
 * permisos.
 */
const VISIBLES_EN_EL_NAVEGADOR = /\.(pdf|png|jpe?g|webp|gif|svg)$/i;

export default async function PaginaArchivoDocumento({
  params,
}: {
  params: { id: string };
}) {
  await requerirUsuario();
  const supabase = crearClienteServidor();

  const [{ data: documento }, { data: adjunto }] = await Promise.all([
    supabase.from("documentos").select("id, codigo, titulo").eq("id", params.id).maybeSingle(),
    supabase
      .from("adjuntos")
      .select("bucket, ruta, nombre_archivo")
      .eq("entidad", "documentos")
      .eq("entidad_id", params.id)
      // El último que se subió es la versión que rige: al aprobar una
      // versión nueva se adjunta el archivo nuevo.
      .order("creado_en", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  // Sin archivo cargado no hay nada que abrir, y un error tampoco sirve:
  // se cae a la ficha, que explica el estado del documento.
  if (!documento) redirect("/documentos");
  if (!adjunto) redirect(`/documentos/${params.id}`);

  // Para ver, el archivo se pide a una dirección de la intranet que lo
  // entrega con la cabecera «inline». El enlace firmado de Storage no
  // sirve para eso: el navegador lo toma como descarga y dibuja su
  // propio cuadro con un botón «Abrir» en vez del PDF.
  const paraVer = `/documentos/${params.id}/archivo/contenido`;

  const { data: paraBajar } = await supabase.storage
    .from(adjunto.bucket)
    .createSignedUrl(adjunto.ruta, 300, { download: adjunto.nombre_archivo });

  const seVe = VISIBLES_EN_EL_NAVEGADOR.test(adjunto.nombre_archivo);

  return (
    <div className="mx-auto max-w-5xl">
      <Boton variante="fantasma" tamano="pequeno" comoHijo className="mb-3 -ml-2">
        <Link href="/documentos">
          <ArrowLeft /> Volver al listado
        </Link>
      </Boton>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="truncate text-base font-semibold">{documento.titulo}</h1>
          <p className="text-xs text-atenuado-contraste">
            {documento.codigo ? `${documento.codigo} · ` : ""}
            {adjunto.nombre_archivo}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <Boton variante="contorno" tamano="pequeno" comoHijo>
            <Link href={`/documentos/${params.id}`}>Ver la ficha</Link>
          </Boton>
          {paraBajar ? (
            <Boton tamano="pequeno" comoHijo>
              <a href={paraBajar.signedUrl}>
                <Download /> Descargar
              </a>
            </Boton>
          ) : null}
        </div>
      </div>

      {seVe ? (
        <iframe
          src={paraVer}
          title={adjunto.nombre_archivo}
          className="h-[78vh] w-full rounded-lg border border-borde bg-fondo"
        />
      ) : (
        <EstadoVacio
          icono={<FileText className="size-6" />}
          titulo="Este formato no se puede ver en el navegador"
          descripcion="Los documentos de Word y las planillas se abren en su programa. Descárguelo para leerlo."
        />
      )}
    </div>
  );
}
