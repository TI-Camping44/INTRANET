import { NextResponse, type NextRequest } from "next/server";
import { revisarSecreto } from "@/lib/trabajos-programados";
import { crearClienteAdministrador } from "@/lib/supabase/administrador";
import { indexarDocumentosPendientes } from "@/lib/indexar-documentos";

/**
 * Indexa el texto de los documentos que todavia no lo tienen.
 *
 * El camino normal es otro: al subir un archivo, la propia accion extrae
 * el texto en el momento. Este trabajo existe por dos motivos:
 *
 *   1. Los documentos que ya estaban cargados antes de que esto
 *      existiera. Nadie los va a volver a subir a mano.
 *   2. Los que fallen en la subida. La extraccion NO corta la subida si
 *      algo sale mal —el documento se guarda igual—, asi que sin este
 *      trabajo un archivo raro quedaria fuera del buscador para siempre y
 *      sin que nadie se entere.
 *
 * Es reintentable: mira que falta y hace eso. Correrlo dos veces no
 * duplica nada.
 *
 * La logica vive en `lib/indexar-documentos.ts`, compartida con el boton
 * «Reindexar» del listado. Corre con la clave de servicio porque no hay
 * sesion de usuario: es uno de los dos unicos lugares donde eso esta
 * permitido.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Cuanto tiempo se permite trabajar antes de cortar.
 *
 * Se corta por reloj y no por cantidad: un manual de 80 paginas tarda lo
 * que diez formularios de una. Cortando por reloj, cada corrida hace todo
 * lo que entra y la siguiente sigue donde quedo.
 */
const PRESUPUESTO_MS = 45_000;

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

  try {
    const resumen = await indexarDocumentosPendientes(
      crearClienteAdministrador(),
      PRESUPUESTO_MS,
    );

    return NextResponse.json({
      ...resumen,
      duracionMs: Date.now() - arranque,
      // QUE VERSION CONTESTO. Sin esto no hay forma de distinguir «el
      // arreglo no funciono» de «corriste la direccion antes de que
      // terminara el despliegue», y las dos se ven exactamente igual: el
      // mismo error, palabra por palabra. Ya nos paso una vez.
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local",
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
