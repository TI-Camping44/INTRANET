import * as React from "react";
import { Construction } from "lucide-react";
import { Aviso, AvisoDescripcion, AvisoTitulo } from "@/components/ui/aviso";

/**
 * Aviso de los modulos cuyo esquema de datos ya existe pero cuya interfaz
 * completa se construye despues de la presentacion del 31/08/2026.
 * Las pantallas correspondientes muestran datos reales en modo consulta.
 */
export function ModuloEnConstruccion({ nota }: { nota?: string }) {
  return (
    <Aviso variante="advertencia" className="mb-5">
      <Construction />
      <div>
        <AvisoTitulo>Módulo en construcción</AvisoTitulo>
        <AvisoDescripcion>
          {nota ??
            "La estructura de datos ya está creada y esta pantalla muestra los registros " +
              "existentes en modo consulta. La carga y edición se habilitan en la próxima fase."}
        </AvisoDescripcion>
      </div>
    </Aviso>
  );
}
