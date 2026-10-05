import { TablaCelda } from "@/components/ui/tabla";
import { cn } from "@/lib/utilidades";

/**
 * Celda de texto largo, recortada y con el texto completo al señalar.
 *
 * Las planillas de Calidad tienen columnas de párrafo entero —la acción
 * planificada de un riesgo, la fórmula de un indicador, el propósito de
 * un cambio—. Puestas crudas en una tabla, una sola fila mide cuatro
 * renglones y la tabla deja de leerse de un barrido.
 *
 * Entonces: se recorta a un ancho fijo con una línea, y el texto entero
 * queda en el `title`, que el navegador muestra solo al señalar. La
 * ficha del registro lo muestra completo; la tabla es para comparar
 * filas, no para leer párrafos.
 *
 * NO LLEVA `recortar()`: el corte es visual, con CSS. Si se cortara el
 * texto en el servidor, el `title` también saldría cortado y se perdería
 * justamente lo que se quiere poder leer.
 */
export function CeldaTexto({
  children,
  ancho = "14rem",
  className,
}: {
  children: string | null | undefined;
  /** Ancho de la columna. El texto se recorta a una línea. */
  ancho?: string;
  className?: string;
}) {
  const texto = children?.trim();

  if (!texto) {
    return (
      <TablaCelda className={cn("text-xs text-atenuado-contraste", className)}>—</TablaCelda>
    );
  }

  return (
    <TablaCelda className={cn("text-xs", className)} style={{ maxWidth: ancho }}>
      <span className="block truncate text-atenuado-contraste" title={texto}>
        {texto}
      </span>
    </TablaCelda>
  );
}

/** Sí / No / — para las columnas de la planilla que son una sola palabra. */
export function CeldaSiNo({
  valor,
  className,
}: {
  valor: boolean | null | undefined;
  className?: string;
}) {
  return (
    <TablaCelda className={cn("text-center text-xs", className)}>
      {valor === null || valor === undefined ? (
        <span className="text-atenuado-contraste">—</span>
      ) : valor ? (
        "Sí"
      ) : (
        "No"
      )}
    </TablaCelda>
  );
}
