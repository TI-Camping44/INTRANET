"use client";

import * as React from "react";
import { toast } from "sonner";
import { HardDrive } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import {
  ALCANCE_DRIVE,
  esNativoDeGoogle,
  formatoDeExportacion,
  mimesParaElSelector,
  nombreExportado,
} from "@/lib/google-drive";
import type { TipoDocumento } from "@/lib/tipos";

/**
 * Las dos bibliotecas de Google no traen tipos. Se declara acá lo poco
 * que se usa —y solo eso— en lugar de tratarlas como `any`: si Google
 * cambia una firma, el error aparece al compilar y no en producción.
 */
interface RespuestaToken {
  access_token?: string;
  error?: string;
}

interface ClienteToken {
  requestAccessToken: () => void;
}

interface VistaDocumentos {
  setIncludeFolders: (valor: boolean) => VistaDocumentos;
  setSelectFolderEnabled: (valor: boolean) => VistaDocumentos;
  setEnableDrives: (valor: boolean) => VistaDocumentos;
  setMimeTypes: (mimes: string) => VistaDocumentos;
}

interface ConstructorSelector {
  setOAuthToken: (token: string) => ConstructorSelector;
  setDeveloperKey: (clave: string) => ConstructorSelector;
  setLocale: (idioma: string) => ConstructorSelector;
  setTitle: (titulo: string) => ConstructorSelector;
  addView: (vista: unknown) => ConstructorSelector;
  setCallback: (
    manejador: (datos: { action: string; docs?: ArchivoElegido[] }) => void,
  ) => ConstructorSelector;
  build: () => { setVisible: (visible: boolean) => void };
}

interface ApiPicker {
  ViewId: { DOCS: string };
  Action: { PICKED: string; CANCEL: string };
  DocsView: new (vista: string) => VistaDocumentos;
  DocsUploadView: new () => unknown;
  PickerBuilder: new () => ConstructorSelector;
}

