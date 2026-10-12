"use server";

import { revalidatePath } from "next/cache";

import { enviarCorreo, urlAbsoluta } from "@/lib/correo";
import { departe } from "@/lib/notificaciones";
import { requerirRol } from "@/lib/sesion";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { DOMINIOS_AUTORIZADOS_TEXTO, NOMBRE_SISTEMA } from "@/lib/constantes";
import type { ResultadoAccion } from "@/lib/tipos";

/**
 * La invitación a ingresar, desde el padrón de la nómina.
 *
 * EL PERFIL NO SE PUEDE PRECARGAR: `usuarios.id` es clave foránea de
 * `auth.users(id)`, así que la fila no existe hasta el primer ingreso con
 * Google. De las 55 personas del padrón entraron 2, y hasta que entren no
 * se les puede asignar nada. Avisarle a cada una era un trabajo que había
 * que hacer por fuera del sistema; ahora sale de acá y queda registrado.
 *
 * NO MANDA UN ENLACE DE ACCESO DIRECTO, y es a propósito. El correo lleva
 * a `/ingresar` y la persona entra con su cuenta de Google. Un enlace
 * mágico crearía el usuario sin pasar por Google, y con eso se cae la
 * primera de las tres capas de validación de dominio. La invitación
 * avisa; quien autoriza sigue siendo Google.
 */

/**
 * Cuántas invitaciones manda como máximo un envío a los pendientes.
 *
 * NO SON LAS 53 DE UNA. Cada correo puede tardar, y una acción de
 * servidor que manda cincuenta envíos seguidos se queda sin tiempo a la
 * mitad: la mitad sale, la otra no, y nadie sabe cuál fue cuál. Con un
 * tope, el resultado siempre dice cuántas salieron y cuántas quedan, y se
 * vuelve a tocar el botón.
 */
const MAXIMO_POR_TANDA = 10;

interface PersonaDelPadron {
  id: string;
  correo: string;
  nombre_completo: string;
  usuario_id: string | null;
  invitaciones_enviadas: number;
}

/**
 * El texto del aviso.
 *
 * ES UNO SOLO para la invitación de a una, la tanda y la prueba: si la
 * prueba armara su propio texto, lo que se mira antes de mandarle a 53
 * personas no sería lo que esas 53 personas van a recibir.
 */
function armarCorreo(
  destinatario: { correo: string; nombre_completo: string },
  enlace: string | null,
) {
  const nombre =
    destinatario.nombre_completo.split(" ")[0] ?? destinatario.nombre_completo;

  return {
    para: destinatario.correo,
    asunto: `Su acceso a la ${NOMBRE_SISTEMA}`,
    titulo: `${nombre}, ya puede entrar a la ${NOMBRE_SISTEMA}`,
    cuerpo:
      "La intranet reúne las publicaciones internas, el directorio de personas, los " +
      "accesos a las aplicaciones que ya usa y el Sistema de Gestión de Calidad.<br><br>" +
      "<strong>No hay que crear ninguna contraseña.</strong> Entre al enlace, toque " +
      "«Ingresar con Google» y elija su cuenta de trabajo " +
      `—la que termina en ${DOMINIOS_AUTORIZADOS_TEXTO}—. Su perfil se arma solo, con los ` +
      "datos que ya están cargados.<br><br>" +
      "Si no le aparece su cuenta de trabajo en la lista, es porque está con una cuenta " +
      "personal: cierre esa sesión en el navegador o use una ventana de incógnito.",
    enlace,
    textoEnlace: "Ingresar a la intranet",
  };
}

/** Marca en el padrón que el aviso salió, y quién lo mandó. */
async function registrarEnvio(
  supabase: ReturnType<typeof crearClienteServidor>,
  persona: PersonaDelPadron,
  administradorId: string,
) {
  await supabase
    .from("personas_nomina")
    .update({
      invitado_en: new Date().toISOString(),
      invitado_por: administradorId,
      invitaciones_enviadas: persona.invitaciones_enviadas + 1,
    })
    .eq("id", persona.id);
}

/**
 * Le manda a una persona del padrón el aviso para que entre.
 */
export async function invitarAlSistema(personaId: string): Promise<ResultadoAccion> {
  const administrador = await requerirRol(["administrador_sgc"]);
  const supabase = crearClienteServidor();

  const { data, error } = await supabase
    .from("personas_nomina")
    .select("id, correo, nombre_completo, usuario_id, invitaciones_enviadas")
    .eq("id", personaId)
    .maybeSingle();

  if (error || !data) {
    return { exito: false, error: "No se encontró a esa persona en el padrón." };
  }

  const persona = data as PersonaDelPadron;

  // Quien ya entró no necesita el aviso, y mandárselo igual lo haría
  // dudar de si perdió el acceso.
  if (persona.usuario_id) {
    return {
      exito: false,
      error: `${persona.nombre_completo} ya ingresó al sistema: no hace falta invitarla.`,
    };
  }

  const enlace = urlAbsoluta("/ingresar");
  const enviado = await enviarCorreo({
    ...armarCorreo(persona, enlace),
    deParteDe: departe(administrador),
  });

  if (!enviado) {
    return {
      exito: false,
      error:
        "No se pudo enviar el correo. Revise la configuración del SMTP; el aviso no quedó " +
        "registrado como enviado.",
    };
  }

  await registrarEnvio(supabase, persona, administrador.id);
  revalidatePath("/administracion/padron");

  return { exito: true, mensaje: `Aviso enviado a ${persona.correo}.` };
}

