"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Paperclip, Trash2, Upload } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { ErrorDeFormulario } from "@/components/ui/error-de-formulario";
import { Insignia } from "@/components/ui/insignia";
import {
  agregarEvidencia,
  eliminarEjecucion,
  quitarEvidencia,
  registrarEjecucion,
} from "@/app/(sgc)/informatica/controles/acciones";
import { ACEPTA_EVIDENCIA, describirTamano } from "@/lib/adjuntos";
import { MAXIMO_EVIDENCIAS_ACCION } from "@/lib/constantes";
import { formatearFecha } from "@/lib/formato";
import {
  ETIQUETAS_RESULTADO_CONTROL,
  RESULTADOS_CONTROL,
  describirPeriodo,
  periodoDe,
  type ResultadoControl,
} from "@/lib/controles-ti";

export interface EjecucionDelControl {
  id: string;
  periodo: string;
  fecha_ejecucion: string;
  resultado: string;
  observaciones: string | null;
  ejecutor: { nombre_completo: string } | null;
  evidencias: { id: string; nombre_archivo: string; tamano_bytes: number | null }[];
}

const VARIANTE_RESULTADO: Record<ResultadoControl, "exito" | "advertencia" | "peligro"> = {
  conforme: "exito",
  con_observaciones: "advertencia",
  no_conforme: "peligro",
};

const CLASE_ARCHIVO =
  "block w-full text-[11px] file:mr-2 file:rounded file:border file:border-borde " +
  "file:bg-acento file:px-2 file:py-1 file:text-[11px]";

/**
 * Registro de las ejecuciones del control y su evidencia.
 *
 * El formulario ofrece solo los períodos que ya llegaron y no tienen
 * registro, empezando por el más viejo: lo atrasado es lo primero que
 * hay que regularizar. La observación se pide recién cuando el resultado
 * no es conforme, y el campo se desmonta en vez de esconderse.
 */
