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

  const enviado = await conTope(
    enviarCorreo({
      para: datos.correoDestino,
      asunto: datos.titulo,
      titulo: datos.titulo,
      cuerpo: datos.mensaje,
      enlace: urlAbsoluta(datos.enlace),
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
