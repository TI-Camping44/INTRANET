"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, Plus } from "lucide-react";
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
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { Insignia } from "@/components/ui/insignia";
import {
  Tabla,
  TablaCabecera,
  TablaCelda,
  TablaCuerpo,
  TablaEncabezado,
  TablaFila,
} from "@/components/ui/tabla";
import { cambiarEstadoEncuesta, crearEncuesta } from "@/app/(sgc)/satisfaccion/acciones";
import { formatearFecha, hoyEnAsuncion } from "@/lib/formato";
import { ETIQUETAS_TIPO_ENCUESTA, tonoNps } from "@/lib/satisfaccion";
import type { TipoEncuesta } from "@/lib/tipos";

export interface FilaEncuesta {
  id: string;
  codigo: string;
  nombre: string;
  tipo: TipoEncuesta;
  descripcion: string | null;
  fecha_inicio: string | null;
  fecha_fin: string | null;
  activa: boolean;
  fuente_externa: string | null;
  respuestas: number;
  nps: number | null;
}

const TONOS_TEXTO = {
  neutro: "text-atenuado-contraste",
  exito: "text-semaforo-bajo",
  advertencia: "text-semaforo-medio",
  peligro: "text-semaforo-critico",
} as const;

export function PanelEncuestas({
  encuestas,
  puedeGestionar,
}: {
  encuestas: FilaEncuesta[];
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState(false);
  const [abierto, definirAbierto] = React.useState(false);

  async function crear(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirProcesando(true);
    const resultado = await crearEncuesta(new FormData(evento.currentTarget));
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Encuesta creada.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function alternar(encuesta: FilaEncuesta) {
    definirProcesando(true);
    const resultado = await cambiarEstadoEncuesta(encuesta.id, !encuesta.activa);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Listo.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="space-y-3">
      {puedeGestionar ? (
        <div className="flex justify-end">
          <Boton tamano="pequeno" variante="contorno" onClick={() => definirAbierto(true)}>
            <Plus /> Nueva encuesta
          </Boton>
        </div>
      ) : null}

      {encuestas.length === 0 ? (
        <EstadoVacio
          icono={<ClipboardList className="size-6" />}
          titulo="Sin encuestas registradas"
          descripcion="Una encuesta agrupa las respuestas de una campaña de medición."
        />
      ) : (
        <div className="overflow-x-auto">
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado className="w-[6rem]">Código</TablaEncabezado>
                <TablaEncabezado>Encuesta</TablaEncabezado>
                <TablaEncabezado className="hidden w-[8rem] md:table-cell">Tipo</TablaEncabezado>
                <TablaEncabezado className="w-[6.5rem]">Desde</TablaEncabezado>
                <TablaEncabezado className="w-[6rem] text-right">Respuestas</TablaEncabezado>
                <TablaEncabezado className="w-[5rem] text-right">NPS</TablaEncabezado>
                <TablaEncabezado className="w-[6rem]">Estado</TablaEncabezado>
                {puedeGestionar ? <TablaEncabezado className="w-[6rem]" /> : null}
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {encuestas.map((encuesta) => (
                <TablaFila key={encuesta.id}>
                  <TablaCelda className="font-medium tabular">
                    <Link
                      href={`/satisfaccion/${encuesta.id}`}
                      className="hover:text-primario hover:underline"
                    >
                      {encuesta.codigo}
                    </Link>
                  </TablaCelda>
                  <TablaCelda className="text-xs font-medium">
                    <Link
                      href={`/satisfaccion/${encuesta.id}`}
                      className="hover:text-primario hover:underline"
                    >
                      {encuesta.nombre}
                    </Link>
                    {encuesta.fuente_externa ? (
                      <span className="ml-2 text-[10px] text-atenuado-contraste">
                        origen: {encuesta.fuente_externa}
                      </span>
                    ) : null}
                  </TablaCelda>
                  <TablaCelda className="hidden text-xs text-atenuado-contraste md:table-cell">
                    {ETIQUETAS_TIPO_ENCUESTA[encuesta.tipo] ?? encuesta.tipo}
                  </TablaCelda>
                  <TablaCelda className="text-xs tabular text-atenuado-contraste">
                    {encuesta.fecha_inicio ? formatearFecha(encuesta.fecha_inicio) : "—"}
                  </TablaCelda>
                  <TablaCelda className="text-right text-xs tabular">
                    {encuesta.respuestas}
                  </TablaCelda>
                  <TablaCelda
                    className={`text-right text-xs font-semibold tabular ${TONOS_TEXTO[tonoNps(encuesta.nps)]}`}
                  >
                    {encuesta.nps === null ? "—" : encuesta.nps}
                  </TablaCelda>
                  <TablaCelda>
                    <Insignia variante={encuesta.activa ? "primaria" : "neutra"}>
                      {encuesta.activa ? "Abierta" : "Cerrada"}
                    </Insignia>
                  </TablaCelda>
                  {puedeGestionar ? (
                    <TablaCelda>
                      <Boton
                        variante="fantasma"
                        tamano="pequeno"
                        disabled={procesando}
                        onClick={() => alternar(encuesta)}
                      >
                        {encuesta.activa ? "Cerrar" : "Reabrir"}
                      </Boton>
                    </TablaCelda>
                  ) : null}
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </div>
      )}

      <Dialogo open={abierto} onOpenChange={definirAbierto}>
        <DialogoContenido>
          <form onSubmit={crear}>
            <DialogoCabecera>
              <DialogoTitulo>Nueva encuesta</DialogoTitulo>
              <DialogoDescripcion>
                El código se asigna solo, correlativo por empresa.
              </DialogoDescripcion>
            </DialogoCabecera>

            <div className="my-4 space-y-3">
              <GrupoCampo etiqueta="Nombre" htmlFor="nombre" requerido>
                <Entrada id="nombre" name="nombre" required />
              </GrupoCampo>

              <div className="grid gap-3 sm:grid-cols-2">
                <GrupoCampo etiqueta="Tipo" htmlFor="tipo" requerido>
                  <Seleccion id="tipo" name="tipo" defaultValue="nps">
                    {(Object.keys(ETIQUETAS_TIPO_ENCUESTA) as TipoEncuesta[]).map((clave) => (
                      <option key={clave} value={clave}>
                        {ETIQUETAS_TIPO_ENCUESTA[clave]}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>
                <GrupoCampo etiqueta="Desde" htmlFor="fecha_inicio">
                  <Entrada
                    id="fecha_inicio"
                    name="fecha_inicio"
                    type="date"
                    defaultValue={hoyEnAsuncion()}
                  />
                </GrupoCampo>
              </div>

              <GrupoCampo
                etiqueta="Fuente externa"
                htmlFor="fuente_externa"
                ayuda="Identificador del sistema de origen, si las respuestas se ingieren de otro lado."
              >
                <Entrada
                  id="fuente_externa"
                  name="fuente_externa"
                  placeholder="panel-nps-apps-script"
                />
              </GrupoCampo>

              <GrupoCampo etiqueta="Descripción" htmlFor="descripcion">
                <AreaTexto id="descripcion" name="descripcion" rows={2} />
              </GrupoCampo>
            </div>

            <DialogoPie className="mt-5">
              <DialogoCierre asChild>
                <Boton type="button" variante="contorno">
                  Cancelar
                </Boton>
              </DialogoCierre>
              <Boton type="submit" cargando={procesando}>
                Crear
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </div>
  );
}
