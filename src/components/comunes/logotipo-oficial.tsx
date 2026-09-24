"use client";

import * as React from "react";
import { Logotipo } from "@/components/comunes/logotipo";
import { NOMBRE_EMPRESA } from "@/lib/constantes";
import { cn } from "@/lib/utilidades";

/**
 * El logotipo oficial de la empresa, para donde hay lugar para mirarlo.
 *
 * Va en el ingreso y no en la barra de arriba: ahí mide 32 píxeles y el
 * detalle —las armas, los anillos del blanco— se convierte en manchas.
 * En la barra sigue el C44, que a ese tamaño se lee.
 *
 * EL RECUADRO BLANCO, SOLO EN MODO OSCURO. El logotipo tiene las dos
 * armas en negro: sobre fondo oscuro desaparecerían. El recuadro lo
 * resuelve sin pedirle al diseñador una segunda versión. En modo claro
 * no hace falta y encima estorba: seria un marco blanco flotando sobre
 * una pagina blanca.
 *
 * SI EL ARCHIVO NO CARGA, no se rompe: vuelve al C44. Así la pantalla de
 * ingreso nunca muestra una imagen rota, que es lo peor que puede ver
 * alguien que todavía no entró al sistema.
 */

/**
 * El archivo que subió Calidad: 740 × 679, con fondo transparente. Es un
 * mapa de bits y no un vector, así que a más de 370 píxeles de ancho
 * empieza a verse blando. En el ingreso se dibuja a 190, que es la mitad
 * justa: se ve nítido también en pantalla de alta densidad.
 *
 * El día que llegue el `.svg` del diseñador, se sube a `public/` y se
 * cambia esta línea. Nada más.
 */
const ARCHIVO = "/logotipo-camping44.png";

export function LogotipoOficial({
  className,
  ancho = 180,
}: {
  className?: string;
  /** Ancho en píxeles del recuadro. El alto sale de la proporción. */
  ancho?: number;
}) {
  const [fallo, definirFallo] = React.useState(false);

  if (fallo) return <Logotipo tamano={48} className={className} />;

  return (
    <div
      className={cn(
        "flex items-center justify-center rounded-lg",
        "dark:bg-white dark:p-4 dark:shadow-sm dark:ring-1 dark:ring-black/5",
        className,
      )}
      style={{ width: ancho }}
    >
      {/* Se usa `img` y no `next/image` a propósito: el archivo lo sube
          Calidad por GitHub y no queremos que su medida esté escrita en
          el código. `next/image` exige alto y ancho, y cada cambio de
          logotipo obligaría a tocar esto. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={ARCHIVO}
        alt={NOMBRE_EMPRESA}
        className="h-auto w-full"
        onError={() => definirFallo(true)}
      />
    </div>
  );
}
