"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Save, Target } from "lucide-react";
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
import { Progreso } from "@/components/ui/progreso";
import { Tarjeta } from "@/components/ui/tarjeta";
import { actualizarAvanceObjetivo, crearObjetivo } from "@/app/(sgc)/indicadores/acciones";

interface Objetivo {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  meta: string | null;
  avance_porcentaje: number;
  estado: string;
  procesos: { nombre: string } | null;
  responsable: { nombre_completo: string } | null;
}

const ESTADOS = {
  en_curso: "En curso",
  cumplido: "Cumplido",
  no_cumplido: "No cumplido",
  suspendido: "Suspendido",
};

/** Objetivos de calidad del ejercicio, con su avance. */
export function PanelObjetivos({
  objetivos,
  procesos,
  anio,
  puedeEditar,
}: {
  objetivos: Objetivo[];
  procesos: { id: string; nombre: string }[];
  anio: number;
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abierto, definirAbierto] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);
  const [avances, definirAvances] = React.useState<Record<string, number>>({});

  async function crear(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirProcesando(true);
    const resultado = await crearObjetivo(new FormData(evento.currentTarget));
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Objetivo creado.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function guardar(objetivo: Objetivo, estado: string) {
    const avance = avances[objetivo.id] ?? objetivo.avance_porcentaje;
    definirProcesando(true);
    const resultado = await actualizarAvanceObjetivo(objetivo.id, avance, estado);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Objetivo actualizado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="space-y-3">
      {objetivos.length === 0 ? (
        <EstadoVacio
          icono={<Target className="size-6" />}
          titulo={`Sin objetivos definidos para ${anio}`}
          descripcion="Los objetivos de calidad se acuerdan en la revisión por la dirección."
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {objetivos.map((objetivo) => (
            <Tarjeta key={objetivo.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-xs font-semibold">
                    <span className="tabular text-atenuado-contraste">{objetivo.codigo}</span>{" "}
                    {objetivo.nombre}
                  </p>
                  {objetivo.meta ? (
                    <p className="mt-0.5 text-[11px] text-atenuado-contraste">
                      Meta: {objetivo.meta}
                    </p>
                  ) : null}
                  <p className="mt-0.5 text-[11px] text-atenuado-contraste">
                    {objetivo.procesos?.nombre ?? "Sin proceso"} ·{" "}
                    {objetivo.responsable?.nombre_completo ?? "Sin responsable"}
                  </p>
                </div>
                <span className="shrink-0 text-lg font-semibold tabular">
                  {avances[objetivo.id] ?? objetivo.avance_porcentaje}%
                </span>
              </div>

              <Progreso
                value={avances[objetivo.id] ?? objetivo.avance_porcentaje}
                className="mt-3"
              />

              {puedeEditar ? (
                <div className="mt-3 flex flex-wrap items-end gap-2 border-t border-borde pt-3">
                  <GrupoCampo etiqueta="Avance (%)" htmlFor={`avance-${objetivo.id}`} className="w-24">
                    <Entrada
                      id={`avance-${objetivo.id}`}
                      type="number"
                      min={0}
                      max={100}
                      className="h-8 text-xs tabular"
                      value={avances[objetivo.id] ?? objetivo.avance_porcentaje}
                      onChange={(evento) =>
                        definirAvances((actual) => ({
                          ...actual,
                          [objetivo.id]: Number(evento.target.value),
                        }))
                      }
                    />
                  </GrupoCampo>

                  <GrupoCampo
                    etiqueta="Estado"
                    htmlFor={`estado-${objetivo.id}`}
                    className="flex-1 min-w-[9rem]"
                  >
                    <Seleccion
                      id={`estado-${objetivo.id}`}
                      defaultValue={objetivo.estado}
                      className="h-8 text-xs"
                      onChange={(evento) => guardar(objetivo, evento.target.value)}
                    >
                      {Object.entries(ESTADOS).map(([valor, etiqueta]) => (
                        <option key={valor} value={valor}>
                          {etiqueta}
                        </option>
                      ))}
                    </Seleccion>
                  </GrupoCampo>

                  <Boton
                    tamano="iconoPequeno"
                    variante="contorno"
                    disabled={procesando}
                    aria-label={`Guardar avance de ${objetivo.codigo}`}
                    onClick={() => guardar(objetivo, objetivo.estado)}
                  >
                    <Save />
                  </Boton>
                </div>
              ) : null}
            </Tarjeta>
          ))}
        </div>
      )}

      {puedeEditar ? (
        <div className="flex justify-end">
          <Boton variante="contorno" tamano="pequeno" onClick={() => definirAbierto(true)}>
            <Plus /> Nuevo objetivo
          </Boton>
        </div>
      ) : null}

      <Dialogo open={abierto} onOpenChange={definirAbierto}>
        <DialogoContenido>
          <form onSubmit={crear}>
            <DialogoCabecera>
              <DialogoTitulo>Nuevo objetivo de calidad</DialogoTitulo>
              <DialogoDescripcion>
                Los objetivos se acuerdan por ejercicio y se miden con los indicadores del
                sistema.
              </DialogoDescripcion>
            </DialogoCabecera>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <GrupoCampo etiqueta="Código" htmlFor="codigo" requerido>
                <Entrada id="codigo" name="codigo" placeholder="OBJ-04" required className="tabular" />
              </GrupoCampo>

              <GrupoCampo etiqueta="Año" htmlFor="anio" requerido>
                <Entrada
                  id="anio"
                  name="anio"
                  type="number"
                  min={2000}
                  max={2100}
                  defaultValue={anio}
                  required
                  className="tabular"
                />
              </GrupoCampo>

              <GrupoCampo etiqueta="Nombre" htmlFor="nombre" requerido className="sm:col-span-2">
                <Entrada
                  id="nombre"
                  name="nombre"
                  required
                  minLength={5}
                  placeholder="Elevar la exactitud de inventario al 99 %"
                />
              </GrupoCampo>

              <GrupoCampo etiqueta="Descripción" htmlFor="descripcion" className="sm:col-span-2">
                <AreaTexto id="descripcion" name="descripcion" rows={2} />
              </GrupoCampo>

              <GrupoCampo etiqueta="Meta" htmlFor="meta" className="sm:col-span-2">
                <Entrada id="meta" name="meta" placeholder="99 % de exactitud sostenida" />
              </GrupoCampo>

              <GrupoCampo etiqueta="Proceso" htmlFor="proceso_id">
                <Seleccion id="proceso_id" name="proceso_id">
                  <option value="">Sin proceso</option>
                  {procesos.map((proceso) => (
                    <option key={proceso.id} value={proceso.id}>
                      {proceso.nombre}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>
            </div>

            <DialogoPie className="mt-5">
              <DialogoCierre asChild>
                <Boton type="button" variante="contorno">
                  Cancelar
                </Boton>
              </DialogoCierre>
              <Boton type="submit" disabled={procesando}>
                Crear objetivo
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </div>
  );
}
