"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";
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
import {
  actualizarAuditoria,
  eliminarAuditoria,
} from "@/app/(sgc)/auditorias/acciones";
import { SEGUN_EL_PLAN } from "@/lib/constantes";

export interface AuditoriaDelPlan {
  id: string;
  codigo: string;
  objetivo: string | null;
  alcance: string | null;
  criterios: string | null;
  proceso_id: string | null;
  procesos_segun_plan: boolean;
  empresa_auditada_id: string | null;
  auditor_lider_id: string | null;
  fecha_planificada: string | null;
  fecha_aviso: string | null;
}

/**
 * El plan de auditoría: qué se audita, con qué alcance, contra qué
 * criterios, quién la conduce y cuándo.
 *
 * HASTA AHORA ESTO SOLO SE PODÍA ESCRIBIR UNA VEZ, en el alta. La ficha
 * mostraba el plan pero no lo dejaba tocar, y `actualizarAuditoria`
 * existía sin que ninguna pantalla la llamara: un objetivo mal redactado
 * o una fecha que se corrió obligaban a borrar y volver a cargar, con
 * código nuevo.
 *
 * La fecha planificada decide a qué programa anual pertenece la
 * auditoría. Por eso se avisa: moverla a otro año la saca del programa
 * en curso, y eso cambia el avance de los dos ejercicios.
 */
