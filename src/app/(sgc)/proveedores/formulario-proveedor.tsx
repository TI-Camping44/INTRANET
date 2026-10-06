"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { actualizarProveedor, crearProveedor } from "@/app/(sgc)/proveedores/acciones";

/** Las dos empresas del grupo, como las devuelve `empresas_del_grupo()`. */
type EmpresaDelGrupo = { id: string; nombre: string };

/** Los datos del Asociado de Negocio que este formulario edita. */
export interface ProveedorInicial {
  id: string;
  empresa_compradora_id: string | null;
  razon_social: string;
  nombre_comercial: string | null;
  ruc: string | null;
  rubro: string | null;
  correo: string | null;
  contacto: string | null;
  contacto_secundario: string | null;
  ciudad: string | null;
  pais: string | null;
  periodicidad_evaluacion_meses: number;
}

/**
 * El mismo formulario sirve para el alta y para la edición.
 *
 * EL CÓDIGO NO ESTÁ NI EN UNO NI EN OTRO: lo genera el alta y es lo que
 * identifica al Asociado de Negocio en el padrón; cambiarlo después
 * rompería la trazabilidad de sus evaluaciones.
 */
export function FormularioProveedor({
  empresas,
  inicial,
}: {
  empresas: EmpresaDelGrupo[];
  inicial?: ProveedorInicial;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);

  const editando = Boolean(inicial);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const datos = new FormData(evento.currentTarget);
    const resultado = inicial
      ? await actualizarProveedor(inicial.id, datos)
      : await crearProveedor(datos);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Asociado de Negocio registrado.");
      router.push(`/proveedores/${inicial?.id ?? resultado.id}`);
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
              defaultValue={inicial?.empresa_compradora_id ?? empresas[0]?.id ?? ""}
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
            <Entrada
              id="razon_social"
              name="razon_social"
              required
              minLength={3}
              defaultValue={inicial?.razon_social ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Nombre comercial" htmlFor="nombre_comercial" requerido>
            <Entrada
              id="nombre_comercial"
              name="nombre_comercial"
              required
              defaultValue={inicial?.nombre_comercial ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="RUC" htmlFor="ruc" requerido>
            <Entrada
              id="ruc"
              name="ruc"
              required
              placeholder="80012345-6"
              className="tabular"
              defaultValue={inicial?.ruc ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Rubro" htmlFor="rubro" requerido>
            <Entrada
              id="rubro"
              name="rubro"
              required
              placeholder="Equipamiento outdoor"
              defaultValue={inicial?.rubro ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Correo" htmlFor="correo" requerido>
            <Entrada
              id="correo"
              name="correo"
              type="email"
              required
              defaultValue={inicial?.correo ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Contacto" htmlFor="contacto" requerido>
            <Entrada
              id="contacto"
              name="contacto"
              required
              defaultValue={inicial?.contacto ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Segundo contacto"
            htmlFor="contacto_secundario"
            ayuda="Opcional. Es el único campo que puede quedar vacío."
          >
            <Entrada
              id="contacto_secundario"
              name="contacto_secundario"
              defaultValue={inicial?.contacto_secundario ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Ciudad" htmlFor="ciudad" requerido>
            <Entrada
              id="ciudad"
              name="ciudad"
              required
              placeholder="Asunción"
              defaultValue={inicial?.ciudad ?? ""}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="País" htmlFor="pais" requerido>
            <Entrada
              id="pais"
              name="pais"
              required
              defaultValue={inicial?.pais ?? "Paraguay"}
            />
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
              defaultValue={inicial?.periodicidad_evaluacion_meses ?? 12}
              className="tabular"
            />
          </GrupoCampo>
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            {editando ? "Guardar cambios" : "Registrar Asociado de Negocio"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
