"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Save, Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import {
  Pestanas,
  PestanaContenido,
  PestanaDisparador,
  PestanasLista,
} from "@/components/ui/pestanas";
import {
  agregarCausaIshikawa,
  eliminarCausaIshikawa,
  guardarConclusionCausaRaiz,
  guardarPorques,
} from "@/app/(sgc)/no-conformidades/acciones";
import { ETIQUETAS_ISHIKAWA } from "@/lib/constantes";
import type { CategoriaIshikawa, NcIshikawa, NcPorque } from "@/lib/tipos";

const CANTIDAD_PORQUES = 5;

/**
 * Analisis de causa raiz con las dos herramientas pedidas por Calidad:
 * la cadena de los cinco porques y el diagrama de Ishikawa por 6M.
 */
export function AnalisisCausaRaiz({
  noConformidadId,
  porques,
  causas,
  conclusion,
  puedeEditar,
}: {
  noConformidadId: string;
  porques: NcPorque[];
  causas: NcIshikawa[];
  conclusion: string | null;
  puedeEditar: boolean;
}) {
  return (
    <Pestanas defaultValue="porques">
      <PestanasLista>
        <PestanaDisparador value="porques">Cinco porqués</PestanaDisparador>
        <PestanaDisparador value="ishikawa">Ishikawa (6M)</PestanaDisparador>
        <PestanaDisparador value="conclusion">Conclusión</PestanaDisparador>
      </PestanasLista>

      <PestanaContenido value="porques">
        <CincoPorques
          noConformidadId={noConformidadId}
          porques={porques}
          puedeEditar={puedeEditar}
        />
      </PestanaContenido>

      <PestanaContenido value="ishikawa">
        <Ishikawa noConformidadId={noConformidadId} causas={causas} puedeEditar={puedeEditar} />
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
    Array.from(
      { length: CANTIDAD_PORQUES },
      (_, indice) => porques.find((porque) => porque.orden === indice + 1)?.respuesta ?? "",
    ),
  );

  async function guardar() {
    definirGuardando(true);
    const resultado = await guardarPorques(
      noConformidadId,
      respuestas.map((respuesta, indice) => ({
        pregunta: indice === 0 ? "¿Por qué ocurrió la desviación?" : "¿Por qué?",
        respuesta,
      })),
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
        Cada respuesta encadena con la siguiente pregunta. No es obligatorio llegar al quinto
        porqué: se detiene cuando la causa deja de ser un síntoma y pasa a ser accionable.
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
            etiqueta={indice === 0 ? "¿Por qué ocurrió la desviación?" : "¿Por qué?"}
            htmlFor={`porque-${indice}`}
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
        <div className="flex justify-end">
          <Boton tamano="pequeno" onClick={guardar} disabled={guardando}>
            <Save /> {guardando ? "Guardando…" : "Guardar análisis"}
          </Boton>
        </div>
      ) : null}
    </div>
  );
}

function Ishikawa({
  noConformidadId,
  causas,
  puedeEditar,
}: {
  noConformidadId: string;
  causas: NcIshikawa[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [categoria, definirCategoria] = React.useState<CategoriaIshikawa>("metodo");
  const [texto, definirTexto] = React.useState("");
  const [esRaiz, definirEsRaiz] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);

  async function agregar() {
    definirProcesando(true);
    const resultado = await agregarCausaIshikawa(noConformidadId, categoria, texto, esRaiz);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Causa agregada.");
      definirTexto("");
      definirEsRaiz(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function eliminar(id: string) {
    const resultado = await eliminarCausaIshikawa(id, noConformidadId);
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Causa eliminada.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {(Object.keys(ETIQUETAS_ISHIKAWA) as CategoriaIshikawa[]).map((clave) => {
          const delGrupo = causas.filter((causa) => causa.categoria === clave);

          return (
            <div key={clave} className="rounded-md border border-borde p-3">
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-atenuado-contraste">
                {ETIQUETAS_ISHIKAWA[clave]}
              </p>
              {delGrupo.length === 0 ? (
                <p className="text-[11px] text-atenuado-contraste">Sin causas identificadas.</p>
              ) : (
                <ul className="space-y-1.5">
                  {delGrupo.map((causa) => (
                    <li key={causa.id} className="flex items-start gap-2 text-xs leading-snug">
                      <span className="mt-1 size-1 shrink-0 rounded-full bg-atenuado-contraste" />
                      <span className="flex-1">
                        {causa.causa}
                        {causa.es_causa_raiz ? (
                          <Insignia variante="peligro" className="ml-1.5">
                            Causa raíz
                          </Insignia>
                        ) : null}
                      </span>
                      {puedeEditar ? (
                        <button
                          type="button"
                          onClick={() => eliminar(causa.id)}
                          className="text-atenuado-contraste transition-colors hover:text-semaforo-critico"
                          aria-label="Eliminar causa"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>

      {puedeEditar ? (
        <div className="flex flex-col gap-2 rounded-md border border-dashed border-borde p-3 sm:flex-row sm:items-end">
          <GrupoCampo etiqueta="Categoría" htmlFor="categoria-ishikawa" className="sm:w-48">
            <Seleccion
              id="categoria-ishikawa"
              value={categoria}
              onChange={(evento) => definirCategoria(evento.target.value as CategoriaIshikawa)}
            >
              {Object.entries(ETIQUETAS_ISHIKAWA).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Causa identificada" htmlFor="causa-ishikawa" className="flex-1">
            <Entrada
              id="causa-ishikawa"
              value={texto}
              onChange={(evento) => definirTexto(evento.target.value)}
              placeholder="El instructivo de conteo no define la frecuencia"
            />
          </GrupoCampo>

          <label className="flex items-center gap-2 whitespace-nowrap pb-2 text-xs">
            <input
              type="checkbox"
              className="size-3.5 accent-[#E01E37]"
              checked={esRaiz}
              onChange={(evento) => definirEsRaiz(evento.target.checked)}
            />
            Es causa raíz
          </label>

          <Boton
            tamano="pequeno"
            onClick={agregar}
            disabled={procesando || texto.trim().length < 3}
          >
            <Plus /> Agregar
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
        ayuda="Redacción final de la causa que el plan de acción debe eliminar. Se copia al riesgo si se genera uno desde aquí."
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
          <Boton tamano="pequeno" onClick={guardar} disabled={guardando}>
            <Save /> {guardando ? "Guardando…" : "Guardar conclusión"}
          </Boton>
        </div>
      ) : null}
    </div>
  );
}
