"use client";

import * as React from "react";

/**
 * Muestra un documento de Word ya convertido a HTML.
 *
 * EL PROBLEMA DEL ALTO. Un marco no se estira solo al tamaño de lo que
 * tiene adentro: hay que medirlo y decírselo. Con el marco totalmente
 * aislado —`sandbox=""`— la página ni siquiera puede leer su contenido
 * para medirlo, así que quedaba con alto fijo y su propia barra de
 * desplazamiento adentro de la barra de la página. Dos barras, una
 * dentro de la otra.
 *
 * LA SOLUCIÓN, sin resignar el aislamiento. Se permite `allow-same-origin`
 * y NADA MÁS. Eso deja que la página lea el alto del documento, pero
 * sigue sin permitir `allow-scripts`: adentro no se ejecuta nada. Es la
 * diferencia que importa —los dos permisos juntos sí anularían el
 * aislamiento, uno solo no—, porque el contenido sale de un archivo que
 * subió alguien.
 *
 * Con el alto real puesto, el marco crece hasta donde llega el documento
 * y queda una sola barra: la de la página.
 */
export function VisorWord({ documento, titulo }: { documento: string; titulo: string }) {
  const marco = React.useRef<HTMLIFrameElement>(null);
  const [alto, definirAlto] = React.useState(600);

  const medir = React.useCallback(() => {
    const cuerpo = marco.current?.contentDocument?.body;
    if (!cuerpo) return;
    // `scrollHeight` del cuerpo mas un respiro: sin el, el ultimo renglon
    // puede quedar cortado por un pixel y aparece la barra igual.
    definirAlto(cuerpo.scrollHeight + 8);
  }, []);

  React.useEffect(() => {
    // NO ALCANZA CON `onLoad`. Con `srcDoc` el contenido puede estar
    // cargado antes de que React conecte el manejador, y entonces el
    // aviso de «cargado» ya paso y nadie lo escucho: el marco se quedaba
    // con el alto inicial y con su barra adentro. Se mide tambien al
    // montar.
    medir();

    const cuerpo = marco.current?.contentDocument?.body;

    // Y se sigue midiendo mientras el contenido cambie de tamaño: al
    // girar el celular, al cambiar el ancho de la ventana, o cuando
    // terminan de cargar las imagenes del documento y todo se corre para
    // abajo.
    const observador =
      cuerpo && typeof ResizeObserver !== "undefined" ? new ResizeObserver(medir) : null;
    observador?.observe(cuerpo!);

    window.addEventListener("resize", medir);
    return () => {
      observador?.disconnect();
      window.removeEventListener("resize", medir);
    };
  }, [medir, documento]);

  return (
    <iframe
      ref={marco}
      sandbox="allow-same-origin"
      srcDoc={documento}
      title={titulo}
      onLoad={medir}
      style={{ height: alto }}
      className="w-full rounded-lg border border-borde bg-white"
    />
  );
}
