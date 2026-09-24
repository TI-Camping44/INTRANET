"use client";

import * as React from "react";
import { FileWarning } from "lucide-react";

/**
 * Dibuja el PDF nosotros, en vez de dejárselo al navegador.
 *
 * POR QUÉ. Chrome trae una opción —«Descargar los PDF en lugar de
 * abrirlos automáticamente»— que, cuando está activada, hace que un PDF
 * dentro de un marco no se dibuje: en su lugar aparece un recuadro gris
 * con el nombre del archivo y un botón «Abrir». Le pasó a Calidad. No es
 * un error del servidor: el archivo llega bien, con su tipo y su
 * cabecera correctos, y el navegador decide no mostrarlo.
 *
 * Con cuarenta y nueve personas no se puede ir máquina por máquina
 * revisando esa opción, ni pedirle a cada una que la cambie. Acá el
 * documento se dibuja en un lienzo, que es una imagen común: no hay
 * ajuste del navegador que lo impida, y se ve igual en Chrome, en Edge y
 * en el celular.
 *
 * CÓMO. PDF.js se carga recién cuando esta pantalla se abre, no en el
 * paquete general: pesa más de un megabyte y no tiene por qué viajar con
 * cada página del sistema.
 *
 * El lienzo se dibuja al ancho real de la pantalla multiplicado por su
 * densidad de píxeles. Sin eso, en un monitor de alta densidad el texto
 * se ve borroso, que es exactamente lo que se le reprocha a un visor
 * propio frente al del navegador.
 */

export function VisorPdf({ url, nombre }: { url: string; nombre: string }) {
  const contenedor = React.useRef<HTMLDivElement>(null);
  const [estado, definirEstado] = React.useState<"cargando" | "listo" | "error">("cargando");
  const [paginas, definirPaginas] = React.useState(0);
  const [detalle, definirDetalle] = React.useState<string | null>(null);

  React.useEffect(() => {
    let vigente = true;
    // Se guarda para poder cancelar el dibujo si la persona se va de la
    // pantalla antes de que termine: seguir dibujando sobre un lienzo que
    // ya no está en el documento tira errores en la consola y gasta
    // batería en el celular.
    const dibujos: { cancel: () => void }[] = [];

    async function dibujar() {
      try {
        // La compilacion «legacy»: la moderna usa funciones que los
        // navegadores de hace dos años no tienen y ahi no dibuja nada.
        // La biblioteca y el trabajador tienen que ser la misma: ver
        // `scripts/copiar-visor-pdf.mjs`.
        const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

        const documento = await pdfjs.getDocument({ url }).promise;
        if (!vigente) return;

        definirPaginas(documento.numPages);

        const caja = contenedor.current;
        if (!caja) return;
        caja.replaceChildren();

        // El ancho disponible, o uno razonable si todavía no se midió.
        const ancho = caja.clientWidth || 800;
        const densidad = Math.min(window.devicePixelRatio || 1, 2);

        for (let numero = 1; numero <= documento.numPages; numero += 1) {
          const pagina = await documento.getPage(numero);
          if (!vigente) return;

          const original = pagina.getViewport({ scale: 1 });
          const escala = ancho / original.width;
          const vista = pagina.getViewport({ scale: escala * densidad });

          const lienzo = document.createElement("canvas");
          lienzo.width = Math.floor(vista.width);
          lienzo.height = Math.floor(vista.height);
          // La medida en pantalla va aparte de la del lienzo: el lienzo
          // tiene más píxeles para que se vea nítido, pero ocupa el ancho
          // del contenedor.
          lienzo.style.width = "100%";
          lienzo.style.height = "auto";
          lienzo.className =
            "block w-full rounded-md border border-borde bg-white shadow-sm";
          lienzo.setAttribute("role", "img");
          lienzo.setAttribute(
            "aria-label",
            `${nombre}, página ${numero} de ${documento.numPages}`,
          );

          const contexto = lienzo.getContext("2d");
          if (!contexto) continue;

          const dibujo = pagina.render({ canvasContext: contexto, viewport: vista, canvas: lienzo });
          dibujos.push(dibujo);
          await dibujo.promise;
          if (!vigente) return;

          caja.appendChild(lienzo);
        }

        if (vigente) definirEstado("listo");
      } catch (error) {
        if (!vigente) return;
        definirDetalle(error instanceof Error ? error.message : null);
        definirEstado("error");
      }
    }

    void dibujar();

    return () => {
      vigente = false;
      for (const dibujo of dibujos) {
        try {
          dibujo.cancel();
        } catch {
          // Un dibujo ya terminado no se puede cancelar. No importa.
        }
      }
    };
    // Se vuelve a dibujar solo si cambia el archivo. El ancho no está en
    // las dependencias a propósito: redibujar en cada píxel de cambio de
    // tamaño trabaría la pantalla. El lienzo se estira por CSS mientras
    // tanto, que alcanza.
  }, [url, nombre]);

  return (
    <div className="rounded-lg border border-borde bg-fondo p-3">
      {estado === "cargando" ? (
        <p className="py-16 text-center text-xs text-atenuado-contraste">
          Abriendo el documento…
        </p>
      ) : null}

      {estado === "error" ? (
        <div className="flex flex-col items-center gap-2 py-16 text-center">
          <FileWarning className="size-6 text-semaforo-alto" />
          <p className="text-sm font-medium">No se pudo dibujar el documento</p>
          <p className="max-w-md text-xs text-atenuado-contraste">
            Puede descargarlo con el botón de arriba y abrirlo en su computadora.
            {detalle ? ` Detalle técnico: ${detalle}` : ""}
          </p>
        </div>
      ) : null}

      <div
        ref={contenedor}
        className="flex flex-col gap-3"
        aria-busy={estado === "cargando"}
      />

      {estado === "listo" && paginas > 0 ? (
        <p className="pt-3 text-center text-[11px] text-atenuado-contraste">
          {paginas === 1 ? "1 página" : `${paginas} páginas`}
        </p>
      ) : null}
    </div>
  );
}
