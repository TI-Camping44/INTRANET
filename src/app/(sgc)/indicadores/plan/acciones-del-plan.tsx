"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import {
  Dialogo,
  DialogoCabecera,
  DialogoCierre,
  DialogoContenido,
  DialogoPie,
  DialogoTitulo,
} from "@/components/ui/dialogo";
import {
  actualizarPlanDeObjetivo,
  crearPlanDeObjetivo,
  eliminarPlanDeObjetivo,
} from "@/app/(sgc)/indicadores/plan/acciones";
import type { FilaPlan } from "@/app/(sgc)/indicadores/plan/page";

/**
 * Alta, edición y baja de una acción del plan de objetivos.
 *
 * Un solo componente para los tres, y en los tres lugares donde hacen
 * falta: el botón del encabezado, el del estado vacío y el de cada fila.
 * Sin `plan` da de alta; con `plan` edita y ofrece eliminar.
 *
 * LOS CINCO INCISOS LLEVAN SU LETRA en la etiqueta —a) qué se va a
 * hacer, b) qué recursos…— porque es como los rotula la hoja de Calidad
 * y como los busca un auditor. No es decoración: es el vocabulario del
 * formulario que esta pantalla reemplaza.
 *
 * TODO OBLIGATORIO MENOS EL PUESTO DEL RESPONSABLE. Lo pidió Dirección
 * el 8 de octubre: una acción a medio llenar no se puede seguir ni
 * auditar. El puesto queda suelto porque es el nombre que le da la
 * planilla y no siempre coincide con un cargo del organigrama.
 *
 * EL SEGUIMIENTO NO ESTÁ ACÁ. La fecha real de finalización, el
 * resultado de la evaluación, el porcentaje de avance, el estado y las
 * observaciones salieron del formulario: el resultado se registra mes a
 * mes en el calendario de la pantalla principal, que es donde Dirección
 * lo mira. Las columnas siguen en la base y conservan lo ya cargado.
 */
