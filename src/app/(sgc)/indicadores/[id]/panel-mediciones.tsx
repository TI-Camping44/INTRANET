"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo } from "@/components/ui/campo";
import {
  Dialogo,
  DialogoCabecera,
  DialogoCierre,
  DialogoContenido,
  DialogoDescripcion,
  DialogoPie,
  DialogoTitulo,
} from "@/components/ui/dialogo";
import { Insignia } from "@/components/ui/insignia";
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import { cargarMedicion, eliminarMedicion } from "@/app/(sgc)/indicadores/acciones";
import { formatearMes, formatearNumero, hoyEnAsuncion } from "@/lib/formato";

interface Medicion {
  id: string;
  periodo: string;
  valor_real: number;
  meta_periodo: number | null;
  observacion: string | null;
  cumple: boolean | null;
  cargado: { nombre_completo: string } | null;
}

/**
 * Carga periodica y tabla de mediciones. La tabla es tambien la vista de
 * datos del grafico: todo valor dibujado se puede leer aca como numero.
 */
export function PanelMediciones({
  indicadorId,
  mediciones,
  unidad,
  metaPorDefecto,
  puedeEditar,
}: {
  indicadorId: string;
  mediciones: Medicion[];
  unidad: string;
  metaPorDefecto: number | null;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abierto, definirAbierto] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);

  const periodoSugerido = hoyEnAsuncion().slice(0, 7);

  async function cargar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirProcesando(true);
    const resultado = await cargarMedicion(indicadorId, new FormData(evento.currentTarget));
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Medición registrada.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function borrar(medicion: Medicion) {
    if (!confirm(`¿Eliminar la medición de ${formatearMes(medicion.periodo)}?`)) return;
    const resultado = await eliminarMedicion(medicion.id, indicadorId);
    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Medición eliminada.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="space-y-3">
      {mediciones.length === 0 ? (
        <p className="py-6 text-center text-xs text-atenuado-contraste">
          Sin mediciones cargadas.
        </p>
      ) : (
        <Tabla>
          <TablaCabecera>
            <TablaFila>
              <TablaEncabezado className="w-[9rem]">Período</TablaEncabezado>
              <TablaEncabezado className="w-[7rem] text-right">Real</TablaEncabezado>
              <TablaEncabezado className="w-[7rem] text-right">Meta</TablaEncabezado>
              <TablaEncabezado className="w-[7.5rem]">Cumple</TablaEncabezado>
              <TablaEncabezado>Observación</TablaEncabezado>
              <TablaEncabezado className="hidden lg:table-cell">Cargó</TablaEncabezado>
              {puedeEditar ? <TablaEncabezado className="w-[3rem]" /> : null}
            </TablaFila>
          </TablaCabecera>
          <TablaCuerpo>
            {mediciones.map((medicion) => (
              <TablaFila key={medicion.id}>
                <TablaCelda className="text-xs">{formatearMes(medicion.periodo)}</TablaCelda>
                <TablaCelda className="text-right text-xs font-medium tabular">
                  {formatearNumero(medicion.valor_real)} {unidad}
                </TablaCelda>
                <TablaCelda className="text-right text-xs tabular text-atenuado-contraste">
                  {medicion.meta_periodo !== null
                    ? `${formatearNumero(medicion.meta_periodo)} ${unidad}`
                    : "—"}
                </TablaCelda>
                <TablaCelda>
                  {medicion.cumple === true ? (
                    <Insignia variante="exito">En meta</Insignia>
                  ) : medicion.cumple === false ? (
                    <Insignia variante="peligro">Fuera de meta</Insignia>
                  ) : (
                    <span className="text-xs text-atenuado-contraste">—</span>
                  )}
                </TablaCelda>
                <TablaCelda className="text-[11px] text-atenuado-contraste">
                  {medicion.observacion ?? "—"}
                </TablaCelda>
                <TablaCelda className="hidden text-[11px] text-atenuado-contraste lg:table-cell">
                  {medicion.cargado?.nombre_completo ?? "—"}
                </TablaCelda>
                {puedeEditar ? (
                  <TablaCelda>
                    <button
                      type="button"
                      onClick={() => borrar(medicion)}
                      className="text-atenuado-contraste transition-colors hover:text-semaforo-critico"
                      aria-label={`Eliminar la medición de ${formatearMes(medicion.periodo)}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </TablaCelda>
                ) : null}
              </TablaFila>
            ))}
          </TablaCuerpo>
        </Tabla>
      )}

      {puedeEditar ? (
        <div className="flex justify-end">
          <Boton tamano="pequeno" variante="contorno" onClick={() => definirAbierto(true)}>
            <Plus /> Cargar medición
          </Boton>
        </div>
      ) : null}

      <Dialogo open={abierto} onOpenChange={definirAbierto}>
        <DialogoContenido>
          <form onSubmit={cargar}>
            <DialogoCabecera>
              <DialogoTitulo>Cargar medición</DialogoTitulo>
              <DialogoDescripcion>
                El período se ancla al mes. Si ya existe una medición de ese mes, se reemplaza en
                lugar de duplicarse.
              </DialogoDescripcion>
            </DialogoCabecera>

            <div className="mt-4 space-y-3">
              <GrupoCampo etiqueta="Período" htmlFor="periodo" requerido>
                <Entrada
                  id="periodo"
                  name="periodo"
                  type="month"
                  defaultValue={periodoSugerido}
                  required
                />
              </GrupoCampo>

              <GrupoCampo etiqueta={`Valor real (${unidad})`} htmlFor="valor_real" requerido>
                <Entrada
                  id="valor_real"
                  name="valor_real"
                  type="number"
                  step="0.01"
                  required
                  className="tabular"
                />
              </GrupoCampo>

              <GrupoCampo
                etiqueta={`Meta del período (${unidad})`}
                htmlFor="meta_periodo"
                ayuda="Se usa la meta general del indicador si se deja vacío."
              >
                <Entrada
                  id="meta_periodo"
                  name="meta_periodo"
                  type="number"
                  step="0.01"
                  defaultValue={metaPorDefecto ?? undefined}
                  className="tabular"
                />
              </GrupoCampo>

              <GrupoCampo etiqueta="Observación" htmlFor="observacion">
                <AreaTexto id="observacion" name="observacion" rows={2} />
              </GrupoCampo>
            </div>

            <DialogoPie className="mt-5">
              <DialogoCierre asChild>
                <Boton type="button" variante="contorno">
                  Cancelar
                </Boton>
              </DialogoCierre>
              <Boton type="submit" disabled={procesando}>
                Guardar medición
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </div>
  );
}
