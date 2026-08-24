import { cn } from "@/lib/utilidades";
import { NOMBRE_EMPRESA, NOMBRE_SISTEMA } from "@/lib/constantes";

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
      <Logotipo tamano={32} />
      <div className="flex flex-col leading-tight">
        <span className="text-sm font-semibold tracking-tight">{NOMBRE_SISTEMA}</span>
        <span className="text-[11px] text-atenuado-contraste">{NOMBRE_EMPRESA}</span>
      </div>
    </div>
  );
}
