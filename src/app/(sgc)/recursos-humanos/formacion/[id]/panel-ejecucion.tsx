"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Paperclip, Trash2, Upload, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Insignia } from "@/components/ui/insignia";
import { Entrada, GrupoCampo } from "@/components/ui/campo";
import {
  Dialogo,
  DialogoCabecera,
  DialogoCierre,
  DialogoContenido,
  DialogoPie,
  DialogoTitulo,
} from "@/components/ui/dialogo";
import {
  Tarjeta,
  TarjetaCabecera,
  TarjetaContenido,
  TarjetaTitulo,
} from "@/components/ui/tarjeta";
import {
  adjuntarArchivoFormacion,
  eliminarArchivoFormacion,
  registrarAsistencia,
  verificarEficacia,
} from "@/app/(sgc)/recursos-humanos/formacion/acciones";
import { AreaTexto, Seleccion } from "@/components/ui/campo";
import { ETIQUETAS_EFICACIA } from "@/lib/constantes";
import {
  CAUSAS_NO_EFICACIA,
  CLASES_EFICACIA_ACCION,
  eficaciaDeLaAccion,
  ETIQUETAS_EFICACIA_ACCION,
  type CausaNoEficacia,
} from "@/lib/formacion";
import type { ResultadoEficacia } from "@/lib/tipos";
import { ACEPTA_EVIDENCIA, describirTamano } from "@/lib/adjuntos";
import { formatearFecha } from "@/lib/formato";
import { cn } from "@/lib/utilidades";
import type { EstadoCapacitacion } from "@/lib/tipos";

interface Participante {
  id: string;
  usuario_id: string;
  asistio: boolean | null;
  eficacia: string | null;
  /** El primer resultado, cuando ya hubo una reevaluación. */
  eficacia_inicial: string | null;
  causa_no_eficacia: string | null;
  plan_refuerzo: string | null;
  fecha_reevaluacion: string | null;
  usuarios: { nombre_completo: string; correo: string } | null;
}

interface ArchivoDeFormacion {
  id: string;
  nombre_archivo: string;
  tamano_bytes: number;
  descripcion: string | null;
  creado_en: string;
}

/**
 * El registro de participación y las evidencias.
 *
 * SE ABRE CUANDO LA ACCIÓN QUEDA EJECUTADA, que es cuando hay algo que
 * registrar. Antes se ve la lista de participantes —hace falta: es a quién
 * hay que avisar— pero sin los controles de asistencia, porque marcar
 * que alguien asistió a algo que todavía no pasó no tiene sentido.
 *
 * Los archivos son el registro de participación firmado, los
 * certificados y cualquier otra evidencia de que la acción se llevó a
 * cabo. Sin ellos, en una auditoría, la formación no ocurrió.
 *
 * EL ENLACE NO SE DIBUJA EN LA PÁGINA. Cada archivo apunta a
 * `/adjuntos/<id>`, y esa ruta firma el enlace recién en el clic, por
 * cinco minutos y con la sesión de la persona.
 */