/**
 * Le manda el aviso a los pendientes, de a tandas.
 *
 * Prioriza a quien nunca recibió uno: si quedan 53 por avisar, lo que no
 * sirve es insistirle cuatro veces a la misma persona mientras otras no
 * se enteraron nunca.
 */
export async function invitarAPendientes(): Promise<ResultadoAccion> {
  const administrador = await requerirRol(["administrador_sgc"]);
  const supabase = crearClienteServidor();

  const { data, error } = await supabase
    .from("personas_nomina")
    .select("id, correo, nombre_completo, usuario_id, invitaciones_enviadas")
    .eq("activo", true)
    .is("usuario_id", null)
    .order("invitaciones_enviadas", { ascending: true })
    .order("nombre_completo")
    .limit(MAXIMO_POR_TANDA);

  if (error) {
    return { exito: false, error: "No se pudo leer el padrón." };
  }

  const pendientes = (data ?? []) as PersonaDelPadron[];

  if (pendientes.length === 0) {
    return { exito: false, error: "No queda nadie pendiente: ya ingresaron todos." };
  }

  const enlace = urlAbsoluta("/ingresar");
  let enviados = 0;
  const fallaron: string[] = [];

  for (const persona of pendientes) {
    const enviado = await enviarCorreo({
      ...armarCorreo(persona, enlace),
      deParteDe: departe(administrador),
    });

    if (enviado) {
      await registrarEnvio(supabase, persona, administrador.id);
      enviados += 1;
    } else {
      fallaron.push(persona.correo);
    }
  }

  // Cuántos quedan después de esta tanda, para que el botón diga la
  // verdad en vez de dejar adivinando si terminó.
  const { count } = await supabase
    .from("personas_nomina")
    .select("id", { count: "exact", head: true })
    .eq("activo", true)
    .is("usuario_id", null)
    .eq("invitaciones_enviadas", 0);

  revalidatePath("/administracion/padron");

  if (enviados === 0) {
    return {
      exito: false,
      error: "No salió ninguno. Revise la configuración del SMTP.",
    };
  }

  const restantes = count ?? 0;

  return {
    exito: true,
    mensaje:
      `Se enviaron ${enviados} avisos.` +
      (restantes > 0 ? ` Quedan ${restantes} sin avisar: vuelva a tocar el botón.` : "") +
      (fallaron.length > 0 ? ` No salieron ${fallaron.length}: ${fallaron.join(", ")}.` : ""),
  };
}

/**
 * Manda el aviso al propio administrador, para verlo antes de mandárselo
 * a nadie.
 *
 * HACE FALTA PORQUE QUIEN TIENE QUE REVISARLO NO LO PUEDE RECIBIR: el
 * botón de cada fila solo aparece en quien todavía no ingresó, y el
 * Administrador SGC ingresó por definición. Sin esto, la única forma de
 * ver cómo queda el correo sería mandárselo a alguien de verdad.
 *
 * NO TOCA EL PADRÓN. No marca a nadie como invitado ni suma al contador:
 * una prueba no es un aviso enviado, y contarla haría que el padrón
 * mienta sobre a quién se le avisó.
 *
 * El cuerpo es idéntico al que sale de verdad; lo único distinto es el
 * «[Prueba]» del asunto, para que en la bandeja no se confunda con el
 * aviso real cuando empiecen a llegar las respuestas.
 */
export async function enviarInvitacionDePrueba(): Promise<ResultadoAccion> {
  const administrador = await requerirRol(["administrador_sgc"]);

  const correo = armarCorreo(
    { correo: administrador.correo, nombre_completo: administrador.nombre_completo },
    urlAbsoluta("/ingresar"),
  );

  const enviado = await enviarCorreo({
    ...correo,
    asunto: `[Prueba] ${correo.asunto}`,
    deParteDe: departe(administrador),
  });

  if (!enviado) {
    return {
      exito: false,
      error:
        "No se pudo enviar. Revise que SMTP_HOST, SMTP_USUARIO y SMTP_CLAVE estén cargados " +
        "en el proyecto: si falla acá, también va a fallar con el resto.",
    };
  }

  return {
    exito: true,
    mensaje: `Prueba enviada a ${administrador.correo}. Es el mismo correo que les va a llegar.`,
  };
}
