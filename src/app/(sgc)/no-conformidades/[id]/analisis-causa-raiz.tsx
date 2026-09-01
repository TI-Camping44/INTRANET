"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, GrupoCampo } from "@/components/ui/campo";
import {
  Pestanas,
  PestanaContenido,
  PestanaDisparador,
  PestanasLista,
} from "@/components/ui/pestanas";
import {
  guardarConclusionCausaRaiz,
  guardarPorques,
} from "@/app/(sgc)/no-conformidades/acciones";
import type { NcPorque } from "@/lib/tipos";

/**
 * Las cinco preguntas, con la redaccion de Calidad. La primera nombra la
 * desviacion y la ultima dice explicitamente que ahi termina la cadena:
 * quien completa el formulario tiene que saber que ese renglon es la
 * causa raiz y no un sintoma mas.
 */
const PREGUNTAS = [
  "¿Por qué ocurrió la desviación?",
  "¿Por qué?",
  "¿Por qué?",
  "¿Por qué?",
  "¿Por qué? (Causa raíz)",
];

/**
 * Analisis de causa raiz: la cadena de los cinco porques y la
 * conclusion.
 *
 * El diagrama de Ishikawa estaba y se retiro. Calidad trabaja con los
 * cinco porques; la segunda herramienta agregaba una pantalla que nadie
 * iba a completar y partia el analisis en dos lugares.
 */
export function AnalisisCausaRaiz({
  noConformidadId,
  porques,
  conclusion,
  puedeEditar,
}: {
  noConformidadId: string;
  porques: NcPorque[];
  conclusion: string | null;
  puedeEditar: boolean;
}) {
  return (
    <Pestanas defaultValue="porques">
      <PestanasLista>
        <PestanaDisparador value="porques">Cinco porqués</PestanaDisparador>
        <PestanaDisparador value="conclusion">Conclusión</PestanaDisparador>
      </PestanasLista>

      <PestanaContenido value="porques">
        <CincoPorques
          noConformidadId={noConformidadId}
          porques={porques}
          puedeEditar={puedeEditar}
        />
      </PestanaContenido>

      <PestanaContenido value="conclusion">
        <Conclusion
          noConformidadId={noConformidadId}
          conclusion={conclusion}
          puedeEditar={puedeEditar}
        />
      </PestanaContenido>
    </Pestanas>
  );
}

function CincoPorques({
  noConformidadId,
  porques,
  puedeEditar,
}: {
  noConformidadId: string;
  porques: NcPorque[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [guardando, definirGuardando] = React.useState(false);

  const [respuestas, definirRespuestas] = React.useState<string[]>(() =>
    PREGUNTAS.map(
      (_, indice) => porques.find((porque) => porque.orden === indice + 1)?.respuesta ?? "",
    ),
  );

  const faltan = respuestas.filter((respuesta) => respuesta.trim().length === 0).length;

  async function guardar() {
    definirGuardando(true);
    const resultado = await guardarPorques(
      noConformidadId,
      respuestas.map((respuesta, indice) => ({ pregunta: PREGUNTAS[indice], respuesta })),
    );
    definirGuardando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Análisis guardado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-[11px] leading-relaxed text-atenuado-contraste">
        Cada respuesta encadena con la siguiente pregunta. Los cinco porqués son obligatorios:
        la cadena tiene que llegar hasta la causa raíz, no detenerse en el primer síntoma.
      </p>

      {respuestas.map((respuesta, indice) => (
        <div key={indice} className="flex gap-3">
          <div
            className="mt-1 flex size-6 shrink-0 items-center justify-center rounded-full
                       bg-primario/10 text-[11px] font-semibold text-primario"
          >
            {indice + 1}
          </div>
          <GrupoCampo
            etiqueta={PREGUNTAS[indice]}
            htmlFor={`porque-${indice}`}
            requerido
            className="flex-1"
          >
            <AreaTexto
              id={`porque-${indice}`}
              rows={2}
              value={respuesta}
              disabled={!puedeEditar}
              onChange={(evento) =>
                definirRespuestas((actuales) =>
                  actuales.map((valor, posicion) =>
                    posicion === indice ? evento.target.value : valor,
                  ),
                )
              }
            />
          </GrupoCampo>
        </div>
      ))}

      {puedeEditar ? (
        <div className="flex items-center justify-end gap-3">
          {faltan > 0 ? (
            <p className="text-[11px] text-atenuado-contraste">
              {faltan === 1 ? "Falta un porqué." : `Faltan ${faltan} porqués.`}
            </p>
          ) : null}
          <Boton tamano="pequeno" onClick={guardar} cargando={guardando} disabled={faltan > 0}>
            <Save /> Guardar análisis
          </Boton>
        </div>
      ) : null}
    </div>
  );
}

function Conclusion({
  noConformidadId,
  conclusion,
  puedeEditar,
}: {
  noConformidadId: string;
  conclusion: string | null;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [texto, definirTexto] = React.useState(conclusion ?? "");
  const [guardando, definirGuardando] = React.useState(false);

  async function guardar() {
    definirGuardando(true);
    const resultado = await guardarConclusionCausaRaiz(noConformidadId, texto);
    definirGuardando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Conclusión guardada.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="space-y-3">
      <GrupoCampo
        etiqueta="Causa raíz determinada"
        htmlFor="conclusion-causa"
        ayuda="Redacción final de la causa que el plan de acción debe eliminar."
      >
        <AreaTexto
          id="conclusion-causa"
          rows={4}
          value={texto}
          disabled={!puedeEditar}
          onChange={(evento) => definirTexto(evento.target.value)}
        />
      </GrupoCampo>

      {puedeEditar ? (
        <div className="flex justify-end">
          <Boton tamano="pequeno" onClick={guardar} cargando={guardando}>
            <Save /> Guardar conclusión
          </Boton>
        </div>
      ) : null}
    </div>
  );
}
