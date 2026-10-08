"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import {
  Dialogo,
  DialogoCabecera,
  DialogoCierre,
  DialogoContenido,
  DialogoDescripcion,
  DialogoPie,
  DialogoTitulo,
} from "@/components/ui/dialogo";
import { Tarjeta } from "@/components/ui/tarjeta";
import {
  borrarMedicionDelObjetivo,
  registrarMedicionDelObjetivo,
} from "@/app/(sgc)/indicadores/acciones";
import {
  estadoDelMes,
  ETIQUETAS_ESTADO_DEL_MES,
  MESES_ABREVIADOS,
  MESES,
  resumenDelMes,
  type EstadoDelMes,
  type FrecuenciaMedicion,
  type MedicionMensual,
  type TipoResultadoObjetivo,
} from "@/lib/objetivos";
import { cn } from "@/lib/utilidades";

/** El objetivo, con lo que el calendario necesita para pintar sus meses. */
export interface ObjetivoDelCalendario {
  id: string;
  codigo: string;
  nombre: string;
  fecha_inicio_medicion: string | null;
  fecha_fin_medicion: string | null;
  frecuencia_medicion: FrecuenciaMedicion | null;
  tipo_resultado: TipoResultadoObjetivo | null;
  resultado_esperado_si_no: boolean | null;
  valor_minimo: number | null;
  valor_maximo: number | null;
  unidad_valor: string | null;
  mediciones: MedicionMensual[];
}

/**
 * El color de cada estado.
 *
 * Sale de las variables del tema, así funciona igual en claro y en
 * oscuro. El color nunca es lo único que identifica la celda: adentro va
 * el valor, y el `title` dice el estado con palabras.
 */
const CLASES_ESTADO: Record<EstadoDelMes, string> = {
  fuera: "bg-atenuado/40 text-atenuado-contraste",
  no_toca: "bg-transparent text-atenuado-contraste",
  pendiente: "bg-transparent text-atenuado-contraste hover:bg-acento",
  alcanzado: "bg-semaforo-bajo/20 text-semaforo-bajo font-medium",
  no_alcanzado: "bg-semaforo-critico/20 text-semaforo-critico font-medium",
  cargado: "bg-primario/15 text-primario font-medium",
};

/**
 * La vista principal del módulo: el objetivo y sus doce meses.
 *
 * Dirección la pidió así el 8 de octubre —«el objetivo y los meses,
 * básicamente»— y es el motivo por el que el seguimiento salió del
 * formulario de la acción del plan: el resultado se registra acá, mes
 * contra mes, que es como se lee si el objetivo va a alcanzarse.
 *
 * Tocar una celda abre el mes: se carga el resultado, se corrige o se
 * borra. Un mes fuera del período declarado no se puede tocar, porque
 * cargarlo sería medir algo que todavía no empezó o que ya cerró.
 *
 * La tabla se desplaza en horizontal dentro de su propia caja; el cuerpo
 * de la página no. La primera columna queda fija: perder de vista el
 * objetivo mientras se leen los meses deja los números sin dueño.
 */
