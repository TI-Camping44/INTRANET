"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardCheck } from "lucide-react";
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
import { InsigniaEstadoProveedor } from "@/components/comunes/insignias-estado";
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import { registrarEvaluacion } from "@/app/(sgc)/proveedores/acciones";
import { CRITERIOS_EVALUACION, FACTOR_PUNTAJE, resultadoSugerido } from "@/lib/proveedores";
import { ETIQUETAS_ESTADO_PROVEEDOR } from "@/lib/constantes";
import { formatearFecha, formatearNumero, hoyEnAsuncion } from "@/lib/formato";
import type { EstadoProveedor } from "@/lib/tipos";

interface Evaluacion {
  id: string;
  fecha: string;
  periodo: string | null;
  calidad: number;
  plazo_entrega: number;
  precio: number;
  servicio_posventa: number;
  documentacion: number;
  puntaje: number;
  resultado: EstadoProveedor | null;
  comentario: string | null;
  evaluador: { nombre_completo: string } | null;
}

const ESCALA = [
  { valor: 1, etiqueta: "1 · Deficiente" },
  { valor: 2, etiqueta: "2 · Insuficiente" },
  { valor: 3, etiqueta: "3 · Aceptable" },
  { valor: 4, etiqueta: "4 · Bueno" },
  { valor: 5, etiqueta: "5 · Excelente" },
];

/**
 * Evaluacion periodica del proveedor sobre cinco criterios de 1 a 5.
 * El puntaje resultante va de 0 a 100 y lo calcula la base de datos.
 */
