"use client";

import * as React from "react";

import { AreaTexto } from "@/components/ui/campo";

/**
 * ¿Existen no conformidades similares, o que puedan ocurrir?
 *
 * Lo pidió Calidad. Arreglar el síntoma donde apareció no sirve de nada
 * si el mismo hecho puede darse en otro proceso o departamento: esta
 * pregunta obliga a mirar al costado antes de dar por respondida la no
 * conformidad.
 *
 * DECIR QUE SÍ ABRE EL DETALLE Y LO EXIGE. Un «sí» sin explicación deja
 * la pregunta sin responder de verdad, así que el cuadro aparece y es
 * obligatorio. Decir que no lo oculta y limpia lo escrito, para que no
 * quede guardado un análisis que contradice la respuesta.
 */
export function CampoAnalisisHorizontal({
  hayNcSimilares,
  analisisHorizontal,
}: {
  hayNcSimilares?: boolean | null;
  analisisHorizontal?: string | null;
}) {
  // `null` es «todavía no contestó»: no es lo mismo que «no». Por eso no
  // arranca marcado, y la acción de servidor exige que elija.
  const [hay, definirHay] = React.useState<boolean | null>(hayNcSimilares ?? null);

  return (
    <div>
      <p className="text-xs font-medium">
        ¿Existen no conformidades similares, o que potencialmente pueden ocurrir?{" "}
        <span className="text-primario">*</span>
      </p>

      <div className="mt-1.5 flex items-center gap-4">
        {[
          { valor: true, etiqueta: "Sí" },
          { valor: false, etiqueta: "No" },
        ].map((opcion) => (
          <label key={opcion.etiqueta} className="flex items-center gap-1.5 text-xs">
            <input
              type="radio"
              name="hay_nc_similares"
              value={opcion.valor ? "si" : "no"}
              checked={hay === opcion.valor}
              onChange={() => definirHay(opcion.valor)}
              required
              className="size-3.5 accent-[#E01E37]"
            />
            {opcion.etiqueta}
          </label>
        ))}
      </div>

      {hay === true ? (
        <div className="mt-2">
          <label
            htmlFor="analisis_horizontal"
            className="text-[11px] font-medium text-atenuado-contraste"
          >
            Análisis horizontal <span className="text-primario">*</span>
          </label>
          <p className="mb-1 mt-0.5 text-[11px] leading-relaxed text-atenuado-contraste">
            Cómo ocurrió, o puede ocurrir, el mismo hecho que disparó esta no conformidad en otro
            proceso o departamento.
          </p>
          <AreaTexto
            id="analisis_horizontal"
            name="analisis_horizontal"
            defaultValue={analisisHorizontal ?? ""}
            rows={3}
            required
            minLength={15}
          />
        </div>
      ) : null}
    </div>
  );
}
