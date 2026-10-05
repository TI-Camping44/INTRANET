"use client";

import * as React from "react";

/**
 * Contenedor con DOS barras de desplazamiento horizontal: una arriba y
 * la de siempre abajo.
 *
 * Las matrices de riesgos y de oportunidades tienen catorce columnas y no
 * entran en ninguna pantalla. Con la barra solo abajo, para correr la
 * tabla hay que bajar hasta el final, mover, y volver a subir para leer
 * el encabezado. Con once filas eso es incómodo; con cuarenta es
 * inservible.
 *
 * Las dos barras mueven el mismo contenido: la de arriba es un cajón
 * vacío del ancho de la tabla, y cada una copia su posición en la otra.
 * Se comparan los valores antes de escribirlos para que no se empujen
 * entre sí en un ciclo infinito.
 *
 * La barra de arriba DESAPARECE cuando la tabla entra entera: una barra
 * que no desplaza nada es ruido, y en el celular ocupa lugar sin dar
 * nada a cambio.
 */
export function DesplazamientoDoble({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const superior = React.useRef<HTMLDivElement>(null);
  const inferior = React.useRef<HTMLDivElement>(null);
  const [ancho, definirAncho] = React.useState(0);
  const [desborda, definirDesborda] = React.useState(false);

  // El ancho del cajón de arriba es el de la tabla de abajo, y cambia al
  // cambiar el tamaño de la ventana o al filtrar el listado.
  React.useEffect(() => {
    const caja = inferior.current;
    if (!caja) return;

    function medir() {
      const actual = inferior.current;
      if (!actual) return;
      definirAncho(actual.scrollWidth);
      definirDesborda(actual.scrollWidth > actual.clientWidth + 1);
    }

    medir();

    const observador = new ResizeObserver(medir);
    observador.observe(caja);
    // También la tabla: el contenedor puede no cambiar de tamaño cuando
    // sí lo hace lo que tiene adentro.
    const tabla = caja.firstElementChild;
    if (tabla) observador.observe(tabla);

    return () => observador.disconnect();
  }, [children]);

  function copiar(desde: HTMLDivElement | null, hacia: HTMLDivElement | null) {
    if (!desde || !hacia) return;
    if (Math.abs(hacia.scrollLeft - desde.scrollLeft) < 1) return;
    hacia.scrollLeft = desde.scrollLeft;
  }

  return (
    <div className={className}>
      <div
        ref={superior}
        onScroll={() => copiar(superior.current, inferior.current)}
        aria-hidden="true"
        className={desborda ? "overflow-x-auto" : "hidden"}
      >
        <div style={{ width: ancho, height: 1 }} />
      </div>

      <div
        ref={inferior}
        onScroll={() => copiar(inferior.current, superior.current)}
        className="desplazable-x w-full overflow-x-auto"
      >
        {children}
      </div>
    </div>
  );
}
