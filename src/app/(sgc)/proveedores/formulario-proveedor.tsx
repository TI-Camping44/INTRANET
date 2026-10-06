"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { crearProveedor } from "@/app/(sgc)/proveedores/acciones";

/** Las dos empresas del grupo, como las devuelve `empresas_del_grupo()`. */
type EmpresaDelGrupo = { id: string; nombre: string };

export function FormularioProveedor({ empresas }: { empresas: EmpresaDelGrupo[] }) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const resultado = await crearProveedor(new FormData(evento.currentTarget));

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Asociado de Negocio registrado.");
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
          {/* TODO OBLIGATORIO MENOS EL SEGUNDO CONTACTO. Lo pidió
              Dirección el 6 de octubre. El control de verdad está en la
              acción de servidor; esto evita el viaje de ida y vuelta.

              SALIERON: el código —lo genera el alta, nadie quiere
              inventarlo—, el teléfono —con el contacto escrito se
              entiende, y suelto no decía de quién era—, la marca de
              crítico, el impacto en la calidad y las observaciones. */}
          {/* CAMPING 44 Y VITÁLICA SON UN MISMO GRUPO Y LA MISMA GENTE
              las administra, pero cada Asociado de Negocio es de una.
              Esta es la empresa que firma su carta de evaluación, con su
              logotipo y su razón social. */}
          <GrupoCampo
            etiqueta="Empresa del grupo"
            htmlFor="empresa_compradora_id"
            requerido
            className="sm:col-span-2"
            ayuda="Cuál de las dos le compra. Es la que firma la carta de evaluación."
          >
            <Seleccion
              id="empresa_compradora_id"
              name="empresa_compradora_id"
              required
              defaultValue={empresas[0]?.id ?? ""}
            >
              <option value="" disabled>
                Elija la empresa…
              </option>
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Razón social" htmlFor="razon_social" requerido className="sm:col-span-2">
            <Entrada id="razon_social" name="razon_social" required minLength={3} />
          </GrupoCampo>

          <GrupoCampo etiqueta="Nombre comercial" htmlFor="nombre_comercial" requerido>
            <Entrada id="nombre_comercial" name="nombre_comercial" required />
          </GrupoCampo>

          <GrupoCampo etiqueta="RUC" htmlFor="ruc" requerido>
            <Entrada
              id="ruc"
              name="ruc"
              required
              placeholder="80012345-6"
              className="tabular"
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Rubro" htmlFor="rubro" requerido>
            <Entrada id="rubro" name="rubro" required placeholder="Equipamiento outdoor" />
          </GrupoCampo>

          <GrupoCampo etiqueta="Correo" htmlFor="correo" requerido>
            <Entrada id="correo" name="correo" type="email" required />
          </GrupoCampo>

          <GrupoCampo etiqueta="Contacto" htmlFor="contacto" requerido>
            <Entrada id="contacto" name="contacto" required />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Segundo contacto"
            htmlFor="contacto_secundario"
            ayuda="Opcional. Es el único campo que puede quedar vacío."
          >
            <Entrada id="contacto_secundario" name="contacto_secundario" />
          </GrupoCampo>

          <GrupoCampo etiqueta="Ciudad" htmlFor="ciudad" requerido>
            <Entrada id="ciudad" name="ciudad" required placeholder="Asunción" />
          </GrupoCampo>

          <GrupoCampo etiqueta="País" htmlFor="pais" requerido>
            <Entrada id="pais" name="pais" required defaultValue="Paraguay" />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Periodicidad de evaluación (meses)"
            htmlFor="periodicidad_evaluacion_meses"
            requerido
            className="sm:col-span-2"
            ayuda="Se usa para agendar la reevaluación automáticamente."
          >
            <Entrada
              id="periodicidad_evaluacion_meses"
              name="periodicidad_evaluacion_meses"
              type="number"
              min={1}
              max={60}
              required
              defaultValue={12}
              className="tabular"
            />
          </GrupoCampo>
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={enviando}>
            {enviando ? "Registrando…" : "Registrar Asociado de Negocio"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