export function CalendarioObjetivos({
  objetivos,
  anio,
  puedeEditar,
}: {
  objetivos: ObjetivoDelCalendario[];
  anio: number;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abierta, definirAbierta] = React.useState<{
    objetivo: ObjetivoDelCalendario;
    mes: number;
  } | null>(null);
  const [procesando, definirProcesando] = React.useState(false);

  const medicionAbierta = abierta
    ? abierta.objetivo.mediciones.find(
        (fila) => fila.anio === anio && fila.mes === abierta.mes,
      )
    : undefined;

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!abierta) return;

    const datos = new FormData(evento.currentTarget);
    definirProcesando(true);
    const resultado = await registrarMedicionDelObjetivo(
      abierta.objetivo.id,
      anio,
      abierta.mes,
      datos,
    );
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Guardado.");
      definirAbierta(null);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function borrar() {
    if (!abierta) return;
    if (!confirm("¿Borrar el resultado de este mes?")) return;

    definirProcesando(true);
    const resultado = await borrarMedicionDelObjetivo(abierta.objetivo.id, anio, abierta.mes);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Borrado.");
      definirAbierta(null);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <>
      <Tarjeta>
        <div className="desplazable-x w-full overflow-x-auto">
          <table className="w-max min-w-full border-collapse text-xs">
            <thead>
              <tr className="border-b border-borde">
                <th
                  className="sticky left-0 z-20 min-w-[20rem] bg-tarjeta px-3 py-2 text-left
                             text-[11px] font-semibold uppercase tracking-wide
                             text-atenuado-contraste"
                >
                  Objetivo
                </th>
                {MESES_ABREVIADOS.map((mes) => (
                  <th
                    key={mes}
                    className="w-[4.5rem] px-1 py-2 text-center text-[11px] font-semibold
                               uppercase tracking-wide text-atenuado-contraste"
                  >
                    {mes}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {objetivos.map((objetivo) => (
                <tr key={objetivo.id} className="border-b border-borde">
                  <td className="sticky left-0 z-10 bg-tarjeta px-3 py-2 align-top">
                    <Link
                      href={`/indicadores/objetivos/${objetivo.id}`}
                      className="hover:text-primario"
                    >
                      <span className="tabular text-[11px] text-atenuado-contraste">
                        {objetivo.codigo}
                      </span>
                      <span className="block font-medium">{objetivo.nombre}</span>
                    </Link>
                  </td>

                  {MESES.map((nombreMes, indice) => {
                    const mes = indice + 1;
                    const medicion = objetivo.mediciones.find(
                      (fila) => fila.anio === anio && fila.mes === mes,
                    );
                    const estado = estadoDelMes(objetivo, anio, mes, medicion);
                    const texto = resumenDelMes(objetivo, medicion);
                    const sePuedeTocar = puedeEditar && estado !== "fuera";
                    const rotulo = `${nombreMes} · ${ETIQUETAS_ESTADO_DEL_MES[estado]}${
                      medicion?.comentario ? ` · ${medicion.comentario}` : ""
                    }`;

                    return (
                      <td key={mes} className="border-l border-borde p-0.5 align-middle">
                        <button
                          type="button"
                          disabled={!sePuedeTocar}
                          onClick={() => definirAbierta({ objetivo, mes })}
                          title={rotulo}
                          aria-label={`${objetivo.codigo}, ${nombreMes}: ${ETIQUETAS_ESTADO_DEL_MES[estado]}`}
                          className={cn(
                            "flex h-9 w-full items-center justify-center rounded px-1",
                            "tabular text-[11px] leading-tight transition-colors",
                            CLASES_ESTADO[estado],
                            sePuedeTocar ? "cursor-pointer" : "cursor-default",
                          )}
                        >
                          {texto || (estado === "pendiente" && sePuedeTocar ? "+" : "")}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Tarjeta>

      {/* La referencia de los colores, con palabras. El color nunca es lo
          único que distingue un estado. */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-atenuado-contraste">
        {(["alcanzado", "no_alcanzado", "cargado", "pendiente", "fuera"] as EstadoDelMes[]).map(
          (estado) => (
            <span key={estado} className="flex items-center gap-1.5">
              <span
                className={cn(
                  "inline-block size-3 rounded border border-borde",
                  CLASES_ESTADO[estado],
                )}
              />
              {ETIQUETAS_ESTADO_DEL_MES[estado]}
            </span>
          ),
        )}
      </div>

      <Dialogo open={abierta !== null} onOpenChange={(valor) => !valor && definirAbierta(null)}>
        <DialogoContenido>
          {abierta ? (
            <form onSubmit={guardar} key={`${abierta.objetivo.id}-${abierta.mes}`}>
              <DialogoCabecera>
                <DialogoTitulo>
                  {MESES[abierta.mes - 1]} de {anio}
                </DialogoTitulo>
                <DialogoDescripcion>
                  {abierta.objetivo.codigo} · {abierta.objetivo.nombre}
                  {abierta.objetivo.tipo_resultado === "numerico" &&
                  abierta.objetivo.valor_minimo !== null &&
                  abierta.objetivo.valor_maximo !== null
                    ? ` · Se espera entre ${abierta.objetivo.valor_minimo} y ${abierta.objetivo.valor_maximo}${
                        abierta.objetivo.unidad_valor
                          ? ` ${abierta.objetivo.unidad_valor}`
                          : ""
                      }`
                    : ""}
                </DialogoDescripcion>
              </DialogoCabecera>

              <div className="mt-4 space-y-3">
                {abierta.objetivo.tipo_resultado === "numerico" ? (
                  <GrupoCampo
                    etiqueta={`Resultado del mes${
                      abierta.objetivo.unidad_valor
                        ? ` (${abierta.objetivo.unidad_valor})`
                        : ""
                    }`}
                    htmlFor="valor_numerico"
                    requerido
                  >
                    <Entrada
                      id="valor_numerico"
                      name="valor_numerico"
                      type="number"
                      step="any"
                      required
                      className="tabular"
                      defaultValue={medicionAbierta?.valor_numerico ?? ""}
                    />
                  </GrupoCampo>
                ) : abierta.objetivo.tipo_resultado === "si_no" ? (
                  <GrupoCampo etiqueta="¿Se cumplió este mes?" htmlFor="resultado_si_no" requerido>
                    <Seleccion
                      id="resultado_si_no"
                      name="resultado_si_no"
                      required
                      defaultValue={
                        medicionAbierta?.resultado_si_no === null ||
                        medicionAbierta?.resultado_si_no === undefined
                          ? ""
                          : medicionAbierta.resultado_si_no
                            ? "si"
                            : "no"
                      }
                    >
                      <option value="" disabled>
                        Elija una opción…
                      </option>
                      <option value="si">Sí</option>
                      <option value="no">No</option>
                    </Seleccion>
                  </GrupoCampo>
                ) : (
                  <GrupoCampo etiqueta="Resultado del mes" htmlFor="resultado_texto" requerido>
                    <AreaTexto
                      id="resultado_texto"
                      name="resultado_texto"
                      rows={3}
                      required
                      defaultValue={medicionAbierta?.resultado_texto ?? ""}
                    />
                  </GrupoCampo>
                )}

                <GrupoCampo
                  etiqueta="Comentario"
                  htmlFor="comentario"
                  ayuda="Opcional. Es lo que se lee en la Revisión por la Dirección cuando el mes no alcanza."
                >
                  <AreaTexto
                    id="comentario"
                    name="comentario"
                    rows={2}
                    defaultValue={medicionAbierta?.comentario ?? ""}
                  />
                </GrupoCampo>
              </div>

              <DialogoPie className="mt-5 sm:justify-between">
                {medicionAbierta ? (
                  <Boton
                    type="button"
                    variante="contorno"
                    onClick={borrar}
                    cargando={procesando}
                    className="text-semaforo-critico hover:text-semaforo-critico"
                  >
                    Borrar el mes
                  </Boton>
                ) : (
                  <span />
                )}

                <span className="flex gap-2">
                  <DialogoCierre asChild>
                    <Boton type="button" variante="contorno">
                      Cancelar
                    </Boton>
                  </DialogoCierre>
                  <Boton type="submit" cargando={procesando}>
                    Guardar
                  </Boton>
                </span>
              </DialogoPie>
            </form>
          ) : null}
        </DialogoContenido>
      </Dialogo>
    </>
  );
}
