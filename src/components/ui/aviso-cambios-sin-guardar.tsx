"use client";

import * as React from "react";

/**
 * Avisa antes de salir si el formulario tiene cambios sin guardar.
 *
 * POR QUE HACE FALTA. El alta de un objetivo son catorce campos y la de
 * un riesgo no mucho menos. Un clic en el menu, un «atras» de mas o una
 * pestana cerrada se llevaban el trabajo entero sin preguntar nada.
 *
 * SE CUELGA DEL FORMULARIO, no recibe estado. Se lo pone adentro del
 * `<form>` y el componente busca a su formulario con `closest`, escucha
 * lo que se escribe y se da por limpio al enviar. La alternativa era
 * que cada uno de los quince formularios llevara su propio `useState`
 * de «sucio» y se acordara de apagarlo en cada salida, que es la clase
 * de cosa que se desincroniza en el tercer cambio.
 *
 * NO CUBRE LA NAVEGACION INTERNA. `beforeunload` es del navegador y
 * solo se dispara al cerrar, recargar o salir del sitio; un `<Link>` a
 * otra pantalla del App Router no lo despierta. Cubrir eso exige
 * interceptar el enrutador, que en Next 14 no tiene una via estable.
 * Queda dicho para que nadie suponga que esto protege mas de lo que
 * protege.
 *
 * EL TEXTO NO ES NUESTRO: los navegadores ignoran el mensaje que uno
 * pone desde hace anos y muestran el suyo. Se devuelve una cadena solo
 * porque algunos todavia la exigen para considerar el evento cancelado.
 */
export function AvisoDeCambiosSinGuardar() {
  const ancla = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    const formulario = ancla.current?.closest("form");
    if (!formulario) return;

    let sucio = false;

    const ensuciar = () => {
      sucio = true;
    };
    const limpiar = () => {
      sucio = false;
    };

    const alSalir = (evento: BeforeUnloadEvent) => {
      if (!sucio) return;
      evento.preventDefault();
      evento.returnValue = "";
      return "";
    };

    formulario.addEventListener("input", ensuciar);
    formulario.addEventListener("change", ensuciar);
    formulario.addEventListener("submit", limpiar);
    window.addEventListener("beforeunload", alSalir);

    return () => {
      formulario.removeEventListener("input", ensuciar);
      formulario.removeEventListener("change", ensuciar);
      formulario.removeEventListener("submit", limpiar);
      window.removeEventListener("beforeunload", alSalir);
    };
  }, []);

  return <span ref={ancla} aria-hidden className="hidden" />;
}
