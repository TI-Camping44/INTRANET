import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enviarCorreo, urlAbsoluta } from "@/lib/correo";
import type { TipoNotificacion } from "@/lib/tipos";

/**
 * Alta de notificaciones. La escritura pasa siempre por la funcion
 * public.crear_notificacion de la base de datos, que valida que emisor y
 * destinatario pertenezcan a la misma empresa y evita duplicar la misma
 * alerta en corridas sucesivas del trabajo programado.
 */

interface DatosNotificacion {
  usuarioId: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  enlace?: string | null;
  entidad?: string | null;
  entidadId?: string | null;
  /** Identificador logico para no repetir la misma alerta. */
  claveUnicidad?: string | null;
  enviarPorCorreo?: boolean;
  /**
   * Quien origino el aviso. El correo sale con su nombre en la bandeja y
   * la respuesta le vuelve a esa persona. Se omite en los avisos del
   * trabajo programado, que no los origina nadie.
   */
  deParteDe?: { nombre: string; correo?: string | null } | null;
}

/**
 * De parte de quien sale el aviso.
 *
 * Se le pasa el usuario que esta haciendo la operacion. El correo sale
 * igual desde la casilla del sistema, pero en la bandeja se lee su
 * nombre y la respuesta le vuelve a esa persona.
 */
export function departe(usuario: { nombre_completo: string; correo: string }) {
  return { nombre: usuario.nombre_completo, correo: usuario.correo };
}

/**
 * El segundo boton del correo, deducido de lo que la notificacion ya
 * guarda.
 *
 * SE DEDUCE Y NO SE GUARDA, y ese es el punto. El correo sale por dos
 * caminos: el envio dentro de la peticion, que tiene un tope de seis
 * segundos y casi nunca llega, y el reenvio de las 11:00, que es por
 * donde sale practicamente todo. El reenvio lee la fila de
 * `notificaciones`, que tiene una sola columna `enlace`: si el segundo
 * boton viajara como parametro, se perderia justo en el camino por el
 * que se entrega el correo de verdad. Deduciendolo de `tipo` y
 * `entidad_id` los dos caminos mandan el mismo mensaje, sin columna
 * nueva.
 *
 * DEVUELVE LOS DOS BOTONES, no solo el segundo, y el primero PISA al
 * `enlace` guardado. Las 212 filas escritas antes del 19 de noviembre
 * guardan el enlace viejo —el del formulario— y el reenvio las toma tal
 * como estan: rotular ese enlace «Ver la no conformidad» seria mandar un
 * boton que miente. Deduciendo los dos de `entidad_id`, una fila vieja y
 * una nueva salen igual y no hay que corregir nada en la base.
 *
 * Hoy lo usa un solo aviso. Cuando aparezca el segundo, se agrega acá y
 * los dos caminos lo toman solos.
 */
export function botonesDelAviso(datos: {
  tipo?: string | null;
  entidadId?: string | null;
}): { enlace: string; texto: string; enlaceSecundario: string; textoSecundario: string } | null {
  if (datos.tipo === "no_conformidad_por_responder" && datos.entidadId) {
    return {
      enlace: `/no-conformidades/${datos.entidadId}`,
      texto: "Ver la no conformidad",
      enlaceSecundario: `/acciones/nueva?nc=${datos.entidadId}`,
      textoSecundario: "Cargar la acción correctiva",
    };
  }

  return null;
}

export async function crearNotificacion(
  supabase: SupabaseClient,
  datos: DatosNotificacion,
): Promise<string | null> {
  const { data, error } = await supabase.rpc("crear_notificacion", {
    p_usuario_id: datos.usuarioId,
    p_tipo: datos.tipo,
    p_titulo: datos.titulo,
    p_mensaje: datos.mensaje,
    p_enlace: datos.enlace ?? null,
    p_entidad: datos.entidad ?? null,
    p_entidad_id: datos.entidadId ?? null,
    p_clave_unicidad: datos.claveUnicidad ?? null,
    p_requiere_correo: datos.enviarPorCorreo ?? true,
  });

  if (error) {
    console.error("[notificaciones] No se pudo registrar la notificación:", error.message);
    return null;
  }

  return (data as string | null) ?? null;
}

/**
 * Tope de espera del envio de correo dentro de una peticion.
 *
 * El correo no puede demorar la respuesta que ve la persona. Si el SMTP
 * no contesta a tiempo, la notificacion queda registrada con
 * correo_enviado = false y el trabajo programado la reintenta.
 */
const ESPERA_MAXIMA_CORREO = 6000;

async function conTope<T>(promesa: Promise<T>, respaldo: T): Promise<T> {
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  const limite = new Promise<T>((resolver) => {
    temporizador = setTimeout(() => resolver(respaldo), ESPERA_MAXIMA_CORREO);
  });

  try {
    return await Promise.race([promesa, limite]);
  } finally {
    if (temporizador) clearTimeout(temporizador);
  }
}

/**
 * Registra la notificacion y despacha el correo correspondiente.
 *
 * Ni el fallo ni la lentitud del correo interrumpen la operacion: la
 * notificacion dentro de la aplicacion ya quedo guardada y el envio tiene
 * un tope de espera.
 */
export async function notificar(
  supabase: SupabaseClient,
  datos: DatosNotificacion & { correoDestino?: string | null },
): Promise<void> {
  const id = await crearNotificacion(supabase, datos);

  // Si no hay id, la alerta ya existía (clave de unicidad) y no se reenvía.
  if (!id || datos.enviarPorCorreo === false || !datos.correoDestino) return;

  const botones = botonesDelAviso({ tipo: datos.tipo, entidadId: datos.entidadId });

  const enviado = await conTope(
    enviarCorreo({
      para: datos.correoDestino,
      asunto: datos.titulo,
      titulo: datos.titulo,
      cuerpo: datos.mensaje,
      enlace: urlAbsoluta(botones?.enlace ?? datos.enlace),
      textoEnlace: botones?.texto,
      enlaceSecundario: botones ? urlAbsoluta(botones.enlaceSecundario) : null,
      textoEnlaceSecundario: botones?.textoSecundario,
      deParteDe: datos.deParteDe,
    }),
    false,
  );

  if (enviado) {
    await supabase
      .from("notificaciones")
      .update({ correo_enviado: true, correo_enviado_en: new Date().toISOString() })
      .eq("id", id);
  }
}

/** Notifica a varias personas la misma novedad. */
export async function notificarAVarios(
  supabase: SupabaseClient,
  destinatarios: { id: string; correo: string | null }[],
  datos: Omit<DatosNotificacion, "usuarioId">,
): Promise<void> {
  await Promise.all(
    destinatarios.map((destinatario) =>
      notificar(supabase, {
        ...datos,
        usuarioId: destinatario.id,
        correoDestino: destinatario.correo,
      }),
    ),
  );
}
