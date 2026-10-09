"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Paperclip, Trash2, Upload } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, Seleccion } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import {
  adjuntarEvidenciaDeLaAccion,
  cambiarEstadoDeLaAccion,
  quitarEvidenciaDeLaAccion,
  reabrirEficaciaDeLaAccion,
  verificarEficaciaDeLaAccion,
} from "@/app/(sgc)/indicadores/plan/acciones";
import { ACEPTA_EVIDENCIA, describirTamano, TAMANO_MAXIMO_ADJUNTO } from "@/lib/adjuntos";
import {
  CLASES_ESTADO_PLAN,
  ESTADOS_PLAN_VIGENTES,
  ETIQUETAS_ESTADO_PLAN,
  type EstadoPlan,
} from "@/lib/objetivos";
import { formatearFecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";

export interface EvidenciaDeLaAccion {
  id: string;
  nombre_archivo: string;
  tamano_bytes: number;
  descripcion: string | null;
}

/**
 * El seguimiento de una acción del plan, al modelo de la acción
 * correctiva.
 *
 * Lo pidió Dirección el 8 de octubre: evidencia adjunta, estado que se
 * mueve, y al final la eficacia. Son los tres pasos con los que se
 * sigue una acción correctiva, y no había razón para que una acción del
 * plan de objetivos se siguiera de otra forma.
 *
 * LA EFICACIA VA DESPUÉS DEL CUMPLIDO. Declararla sobre una acción que
 * todavía no se ejecutó sería opinar sobre algo que no pasó. La base lo
 * exige también, en `objetivo_planes_eficacia_tras_cumplir`.
 *
 * Un «no eficaz» pide explicación: es lo que la Revisión por la
 * Dirección lee para decidir qué se hace después.
 */
export function SeguimientoDeLaAccion({
  accionId,
  estado,
  fechaRealFinalizacion,
  eficacia,
  fechaEvaluacionEficacia,
  observacionEficacia,
  evidencias,
  puedeGestionar,
}: {
  accionId: string;
  estado: EstadoPlan;
  fechaRealFinalizacion: string | null;
  eficacia: "eficaz" | "no_eficaz" | null;
  fechaEvaluacionEficacia: string | null;
  observacionEficacia: string | null;
  evidencias: EvidenciaDeLaAccion[];
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);
  const [declarando, definirDeclarando] = React.useState<boolean | null>(null);
  const [observacion, definirObservacion] = React.useState("");
  const [subiendo, definirSubiendo] = React.useState(false);
  const campoArchivos = React.useRef<HTMLInputElement>(null);

  async function ejecutar(operacion: () => Promise<{ exito: boolean; mensaje?: string; error?: string }>) {
    definirProcesando(true);
    const resultado = await operacion();
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Guardado.");
      router.refresh();
      return true;
    }

    toast.error(resultado.error ?? "No se pudo guardar.");
    return false;
  }

  async function subir(evento: React.ChangeEvent<HTMLInputElement>) {
    const archivos = Array.from(evento.target.files ?? []);
    if (archivos.length === 0) return;

    const datos = new FormData();
    for (const archivo of archivos) datos.append("archivos", archivo);

    definirSubiendo(true);
    const resultado = await adjuntarEvidenciaDeLaAccion(accionId, datos);
    definirSubiendo(false);
    evento.target.value = "";

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Evidencia subida.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="mt-2 space-y-2 rounded-md border border-borde p-2.5">
      {/* EL ESTADO. Se ve y se cambia en el mismo lugar. */}
      <div className="flex flex-wrap items-center gap-2">
        <Insignia className={cn("border", CLASES_ESTADO_PLAN[estado])}>
          {ETIQUETAS_ESTADO_PLAN[estado]}
        </Insignia>

        {estado === "cumplido" && fechaRealFinalizacion ? (
          <span className="text-[11px] text-atenuado-contraste">
            Cumplida el {formatearFecha(fechaRealFinalizacion)}
          </span>
        ) : null}

        {eficacia ? (
          <Insignia variante={eficacia === "eficaz" ? "exito" : "peligro"}>
            {eficacia === "eficaz" ? "Eficaz" : "No eficaz"}
          </Insignia>
        ) : null}

        {puedeGestionar && !eficacia ? (
          <Seleccion
            aria-label="Estado de la acción"
            className="h-7 w-auto min-w-[10rem] py-0 text-[11px]"
            value={estado}
            disabled={procesando}
            onChange={(evento) =>
              ejecutar(() => cambiarEstadoDeLaAccion(accionId, evento.target.value))
            }
          >
            {ESTADOS_PLAN_VIGENTES.map((valor) => (
              <option key={valor} value={valor}>
                {ETIQUETAS_ESTADO_PLAN[valor]}
              </option>
            ))}
          </Seleccion>
        ) : null}
      </div>

      {/* LA EVIDENCIA. */}
      <div className="space-y-1">
        {evidencias.length > 0 ? (
          <ul className="space-y-1">
            {evidencias.map((evidencia) => (
              <li
                key={evidencia.id}
                className="flex items-center justify-between gap-2 text-[11px]"
              >
                <span className="flex min-w-0 items-center gap-1.5">
                  <Paperclip className="size-3 shrink-0 text-atenuado-contraste" />
                  <span className="truncate">{evidencia.nombre_archivo}</span>
                  <span className="shrink-0 text-atenuado-contraste">
                    {describirTamano(evidencia.tamano_bytes)}
                  </span>
                </span>
                {puedeGestionar ? (
                  <button
                    type="button"
                    disabled={procesando}
                    onClick={() => {
                      if (!confirm(`¿Quitar ${evidencia.nombre_archivo}?`)) return;
                      ejecutar(() => quitarEvidenciaDeLaAccion(evidencia.id, accionId));
                    }}
                    className="shrink-0 text-atenuado-contraste transition-colors
                               hover:text-semaforo-critico"
                    aria-label={`Quitar ${evidencia.nombre_archivo}`}
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[11px] text-atenuado-contraste">Sin evidencia cargada.</p>
        )}

        {puedeGestionar ? (
          <>
            <Entrada
              ref={campoArchivos}
              type="file"
              multiple
              accept={ACEPTA_EVIDENCIA}
              onChange={subir}
              className="hidden"
            />
            <Boton
              type="button"
              variante="fantasma"
              tamano="pequeno"
              cargando={subiendo}
              onClick={() => campoArchivos.current?.click()}
              className="h-6 px-1.5 text-[11px]"
            >
              <Upload /> Subir evidencia
            </Boton>
            <span className="ml-1 text-[10px] text-atenuado-contraste">
              Hasta {describirTamano(TAMANO_MAXIMO_ADJUNTO)} por archivo.
            </span>
          </>
        ) : null}
      </div>

      {/* LA EFICACIA, recién con la acción cumplida. */}
      {eficacia ? (
        <div className="border-t border-borde pt-2 text-[11px]">
          <p className="text-atenuado-contraste">
            Eficacia declarada
            {fechaEvaluacionEficacia ? ` el ${formatearFecha(fechaEvaluacionEficacia)}` : ""}.
          </p>
          {observacionEficacia ? (
            <p className="mt-0.5 whitespace-pre-line">{observacionEficacia}</p>
          ) : null}
          {puedeGestionar ? (
            <Boton
              type="button"
              variante="fantasma"
              tamano="pequeno"
              cargando={procesando}
              onClick={() => ejecutar(() => reabrirEficaciaDeLaAccion(accionId))}
              className="mt-1 h-6 px-1.5 text-[11px]"
            >
              Reabrir
            </Boton>
          ) : null}
        </div>
      ) : puedeGestionar && estado === "cumplido" ? (
        <div className="space-y-2 border-t border-borde pt-2">
          {declarando === null ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[11px] text-atenuado-contraste">¿La acción fue eficaz?</span>
              <Boton
                type="button"
                variante="contorno"
                tamano="pequeno"
                onClick={() => definirDeclarando(true)}
                className="h-6 px-2 text-[11px]"
              >
                Sí, fue eficaz
              </Boton>
              <Boton
                type="button"
                variante="contorno"
                tamano="pequeno"
                onClick={() => definirDeclarando(false)}
                className="h-6 px-2 text-[11px]"
              >
                No fue eficaz
              </Boton>
            </div>
          ) : (
            <>
              <AreaTexto
                rows={2}
                value={observacion}
                onChange={(evento) => definirObservacion(evento.target.value)}
                placeholder={
                  declarando
                    ? "Con qué se comprueba que sirvió. Opcional."
                    : "Por qué no fue eficaz y qué se hace ahora."
                }
              />
              <div className="flex flex-wrap gap-2">
                <Boton
                  type="button"
                  tamano="pequeno"
                  cargando={procesando}
                  onClick={async () => {
                    const listo = await ejecutar(() =>
                      verificarEficaciaDeLaAccion(accionId, declarando, observacion),
                    );
                    if (listo) {
                      definirDeclarando(null);
                      definirObservacion("");
                    }
                  }}
                  className="h-6 px-2 text-[11px]"
                >
                  Registrar {declarando ? "eficaz" : "no eficaz"}
                </Boton>
                <Boton
                  type="button"
                  variante="fantasma"
                  tamano="pequeno"
                  onClick={() => {
                    definirDeclarando(null);
                    definirObservacion("");
                  }}
                  className="h-6 px-2 text-[11px]"
                >
                  Cancelar
                </Boton>
              </div>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
