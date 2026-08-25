"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { crearProveedor } from "@/app/(sgc)/proveedores/acciones";

export function FormularioProveedor({ codigoSugerido }: { codigoSugerido: string }) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [critico, definirCritico] = React.useState(false);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const resultado = await crearProveedor(new FormData(evento.currentTarget));

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Proveedor registrado.");
      router.push(`/proveedores/${resultado.id}`);
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
          <GrupoCampo etiqueta="Código" htmlFor="codigo" requerido>
            <Entrada
              id="codigo"
              name="codigo"
              defaultValue={codigoSugerido}
              required
              className="tabular"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="RUC" htmlFor="ruc">
            <Entrada id="ruc" name="ruc" placeholder="80012345-6" className="tabular" />
          </GrupoCampo>

          <GrupoCampo etiqueta="Razón social" htmlFor="razon_social" requerido className="sm:col-span-2">
            <Entrada id="razon_social" name="razon_social" required minLength={3} />
          </GrupoCampo>

          <GrupoCampo etiqueta="Nombre comercial" htmlFor="nombre_comercial">
            <Entrada id="nombre_comercial" name="nombre_comercial" />
          </GrupoCampo>

          <GrupoCampo etiqueta="Rubro" htmlFor="rubro">
            <Entrada id="rubro" name="rubro" placeholder="Equipamiento outdoor" />
          </GrupoCampo>

          <GrupoCampo etiqueta="Contacto" htmlFor="contacto">
            <Entrada id="contacto" name="contacto" />
          </GrupoCampo>

          <GrupoCampo etiqueta="Correo" htmlFor="correo">
            <Entrada id="correo" name="correo" type="email" />
          </GrupoCampo>

          <GrupoCampo etiqueta="Teléfono" htmlFor="telefono">
            <Entrada id="telefono" name="telefono" />
          </GrupoCampo>

          <GrupoCampo etiqueta="Ciudad" htmlFor="ciudad">
            <Entrada id="ciudad" name="ciudad" placeholder="Asunción" />
          </GrupoCampo>

          <GrupoCampo etiqueta="País" htmlFor="pais">
            <Entrada id="pais" name="pais" defaultValue="Paraguay" />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Periodicidad de evaluación (meses)"
            htmlFor="periodicidad_evaluacion_meses"
            ayuda={
              critico
                ? "Los proveedores críticos suelen evaluarse cada 6 meses."
                : "Se usa para agendar la reevaluación automáticamente."
            }
          >
            <Entrada
              id="periodicidad_evaluacion_meses"
              name="periodicidad_evaluacion_meses"
              type="number"
              min={1}
              max={60}
              value={critico ? 6 : undefined}
              defaultValue={critico ? undefined : 12}
              onChange={() => undefined}
              readOnly={critico}
              className="tabular"
            />
          </GrupoCampo>

          <div className="sm:col-span-2">
            <label className="flex items-start gap-2 text-xs">
              <input
                type="checkbox"
                name="critico"
                className="mt-0.5 size-4 accent-[#E01E37]"
                checked={critico}
                onChange={(evento) => definirCritico(evento.target.checked)}
              />
              <span>
                <span className="font-medium">Proveedor crítico</span>
                <span className="block text-atenuado-contraste">
                  Su incumplimiento afecta directamente la calidad del producto o el cumplimiento
                  legal. Se evalúa con mayor frecuencia y su resultado desfavorable avisa a Calidad.
                </span>
              </span>
            </label>
          </div>

          <GrupoCampo
            etiqueta="¿De qué manera afecta a la calidad?"
            htmlFor="impacto_en_calidad"
            className="sm:col-span-2"
            ayuda="Del formulario F-SOP-08-01. Es el fundamento de por qué este proveedor se evalúa."
          >
            <AreaTexto id="impacto_en_calidad" name="impacto_en_calidad" rows={2} />
          </GrupoCampo>

          <GrupoCampo etiqueta="Observaciones" htmlFor="observaciones" className="sm:col-span-2">
            <AreaTexto id="observaciones" name="observaciones" rows={2} />
          </GrupoCampo>
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={enviando}>
            {enviando ? "Registrando…" : "Registrar proveedor"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
