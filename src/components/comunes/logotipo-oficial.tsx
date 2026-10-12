"use client";

import * as React from "react";
import { Logotipo } from "@/components/comunes/logotipo";
import { NOMBRE_EMPRESA } from "@/lib/constantes";
import { cn } from "@/lib/utilidades";

/**
 * Los logotipos de las dos empresas del grupo, para donde hay lugar
 * para mirarlos.
 *
 * VAN LOS DOS, Y SOLO ACA. El grupo son Camping 44 S.A. y Vitálica
 * E.A.S., y por la intranet entran las dos: quien tiene correo de
 * Vitálica no tiene por qué encontrarse únicamente con el logotipo de la
 * otra en la pantalla donde decide si está en el lugar correcto. En la
 * barra de arriba sigue el C44 solo, que a 32 píxeles es lo único que se
 * lee.
 *
 * NO VAN EN LA BARRA. Ahí miden 32 píxeles y el detalle —las armas, los
 * anillos del blanco, los pétalos— se convierte en manchas.
 *
 * EL RECUADRO BLANCO, SOLO EN MODO OSCURO. El de Camping 44 tiene las
 * dos armas en negro y el de Vitálica su nombre en gris oscuro: sobre
 * fondo oscuro los dos desaparecerían. El recuadro lo resuelve sin
 * pedirle al diseñador una segunda versión. En modo claro no hace falta
 * y encima estorba: sería un marco blanco flotando sobre página blanca.
 *
 * SI UN ARCHIVO NO CARGA, no se rompe: ese se oculta y queda el otro, y
 * si fallan los dos vuelve al C44. Así la pantalla de ingreso nunca
 * muestra una imagen rota, que es lo peor que puede ver alguien que
 * todavía no entró al sistema.
 *
 * El día que lleguen los `.svg` del diseñador se suben a `public/` y se
 * cambian estas dos líneas. Nada más.
 */
const ARCHIVOS = [
  { empresa: "Camping 44 S.A.", archivo: "/logotipo-camping44.png" },
  { empresa: "Vitálica E.A.S.", archivo: "/logotipo-vitalica.png" },
];

export function LogotipoOficial({
  className,
  alto = 86,
}: {
  className?: string;
  /**
   * Alto en píxeles de cada logotipo. Se igualan por el ALTO y no por el
   * ancho: tienen proporciones distintas —el de Camping 44 es casi
   * cuadrado y el de Vitálica apaisado— y emparejarlos por el ancho
   * dejaría uno visiblemente más grande que el otro.
   */
  alto?: number;
}) {
  const [fallaron, definirFallaron] = React.useState<string[]>([]);

  const visibles = ARCHIVOS.filter(({ archivo }) => !fallaron.includes(archivo));

  if (visibles.length === 0) return <Logotipo tamano={48} className={className} />;

  return (
    <div
      className={cn(
        "flex items-center justify-center gap-5 rounded-lg",
        "dark:bg-white dark:px-5 dark:py-4 dark:shadow-sm dark:ring-1 dark:ring-black/5",
        className,
      )}
    >
      {visibles.map(({ empresa, archivo }, posicion) => (
        <React.Fragment key={archivo}>
          {posicion > 0 ? (
            <span
              aria-hidden="true"
              className="w-px shrink-0 self-stretch bg-borde dark:bg-black/10"
            />
          ) : null}

          {/* Se usa `img` y no `next/image` a propósito: los archivos los
              sube Calidad por GitHub y no queremos que su medida esté
              escrita en el código. `next/image` exige alto y ancho, y
              cada cambio de logotipo obligaría a tocar esto. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={archivo}
            alt={empresa}
            style={{ height: alto }}
            className="w-auto"
            onError={() => definirFallaron((previos) => [...previos, archivo])}
          />
        </React.Fragment>
      ))}
    </div>
  );
}

