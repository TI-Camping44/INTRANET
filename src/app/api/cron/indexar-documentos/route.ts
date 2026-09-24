import { NextResponse, type NextRequest } from "next/server";
import { revisarSecreto } from "@/lib/trabajos-programados";
import { crearClienteAdministrador } from "@/lib/supabase/administrador";
import { extraerTexto } from "@/lib/extraer-texto";

/**
 * Indexa el texto de los documentos que todavia no lo tienen.
 *
 * El camino normal es otro: al subir un archivo, la propia accion extrae
 * el texto en el momento. Este trabajo existe por dos motivos:
 *
 *   1. Los 58 documentos que ya estaban cargados antes de que esto
 *      existiera. Nadie los va a volver a subir a mano.
 *   2. Los que fallen en la subida. La extraccion NO corta la subida si
 *      algo sale mal —el documento se guarda igual—, asi que sin este
 *      trabajo un archivo raro quedaria fuera del buscador para siempre y
 *      sin que nadie se entere.
 *
 * Es reintentable: mira que falta y hace eso. Correrlo dos veces no
 * duplica nada.
 *
 * Corre con la clave de servicio porque no hay sesion de usuario. Es uno
 * de los dos unicos lugares donde eso esta permitido.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cuanto tiempo se permite trabajar antes de cortar.
 *
 * Se corta por reloj y no por cantidad: un manual de 80 paginas tarda lo
 * que diez formularios de una. Cortando por reloj, cada corrida hace todo
 * lo que entra y la siguiente sigue donde quedo, sin que haya que estimar
 * cuantos documentos entran en un minuto.
 */
const PRESUPUESTO_MS = 45_000;

interface Resumen {
  pendientes: number;
  indexados: number;
  sinTexto: number;
  fallados: number;
  seCortoPorTiempo: boolean;
  /**
   * El motivo de los primeros tropiezos, con el documento al que le
   * pasaron.
   *
   * Sin esto el trabajo devolvia solo numeros, y un «23 sin texto» no
   * dice si los PDF son escaneados o si la biblioteca no cargo. Se
   * guardan los primeros y no todos: alcanza para saber que pasa y evita
   * devolver 23 veces el mismo mensaje.
   */
  motivos: string[];
}

/** Cuantos motivos distintos se devuelven antes de dejar de anotar. */
const MAXIMO_MOTIVOS = 5;

interface AdjuntoDeDocumento {
  id: string;
  entidad_id: string;
  bucket: string;
  ruta: string;
  nombre_archivo: string;
  tipo_mime: string | null;
  creado_en: string;
}

export async function GET(peticion: NextRequest) {
  const rechazo = revisarSecreto(
    peticion.headers.get("authorization"),
    peticion.nextUrl.searchParams.get("secreto"),
  );

  if (rechazo) {
    return NextResponse.json(
      {
        error:
          rechazo === "sin_secreto"
            ? "No hay secreto configurado para los trabajos programados."
            : "El secreto no coincide.",
      },
      { status: 401 },
    );
  }

  const arranque = Date.now();
  const supabase = crearClienteAdministrador();

  // El archivo que rige es el ultimo que se subio, el mismo criterio que
  // usa la pantalla del documento.
  const { data: adjuntos, error: errorAdjuntos } = await supabase
    .from("adjuntos")
    .select("id, entidad_id, bucket, ruta, nombre_archivo, tipo_mime, creado_en")
    .eq("entidad", "documentos")
    .order("creado_en", { ascending: false });

  if (errorAdjuntos) {
    return NextResponse.json({ error: errorAdjuntos.message }, { status: 500 });
  }

  const ultimoPorDocumento = new Map<string, AdjuntoDeDocumento>();
  for (const adjunto of (adjuntos as AdjuntoDeDocumento[] | null) ?? []) {
    // Vienen del mas nuevo al mas viejo: el primero de cada documento gana.
    if (!ultimoPorDocumento.has(adjunto.entidad_id)) {
      ultimoPorDocumento.set(adjunto.entidad_id, adjunto);
    }
  }

  const { data: yaIndexados, error: errorTexto } = await supabase
    .from("documento_texto")
    .select("documento_id, adjunto_id");

  if (errorTexto) {
    return NextResponse.json({ error: errorTexto.message }, { status: 500 });
  }

  const indexadoDe = new Map(
    ((yaIndexados as { documento_id: string; adjunto_id: string | null }[] | null) ?? []).map(
      (fila) => [fila.documento_id, fila.adjunto_id],
    ),
  );

  // Falta indexar si no hay fila, o si la fila apunta a un archivo que ya
  // no es el vigente: eso pasa cuando se reemplaza el archivo del
  // documento, y es justo cuando hay que volver a leerlo.
  const pendientes = Array.from(ultimoPorDocumento.entries()).filter(
    ([documentoId, adjunto]) => indexadoDe.get(documentoId) !== adjunto.id,
  );

  const resumen: Resumen = {
    pendientes: pendientes.length,
    indexados: 0,
    sinTexto: 0,
    fallados: 0,
    seCortoPorTiempo: false,
    motivos: [],
  };

  function anotar(documento: string, motivo: string) {
    if (resumen.motivos.length < MAXIMO_MOTIVOS) {
      resumen.motivos.push(`${documento}: ${motivo}`);
    }
  }

  for (const [documentoId, adjunto] of pendientes) {
    if (Date.now() - arranque > PRESUPUESTO_MS) {
      resumen.seCortoPorTiempo = true;
      break;
    }

    try {
      const { data: archivo, error: errorDescarga } = await supabase.storage
        .from(adjunto.bucket)
        .download(adjunto.ruta);

      if (errorDescarga || !archivo) {
        resumen.fallados += 1;
        anotar(
          adjunto.nombre_archivo,
          `no se pudo bajar del deposito · ${errorDescarga?.message ?? "sin detalle"}`,
        );
        continue;
      }

      const extraido = await extraerTexto(
        await archivo.arrayBuffer(),
        adjunto.nombre_archivo,
        adjunto.tipo_mime,
      );

      // Sin texto no es un fallo: es un formato que no se indexa, o un
      // PDF escaneado. Se cuenta aparte para poder verlo en el resumen.
      if (!extraido) {
        resumen.sinTexto += 1;
        anotar(
          adjunto.nombre_archivo,
          "sin texto · o es un escaneado, o el formato no se indexa",
        );
        continue;
      }

      const { error: errorGuardado } = await supabase.from("documento_texto").upsert(
        {
          documento_id: documentoId,
          adjunto_id: adjunto.id,
          texto: extraido.texto,
          paginas: extraido.paginas,
          extraido_en: new Date().toISOString(),
        },
        { onConflict: "documento_id" },
      );

      if (errorGuardado) {
        resumen.fallados += 1;
        anotar(adjunto.nombre_archivo, `no se pudo guardar · ${errorGuardado.message}`);
      } else {
        resumen.indexados += 1;
      }
    } catch (error) {
      // Un archivo roto no puede cortar la corrida entera: se cuenta, se
      // anota por que, y se sigue con el siguiente.
      resumen.fallados += 1;
      anotar(
        adjunto.nombre_archivo,
        `excepcion · ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  return NextResponse.json({
    ...resumen,
    duracionMs: Date.now() - arranque,
  });
}
