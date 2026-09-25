import { NextResponse, type NextRequest } from "next/server";

import { revisarSecreto } from "@/lib/trabajos-programados";
import { crearClienteAdministrador } from "@/lib/supabase/administrador";
import { anotarFalloDeSincronizacion, sincronizarVentas } from "@/lib/sincronizar-ventas";

/**
 * Trae la planilla del informe comercial y deja el resumen guardado.
 *
 * Corre de madrugada, antes que las alertas. La planilla la actualiza a
 * mano quien mantiene el informe, asi que una vez por dia alcanza: la
 * pantalla dice de cuando es el dato y nadie lo confunde con tiempo real.
 *
 * La logica vive en `lib/sincronizar-ventas.ts`. Corre con la clave de
 * servicio porque no hay sesion de usuario: es uno de los dos unicos
 * lugares donde eso esta permitido.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

  // QUE VERSION CONTESTO. Sin esto no hay forma de distinguir «el arreglo
  // no funciono» de «corriste la direccion antes de que terminara el
  // despliegue», y las dos se ven exactamente igual. Ya nos paso una vez.
  const version = process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? "local";
  const supabase = crearClienteAdministrador();

  try {
    const resumen = await sincronizarVentas(supabase);
    return NextResponse.json({ ...resumen, version });
  } catch (error) {
    const motivo = error instanceof Error ? error.message : "desconocido";

    // Queda anotado SIN pisar el ultimo dato bueno: la pantalla sigue
    // mostrando lo de ayer con su fecha, que es util, en vez de un error,
    // que no lo es.
    await anotarFalloDeSincronizacion(supabase, motivo);

    return NextResponse.json({ error: motivo, version }, { status: 500 });
  }
}