export function AccionesDelPlan({
  objetivos,
  personas,
  plan,
  soloAlta = false,
}: {
  objetivos: { id: string; codigo: string; nombre: string }[];
  personas: { id: string; nombre_completo: string }[];
  plan?: FilaPlan;
  /** Para el estado vacío: solo el botón de alta, sin el de editar. */
  soloAlta?: boolean;
}) {
  const router = useRouter();
  const [abierto, definirAbierto] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);

  const editando = Boolean(plan) && !soloAlta;

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const datos = new FormData(evento.currentTarget);
    definirProcesando(true);
    const resultado = editando
      ? await actualizarPlanDeObjetivo(plan!.id, datos)
      : await crearPlanDeObjetivo(datos);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Guardado.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function borrar() {
    if (!plan) return;
    if (!confirm("¿Eliminar esta acción del plan? No se puede deshacer.")) return;

    definirProcesando(true);
    const resultado = await eliminarPlanDeObjetivo(plan.id);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Eliminada.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <>
      {editando ? (
        <button
          type="button"
          onClick={() => definirAbierto(true)}
          className="text-atenuado-contraste transition-colors hover:text-primario"
          aria-label="Editar la acción del plan"
        >
          <Pencil className="size-3.5" />
        </button>
      ) : (
        <Boton tamano="pequeno" onClick={() => definirAbierto(true)}>
          <Plus /> Nueva acción
        </Boton>
      )}

      <Dialogo open={abierto} onOpenChange={definirAbierto}>
        <DialogoContenido className="max-w-2xl">
          <form onSubmit={guardar}>
            <DialogoCabecera>
              <DialogoTitulo>
                {editando ? "Editar la acción del plan" : "Nueva acción del plan"}
              </DialogoTitulo>
            </DialogoCabecera>

            <div className="mt-4 max-h-[65vh] space-y-3 overflow-y-auto pr-1">
              {/* «Todos» es una fila real de la planilla: aplica a los
                  ocho objetivos a la vez, y eso una clave ajena no lo
                  puede decir. Por eso el desplegable tiene esa opción y
                  al lado queda el texto. */}
              <GrupoCampo
                etiqueta="Objetivo relacionado"
                htmlFor="objetivo_id"
                requerido
                ayuda="A qué objetivo responde la acción."
              >
                <Seleccion
                  id="objetivo_id"
                  name="objetivo_id"
                  required
                  defaultValue={plan?.objetivo_id ?? objetivos[0]?.id ?? ""}
                  key={plan?.id ?? "nueva"}
                >
                  <option value="" disabled>
                    Elija el objetivo…
                  </option>
                  {objetivos.map((objetivo) => (
                    <option key={objetivo.id} value={objetivo.id}>
                      {objetivo.codigo} · {objetivo.nombre}
                    </option>
                  ))}
                </Seleccion>
              </GrupoCampo>

              <input
                type="hidden"
                name="objetivo_declarado"
                value={plan?.objetivo_declarado ?? ""}
              />

              <GrupoCampo etiqueta="a) Qué se va a hacer" htmlFor="que_se_va_a_hacer" requerido>
                <AreaTexto
                  id="que_se_va_a_hacer"
                  name="que_se_va_a_hacer"
                  rows={3}
                  required
                  minLength={10}
                  defaultValue={plan?.que_se_va_a_hacer ?? ""}
                />
              </GrupoCampo>

              <GrupoCampo
                etiqueta="b) Qué recursos se requerirán"
                htmlFor="recursos_necesarios"
                requerido
              >
                <AreaTexto
                  id="recursos_necesarios"
                  name="recursos_necesarios"
                  rows={2}
                  required
                  defaultValue={plan?.recursos_necesarios ?? ""}
                />
              </GrupoCampo>

              <div className="grid gap-3 sm:grid-cols-2">
                <GrupoCampo
                  etiqueta="c) Quién será responsable"
                  htmlFor="responsable_id"
                  requerido
                  ayuda="De la lista de personas que ya ingresaron al sistema."
                >
                  <Seleccion
                    id="responsable_id"
                    name="responsable_id"
                    required
                    defaultValue={plan?.responsable_id ?? ""}
                    key={plan?.id ?? "nueva"}
                  >
                    <option value="" disabled>
                      Elija a la persona…
                    </option>
                    {personas.map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.nombre_completo}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>

                {/* El único campo que puede quedar vacío. */}
                <GrupoCampo
                  etiqueta="Puesto del responsable"
                  htmlFor="responsable_declarado"
                  ayuda="Opcional. Por ejemplo: Jefe de Capital Humano."
                >
                  <Entrada
                    id="responsable_declarado"
                    name="responsable_declarado"
                    defaultValue={plan?.responsable_declarado ?? ""}
                  />
                </GrupoCampo>
              </div>

              <GrupoCampo
                etiqueta="d) Cuándo se finalizará"
                htmlFor="fecha_finalizacion"
                requerido
              >
                <Entrada
                  id="fecha_finalizacion"
                  name="fecha_finalizacion"
                  type="date"
                  required
                  defaultValue={plan?.fecha_finalizacion ?? ""}
                />
              </GrupoCampo>

              <GrupoCampo
                etiqueta="e) Cómo se evaluarán los resultados"
                htmlFor="como_se_evaluan_resultados"
                requerido
              >
                <AreaTexto
                  id="como_se_evaluan_resultados"
                  name="como_se_evaluan_resultados"
                  rows={2}
                  required
                  defaultValue={plan?.como_se_evaluan_resultados ?? ""}
                />
              </GrupoCampo>

              <p className="text-[11px] leading-relaxed text-atenuado-contraste">
                El resultado se registra mes a mes en el calendario de Objetivos e Indicadores,
                no acá.
              </p>
            </div>

            <DialogoPie className="mt-5 sm:justify-between">
              {editando ? (
                <Boton
                  type="button"
                  variante="contorno"
                  onClick={borrar}
                  cargando={procesando}
                  className="text-semaforo-critico hover:text-semaforo-critico"
                >
                  <Trash2 /> Eliminar
                </Boton>
              ) : (
                <span />
              )}

              <span className="flex gap-2">
                <DialogoCierre asChild>
                  <Boton type="button" variante="contorno">
                    Cancelar
                  </Boton>
                </DialogoCierre>
                <Boton type="submit" cargando={procesando}>
                  {editando ? "Guardar cambios" : "Cargar acción"}
                </Boton>
              </span>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </>
  );
}