interface VentanaConGoogle extends Window {
  gapi?: { load: (biblioteca: string, listo: () => void) => void };
  google?: {
    picker?: ApiPicker;
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

function ventana(): VentanaConGoogle {
  return window as VentanaConGoogle;
}

/**
 * Botón que abre el Drive de la persona y devuelve el archivo elegido.
 *
 * Devuelve un `File`, igual que un `<input type="file">`. Es a propósito:
 * quien lo usa no tiene que saber de dónde salió el archivo, y el camino
 * de subida —la regla de formato, el límite de tamaño, el registro en
 * `adjuntos`— es exactamente el mismo para los dos orígenes.
 *
 * El archivo lo baja el navegador con el token de la persona. El servidor
 * nunca ve ese token, y Google nunca ve nuestra base.
 */

/** Las dos bibliotecas de Google que hacen falta, cargadas una sola vez. */
let promesaGis: Promise<void> | null = null;
let promesaPicker: Promise<void> | null = null;

function cargarGuion(url: string): Promise<void> {
  return new Promise((resolver, rechazar) => {
    const guion = document.createElement("script");
    guion.src = url;
    guion.async = true;
    guion.onload = () => resolver();
    guion.onerror = () => rechazar(new Error(`No se pudo cargar ${url}`));
    document.head.appendChild(guion);
  });
}

function cargarGis(): Promise<void> {
  promesaGis ??= cargarGuion("https://accounts.google.com/gsi/client");
  return promesaGis;
}

function cargarPicker(): Promise<void> {
  promesaPicker ??= cargarGuion("https://apis.google.com/js/api.js").then(
    () =>
      new Promise<void>((resolver, rechazar) => {
        const gapi = ventana().gapi;
        if (!gapi) return rechazar(new Error("No se pudo cargar el selector de Google."));
        gapi.load("picker", () => resolver());
      }),
  );
  return promesaPicker;
}

/** Pide a Google un permiso acotado a los archivos que la persona elija. */
function pedirToken(clienteId: string): Promise<string> {
  return new Promise((resolver, rechazar) => {
    const cuentas = ventana().google?.accounts;
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

interface ArchivoElegido {
  id: string;
  name: string;
  mimeType: string;
}

/** Abre el selector y resuelve con el archivo elegido, o null si se cerró. */
function abrirSelector(
  token: string,
  claveApi: string,
  mimes: string[],
): Promise<ArchivoElegido | null> {
  return new Promise((resolver, rechazar) => {
    const picker = ventana().google?.picker;
    if (!picker) return rechazar(new Error("No se pudo cargar el selector de Google."));

    const vista = new picker.DocsView(picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      .setMimeTypes(mimes.join(","));

    // Las unidades compartidas son donde vive el juego documental de la
    // empresa. Sin esto el selector solo muestra «Mi unidad», que es
    // justamente donde el SGC no está.
    const compartidas = new picker.DocsView(picker.ViewId.DOCS)
      .setIncludeFolders(true)
      .setSelectFolderEnabled(false)
      .setEnableDrives(true)
      .setMimeTypes(mimes.join(","));

    const constructor = new picker.PickerBuilder()
      .setOAuthToken(token)
      .setDeveloperKey(claveApi)
      .setLocale("es")
      .setTitle("Elegir un archivo")
      .addView(vista)
      .addView(compartidas)
      .addView(new picker.DocsUploadView())
      .setCallback((datos) => {
        if (datos.action === picker.Action.PICKED) resolver(datos.docs?.[0] ?? null);
        else if (datos.action === picker.Action.CANCEL) resolver(null);
      });

    constructor.build().setVisible(true);
  });
}

/** Baja el archivo de Drive, exportándolo si es nativo de Google. */
async function bajarDeDrive(
  archivo: ArchivoElegido,
  token: string,
  tipoDocumento: TipoDocumento,
): Promise<File> {
  const cabeceras = { Authorization: `Bearer ${token}` };

  if (esNativoDeGoogle(archivo.mimeType)) {
    const formato = formatoDeExportacion(tipoDocumento, archivo.mimeType);
    if (!formato) {
      throw new Error(
        "Ese archivo de Google no se puede convertir a un formato que este tipo de " +
          "documento admita. Expórtelo a mano y súbalo desde la computadora.",
      );
    }

    const respuesta = await fetch(
      `https://www.googleapis.com/drive/v3/files/${archivo.id}/export` +
        `?mimeType=${encodeURIComponent(formato.mime)}`,
      { headers: cabeceras },
    );
    if (!respuesta.ok) throw new Error("No se pudo exportar el archivo desde Drive.");

    const contenido = await respuesta.blob();
    return new File([contenido], nombreExportado(archivo.name, formato.extension), {
      type: formato.mime,
    });
  }

  const respuesta = await fetch(
    `https://www.googleapis.com/drive/v3/files/${archivo.id}?alt=media&supportsAllDrives=true`,
    { headers: cabeceras },
  );
  if (!respuesta.ok) throw new Error("No se pudo descargar el archivo desde Drive.");

  const contenido = await respuesta.blob();
  return new File([contenido], archivo.name, { type: archivo.mimeType });
}

export function SelectorDrive({
  tipoDocumento,
  onElegir,
  deshabilitado,
}: {
  tipoDocumento: TipoDocumento;
  onElegir: (archivo: File) => void | Promise<void>;
  deshabilitado?: boolean;
}) {
  const [trabajando, definirTrabajando] = React.useState(false);

  const clienteId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const claveApi = process.env.NEXT_PUBLIC_GOOGLE_API_KEY;

  // Sin configurar, el botón no existe. La subida desde la computadora
  // sigue andando: es una comodidad que se suma, no un requisito.
  if (!clienteId || !claveApi) return null;

  async function elegir() {
    definirTrabajando(true);
    try {
      await Promise.all([cargarGis(), cargarPicker()]);
      const token = await pedirToken(clienteId!);
      const archivo = await abrirSelector(
        token,
        claveApi!,
        mimesParaElSelector(tipoDocumento),
      );

      if (!archivo) return; // La persona cerró el selector.

      const descargado = await bajarDeDrive(archivo, token, tipoDocumento);
      await onElegir(descargado);
    } catch (error) {
      const motivo = (error as Error).message;
      toast.error(
        motivo === "permiso_denegado"
          ? "Hace falta autorizar el acceso al archivo que elija para poder traerlo."
          : motivo,
      );
    } finally {
      definirTrabajando(false);
    }
  }

  return (
    <Boton
      variante="contorno"
      tamano="pequeno"
      onClick={elegir}
      cargando={trabajando}
      disabled={deshabilitado}
    >
      <HardDrive /> Desde Drive
    </Boton>
  );
}
