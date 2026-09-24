import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Download, FileText } from "lucide-react";
import { GuardarEnDrive } from "@/components/comunes/guardar-en-drive";
import { VisorPdf } from "@/components/comunes/visor-pdf";
import { VisorWord } from "@/components/comunes/visor-word";
import { convertirWordAHtml, documentoDeLaVista, esWord } from "@/lib/vista-word";
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
const ES_PDF = /\.pdf$/i;
const ES_IMAGEN = /\.(png|jpe?g|webp|gif|svg)$/i;

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

  const esPdf = ES_PDF.test(adjunto.nombre_archivo);
  const esImagen = ES_IMAGEN.test(adjunto.nombre_archivo);

  // El Word se convierte acá, en el servidor. Se baja el archivo del
  // depósito con la sesión de la persona, así que RLS ya decidió que
  // puede verlo: esta pantalla no agrega permisos.
  const vistaWord = esWord(adjunto.nombre_archivo)
    ? await (async () => {
        const { data } = await supabase.storage.from(adjunto.bucket).download(adjunto.ruta);
        return data ? convertirWordAHtml(await data.arrayBuffer()) : null;
      })()
    : null;

  // El Word va mas ancho: es un formulario con tabla de dos columnas y en
  // una columna de lectura queda apretado. El PDF y las imagenes se
  // quedan como estaban, que ya traen su propio ancho de hoja.
  return (
    <div className={vistaWord ? "mx-auto max-w-7xl" : "mx-auto max-w-5xl"}>
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
        <div className="flex shrink-0 flex-wrap gap-2">
          <Boton variante="contorno" tamano="pequeno" comoHijo>
            <Link href={`/documentos/${params.id}`}>Ver la ficha</Link>
          </Boton>
          <GuardarEnDrive url={paraVer} nombre={adjunto.nombre_archivo} />
          {paraBajar ? (
            <Boton tamano="pequeno" comoHijo>
              <a href={paraBajar.signedUrl}>
                <Download /> Descargar
              </a>
            </Boton>
          ) : null}
        </div>
      </div>

      {/* El PDF lo dibuja el visor propio y no un marco: Chrome puede
          estar configurado para descargar los PDF en vez de mostrarlos, y
          entonces el marco queda en un recuadro gris con un botón. La
          imagen no tiene ese problema y se muestra tal cual. */}
      {esPdf ? (
        <VisorPdf url={paraVer} nombre={adjunto.nombre_archivo} />
      ) : esImagen ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={paraVer}
          alt={adjunto.nombre_archivo}
          className="mx-auto h-auto max-w-full rounded-lg border border-borde"
        />
      ) : vistaWord ? (
        <>
          <VisorWord
            documento={documentoDeLaVista(vistaWord.html, adjunto.nombre_archivo)}
            titulo={adjunto.nombre_archivo}
          />
          <p className="mt-2 text-[11px] leading-relaxed text-atenuado-contraste">
            Vista del documento de Word. La conversión puede perder encabezados, pies de página y
            el corte en páginas: el archivo que rige es el que se descarga.
          </p>
        </>
      ) : (
        <EstadoVacio
          icono={<FileText className="size-6" />}
          titulo="Este formato no se puede ver en el navegador"
          descripcion="Las planillas y las presentaciones se abren en su programa. Descárguelo para leerlo."
        />
      )}
    </div>
  );
}
