"use client";

import * as React from "react";
import { FileText } from "lucide-react";

export interface DocumentoElegible {
  id: string;
  codigo: string | null;
  titulo: string;
}

/**
 * Elige uno o varios documentos de Información Documentada.
 *
 * NO ES UN DESPLEGABLE DE PROCESOS. Hasta el 8 de octubre el riesgo se
 * identificaba contra la lista fija del mapa de procesos. Dirección lo
 * cambió: no siempre es un proceso —puede ser una política, un
 * instructivo o un formulario—, así que se elige de lo que realmente hay
 * cargado en Información Documentada.
 *
 * VA EN CASILLAS Y NO EN UN `<select multiple>`: en un celular el
 * multiple obliga a mantener apretada una tecla que no existe, y el
 * módulo se usa desde el piso de venta.
 *
 * Cuando no hay documentos cargados lo dice, en vez de mostrar una caja
 * vacía que se lee como una pantalla rota.
 */
export function SelectorDocumentos({
  etiqueta,
  ayuda,
  documentos,
  elegidos,
  alAlternar,
}: {
  etiqueta: string;
  ayuda?: string;
  documentos: DocumentoElegible[];
  elegidos: string[];
  alAlternar: (id: string) => void;
}) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs font-medium">{etiqueta}</p>
      {ayuda ? <p className="text-[11px] text-atenuado-contraste">{ayuda}</p> : null}

      {documentos.length === 0 ? (
        <p className="flex items-start gap-2 rounded-md border border-dashed border-borde p-3 text-[11px] leading-relaxed text-atenuado-contraste">
          <FileText className="mt-0.5 size-3.5 shrink-0" />
          <span>
            Todavía no hay información documentada cargada. A medida que Calidad cargue los
            documentos aparecen acá y se pueden elegir. El riesgo se puede registrar igual y
            vincularlos después.
          </span>
        </p>
      ) : (
        <div className="desplazable-y max-h-48 space-y-1 overflow-y-auto rounded-md border border-borde p-2">
          {documentos.map((documento) => (
            <label
              key={documento.id}
              className="flex cursor-pointer items-start gap-2 rounded px-1 py-1 text-xs hover:bg-acento"
            >
              <input
                type="checkbox"
                className="mt-0.5 size-3.5 shrink-0 accent-[#E01E37]"
                checked={elegidos.includes(documento.id)}
                onChange={() => alAlternar(documento.id)}
              />
              <span className="min-w-0">
                {documento.codigo ? (
                  <span className="tabular text-atenuado-contraste">{documento.codigo} · </span>
                ) : null}
                {documento.titulo}
              </span>
            </label>
          ))}
        </div>
      )}

      {elegidos.length > 0 ? (
        <p className="text-[11px] text-atenuado-contraste">
          {elegidos.length} seleccionado{elegidos.length === 1 ? "" : "s"}.
        </p>
      ) : null}
    </div>
  );
}