export function PanelPlan({
  auditoria,
  procesos,
  personas,
  empresas,
  puedeEditar,
}: {
  auditoria: AuditoriaDelPlan;
  procesos: { id: string; nombre: string }[];
  personas: { id: string; nombre_completo: string }[];
  /** Las dos empresas del grupo, como las devuelve `empresas_del_grupo()`. */
  empresas: { id: string; nombre: string }[];
  puedeEditar: boolean;
}) {
  const router = useRouter();
  const [abierto, definirAbierto] = React.useState(false);
  const [procesando, definirProcesando] = React.useState(false);

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirProcesando(true);
    const resultado = await actualizarAuditoria(
      auditoria.id,
      new FormData(evento.currentTarget),
    );
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Plan guardado.");
      definirAbierto(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function borrar() {
    if (
      !confirm(
        `¿Eliminar la auditoría ${auditoria.codigo} y sus hallazgos? No se puede deshacer.`,
      )
    ) {
      return;
    }

    definirProcesando(true);
    const resultado = await eliminarAuditoria(auditoria.id);
    definirProcesando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Auditoría eliminada.");
      definirAbierto(false);
      router.push("/auditorias");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  if (!puedeEditar) return null;

  return (
    <>
      {/* EDITAR Y ELIMINAR, LOS DOS A LA VISTA. «Eliminar» estaba
          adentro del diálogo de edición y no se encontraba: para borrar
          una auditoría había que entrar a editarla primero. */}
      <span className="flex flex-wrap gap-2">
        <Boton variante="contorno" tamano="pequeno" onClick={() => definirAbierto(true)}>
          <Pencil /> Editar el plan
        </Boton>
        <Boton
          variante="contorno"
          tamano="pequeno"
          onClick={borrar}
          cargando={procesando}
          className="text-semaforo-critico hover:text-semaforo-critico"
        >
          <Trash2 /> Eliminar
        </Boton>
      </span>

      <Dialogo open={abierto} onOpenChange={definirAbierto}>
        <DialogoContenido className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <form onSubmit={guardar}>
            <DialogoCabecera>
              <DialogoTitulo>Plan de la auditoría {auditoria.codigo}</DialogoTitulo>
              <DialogoDescripcion>
                El equipo auditor y los hallazgos se cargan aparte, en la misma ficha.
              </DialogoDescripcion>
            </DialogoCabecera>

            <div className="mt-4 space-y-3">
              <GrupoCampo
                etiqueta="Objetivo"
                htmlFor="objetivo"
                requerido
                ayuda="Qué se busca verificar. Es el encabezado del informe."
              >
                <AreaTexto
                  id="objetivo"
                  name="objetivo"
                  rows={3}
                  required
                  minLength={10}
                  defaultValue={auditoria.objetivo ?? ""}
                />
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Alcance"
                htmlFor="alcance"
                ayuda="Qué procesos, sedes y períodos abarca."
              >
                <AreaTexto
                  id="alcance"
                  name="alcance"
                  rows={2}
                  defaultValue={auditoria.alcance ?? ""}
                />
              </GrupoCampo>

              <GrupoCampo
                etiqueta="Criterios"
                htmlFor="criterios"
                ayuda="Contra qué se audita: la norma, los procedimientos, la legislación."
              >
                <AreaTexto
                  id="criterios"
                  name="criterios"
                  rows={2}
                  defaultValue={auditoria.criterios ?? ""}
                />
              </GrupoCampo>

              <div className="grid gap-3 sm:grid-cols-2">
                {/* LA EMPRESA AUDITADA TIENE QUE ESTAR ACÁ. No es un
                    adorno: `actualizarAuditoria` la escribe, y un
                    formulario que no la mandara la dejaría en null al
                    guardar el plan. */}
                <GrupoCampo
                  etiqueta="Empresa"
                  htmlFor="empresa_auditada_id"
                  requerido
                  className="sm:col-span-2"
                  ayuda="Cuál de las dos empresas del grupo se audita."
                >
                  <Seleccion
                    id="empresa_auditada_id"
                    name="empresa_auditada_id"
                    required
                    defaultValue={auditoria.empresa_auditada_id ?? empresas[0]?.id ?? ""}
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

                {/* «Procesos declarados en el Plan» es lo que pasa en
                    la práctica casi siempre: el alcance son los procesos
                    que el propio Plan enumera más arriba, no uno suelto.
                    «Sin proceso definido» se leía como un dato que falta,
                    y no falta nada. */}
                <GrupoCampo etiqueta="Proceso auditado" htmlFor="proceso_id">
                  <Seleccion
                    id="proceso_id"
                    name="proceso_id"
                    defaultValue={
                      auditoria.procesos_segun_plan
                        ? SEGUN_EL_PLAN
                        : (auditoria.proceso_id ?? "")
                    }
                  >
                    <option value={SEGUN_EL_PLAN}>Procesos declarados en el Plan</option>
                    <option value="">Sin proceso definido</option>
                    {procesos.map((proceso) => (
                      <option key={proceso.id} value={proceso.id}>
                        {proceso.nombre}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>

                <GrupoCampo etiqueta="Auditor líder" htmlFor="auditor_lider_id">
                  <Seleccion
                    id="auditor_lider_id"
                    name="auditor_lider_id"
                    defaultValue={auditoria.auditor_lider_id ?? ""}
                  >
                    <option value="">Sin asignar</option>
                    {personas.map((persona) => (
                      <option key={persona.id} value={persona.id}>
                        {persona.nombre_completo}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>

                <GrupoCampo
                  etiqueta="Fecha planificada"
                  htmlFor="fecha_planificada"
                  requerido
                  ayuda="Define a qué programa anual pertenece."
                >
                  <Entrada
                    id="fecha_planificada"
                    name="fecha_planificada"
                    type="date"
                    required
                    defaultValue={auditoria.fecha_planificada ?? ""}
                  />
                </GrupoCampo>

                <GrupoCampo
                  etiqueta="Aviso a la empresa"
                  htmlFor="fecha_aviso"
                  ayuda="Opcional. Ese día se avisa que la auditoría se aproxima."
                >
                  <Entrada
                    id="fecha_aviso"
                    name="fecha_aviso"
                    type="date"
                    defaultValue={auditoria.fecha_aviso ?? ""}
                  />
                </GrupoCampo>
              </div>
            </div>

            <DialogoPie className="mt-5">
              <DialogoCierre asChild>
                <Boton type="button" variante="contorno">
                  Cancelar
                </Boton>
              </DialogoCierre>
              <Boton type="submit" cargando={procesando}>
                Guardar el plan
              </Boton>
            </DialogoPie>
          </form>
        </DialogoContenido>
      </Dialogo>
    </>
  );
}
