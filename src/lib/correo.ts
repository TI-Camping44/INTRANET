import "server-only";
import nodemailer, { type Transporter } from "nodemailer";
import { NOMBRE_EMPRESA, NOMBRE_SISTEMA } from "@/lib/constantes";

/**
 * Envio de correo por el SMTP de Google Workspace.
 *
 * Requiere una cuenta del propio espacio de trabajo (por ejemplo
 * sgc@camping44.com.py) con verificacion en dos pasos y una contrasena de
 * aplicacion. Ver docs/despliegue.md.
 *
 * Si el SMTP no esta configurado, el envio se omite en silencio y queda
 * anotado en el registro del servidor: el centro de notificaciones dentro
 * de la aplicacion sigue funcionando igual.
 */

let transporte: Transporter | null = null;

function obtenerTransporte(): Transporter | null {
  const host = process.env.SMTP_HOST;
  const usuario = process.env.SMTP_USUARIO;
  const clave = process.env.SMTP_CLAVE;

  if (!host || !usuario || !clave) return null;
  if (transporte) return transporte;

  const puerto = Number(process.env.SMTP_PUERTO ?? 465);

  transporte = nodemailer.createTransport({
    host,
    port: puerto,
    secure: puerto === 465,
    auth: { user: usuario, pass: clave },
    // Tiempos de espera cortos: si el SMTP no responde, se falla rapido y
    // la persona no queda esperando. El reenvio lo resuelve el trabajo
    // programado, que reintenta las notificaciones sin correo enviado.
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
  });

  return transporte;
}

export function correoConfigurado(): boolean {
  return obtenerTransporte() !== null;
}

interface OpcionesCorreo {
  para: string | string[];
  asunto: string;
  titulo: string;
  cuerpo: string;
  enlace?: string | null;
  textoEnlace?: string;
  /**
   * Quien origino el aviso: quien asigno la accion, quien mando el
   * documento a revision, quien registro la no conformidad.
   *
   * El correo sale igual desde la casilla del sistema —es la unica con
   * la que el SMTP puede autenticarse— pero se muestra con el nombre de
   * esa persona y la respuesta le vuelve a ella. En la bandeja se lee
   * «Facundo Colman · Intranet», y si el destinatario contesta, le
   * contesta a Facundo y no a una casilla que nadie mira.
   *
   * Poner el correo de la persona en el campo `from` de verdad seria
   * suplantarla: el servidor de Google lo rechaza, y si lo aceptara el
   * mensaje caeria en spam por SPF y DKIM. Para que el remitente real
   * sea la persona hace falta delegacion a nivel del dominio en Google
   * Workspace, que es una configuracion aparte.
   */
  deParteDe?: { nombre: string; correo?: string | null } | null;
}

/**
 * La plantilla del correo.
 *
 * VA EL LOGOTIPO OFICIAL, NO EL «C44». El C44 tipografico lo invento el
 * proyecto y no es el logotipo de la empresa: salio de la barra de la
 * aplicacion el 12 de octubre por eso mismo, y este correo lo seguia
 * usando. Queda solo como respaldo para cuando no hay direccion publica
 * desde donde servir la imagen —sin eso el encabezado quedaria vacio, que
 * es peor—.
 *
 * SOBRE RECUADRO BLANCO, por la misma razon que en la aplicacion: el
 * logotipo tiene las dos armas en negro y sobre la barra oscura
 * desapareceria.
 *
 * LA IMAGEN SE ENLAZA, no se adjunta. Un adjunto en linea hace que el
 * correo figure con clip en la bandeja, como si trajera un archivo para
 * descargar, y en una invitacion eso invita a desconfiar. El `alt` cubre
 * al cliente que bloquea imagenes.
 */
