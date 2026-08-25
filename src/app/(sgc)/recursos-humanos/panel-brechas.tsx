"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ClipboardList, GraduationCap } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import {
  AreaTexto,
  Entrada,
  GrupoCampo,
  Seleccion,
} from "@/components/ui/campo";
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
import { evaluarCompetencia } from "@/app/(sgc)/recursos-humanos/acciones";
import { formatearFecha, hoyEnAsuncion } from "@/lib/formato";

interface Evaluacion {
  id: string;
  usuario_id: string;
  nivel_actual: number;
  nivel_requerido: number;
  brecha: number;
  fecha: string;
  observacion: string | null;
  usuarios: {
    nombre_completo: string;
    puestos: { nombre: string } | null;
  } | null;
  competencias: { codigo: string; nombre: string } | null;
}

/**
 * Brechas de competencia del personal. La brecha la calcula la base de
 * datos como columna generada (requerido menos alcanzado) y es la entrada
 * natural al plan de capacitacion.
 */
export function PanelBrechas({
  evaluaciones,
  personas,
  competencias,
  puedeEvaluar,
}: {
  evaluaciones: Evaluacion[];
  personas: { id: string; nombre_completo: string }[];
  competencias: { id: string; codigo: string; nombre: string }[];
  puedeEvaluar: boolean;
}) {
  const router = useRouter();
  const [abierto, definirAbierto] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);

  const conBrecha = evaluaciones.filter((evaluacion) => evaluacion.brecha > 0);

  async function evaluar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirProcesando(true);
    const resultado = await evaluarCompetencia(
      new FormData(evento.currentTarget),
    );
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
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] leading-relaxed text-atenuado-contraste">
          {conBrecha.length} de {evaluaciones.length} evaluaciones tienen brecha
          {conBrecha.length > 0
            ? "; cada una debería derivar en una capacitación."
            : "."}
        </p>
        {puedeEvaluar ? (
          <Boton
            tamano="pequeno"
            variante="contorno"
            onClick={() => definirAbierto(true)}
          >
            <GraduationCap /> Evaluar competencia
          </Boton>
        ) : null}
      </div>

      {evaluaciones.length === 0 ? (
        <EstadoVacio
          icono={<ClipboardList className="size-6" />}
          titulo="Sin evaluaciones de competencia"
          descripcion="Evalúe al personal contra el nivel exigido en la matriz de su puesto."
        />
      ) : (
        <div className="overflow-x-auto">
          <Tabla>
            <TablaCabecera>
              <TablaFila>
                <TablaEncabezado>Persona</TablaEncabezado>
                <TablaEncabezado>Competencia</TablaEncabezado>
                <TablaEncabezado className="w-[5.5rem] text-center">
                  Exigido
                </TablaEncabezado>
                <TablaEncabezado className="w-[5.5rem] text-center">
                  Alcanzado
                </TablaEncabezado>
                <TablaEncabezado className="w-[7rem]">Brecha</TablaEncabezado>
                <TablaEncabezado className="hidden lg:table-cell">
                  Observación
                </TablaEncabezado>
                <TablaEncabezado className="w-[7rem]">Fecha</TablaEncabezado>
              </TablaFila>
            </TablaCabecera>
            <TablaCuerpo>
              {evaluaciones.map((evaluacion) => (
                <TablaFila key={evaluacion.id}>
                  <TablaCelda>
                    <p className="text-xs font-medium">
                      {evaluacion.usuarios?.nombre_completo ?? "—"}
                    </p>
                    <p className="text-[11px] text-atenuado-contraste">
                      {evaluacion.usuarios?.puestos?.nombre ?? "Sin puesto"}
                    </p>
                  </TablaCelda>
                  <TablaCelda className="text-xs">
                    <span className="tabular text-atenuado-contraste">
                      {evaluacion.competencias?.codigo}
                    </span>{" "}
                    {evaluacion.competencias?.nombre}
                  </TablaCelda>
                  <TablaCelda className="text-center text-xs tabular">
                    {evaluacion.nivel_requerido}
                  </TablaCelda>
                  <TablaCelda className="text-center text-xs font-medium tabular">
                    {evaluacion.nivel_actual}
                  </TablaCelda>
                  <TablaCelda>
                    {evaluacion.brecha > 0 ? (
                      <Insignia
                        variante={
                          evaluacion.brecha >= 2 ? "peligro" : "advertencia"
                        }
                      >
                        −{evaluacion.brecha} nivel
                        {evaluacion.brecha === 1 ? "" : "es"}
                      </Insignia>
                    ) : (
                      <Insignia variante="exito">Sin brecha</Insignia>
                    )}
                  </TablaCelda>
                  <TablaCelda className="hidden text-[11px] text-atenuado-contraste lg:table-cell">
                    {evaluacion.observacion ?? "—"}
                  </TablaCelda>
                  <TablaCelda className="text-xs tabular text-atenuado-contraste">
                    {formatearFecha(evaluacion.fecha)}
                  </TablaCelda>
                </TablaFila>
              ))}
            </TablaCuerpo>
          </Tabla>
        </div>
      )}

      <Dialogo open={abierto} onOpenChange={definirAbierto}>
        <DialogoContenido>
          <form onSubmit={evaluar}>
            <DialogoCabecera>
              <DialogoTitulo>Evaluar competencia</DialogoTitulo>
              <DialogoDescripcion>
                El nivel exigido se toma de la matriz del puesto de la persona.
                La brecha la calcula el sistema y es la entrada al plan de
                capacitación.
              </DialogoDescripcion>
            </DialogoCabecera>

            <div className="mt-4 space-y-3">
              <GrupoCampo etiqueta="Persona" htmlFor="usuario_id" requerido>
                <Seleccion id="usuario_id" name="usuario_id" required>
                  <option value="">Seleccione una persona</option>
                  {personas.map((persona) => (
                    <option key={persona.id} value={persona.id}>
                      {persona.nombre_completo}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Competencia"
                htmlFor="competencia_id"
                requerido
              >
                <Seleccion id="competencia_id" name="competencia_id" required>
                  <option value="">Seleccione una competencia</option>
                  {competencias.map((competencia) => (
                    <option key={competencia.id} value={competencia.id}>
                      {competencia.codigo} · {competencia.nombre}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Nivel alcanzado"
                htmlFor="nivel_actual"
                requerido
                ayuda="0 significa que todavía no tiene la competencia."
              >
                <Seleccion
                  id="nivel_actual"
                  name="nivel_actual"
                  defaultValue={3}
                >
                  {[0, 1, 2, 3, 4, 5].map((valor) => (
                    <option key={valor} value={valor}>
                      {valor}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>

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
                Registrar evaluación
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </div>
  );
}
