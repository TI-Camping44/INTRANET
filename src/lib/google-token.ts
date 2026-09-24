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

interface FalloToken {
  type?: string;
  message?: string;
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
          error_callback: (fallo: FalloToken) => void;
        }) => ClienteToken;
      };
    };
  };
}

export function ventanaConGoogle(): VentanaConGoogle {
  return window as VentanaConGoogle;
}

/**
 * Motivos que se distinguen al pedir el token.
 *
 * `VENTANA_BLOQUEADA` importa porque no es culpa de la persona ni de un
 * permiso mal dado: es el navegador tapando la ventana de Google. Sin
 * separarlo, el aviso le pide autorizar algo que nunca llegó a ver.
 */
export const VENTANA_BLOQUEADA = "ventana_bloqueada";
export const PERMISO_DENEGADO = "permiso_denegado";

export const MENSAJE_VENTANA_BLOQUEADA =
  "El navegador bloqueó la ventana de Google. Permita las ventanas emergentes " +
  "para este sitio y vuelva a intentar.";

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

/**
 * Pide a Google un permiso acotado a los archivos que la persona elija o cree.
 *
 * Abre una ventana emergente, y esa ventana solo se puede abrir dentro de
 * los pocos segundos que siguen al clic. Por eso quien llame a esta
 * función tiene que llegar hasta acá sin esperar nada por el camino: los
 * guiones de Google se cargan al abrir la pantalla, no al apretar el
 * botón. Si se cargan en el medio, la descarga se come el plazo y el
 * navegador tapa la ventana.
 */
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
          else rechazar(new Error(respuesta.error ?? PERMISO_DENEGADO));
        },
        error_callback: (fallo) =>
          rechazar(
            new Error(
              fallo?.type === "popup_failed_to_open" ? VENTANA_BLOQUEADA : PERMISO_DENEGADO,
            ),
          ),
      })
      .requestAccessToken();
  });
}