function construirHtml({
  titulo,
  cuerpo,
  enlace,
  textoEnlace,
  deParteDe,
}: OpcionesCorreo): string {
  const boton = enlace
    ? `<tr><td style="padding:24px 32px 0 32px;">
         <a href="${enlace}" style="display:inline-block;background:#E01E37;color:#ffffff;
            text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600;
            font-size:14px;">${textoEnlace ?? `Abrir en la ${NOMBRE_SISTEMA}`}</a>
       </td></tr>`
    : "";

  const logotipo = urlAbsoluta("/logotipo-camping44.png");

  const marca = logotipo
    ? `<td width="44" style="background:#ffffff;border-radius:6px;padding:5px;text-align:center;">
         <img src="${logotipo}" width="34" alt="${NOMBRE_EMPRESA}"
              style="display:block;width:34px;height:auto;border:0;" />
       </td>`
    : `<td width="44" style="text-align:left;">
         <span style="display:inline-block;background:#E01E37;color:#ffffff;font-weight:700;
                      font-size:15px;letter-spacing:0.5px;padding:6px 10px;border-radius:5px;">
           C44</span>
       </td>`;

  /**
   * EL PIE DICE LA VERDAD SOBRE LA RESPUESTA. Decia «No responda a esta
   * direccion» en todos los correos, incluso en los que salen de parte de
   * una persona y llevan su casilla en `replyTo`: quien respondia llegaba
   * igual, y quien leia el pie no respondia cuando convenia que lo
   * hiciera. En una invitacion a ingresar eso importa: la duda tipica
   * —«no me aparece mi cuenta»— se contesta respondiendo.
   */
  const pie = deParteDe
    ? `Mensaje del Sistema de Gestión de Calidad de ${NOMBRE_EMPRESA}.
       Si necesita ayuda, responda a este correo: le llega a ${deParteDe.nombre}.`
    : `Mensaje automático del Sistema de Gestión de Calidad de ${NOMBRE_EMPRESA}.
       No responda a esta dirección.`;

  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#f4f5f7;
  font-family:Inter,'Helvetica Neue',Arial,sans-serif;color:#14161B;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background:#f4f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
        style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;
               border:1px solid #e5e7eb;">
        <tr><td style="background:#14161B;padding:16px 32px;">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0">
            <tr>
              ${marca}
              <td style="padding-left:12px;">
                <span style="color:#ffffff;font-size:14px;font-weight:600;
                             letter-spacing:0.3px;">${NOMBRE_SISTEMA}</span>
              </td>
            </tr>
          </table>
        </td></tr>
        <tr><td style="padding:32px 32px 0 32px;">
          <h1 style="margin:0 0 12px 0;font-size:19px;font-weight:600;line-height:1.35;">
            ${titulo}</h1>
          <p style="margin:0;font-size:14px;line-height:1.65;color:#3f4653;">${cuerpo}</p>
        </td></tr>
        ${boton}
        <tr><td style="padding:32px;">
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px 0;" />
          <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">${pie}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * El mensaje tal como se le entrega al SMTP.
 *
 * Esta en una funcion propia porque lo arman los dos caminos de envio
 * —el que devuelve un booleano y el que devuelve el motivo—, y con el
 * cuerpo duplicado alcanzaba con tocar uno para que los correos de un
 * camino salieran distintos a los del otro.
 */
function armarMensaje(opciones: OpcionesCorreo) {
  const casilla = process.env.SMTP_USUARIO;
  const remitentePorDefecto =
    process.env.SMTP_REMITENTE ?? `${NOMBRE_SISTEMA} <${casilla}>`;

  // Con `deParteDe`, el nombre que se ve en la bandeja es el de quien
  // origino el aviso; la casilla sigue siendo la del sistema.
  const remitente = opciones.deParteDe
    ? `${opciones.deParteDe.nombre} · ${NOMBRE_SISTEMA} <${casilla}>`
    : remitentePorDefecto;

  return {
    from: remitente,
    replyTo: opciones.deParteDe?.correo ?? undefined,
    to: Array.isArray(opciones.para) ? opciones.para.join(", ") : opciones.para,
    subject: opciones.asunto,
    text: `${opciones.titulo}\n\n${opciones.cuerpo}${
      opciones.enlace ? `\n\n${opciones.enlace}` : ""
    }`,
    html: construirHtml(opciones),
  };
}

/** El resultado del envío, con el motivo cuando falla. */
export type ResultadoEnvio = { ok: true } | { ok: false; motivo: string };

/**
 * Traduce el error crudo del SMTP a algo que se pueda leer y accionar.
 *
 * HACE FALTA PORQUE UN SMTP CAIDO ERA INVISIBLE. El envío fallaba, la
 * notificación quedaba con `correo_enviado = false` y el motivo se perdía
 * en `console.error`: el 3 de noviembre se descubrió que no salía un
 * correo desde el 10 de octubre, y para saber por qué había que leer los
 * registros de Vercel. La causa tiene que llegar a quien administra.
 *
 * NO SE INCLUYE NINGUNA CREDENCIAL: el código, la respuesta del servidor
 * y el mensaje de la librería, nada más. La clave nunca viaja en el error
 * y tampoco se la agrega acá.
 */
function motivoDelError(error: unknown): string {
  const detalle = error as {
    code?: string;
    responseCode?: number;
    response?: string;
    message?: string;
  };

  const crudo = [
    detalle.code,
    detalle.responseCode ? `respuesta ${detalle.responseCode}` : null,
    detalle.response ?? detalle.message,
  ]
    .filter(Boolean)
    .join(" · ");

  if (detalle.code === "EAUTH" || detalle.responseCode === 535) {
    return (
      "El servidor rechazó el usuario o la clave. Si la casilla es de Google Workspace con " +
      "verificación en dos pasos, SMTP_CLAVE tiene que ser una contraseña de aplicación, y " +
      "esas se revocan solas cuando se cambia la contraseña de la cuenta o se saca la " +
      `verificación en dos pasos. Detalle: ${crudo}`
    );
  }

  if (
    detalle.code === "ETIMEDOUT" ||
    detalle.code === "ECONNECTION" ||
    detalle.code === "ESOCKET"
  ) {
    return (
      "No se pudo conectar con el servidor de correo. Revise SMTP_HOST y SMTP_PUERTO: con " +
      `el puerto 465 la conexión va cifrada y con 587 no. Detalle: ${crudo}`
    );
  }

  if (detalle.code === "EENVELOPE") {
    return `El servidor no aceptó el remitente o el destinatario. Detalle: ${crudo}`;
  }

  return `El servidor de correo rechazó el envío. Detalle: ${crudo || "sin detalle"}`;
}

/**
 * Como `enviarCorreo`, pero devuelve el motivo cuando falla.
 *
 * Lo usa la prueba de correo de la pantalla de Usuarios, que es donde
 * alguien está mirando y puede hacer algo con la respuesta.
 */
export async function enviarCorreoConDetalle(
  opciones: OpcionesCorreo,
): Promise<ResultadoEnvio> {
  const transporteActual = obtenerTransporte();

  if (!transporteActual) {
    const motivo =
      "El SMTP no está configurado en el proyecto: faltan SMTP_HOST, SMTP_USUARIO o " +
      "SMTP_CLAVE. Mientras falten, ninguna notificación sale por correo.";
    console.warn(`[correo] ${motivo} No se envió "${opciones.asunto}".`);
    return { ok: false, motivo };
  }

  try {
    await transporteActual.sendMail(armarMensaje(opciones));
    return { ok: true };
  } catch (error) {
    console.error("[correo] Falló el envío:", error);
    return { ok: false, motivo: motivoDelError(error) };
  }
}

export async function enviarCorreo(opciones: OpcionesCorreo): Promise<boolean> {
  const transporteActual = obtenerTransporte();

  if (!transporteActual) {
    console.warn(
      `[correo] SMTP no configurado; no se envió "${opciones.asunto}". ` +
        "Defina SMTP_HOST, SMTP_USUARIO y SMTP_CLAVE.",
    );
    return false;
  }

  try {
    await transporteActual.sendMail(armarMensaje(opciones));
    return true;
  } catch (error) {
    console.error("[correo] Falló el envío:", error);
    return false;
  }
}

/** URL absoluta del sistema, para los enlaces de los correos. */
export function urlAbsoluta(ruta: string | null | undefined): string | null {
  if (!ruta) return null;
  const base =
    process.env.NEXT_PUBLIC_SITIO_URL ??
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null);
  if (!base) return null;
  return `${base.replace(/\/$/, "")}${ruta.startsWith("/") ? ruta : `/${ruta}`}`;
}
