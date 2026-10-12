import * as React from "react";
import Link from "next/link";

import { cn } from "@/lib/utilidades";

/**
 * Un listado como tarjetas, para pantalla chica.
 *
 * POR QUE EXISTE. Las tablas densas del SGC tienen de diez a dieciseis
 * columnas. En el escritorio eso es una virtud —se compara una fila con
 * otra de un vistazo— y en un celular es una tabla de mil ochocientos
 * pixeles que hay que arrastrar de costado para leer un solo registro.
 * Esconder columnas no alcanza cuando las que sobran son doce.
 *
 * ENTONCES CAMBIA EL FORMATO, no los datos: abajo de `md` va esta lista
 * de tarjetas y de `md` para arriba sigue la tabla de siempre, con todas
 * sus columnas y su primera columna fija. Las dos salen de los mismos
 * datos; lo que cambia es como se dibujan.
 *
 * NO ES UNA SEGUNDA PANTALLA. Cada pagina declara que campos muestra en
 * la tarjeta, igual que declara sus columnas, y los dos bloques viven en
 * el mismo archivo: si se agrega una columna, se ve ahi mismo que la
 * tarjeta tambien la necesita.
 *
 * QUE LLEVA UNA TARJETA, en este orden:
 *  · el identificador —el codigo—, que es por donde se entra,
 *  · el titulo, que es lo que la persona esta buscando,
 *  · las insignias de estado, que es lo que se mira de reojo,
 *  · y los datos que de verdad importan, de a dos por fila.
 *
 * Lo que no entra en eso no entra en la tarjeta: la tabla completa esta
 * a una rotacion de pantalla.
 */

export interface DatoDeTarjeta {
  etiqueta: string;
  /** Vacio o nulo se dibuja como «—», no se omite: un dato que falta tiene que verse. */
  valor: React.ReactNode;
  /** Ocupa el ancho completo en vez de media fila. */
  ancho?: boolean;
}

export interface FilaEnTarjeta {
  clave: string;
  /** El codigo o identificador. Va arriba, chico y tabular. */
  identificador?: React.ReactNode;
  titulo: React.ReactNode;
  /** A donde lleva tocar la tarjeta. Sin esto no es un enlace. */
  enlace?: string;
  /** Insignias de estado, debajo del titulo. */
  insignias?: React.ReactNode;
  datos: DatoDeTarjeta[];
  /** Acciones al pie, cuando la fila tiene alguna. */
  pie?: React.ReactNode;
}

export function ListaEnTarjetas({
  filas,
  className,
}: {
  filas: FilaEnTarjeta[];
  className?: string;
}) {
  return (
    <ul className={cn("space-y-2", className)}>
      {filas.map((fila) => {
        const cabecera = (
          <>
            {fila.identificador ? (
              <span className="block text-[11px] font-medium tabular text-atenuado-contraste">
                {fila.identificador}
              </span>
            ) : null}
            <span className="block text-xs font-medium leading-snug">{fila.titulo}</span>
          </>
        );

        return (
          <li key={fila.clave} className="rounded-lg border border-borde bg-tarjeta p-3">
            {fila.enlace ? (
              <Link href={fila.enlace} className="block hover:text-primario">
                {cabecera}
              </Link>
            ) : (
              <div>{cabecera}</div>
            )}

            {fila.insignias ? (
              <div className="mt-1.5 flex flex-wrap items-center gap-1.5">{fila.insignias}</div>
            ) : null}

            {fila.datos.length > 0 ? (
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 border-t border-borde pt-2">
                {fila.datos.map((dato) => (
                  <div key={dato.etiqueta} className={cn(dato.ancho && "col-span-2")}>
                    <dt className="text-[10px] uppercase tracking-wide text-atenuado-contraste">
                      {dato.etiqueta}
                    </dt>
                    <dd className="text-[11px] leading-snug">{dato.valor || "—"}</dd>
                  </div>
                ))}
              </dl>
            ) : null}

            {fila.pie ? (
              <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-borde pt-2">
                {fila.pie}
              </div>
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}
