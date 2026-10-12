"use client";

import * as React from "react";
import { cn } from "@/lib/utilidades";
import { NOMBRE_EMPRESA, NOMBRE_SISTEMA } from "@/lib/constantes";

/**
 * La marca de la empresa en chico: la barra de arriba y el cajón del
 * celular.
 *
 * ACÁ IBA EL «C44» TIPOGRÁFICO, y salió el 12 de octubre. Se había
 * puesto porque a 32 píxeles el detalle del logotipo —los anillos del
 * blanco, las dos armas— se empasta, y una marca dibujada se lee
 * siempre. Pero el C44 lo inventó el proyecto: no es el logotipo de
 * Camping 44, y tener una marca propia en la barra de todos los días es
 * justamente donde menos corresponde inventar. Va el de verdad.
 *
 * EL RECUADRO BLANCO, SOLO EN MODO OSCURO, por lo mismo que en el
 * ingreso: el logotipo tiene las dos armas en negro y sobre la barra
 * oscura desaparecerían.
 *
 * SI EL ARCHIVO NO CARGA vuelve al C44, que sigue existiendo abajo como
 * `Logotipo`. Una barra sin marca se lee como una página rota.
 */
export function Marca({
  tamano = 32,
  className,
}: {
  tamano?: number;
  className?: string;
}) {
  const [fallo, definirFallo] = React.useState(false);

  if (fallo) return <Logotipo tamano={tamano} className={className} />;

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-md",
        "dark:bg-white dark:p-[3px] dark:ring-1 dark:ring-black/5",
        className,
      )}
    >
      {/* `img` y no `next/image`: el archivo lo sube Calidad por GitHub
          y no queremos su medida escrita en el código. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src="/logotipo-camping44.png"
        alt={NOMBRE_EMPRESA}
        style={{ height: tamano }}
        className="w-auto"
        onError={() => definirFallo(true)}
      />
    </span>
  );
}

/**
 * Logotipo tipografico C44. Se construye en SVG en lugar de usar un
 * archivo de imagen para que herede el color del tema y se vea nitido en
 * cualquier resolucion. Si mas adelante llega el logotipo oficial en
 * vectores, se reemplaza solo este componente.
 */
export function Logotipo({
  className,
  tamano = 32,
}: {
  className?: string;
  tamano?: number;
}) {
  return (
    <svg
      width={tamano}
      height={tamano}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${NOMBRE_EMPRESA} · ${NOMBRE_SISTEMA}`}
      className={cn("shrink-0", className)}
    >
      <rect width="40" height="40" rx="9" fill="#E01E37" />
      <text
        x="20"
        y="26.5"
        textAnchor="middle"
        fill="#FFFFFF"
        fontFamily="Inter, system-ui, sans-serif"
        fontSize="15.5"
        fontWeight="700"
        letterSpacing="-0.4"
      >
        C44
      </text>
    </svg>
  );
}

/** Logotipo con el nombre del sistema al lado. */
export function LogotipoCompleto({ className }: { className?: string }) {
  return (
    <div className={cn("flex items-center gap-2.5", className)}>
      <Marca tamano={32} />
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold tracking-tight">{NOMBRE_SISTEMA}</span>
        <span className="text-[11px] text-atenuado-contraste">{NOMBRE_EMPRESA}</span>
      </div>
    </div>
  );
}