export function PanelEjecuciones({
  controlId,
  ejecuciones,
  pendientes,
  hoy,
  puedeEditar,
}: {
  controlId: string;
  ejecuciones: EjecucionDelControl[];
  pendientes: string[];
  hoy: string;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [resultado, definirResultado] = React.useState<ResultadoControl>("conforme");
  const [subiendoEn, definirSubiendoEn] = React.useState<string | null>(null);

  // El período del mes en curso, si está pendiente, va elegido: es lo
  // que se registra casi siempre. Si no, el más viejo.
  const periodoSugerido = pendientes.includes(periodoDe(hoy)) ? periodoDe(hoy) : pendientes[0];

  async function registrar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    definirProcesando(true);
    definirError(null);
    const respuesta = await registrarEjecucion(controlId, new FormData(formulario));
    definirProcesando(false);

    if (respuesta.exito) {
      toast.success(respuesta.mensaje ?? "Ejecución registrada.");
      formulario.reset();
      definirResultado("conforme");
      router.refresh();
    } else {
      definirError(respuesta.error);
      toast.error(respuesta.error);
    }
  }

  async function subir(evento: React.FormEvent<HTMLFormElement>, ejecucionId: string) {
    evento.preventDefault();
    definirProcesando(true);
    const respuesta = await agregarEvidencia(
      controlId,
      ejecucionId,
      new FormData(evento.currentTarget),
    );
    definirProcesando(false);

    if (respuesta.exito) {
      toast.success(respuesta.mensaje ?? "Evidencia agregada.");
      definirSubiendoEn(null);
      router.refresh();
    } else {
      toast.error(respuesta.error);
    }
  }

  async function quitar(ejecucionId: string, adjuntoId: string, nombre: string) {
    if (!confirm(`¿Quitar ${nombre} de la evidencia?`)) return;
    const respuesta = await quitarEvidencia(controlId, ejecucionId, adjuntoId);
    if (respuesta.exito) {
      toast.success(respuesta.mensaje ?? "Archivo quitado.");
      router.refresh();
    } else {
      toast.error(respuesta.error);
    }
  }

  async function eliminar(ejecucion: EjecucionDelControl) {
    const archivos = ejecucion.evidencias.length;
    const aviso =
      `¿Eliminar el registro de ${describirPeriodo(ejecucion.periodo)}?` +
      (archivos > 0 ? ` Se borran también sus ${archivos} archivo(s) de evidencia.` : "") +
      " El período vuelve a quedar pendiente.";
    if (!confirm(aviso)) return;
    const respuesta = await eliminarEjecucion(controlId, ejecucion.id);
    if (respuesta.exito) {
      toast.success(respuesta.mensaje ?? "Registro eliminado.");
      router.refresh();
    } else {
      toast.error(respuesta.error);
    }
  }

  return (
    <div className="space-y-4">
      {puedeEditar && pendientes.length > 0 ? (
        <form
          onSubmit={registrar}
          className="space-y-3 rounded-md border border-borde bg-atenuado/30 p-3"
        >
          <p className="text-xs font-semibold">Registrar ejecución</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <GrupoCampo etiqueta="Período" htmlFor="periodo" requerido>
              <Seleccion id="periodo" name="periodo" required defaultValue={periodoSugerido}>
                {pendientes.map((periodo) => (
                  <option key={periodo} value={periodo}>
                    {describirPeriodo(periodo)}
                    {periodo < periodoDe(hoy) ? " (vencido)" : ""}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>
            <GrupoCampo etiqueta="Fecha de ejecución" htmlFor="fecha_ejecucion" requerido>
              <Entrada
                id="fecha_ejecucion"
                name="fecha_ejecucion"
                type="date"
                required
                max={hoy}
                defaultValue={hoy}
                className="tabular"
              />
            </GrupoCampo>
            <GrupoCampo etiqueta="Resultado" htmlFor="resultado" requerido>
              <Seleccion
                id="resultado"
                name="resultado"
                required
                value={resultado}
                onChange={(evento) => definirResultado(evento.target.value as ResultadoControl)}
              >
                {RESULTADOS_CONTROL.map((valor) => (
                  <option key={valor} value={valor}>
                    {ETIQUETAS_RESULTADO_CONTROL[valor]}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>
          </div>

          <GrupoCampo
            etiqueta="Observaciones"
            htmlFor="observaciones"
            requerido={resultado !== "conforme"}
            ayuda={
              resultado !== "conforme"
                ? "Qué se encontró y qué se hizo: los tickets abiertos, las acciones derivadas."
                : undefined
            }
          >
            <AreaTexto
              key={resultado === "conforme" ? "opcional" : "obligatoria"}
              id="observaciones"
              name="observaciones"
              rows={3}
              required={resultado !== "conforme"}
              minLength={resultado !== "conforme" ? 10 : undefined}
              placeholder="Hallazgos, tickets derivados, pendientes…"
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Evidencia"
            htmlFor="evidencias"
            ayuda={`El formulario firmado, capturas, actas. Hasta ${MAXIMO_EVIDENCIAS_ACCION} archivos.`}
          >
            <input
              id="evidencias"
              type="file"
              name="evidencias"
              multiple
              accept={ACEPTA_EVIDENCIA}
              className={CLASE_ARCHIVO}
            />
          </GrupoCampo>

          {error ? <ErrorDeFormulario error={error} /> : null}

          <div className="flex justify-end">
            <Boton type="submit" tamano="pequeno" cargando={procesando}>
              <CheckCircle2 aria-hidden />
              Registrar
            </Boton>
          </div>
        </form>
      ) : null}

      {ejecuciones.length === 0 ? (
        <EstadoVacio
          titulo="Sin ejecuciones registradas"
          descripcion="Cada vez que se haga el control, se registra acá con su evidencia."
        />
      ) : (
        <ul className="space-y-2">
          {ejecuciones.map((ejecucion) => {
            const resultadoValido = (RESULTADOS_CONTROL as readonly string[]).includes(
              ejecucion.resultado,
            )
              ? (ejecucion.resultado as ResultadoControl)
              : null;

            return (
              <li key={ejecucion.id} className="rounded-md border border-borde p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold">
                    {describirPeriodo(ejecucion.periodo)}
                  </span>
                  {resultadoValido ? (
                    <Insignia variante={VARIANTE_RESULTADO[resultadoValido]}>
                      {ETIQUETAS_RESULTADO_CONTROL[resultadoValido]}
                    </Insignia>
                  ) : null}
                  <span className="text-[11px] text-atenuado-contraste">
                    Ejecutado el {formatearFecha(ejecucion.fecha_ejecucion)}
                    {ejecucion.ejecutor ? ` · ${ejecucion.ejecutor.nombre_completo}` : ""}
                  </span>
                </div>

                {ejecucion.observaciones ? (
                  <p className="mt-1.5 whitespace-pre-line rounded bg-atenuado/60 p-2 text-[11px] leading-relaxed">
                    {ejecucion.observaciones}
                  </p>
                ) : null}

                {ejecucion.evidencias.length > 0 ? (
                  <ul className="mt-2 space-y-1">
                    {ejecucion.evidencias.map((adjunto) => (
                      <li key={adjunto.id} className="flex items-center gap-1.5 text-[11px]">
                        <a
                          href={`/adjuntos/${adjunto.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex min-w-0 flex-1 items-center gap-1.5 hover:underline"
                        >
                          <Paperclip className="size-3 shrink-0 text-atenuado-contraste" aria-hidden />
                          <span className="truncate">{adjunto.nombre_archivo}</span>
                          <span className="shrink-0 text-atenuado-contraste">
                            {describirTamano(adjunto.tamano_bytes ?? 0)}
                          </span>
                        </a>
                        {puedeEditar ? (
                          <button
                            type="button"
                            onClick={() => quitar(ejecucion.id, adjunto.id, adjunto.nombre_archivo)}
                            className="shrink-0 text-atenuado-contraste transition-colors hover:text-semaforo-critico"
                            aria-label={`Quitar ${adjunto.nombre_archivo}`}
                          >
                            <Trash2 className="size-3" aria-hidden />
                          </button>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-2 text-[11px] text-semaforo-alto">Sin evidencia adjunta.</p>
                )}

                {puedeEditar ? (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-borde pt-2">
                    {ejecucion.evidencias.length < MAXIMO_EVIDENCIAS_ACCION ? (
                      <Boton
                        tamano="pequeno"
                        variante="fantasma"
                        onClick={() =>
                          definirSubiendoEn(subiendoEn === ejecucion.id ? null : ejecucion.id)
                        }
                      >
                        <Upload aria-hidden /> Agregar evidencia
                      </Boton>
                    ) : null}
                    <Boton
                      tamano="pequeno"
                      variante="fantasma"
                      className="text-semaforo-critico"
                      onClick={() => eliminar(ejecucion)}
                    >
                      <Trash2 aria-hidden /> Eliminar registro
                    </Boton>
                  </div>
                ) : null}

                {subiendoEn === ejecucion.id ? (
                  <form
                    onSubmit={(evento) => subir(evento, ejecucion.id)}
                    className="mt-2 space-y-2 rounded-md border border-dashed border-borde p-2.5"
                  >
                    <input
                      type="file"
                      name="evidencias"
                      multiple
                      required
                      accept={ACEPTA_EVIDENCIA}
                      aria-label="Archivos de evidencia"
                      className={CLASE_ARCHIVO}
                    />
                    <p className="text-[10px] text-atenuado-contraste">
                      Hasta {MAXIMO_EVIDENCIAS_ACCION} archivos por ejecución. Van{" "}
                      {ejecucion.evidencias.length}.
                    </p>
                    <div className="flex justify-end gap-1.5">
                      <Boton
                        type="button"
                        tamano="pequeno"
                        variante="fantasma"
                        onClick={() => definirSubiendoEn(null)}
                      >
                        Cancelar
                      </Boton>
                      <Boton type="submit" tamano="pequeno" cargando={procesando}>
                        Subir
                      </Boton>
                    </div>
                  </form>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
