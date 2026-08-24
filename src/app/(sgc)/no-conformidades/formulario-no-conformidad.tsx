"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { crearNoConformidad } from "@/app/(sgc)/no-conformidades/acciones";
import { ETIQUETAS_ORIGEN_NC, ETIQUETAS_SEVERIDAD_NC } from "@/lib/constantes";
import { hoyEnAsuncion, sumarDias } from "@/lib/formato";

interface Opcion {
  id: string;
  nombre?: string;
  codigo?: string;
  nombre_completo?: string;
  razon_social?: string;
}

export function FormularioNoConformidad({
  procesos,
  sedes,
  normas,
  usuarios,
  clientes,
}: {
  procesos: Opcion[];
  sedes: Opcion[];
  normas: Opcion[];
  usuarios: Opcion[];
  clientes: Opcion[];
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);

  const hoy = hoyEnAsuncion();
  // Plazo de cierre por defecto: 30 días, coherente con el escalamiento
  // a los 10 días de las acciones sin resolver.
  const limitePorDefecto = sumarDias(hoy, 30);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const resultado = await crearNoConformidad(new FormData(evento.currentTarget));

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "No conformidad registrada.");
      router.push(`/no-conformidades/${resultado.id}`);
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
          <GrupoCampo etiqueta="Título" htmlFor="titulo" requerido className="sm:col-span-2">
            <Entrada
              id="titulo"
              name="titulo"
              placeholder="Faltante de stock en el conteo cíclico de depósito"
              required
              minLength={5}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Descripción de la desviación"
            htmlFor="descripcion"
            requerido
            className="sm:col-span-2"
            ayuda="Qué ocurrió, dónde y cuándo. Es la evidencia objetiva del hallazgo."
          >
            <AreaTexto id="descripcion" name="descripcion" rows={4} required minLength={15} />
          </GrupoCampo>

          <GrupoCampo etiqueta="Origen" htmlFor="origen" requerido>
            <Seleccion id="origen" name="origen" defaultValue="proceso_interno">
              {Object.entries(ETIQUETAS_ORIGEN_NC).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Severidad"
            htmlFor="severidad"
            requerido
            ayuda="Mayor y crítica exigen análisis de causa raíz."
          >
            <Seleccion id="severidad" name="severidad" defaultValue="menor">
              {Object.entries(ETIQUETAS_SEVERIDAD_NC).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </Seleccion>
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

          <GrupoCampo etiqueta="Sede" htmlFor="sede_id">
            <Seleccion id="sede_id" name="sede_id">
              <option value="">Sin sede específica</option>
              {sedes.map((sede) => (
                <option key={sede.id} value={sede.id}>
                  {sede.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Requisito incumplido"
            htmlFor="requisito_incumplido"
            ayuda="Cláusula de la norma o del procedimiento interno."
          >
            <Entrada
              id="requisito_incumplido"
              name="requisito_incumplido"
              placeholder="ISO 9001:2015 · 8.5.1"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Norma de referencia" htmlFor="norma_id">
            <Seleccion id="norma_id" name="norma_id">
              <option value="">Sin norma asociada</option>
              {normas.map((norma) => (
                <option key={norma.id} value={norma.id}>
                  {norma.codigo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Cliente afectado" htmlFor="cliente_id">
            <Seleccion id="cliente_id" name="cliente_id">
              <option value="">No aplica</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.razon_social}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Responsable del tratamiento"
            htmlFor="responsable_id"
            ayuda="Recibe la notificación de asignación."
          >
            <Seleccion id="responsable_id" name="responsable_id">
              <option value="">Asignar más adelante</option>
              {usuarios.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Corrección inmediata aplicada"
            htmlFor="correccion_inmediata"
            className="sm:col-span-2"
            ayuda="Qué se hizo en el momento para contener el problema."
          >
            <AreaTexto id="correccion_inmediata" name="correccion_inmediata" rows={2} />
          </GrupoCampo>

          <GrupoCampo etiqueta="Fecha de detección" htmlFor="fecha_deteccion" requerido>
            <Entrada
              id="fecha_deteccion"
              name="fecha_deteccion"
              type="date"
              defaultValue={hoy}
              max={hoy}
              required
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Fecha límite de cierre"
            htmlFor="fecha_limite_cierre"
            ayuda="A los 10 días sin resolver, la acción escala al jefe inmediato."
          >
            <Entrada
              id="fecha_limite_cierre"
              name="fecha_limite_cierre"
              type="date"
              defaultValue={limitePorDefecto}
              min={hoy}
            />
          </GrupoCampo>
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={enviando}>
            {enviando ? "Registrando…" : "Registrar no conformidad"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
