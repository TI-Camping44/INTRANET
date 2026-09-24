"use client";

import * as React from "react";
import { toast } from "sonner";
import { HardDrive } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import {
  MENSAJE_VENTANA_BLOQUEADA,
  PERMISO_DENEGADO,
  VENTANA_BLOQUEADA,
  cargarGis,
  pedirToken,
} from "@/lib/google-token";

/**
 * Guarda una copia del archivo en el Drive de quien está mirando.
 *
 * Es el camino inverso al selector: ahí se trae un archivo del Drive a
 * la intranet, acá se lleva uno de la intranet al Drive de la persona.
 * Lo pidió Calidad para poder trabajar sobre una copia sin bajar el
 * archivo al escritorio y volver a subirlo.
 *
 * Es una COPIA y queda suelta en el Drive de esa persona. No es el
 * documento del SGC: si lo edita ahí, edita su copia, y la versión que
 * rige sigue siendo la de la intranet. Es lo correcto —lo contrario
 * sería abrir una puerta para modificar un documento aprobado sin pasar
 * por el control de cambios— pero conviene que quien lo use lo sepa, así
 * que el aviso lo dice.
 *
 * El archivo lo sube el navegador con el token de la persona: pasa de su
 * máquina a su Drive. El servidor de la intranet no interviene más que
 * para entregarle los bytes, y el token nunca sale de su navegador.
 */
export function GuardarEnDrive({
  url,
  nombre,
  variante = "contorno",
  abrir = false,
}: {
  /** Dirección interna que entrega el archivo. */
  url: string;
  nombre: string;
  variante?: "contorno" | "fantasma";
  /**
   * Abrir el archivo en Drive apenas termine de subir.
   *
   * Se usa con lo que la intranet no muestra igual de bien que Drive:
   * Word, Excel, PowerPoint. El PDF no lo usa, porque para leerlo ya está
   * el visor propio y mandarlo a otra pestaña sería dar un rodeo.
   */
  abrir?: boolean;
}) {
  const clienteId = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
  const [guardando, definirGuardando] = React.useState(false);

  // El guion de Google se trae al abrir la pantalla, no al apretar el
  // botón: la ventana de permiso solo se puede abrir en los segundos que
  // siguen al clic, y esa descarga en el medio alcanza para que el
  // navegador la bloquee. Ver `pedirToken`.
  React.useEffect(() => {
    if (!clienteId) return;
    void cargarGis().catch(() => {});
  }, [clienteId]);

  // Sin el identificador de Google el botón no tiene con qué pedir
  // permiso, así que no se dibuja. Es la misma regla del selector.
  if (!clienteId) return null;

  async function guardar() {
    definirGuardando(true);

    // LA PESTAÑA SE ABRE ACA, EN EL CLIC, y no cuando termina la subida.
    // El navegador solo deja abrir una pestaña dentro de los segundos que
    // siguen al clic; pedida despues de esperar la subida, la bloquea. Se
    // abre vacia y se le pone la direccion cuando el archivo ya esta
    // arriba. Es el mismo problema que tuvimos con la ventana de permiso
    // de Google, resuelto del mismo modo.
    const pestana = abrir ? window.open("", "_blank", "noopener,noreferrer") : null;

    try {
      await cargarGis();
      const token = await pedirToken(clienteId!);

      const respuesta = await fetch(url);
      if (!respuesta.ok) throw new Error("No se pudo leer el archivo de la intranet.");
      const contenido = await respuesta.blob();

      const cuerpo = new FormData();
      cuerpo.append(
        "metadata",
        new Blob([JSON.stringify({ name: nombre })], { type: "application/json" }),
      );
      cuerpo.append("file", contenido);

      const subida = await fetch(
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,webViewLink",
        { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: cuerpo },
      );

      if (!subida.ok) {
        const detalle = await subida.text();
        throw new Error(`Google rechazó la subida. ${detalle.slice(0, 120)}`);
      }

      const creado = (await subida.json()) as { webViewLink?: string };

      if (pestana && creado.webViewLink) {
        pestana.location.href = creado.webViewLink;
        toast.success("Abierto en su Drive.", {
          description: "Es una copia suya: editarla no cambia el documento del SGC.",
        });
        return;
      }

      // Si la pestaña no se pudo abrir —el navegador la bloqueo— el
      // archivo igual quedo subido: se ofrece el enlace en el aviso en vez
      // de perder el trabajo hecho.
      pestana?.close();

      toast.success(abrir ? "Guardado en su Drive." : "Copia guardada en su Drive.", {
        description: "Es una copia suya: editarla no cambia el documento del SGC.",
        action: creado.webViewLink
          ? {
              label: "Abrir en Drive",
              onClick: () => window.open(creado.webViewLink, "_blank", "noopener,noreferrer"),
            }
          : undefined,
      });
    } catch (error) {
      // La pestaña vacia no se deja abierta si la subida fallo.
      pestana?.close();
      const motivo = error instanceof Error ? error.message : "";
      toast.error(
        motivo === VENTANA_BLOQUEADA
          ? MENSAJE_VENTANA_BLOQUEADA
          : motivo === PERMISO_DENEGADO
            ? "Hace falta autorizar el acceso a su Drive para guardar la copia."
            : `No se pudo guardar en Drive. ${motivo}`,
      );
    } finally {
      definirGuardando(false);
    }
  }

  return (
    <Boton variante={variante} tamano="pequeno" cargando={guardando} onClick={guardar}>
      <HardDrive /> {abrir ? "Abrir en Drive" : "Guardar en mi Drive"}
    </Boton>
  );
}