export function PanelEvaluaciones({
  proveedorId,
  evaluaciones,
  puedeEditar,
}: {
  proveedorId: string;
  evaluaciones: Evaluacion[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abierto, definirAbierto] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);
  const [puntos, definirPuntos] = React.useState<Record<string, number>>(() =>
    Object.fromEntries(CRITERIOS_EVALUACION.map((criterio) => [criterio.campo, 3])),
  );

  const puntajePrevisto =
    Object.values(puntos).reduce((suma, valor) => suma + valor, 0) * FACTOR_PUNTAJE;
  const resultadoPrevisto = resultadoSugerido(puntajePrevisto);

  async function registrar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirProcesando(true);
    const resultado = await registrarEvaluacion(proveedorId, new FormData(evento.currentTarget));
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Evaluación registrada.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="space-y-3">
      {evaluaciones.length === 0 ? (
        <p className="py-6 text-center text-xs text-atenuado-contraste">
          Sin evaluaciones registradas. El proveedor permanece en evaluación hasta la primera.
        </p>
      ) : (
        <Tabla>
          <TablaCabecera>
            <TablaFila>
              <TablaEncabezado className="w-[7rem]">Fecha</TablaEncabezado>
              <TablaEncabezado className="hidden md:table-cell">Período</TablaEncabezado>
              {CRITERIOS_EVALUACION.map((criterio) => (
                <TablaEncabezado
                  key={criterio.campo}
                  className="hidden w-[3rem] text-center xl:table-cell"
                  title={criterio.etiqueta}
                >
                  {criterio.etiqueta.split(" ")[0]}
                </TablaEncabezado>
              ))}
              <TablaEncabezado className="w-[6rem] text-right">Puntaje</TablaEncabezado>
              <TablaEncabezado className="w-[8rem]">Resultado</TablaEncabezado>
              <TablaEncabezado className="hidden lg:table-cell">Evaluó</TablaEncabezado>
            </TablaFila>
          </TablaCabecera>
          <TablaCuerpo>
            {evaluaciones.map((evaluacion) => (
              <TablaFila key={evaluacion.id}>
                <TablaCelda className="text-xs tabular">
                  {formatearFecha(evaluacion.fecha)}
                </TablaCelda>
                <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                  {evaluacion.periodo ?? "—"}
                </TablaCelda>
                {CRITERIOS_EVALUACION.map((criterio) => (
                  <TablaCelda
                    key={criterio.campo}
                    className="hidden text-center text-xs tabular xl:table-cell"
                  >
                    {(evaluacion as unknown as Record<string, number>)[criterio.campo]}
                  </TablaCelda>
                ))}
                <TablaCelda className="text-right text-xs font-semibold tabular">
                  {formatearNumero(evaluacion.puntaje, 0)} / 100
                </TablaCelda>
                <TablaCelda>
                  {evaluacion.resultado ? (
                    <InsigniaEstadoProveedor estado={evaluacion.resultado} />
                  ) : (
                    <span className="text-xs text-atenuado-contraste">—</span>
                  )}
                </TablaCelda>
                <TablaCelda className="hidden text-[11px] text-atenuado-contraste lg:table-cell">
                  {evaluacion.evaluador?.nombre_completo ?? "—"}
                </TablaCelda>
              </TablaFila>
            ))}
          </TablaCuerpo>
        </Tabla>
      )}

      {evaluaciones.some((evaluacion) => evaluacion.comentario) ? (
        <div className="space-y-2 border-t border-borde pt-3">
          {evaluaciones
            .filter((evaluacion) => evaluacion.comentario)
            .slice(0, 3)
            .map((evaluacion) => (
              <p key={`c-${evaluacion.id}`} className="text-[11px] leading-relaxed">
                <span className="text-atenuado-contraste">
                  {formatearFecha(evaluacion.fecha)}:
                </span>{" "}
                {evaluacion.comentario}
              </p>
            ))}
        </div>
      ) : null}

      {puedeEditar ? (
        <div className="flex justify-end">
          <Boton tamano="pequeno" variante="contorno" onClick={() => definirAbierto(true)}>
            <ClipboardCheck /> Registrar evaluación
          </Boton>
        </div>
      ) : null}

      <Dialogo open={abierto} onOpenChange={definirAbierto}>
        <DialogoContenido className="max-w-xl">
          <form onSubmit={registrar}>
            <DialogoCabecera>
              <DialogoTitulo>Evaluación del proveedor</DialogoTitulo>
              <DialogoDescripcion>
                Cinco criterios de 1 a 5. El puntaje resultante va de 0 a 100 y define el
                resultado; la próxima evaluación se agenda sola según la periodicidad.
              </DialogoDescripcion>
            </DialogoCabecera>

            <div className="mt-4 space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <GrupoCampo etiqueta="Fecha" htmlFor="fecha" requerido>
                  <Entrada
                    id="fecha"
                    name="fecha"
                    type="date"
                    defaultValue={hoyEnAsuncion()}
                    max={hoyEnAsuncion()}
                    required
                  />
                </GrupoCampo>
                <GrupoCampo etiqueta="Período evaluado" htmlFor="periodo">
                  <Entrada id="periodo" name="periodo" placeholder="Semestre 1" />
                </GrupoCampo>
              </div>

              {CRITERIOS_EVALUACION.map((criterio) => (
                <GrupoCampo
                  key={criterio.campo}
                  etiqueta={criterio.etiqueta}
                  htmlFor={criterio.campo}
                  requerido
                >
                  <Seleccion
                    id={criterio.campo}
                    name={criterio.campo}
                    value={puntos[criterio.campo]}
                    onChange={(evento) =>
                      definirPuntos((actual) => ({
                        ...actual,
                        [criterio.campo]: Number(evento.target.value),
                      }))
                    }
                  >
                    {ESCALA.map((opcion) => (
                      <option key={opcion.valor} value={opcion.valor}>
                        {opcion.etiqueta}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>
              ))}

              <div className="flex items-center justify-between rounded-md border border-borde p-3">
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-atenuado-contraste">
                    Puntaje resultante
                  </p>
                  <p className="text-lg font-semibold tabular">{puntajePrevisto} / 100</p>
                </div>
                <InsigniaEstadoProveedor estado={resultadoPrevisto} />
              </div>

              <GrupoCampo
                etiqueta="Resultado"
                htmlFor="resultado"
                ayuda="Se propone según el puntaje; puede ajustarse con justificación."
              >
                <Seleccion id="resultado" value={resultadoPrevisto} disabled onChange={() => {}}>
                  {Object.entries(ETIQUETAS_ESTADO_PROVEEDOR).map(([valor, etiqueta]) => (
                    <option key={valor} value={valor}>
                      {etiqueta}
                    </option>
                  ))}
                </Seleccion>
                <input type="hidden" name="resultado" value={resultadoPrevisto} />
              </GrupoCampo>

              <GrupoCampo etiqueta="Comentario" htmlFor="comentario">
                <AreaTexto
                  id="comentario"
                  name="comentario"
                  rows={2}
                  placeholder="Observaciones del período evaluado."
                />
              </GrupoCampo>
            </div>

            <DialogoPie className="mt-5">
              <DialogoCierre asChild>
                <Boton type="button" variante="contorno">
                  Cancelar
                </Boton>
              </DialogoCierre>
              <Boton type="submit" disabled={procesando}>
                Registrar evaluación
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </div>
  );
}
