"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { crearRiesgo } from "@/app/(sgc)/riesgos/acciones";
import {
  ESCALA_IMPACTO,
  ESCALA_PROBABILIDAD,
  ETIQUETAS_NIVEL_RIESGO,
  ETIQUETAS_TIPO_RIESGO,
  ETIQUETAS_TRATAMIENTO_RIESGO,
} from "@/lib/constantes";
import { CLASES_NIVEL_RIESGO, diasReevaluacion, etiquetaNivelRiesgo } from "@/lib/riesgos";
import { cn } from "@/lib/utilidades";

interface Opcion {
  id: string;
  nombre?: string;
  codigo?: string;
  nombre_completo?: string;
}

export function FormularioRiesgo({
  procesos,
  usuarios,
  usuarioActual,
}: {
  procesos: Opcion[];
  usuarios: Opcion[];
  usuarioActual: string;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [probabilidad, definirProbabilidad] = React.useState(3);
  const [impacto, definirImpacto] = React.useState(3);

  const nivel = probabilidad * impacto;
  const etiqueta = etiquetaNivelRiesgo(nivel)!;
  const dias = diasReevaluacion(nivel);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const resultado = await crearRiesgo(new FormData(evento.currentTarget));

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Riesgo registrado.");
      router.push(`/riesgos/${resultado.id}`);
      router.refresh();
    } else {
      definirError(resultado.error);
      toast.error(resultado.error);
      definirEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      <Tarjeta className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <GrupoCampo etiqueta="Tipo" htmlFor="tipo" requerido>
            <Seleccion id="tipo" name="tipo" defaultValue="riesgo">
              {Object.entries(ETIQUETAS_TIPO_RIESGO).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Categoría"
            htmlFor="categoria"
            ayuda="Por ejemplo: Operativo, Legal, Financiero, Seguridad."
          >
            <Entrada id="categoria" name="categoria" placeholder="Operativo" />
          </GrupoCampo>

          <GrupoCampo etiqueta="Título" htmlFor="titulo" requerido className="sm:col-span-2">
            <Entrada
              id="titulo"
              name="titulo"
              required
              minLength={5}
              placeholder="Incumplimiento del registro de armas ante la DIMABEL"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Descripción" htmlFor="descripcion" className="sm:col-span-2">
            <AreaTexto id="descripcion" name="descripcion" rows={3} />
          </GrupoCampo>

          <GrupoCampo etiqueta="Proceso afectado" htmlFor="proceso_id">
            <Seleccion id="proceso_id" name="proceso_id">
              <option value="">Sin proceso asociado</option>
              {procesos.map((proceso) => (
                <option key={proceso.id} value={proceso.id}>
                  {proceso.codigo} · {proceso.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Responsable" htmlFor="responsable_id" requerido>
            <Seleccion id="responsable_id" name="responsable_id" defaultValue={usuarioActual}>
              {usuarios.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Causas" htmlFor="causas">
            <AreaTexto id="causas" name="causas" rows={2} />
          </GrupoCampo>

          <GrupoCampo etiqueta="Consecuencias" htmlFor="consecuencias">
            <AreaTexto id="consecuencias" name="consecuencias" rows={2} />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Controles existentes"
            htmlFor="controles_existentes"
            className="sm:col-span-2"
            ayuda="Qué se hace hoy para contener el riesgo. Justifica la evaluación."
          >
            <AreaTexto id="controles_existentes" name="controles_existentes" rows={2} />
          </GrupoCampo>

          <GrupoCampo etiqueta="Estrategia de tratamiento" htmlFor="tratamiento" requerido>
            <Seleccion id="tratamiento" name="tratamiento" defaultValue="mitigar">
              {Object.entries(ETIQUETAS_TRATAMIENTO_RIESGO).map(([valor, texto]) => (
                <option key={valor} value={valor}>
                  {texto}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>
        </div>

        {/* Evaluación */}
        <div className="mt-5 rounded-md border border-borde p-4">
          <p className="mb-3 text-xs font-semibold">Evaluación inicial</p>

          <div className="grid gap-4 sm:grid-cols-2">
            <GrupoCampo etiqueta="Probabilidad" htmlFor="probabilidad" requerido>
              <Seleccion
                id="probabilidad"
                name="probabilidad"
                value={probabilidad}
                onChange={(evento) => definirProbabilidad(Number(evento.target.value))}
              >
                {ESCALA_PROBABILIDAD.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.valor} · {opcion.etiqueta} — {opcion.detalle}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>

            <GrupoCampo etiqueta="Impacto" htmlFor="impacto" requerido>
              <Seleccion
                id="impacto"
                name="impacto"
                value={impacto}
                onChange={(evento) => definirImpacto(Number(evento.target.value))}
              >
                {ESCALA_IMPACTO.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.valor} · {opcion.etiqueta} — {opcion.detalle}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>
          </div>

          <div
            className={cn(
              "mt-4 flex flex-wrap items-center justify-between gap-2 rounded-md border p-3",
              CLASES_NIVEL_RIESGO[etiqueta],
            )}
          >
            <div>
              <p className="text-[11px] uppercase tracking-wide opacity-80">Nivel resultante</p>
              <p className="text-lg font-semibold tabular">
                {nivel} · {ETIQUETAS_NIVEL_RIESGO[etiqueta]}
              </p>
            </div>
            <p className="text-[11px] opacity-90">
              Reevaluación automática cada {dias} días
            </p>
          </div>
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={enviando}>
            {enviando ? "Registrando…" : "Registrar riesgo"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