export function PanelEjecucion({
  formacionId,
  estado,
  requiereEficacia,
  participantes,
  archivos,
  puedeEditar,
}: {
  formacionId: string;
  estado: EstadoCapacitacion;
  requiereEficacia: boolean;
  participantes: Participante[];
  archivos: ArchivoDeFormacion[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);
  const [marcando, definirMarcando] = React.useState<string | null>(null);
  const [evaluando, definirEvaluando] = React.useState<Participante | null>(null);
  const [resultado, definirResultado] = React.useState<ResultadoEficacia>("eficaz");
  const [observacion, definirObservacion] = React.useState("");
  const [causa, definirCausa] = React.useState<CausaNoEficacia | "">("");
  const [planRefuerzo, definirPlanRefuerzo] = React.useState("");
  const [fechaReevaluacion, definirFechaReevaluacion] = React.useState("");

  const ejecutada = estado === "ejecutada";
  // Con un solo participante el resultado de la acción es el de esa
  // persona, así que un «no eficaz» exige saber de dónde vino.
  const esIndividual = participantes.length === 1;
  const yaSeReevaluo = Boolean(evaluando?.eficacia_inicial);

  // El resultado de la ACCION sale de contar el de su gente. No se
  // guarda en ninguna columna: se deduce acá y en la base con la misma
  // regla, así que no puede quedar viejo.
  const eficaciaAccion = eficaciaDeLaAccion(
    participantes.map((participante) => ({
      eficacia: (participante.eficacia ?? "pendiente") as ResultadoEficacia,
      eficacia_inicial: participante.eficacia_inicial as ResultadoEficacia | null,
    })),
  );

  const evaluados = participantes.filter(
    (participante) => participante.eficacia && participante.eficacia !== "pendiente",
  ).length;
  const asistieron = participantes.filter((participante) => participante.asistio === true).length;

  async function marcar(participante: Participante, asistio: boolean) {
    definirMarcando(participante.id);
    const resultado = await registrarAsistencia(participante.id, formacionId, asistio);
    definirMarcando(null);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Registrado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function guardarEficacia(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!evaluando) return;

    definirProcesando(true);
    const salida = await verificarEficacia(evaluando.id, formacionId, {
      eficacia: resultado,
      observacion,
      causa: causa || null,
      planRefuerzo,
      fechaReevaluacion,
    });
    definirProcesando(false);

    if (salida.exito) {
      toast.success(salida.mensaje ?? "Eficacia verificada.");
      definirEvaluando(null);
      definirObservacion("");
      definirCausa("");
      definirPlanRefuerzo("");
      definirFechaReevaluacion("");
      router.refresh();
    } else {
      toast.error(salida.error);
    }
  }

  async function subir(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const formulario = evento.currentTarget;
    definirProcesando(true);
    const resultado = await adjuntarArchivoFormacion(formacionId, new FormData(formulario));
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Archivo subido.");
      formulario.reset();
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function quitar(archivo: ArchivoDeFormacion) {
    if (!confirm(`¿Quitar «${archivo.nombre_archivo}»? No se puede deshacer.`)) return;

    const resultado = await eliminarArchivoFormacion(archivo.id, formacionId);
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Archivo eliminado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <>
      <Tarjeta>
        <TarjetaCabecera className="flex-row items-start justify-between gap-3">
          <TarjetaTitulo>
            {ejecutada ? "Registro de participación" : "Participantes"}
            {ejecutada ? ` · ${asistieron} de ${participantes.length}` : ""}
          </TarjetaTitulo>

          {/* El resultado de la acción, deducido. Se muestra donde se
              evalúa: si no, quien carga persona por persona nunca ve en
              qué terminó la acción. */}
          {ejecutada && requiereEficacia ? (
            <span className="shrink-0 text-right">
              <Insignia variante="contorno" className={CLASES_EFICACIA_ACCION[eficaciaAccion]}>
                {ETIQUETAS_EFICACIA_ACCION[eficaciaAccion]}
              </Insignia>
              <span className="mt-1 block text-[10px] text-atenuado-contraste">
                {evaluados} de {participantes.length} evaluado
                {participantes.length === 1 ? "" : "s"}
              </span>
            </span>
          ) : null}
        </TarjetaCabecera>
        <TarjetaContenido>
          {participantes.length === 0 ? (
            <p className="text-xs text-atenuado-contraste">
              Sin participantes. Se agregan desde «Editar».
            </p>
          ) : (
            <ul className="divide-y divide-borde">
              {participantes.map((participante) => (
                <li key={participante.id} className="flex items-center gap-3 py-2 first:pt-0">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-medium">
                      {participante.usuarios?.nombre_completo ?? "Sin nombre"}
                    </span>
                    <span className="block truncate text-[11px] text-atenuado-contraste">
                      {participante.usuarios?.correo}
                    </span>
                  </span>

                  {ejecutada && puedeEditar ? (
                    <span className="flex shrink-0 gap-1">
                      <Boton
                        tamano="iconoPequeno"
                        variante={participante.asistio === true ? "primario" : "contorno"}
                        aria-label={`Marcar que ${participante.usuarios?.nombre_completo} asistió`}
                        cargando={marcando === participante.id}
                        onClick={() => marcar(participante, true)}
                      >
                        <Check />
                      </Boton>
                      <Boton
                        tamano="iconoPequeno"
                        variante="contorno"
                        aria-label={`Marcar que ${participante.usuarios?.nombre_completo} no asistió`}
                        cargando={marcando === participante.id}
                        onClick={() => marcar(participante, false)}
                        className={cn(
                          participante.asistio === false &&
                            "border-semaforo-critico/50 text-semaforo-critico",
                        )}
                      >
                        <X />
                      </Boton>
                    </span>
                  ) : ejecutada ? (
                    <span className="shrink-0 text-[11px] text-atenuado-contraste">
                      {participante.asistio === true
                        ? "Asistió"
                        : participante.asistio === false
                          ? "No asistió"
                          : "Sin registrar"}
                    </span>
                  ) : null}

                  {/* La eficacia, persona por persona. Solo en las de más
                      de dos horas y solo sobre lo ejecutado: es la regla
                      de Calidad y la controla también la acción de
                      servidor. A quien no asistió no se le evalúa nada. */}
                  {ejecutada && requiereEficacia && participante.asistio === true ? (
                    <span className="flex shrink-0 items-center gap-1.5">
                      {participante.eficacia && participante.eficacia !== "pendiente" ? (
                        <span
                          className={cn(
                            "whitespace-nowrap text-[11px] font-medium",
                            participante.eficacia === "eficaz"
                              ? "text-semaforo-bajo"
                              : participante.eficacia === "no_eficaz"
                                ? "text-semaforo-critico"
                                : "text-semaforo-medio",
                          )}
                        >
                          {ETIQUETAS_EFICACIA[participante.eficacia as ResultadoEficacia]}
                        </span>
                      ) : null}

                      {puedeEditar ? (
                        <Boton
                          tamano="pequeno"
                          variante="fantasma"
                          onClick={() => {
                            definirEvaluando(participante);
                            // Se abre en «Eficaz» salvo que ya tenga un
                            // resultado binario cargado. Con «no eficaz»
                            // previo, lo que viene es la reevaluación.
                            definirResultado(
                              participante.eficacia === "no_eficaz" ? "no_eficaz" : "eficaz",
                            );
                            definirObservacion("");
                            definirCausa(
                              (participante.causa_no_eficacia as CausaNoEficacia | null) ?? "",
                            );
                            definirPlanRefuerzo(participante.plan_refuerzo ?? "");
                            definirFechaReevaluacion(participante.fecha_reevaluacion ?? "");
                          }}
                        >
                          {participante.eficacia && participante.eficacia !== "pendiente"
                            ? "Corregir"
                            : "Evaluar eficacia"}
                        </Boton>
                      ) : null}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {!ejecutada ? (
            <p className="mt-3 rounded-md border border-dashed border-borde p-3 text-[11px] leading-relaxed text-atenuado-contraste">
              La asistencia se registra cuando la acción pase a «Ejecutada». Hasta entonces esta
              es la lista de a quiénes hay que convocar.
            </p>
          ) : requiereEficacia ? (
            <p className="mt-3 rounded-md border border-semaforo-medio/40 bg-semaforo-medio/10 p-3 text-[11px] leading-relaxed text-semaforo-medio">
              Esta formación supera las 2 horas: a los dos meses hay que evaluar su eficacia,
              persona por persona. El aviso lo manda el trabajo programado.
            </p>
          ) : null}
        </TarjetaContenido>
      </Tarjeta>

      <Tarjeta>
        <TarjetaCabecera>
          <TarjetaTitulo>
            {ejecutada ? "Evidencias y plan" : "Plan o programa"}
          </TarjetaTitulo>
        </TarjetaCabecera>
        <TarjetaContenido className="space-y-3">
          {archivos.length === 0 ? (
            <p className="text-xs leading-relaxed text-atenuado-contraste">
              {ejecutada
                ? "Suba el registro de participación firmado y los certificados: sin evidencia, en una auditoría la formación no ocurrió."
                : "Suba el plan o programa de la formación."}
            </p>
          ) : (
            <ul className="divide-y divide-borde">
              {archivos.map((archivo) => (
                <li key={archivo.id} className="flex items-start gap-2 py-2 first:pt-0">
                  {/* El enlace firmado se genera en el clic, en /adjuntos/[id]. */}
                  <a
                    href={`/adjuntos/${archivo.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-start gap-2 hover:underline"
                  >
                    <Paperclip className="mt-0.5 size-3.5 shrink-0 text-atenuado-contraste" />
                    <span className="min-w-0">
                      <span className="block truncate text-xs font-medium">
                        {archivo.nombre_archivo}
                      </span>
                      <span className="block text-[11px] text-atenuado-contraste">
                        {describirTamano(archivo.tamano_bytes)} ·{" "}
                        {formatearFecha(archivo.creado_en)}
                        {archivo.descripcion ? ` · ${archivo.descripcion}` : ""}
                      </span>
                    </span>
                  </a>

                  {puedeEditar ? (
                    <Boton
                      tamano="iconoPequeno"
                      variante="fantasma"
                      aria-label={`Quitar ${archivo.nombre_archivo}`}
                      onClick={() => quitar(archivo)}
                      className="text-atenuado-contraste hover:text-semaforo-critico"
                    >
                      <Trash2 />
                    </Boton>
                  ) : null}
                </li>
              ))}
            </ul>
          )}

          {puedeEditar ? (
            <form
              onSubmit={subir}
              className="space-y-2 rounded-md border border-dashed border-borde p-3"
            >
              <input
                type="file"
                name="archivo"
                multiple
                required
                accept={ACEPTA_EVIDENCIA}
                className="block w-full text-xs file:mr-2 file:rounded file:border file:border-borde file:bg-acento file:px-2 file:py-1 file:text-xs"
              />
              <Entrada
                name="descripcion"
                placeholder={
                  ejecutada ? "Registro de participación, certificado…" : "Plan o programa"
                }
                className="text-xs"
              />
              <div className="flex justify-end">
                <Boton type="submit" tamano="pequeno" cargando={procesando}>
                  <Upload /> Subir
                </Boton>
              </div>
            </form>
          ) : null}
        </TarjetaContenido>
      </Tarjeta>

      {/* La Evaluación de Eficacia de la Formación, de a una persona. */}
      <Dialogo
        open={evaluando !== null}
        onOpenChange={(abierto) => !abierto && definirEvaluando(null)}
      >
        <DialogoContenido>
          <form onSubmit={guardarEficacia}>
            <DialogoCabecera>
              <DialogoTitulo>
                Eficacia · {evaluando?.usuarios?.nombre_completo ?? ""}
              </DialogoTitulo>
            </DialogoCabecera>

            <div className="mt-4 space-y-3">
              <p className="text-xs leading-relaxed text-atenuado-contraste">
                Se evalúa a los dos meses de la formación: si la persona aplica en su puesto lo
                que se le enseñó. Se registra por persona, no por curso.
              </p>

              {/* EL RESULTADO DE LA PERSONA ES BINARIO. «Parcialmente
                  eficaz» salió de acá el 6 de octubre: es un resultado de
                  la acción, no de alguien. Una persona aplica lo que
                  aprendió o no lo aplica; de contar a su gente sale el
                  parcialmente eficaz de la acción. */}
              <GrupoCampo etiqueta="Resultado" htmlFor="resultado-eficacia" requerido>
                <Seleccion
                  id="resultado-eficacia"
                  value={resultado}
                  onChange={(evento) =>
                    definirResultado(evento.target.value as ResultadoEficacia)
                  }
                >
                  <option value="eficaz">{ETIQUETAS_EFICACIA.eficaz}</option>
                  <option value="no_eficaz">{ETIQUETAS_EFICACIA.no_eficaz}</option>
                </Seleccion>
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Cómo se verificó"
                htmlFor="observacion-eficacia"
                requerido={resultado !== "pendiente"}
                ayuda="Con qué se comprobó: observación en el puesto, muestreo, indicador."
              >
                <AreaTexto
                  id="observacion-eficacia"
                  rows={3}
                  value={observacion}
                  onChange={(evento) => definirObservacion(evento.target.value)}
                />
              </GrupoCampo>

              {/* CON UNA SOLA PERSONA, UN «NO EFICAZ» NO CONCLUYE NADA
                  TODAVÍA: no se puede distinguir si falló la formación o
                  falló ella, y de eso depende qué se corrige. */}
              {esIndividual && resultado === "no_eficaz" ? (
                <div className="space-y-3 rounded-md border border-semaforo-medio/40
                                bg-semaforo-medio/5 p-3">
                  <p className="text-[11px] leading-relaxed text-atenuado-contraste">
                    Es el único participante, así que este resultado no alcanza para concluir
                    que la capacitación falló. Indique dónde estuvo la causa: de eso depende si
                    se corrige la capacitación o se refuerza a la persona.
                  </p>

                  <GrupoCampo etiqueta="Causa" htmlFor="causa-eficacia" requerido>
                    <Seleccion
                      id="causa-eficacia"
                      value={causa}
                      onChange={(evento) =>
                        definirCausa(evento.target.value as CausaNoEficacia | "")
                      }
                    >
                      <option value="">Elija la causa…</option>
                      {CAUSAS_NO_EFICACIA.map((opcion) => (
                        <option key={opcion.valor} value={opcion.valor}>
                          {opcion.etiqueta} · {opcion.ejemplos}
                        </option>
                      ))}
                    </Seleccion>
                  </GrupoCampo>

                  {causa ? (
                    <p className="text-[11px] leading-relaxed">
                      {CAUSAS_NO_EFICACIA.find((opcion) => opcion.valor === causa)?.queSeHace}
                    </p>
                  ) : null}

                  {causa === "participante" ? (
                    <>
                      <GrupoCampo
                        etiqueta="Refuerzo"
                        htmlFor="plan-refuerzo"
                        requerido
                        ayuda="Qué se hace antes de volver a evaluar."
                      >
                        <AreaTexto
                          id="plan-refuerzo"
                          rows={2}
                          value={planRefuerzo}
                          onChange={(evento) => definirPlanRefuerzo(evento.target.value)}
                        />
                      </GrupoCampo>

                      <GrupoCampo
                        etiqueta="Fecha de reevaluación"
                        htmlFor="fecha-reevaluacion"
                        requerido
                        ayuda="Un refuerzo sin plazo no se revisa nunca. Se reevalúa una sola vez."
                      >
                        <Entrada
                          id="fecha-reevaluacion"
                          type="date"
                          value={fechaReevaluacion}
                          onChange={(evento) => definirFechaReevaluacion(evento.target.value)}
                        />
                      </GrupoCampo>
                    </>
                  ) : null}
                </div>
              ) : null}

              {yaSeReevaluo ? (
                <p className="rounded-md border border-borde p-3 text-[11px] leading-relaxed
                              text-atenuado-contraste">
                  Esta persona ya fue reevaluada una vez: la primera evaluación dio «
                  {ETIQUETAS_EFICACIA[evaluando?.eficacia_inicial as ResultadoEficacia] ??
                    "no eficaz"}
                  ». Si sigue sin ser eficaz, corresponde una acción correctiva y no otra
                  reevaluación.
                </p>
              ) : null}
            </div>

            <DialogoPie className="mt-5">
              <DialogoCierre asChild>
                <Boton type="button" variante="contorno">
                  Cancelar
                </Boton>
              </DialogoCierre>
              <Boton type="submit" cargando={procesando}>
                Guardar
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </>
  );
}
