import type { Metadata } from "next";
import { puedeGestionar, requerirUsuario } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { hoyEnAsuncion } from "@/lib/formato";
import { PUBLICACIONES_EN_INICIO, estaVigente } from "@/lib/publicaciones";
import {
  BUCKET_IMAGENES,
  DURACION_ENLACE_IMAGEN,
  esRutaDelBucket,
} from "@/lib/imagenes";
import {
  proximasEfemerides,
  MAXIMO_EN_LA_FRANJA,
  type Efemeride,
} from "@/lib/efemerides";
import { FranjaEfemerides } from "./franja-efemerides";
import { MuroPublicaciones, type Publicacion } from "./muro-publicaciones";

export const metadata: Metadata = { title: "Inicio" };
export const dynamic = "force-dynamic";

export default async function PaginaInicio() {
  const usuario = await requerirUsuario();
  const supabase = crearClienteServidor();

  const [{ data: publicaciones }, { data: efemerides }] = await Promise.all([
    supabase
      .from("publicaciones")
      .select(
        "id, tipo, titulo, cuerpo, resumen, estado, fijada, fecha_publicacion," +
          " fecha_vencimiento, url_imagen, usuario_referido_id, proceso_id," +
          " autor:creado_por (nombre_completo, url_avatar)," +
          " referido:usuario_referido_id (nombre_completo, url_avatar)," +
          " procesos:proceso_id (nombre)," +
          " documento:documento_id (id, codigo, titulo)",
      )
      .order("fijada", { ascending: false })
      .order("fecha_publicacion", { ascending: false, nullsFirst: false })
      .limit(60),
    supabase.from("vista_efemerides").select("*"),
  ]);

  const hoy = hoyEnAsuncion();

  // El muro muestra lo publicado y vigente. El borrador propio y lo
  // archivado se ven, pero mas abajo: RLS ya filtro lo que no corresponde.
  const visibles = (
    (publicaciones ?? []) as unknown as (Publicacion & {
      url_imagen: string | null;
    })[]
  )
    .filter(
      (publicacion) =>
        publicacion.estado !== "publicada" ||
        estaVigente(publicacion.fecha_vencimiento, hoy),
    )
    .slice(0, PUBLICACIONES_EN_INICIO);

  // Las imagenes viven en un bucket privado: nada se sirve por direccion
  // directa. Se firman aca, en el servidor, y solo las de las
  // publicaciones que efectivamente se van a dibujar.
  const rutas = visibles
    .map((publicacion) => publicacion.url_imagen)
    .filter((ruta): ruta is string => esRutaDelBucket(ruta));

  const firmadas = new Map<string, string>();
  if (rutas.length > 0) {
    const { data: enlaces } = await supabase.storage
      .from(BUCKET_IMAGENES)
      .createSignedUrls(rutas, DURACION_ENLACE_IMAGEN);

    for (const enlace of enlaces ?? []) {
      if (enlace.path && enlace.signedUrl)
        firmadas.set(enlace.path, enlace.signedUrl);
    }
  }

  // Los documentos anexados a una publicacion —el formulario en PDF de un
  // aviso de Capital Humano, la ficha tecnica de una novedad— viven en
  // `adjuntos` y tambien se entregan firmados.
  interface AnexoDePublicacion {
    id: string;
    entidad_id: string;
    nombre_archivo: string;
    tamano_bytes: number;
    ruta: string;
  }

  // Con el muro vacio no se consulta: un `in` con lista vacia no tiene
  // respuesta util y ademas es un viaje a la base para nada.
  let listaAnexos: AnexoDePublicacion[] = [];
  if (visibles.length > 0) {
    const { data: anexos } = await supabase
      .from("adjuntos")
      .select("id, entidad_id, nombre_archivo, tamano_bytes, ruta")
      .eq("entidad", "publicaciones")
      .in(
        "entidad_id",
        visibles.map((publicacion) => publicacion.id),
      )
      // Por orden de carga: ahora que las imagenes anexas se dibujan en
      // la tarjeta, sin un orden fijo la galeria se reacomodaba sola
      // entre una recarga y otra.
      .order("creado_en", { ascending: true });

    listaAnexos = (anexos as AnexoDePublicacion[] | null) ?? [];
  }

  const firmadosAnexos = new Map<string, string>();
  if (listaAnexos.length > 0) {
    const { data: enlaces } = await supabase.storage
      .from(BUCKET_IMAGENES)
      .createSignedUrls(
        listaAnexos.map((anexo) => anexo.ruta),
        DURACION_ENLACE_IMAGEN,
      );

    for (const enlace of enlaces ?? []) {
      if (enlace.path && enlace.signedUrl)
        firmadosAnexos.set(enlace.path, enlace.signedUrl);
    }
  }

  const listaPublicaciones: Publicacion[] = visibles.map((publicacion) => ({
    ...publicacion,
    // Una direccion externa se usa tal cual; una ruta del bucket, firmada.
    imagen: esRutaDelBucket(publicacion.url_imagen)
      ? (firmadas.get(publicacion.url_imagen!) ?? null)
      : publicacion.url_imagen,
    anexos: listaAnexos
      .filter((anexo) => anexo.entidad_id === publicacion.id)
      .map((anexo) => ({
        id: anexo.id,
        nombre: anexo.nombre_archivo,
        tamano: anexo.tamano_bytes,
        enlace: firmadosAnexos.get(anexo.ruta) ?? null,
      })),
  }));

  // De hoy en adelante y por 30 dias corridos. La ventana y el orden
  // viven en `lib/efemerides.ts`: antes el techo era el fin de mes y la
  // tarjeta se vaciaba sola cada vez que se acababa la hoja.
  const proximas = proximasEfemerides(
    (efemerides ?? []) as unknown as Efemeride[],
    hoy,
  ).slice(0, MAXIMO_EN_LA_FRANJA);

  const gestiona = puedeGestionar(usuario);
  const primerNombre = usuario.nombre_completo.split(" ")[0];

  return (
    // UNA SOLA COLUMNA DE LECTURA. El muro estaba en dos tercios de una
    // grilla de tres y el tercio restante lo ocupaba la tarjeta de
    // cumpleaños; al subir la franja, ese tercio quedaba vacío. Se topea
    // el ancho porque el contenedor del sistema llega a 110rem y una
    // publicación de texto a ese ancho deja renglones imposibles de
    // seguir.
    <div className="max-w-5xl">
      <div className="mb-5">
        <h1 className="text-xl font-semibold tracking-tight">
          Hola, {primerNombre}
        </h1>
        <p className="mt-1 text-sm text-atenuado-contraste">
          Lo que pasa en Camping 44, en un solo lugar.
        </p>
      </div>

      <FranjaEfemerides proximas={proximas} />

      <MuroPublicaciones
        publicaciones={listaPublicaciones}
        puedeGestionar={gestiona}
      />
    </div>
  );
}
