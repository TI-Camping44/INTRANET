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
}

/** Plantilla sobria, con la marca de Camping 44 y legible en modo oscuro. */
function construirHtml({ titulo, cuerpo, enlace, textoEnlace }: OpcionesCorreo): string {
  const boton = enlace
    ? `<tr><td style="padding:24px 32px 0 32px;">
         <a href="${enlace}" style="display:inline-block;background:#E01E37;color:#ffffff;
            text-decoration:none;padding:11px 20px;border-radius:6px;font-weight:600;
            font-size:14px;">${textoEnlace ?? "Abrir en la Intranet SGC"}</a>
       </td></tr>`
    : "";

  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:0;background:#f4f5f7;
  font-family:Inter,'Helvetica Neue',Arial,sans-serif;color:#14161B;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"
    style="background:#f4f5f7;padding:32px 16px;">
    <tr><td align="center">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0"
        style="max-width:600px;background:#ffffff;border-radius:10px;overflow:hidden;
               border:1px solid #e5e7eb;">
        <tr><td style="background:#14161B;padding:20px 32px;">
          <span style="display:inline-block;background:#E01E37;color:#ffffff;font-weight:700;
                       font-size:15px;letter-spacing:0.5px;padding:6px 10px;border-radius:5px;">
            C44</span>
          <span style="color:#ffffff;font-size:14px;font-weight:600;margin-left:10px;
                       letter-spacing:0.3px;">${NOMBRE_SISTEMA}</span>
        </td></tr>
        <tr><td style="padding:32px 32px 0 32px;">
          <h1 style="margin:0 0 12px 0;font-size:19px;font-weight:600;line-height:1.35;">
            ${titulo}</h1>
          <p style="margin:0;font-size:14px;line-height:1.65;color:#3f4653;">${cuerpo}</p>
        </td></tr>
        ${boton}
        <tr><td style="padding:32px;">
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px 0;" />
          <p style="margin:0;font-size:12px;line-height:1.6;color:#6b7280;">
            Mensaje automático del Sistema de Gestión de Calidad de ${NOMBRE_EMPRESA}.
            No responda a esta dirección.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
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

  const remitente =
    process.env.SMTP_REMITENTE ?? `${NOMBRE_SISTEMA} <${process.env.SMTP_USUARIO}>`;

  try {
    await transporteActual.sendMail({
      from: remitente,
      to: Array.isArray(opciones.para) ? opciones.para.join(", ") : opciones.para,
      subject: opciones.asunto,
      text: `${opciones.titulo}\n\n${opciones.cuerpo}${
        opciones.enlace ? `\n\n${opciones.enlace}` : ""
      }`,
      html: construirHtml(opciones),
    });
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
