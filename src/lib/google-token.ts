/**
 * Lo mínimo para hablar con Google desde el navegador.
 *
 * Vive aparte del selector de Drive porque ahora hay dos cosas que
 * necesitan un token: elegir un archivo del Drive de la persona y
 * guardarle un archivo en su Drive. Las dos usan el mismo permiso y el
 * mismo camino; repetirlo en dos lados sería tener dos formas de pedir
 * lo mismo y arreglar los errores en una sola.
 *
 * El permiso se le pide a quien aprieta el botón, en el momento de
 * apretarlo, y nunca al ingresar a la intranet. Quien no use Drive nunca
 * ve un pedido de permiso.
 *
 * El token vive en la memoria del navegador, dura una hora y no llega
 * nunca al servidor: los archivos los sube y los baja la propia máquina
 * de la persona.
 */

import { ALCANCE_DRIVE } from "@/lib/google-drive";

interface RespuestaToken {
  access_token?: string;
  error?: string;
}

interface ClienteToken {
  requestAccessToken: () => void;
}

interface VentanaConGoogle extends Window {
  gapi?: { load: (biblioteca: string, listo: () => void) => void };
  google?: {
    accounts?: {
      oauth2: {
        initTokenClient: (opciones: {
          client_id: string;
          scope: string;
          callback: (respuesta: RespuestaToken) => void;
          error_callback: () => void;
        }) => ClienteToken;
      };
    };
  };
}

export function ventanaConGoogle(): VentanaConGoogle {
  return window as VentanaConGoogle;
}

const cargadas = new Map<string, Promise<void>>();

export function cargarGuion(url: string): Promise<void> {
  const yaEsta = cargadas.get(url);
  if (yaEsta) return yaEsta;

  const promesa = new Promise<void>((resolver, rechazar) => {
    const guion = document.createElement("script");
    guion.src = url;
    guion.async = true;
    guion.onload = () => resolver();
    guion.onerror = () => rechazar(new Error(`No se pudo cargar ${url}`));
    document.head.appendChild(guion);
  });

  cargadas.set(url, promesa);
  return promesa;
}

export function cargarGis(): Promise<void> {
  return cargarGuion("https://accounts.google.com/gsi/client");
}

/** Pide a Google un permiso acotado a los archivos que la persona elija o cree. */
export function pedirToken(clienteId: string): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const cuentas = ventanaConGoogle().google?.accounts;
    if (!cuentas) return rechazar(new Error("No se pudo cargar el ingreso de Google."));

    cuentas.oauth2
      .initTokenClient({
        client_id: clienteId,
        scope: ALCANCE_DRIVE,
        callback: (respuesta) => {
          if (respuesta.access_token) resolver(respuesta.access_token);
          else rechazar(new Error(respuesta.error ?? "permiso_denegado"));
        },
        error_callback: () => rechazar(new Error("permiso_denegado")),
      })
      .requestAccessToken();
  });
}
