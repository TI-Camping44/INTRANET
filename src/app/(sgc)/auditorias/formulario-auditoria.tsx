"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { crearAuditoria } from "@/app/(sgc)/auditorias/acciones";
import {
  CORREO_TODOS,
  ETIQUETAS_TIPO_AUDITORIA,
  TIPOS_AUDITORIA_VIGENTES,
} from "@/lib/constantes";
import { hoyEnAsuncion, sumarDias } from "@/lib/formato";

interface Opcion {
  id: string;
  nombre?: string;
  codigo?: string;
  nombre_completo?: string;
}

export function FormularioAuditoria({
  documentos,
  usuarios,
  usuarioActual,
  programaId,
}: {
  /** La informacion documentada. Puede venir vacia: el modulo recien se carga. */
  documentos: { id: string; codigo: string | null; titulo: string }[];
  usuarios: Opcion[];
  usuarioActual: string;
  /**
   * El programa anual al que entra la auditoría, cuando el alta se abre
   * desde su ficha. Sin esto, la acción la liga al programa del año de
   * la fecha planificada, que es el caso normal.
   */
  programaId?: string | null;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [elegidosDocumentos, definirElegidosDocumentos] = React.useState<string[]>([]);

  const hoy = hoyEnAsuncion();
  const [planificada, definirPlanificada] = React.useState(sumarDias(hoy, 30));

  function alternarDocumento(id: string) {
    definirElegidosDocumentos((actuales) =>
      actuales.includes(id) ? actuales.filter((otro) => otro !== id) : [...actuales, id],
    );
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    // Las casillas no se pueden marcar `required` de a una: el navegador
    // exigiria todas. Con Informacion Documentada vacia no se exige
    // ninguna, porque si no el modulo quedaria sin forma de cargar una
    // auditoria hasta que Calidad cargue el primer documento.
    if (documentos.length > 0 && elegidosDocumentos.length === 0) {
      definirError("Elija al menos un documento auditado.");
      return;
    }

    definirEnviando(true);
    definirError(null);

    const resultado = await crearAuditoria(new FormData(evento.currentTarget));

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Auditoría planificada.");
      router.push(`/auditorias/${resultado.id}`);
      router.refresh();
    } else {
      definirError(resultado.error);
      toast.error(resultado.error);
      definirEnviando(false);
    }
  }

  return (
    <form onSubmit={enviar}>
      {programaId ? <input type="hidden" name="programa_id" value={programaId} /> : null}
      <Tarjeta className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <GrupoCampo etiqueta="Tipo" htmlFor="tipo" requerido className="sm:col-span-2">
            <Seleccion id="tipo" name="tipo" defaultValue="por_proceso">
              {TIPOS_AUDITORIA_VIGENTES.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS_TIPO_AUDITORIA[valor]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Objetivo"
            htmlFor="objetivo"
            requerido
            className="sm:col-span-2"
            ayuda="Qué se busca verificar con esta auditoría."
          >
            <AreaTexto
              id="objetivo"
              name="objetivo"
              rows={2}
              required
              minLength={10}
              placeholder="Verificar el control de existencias y la trazabilidad del material en depósito."
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Alcance"
            requerido
            htmlFor="alcance"
            className="sm:col-span-2"
            ayuda="Sedes, períodos y límites de la auditoría. Los procesos van en el campo de abajo."
          >
            <AreaTexto id="alcance" name="alcance" rows={2} required minLength={5} />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Criterios"
            requerido
            htmlFor="criterios"
            className="sm:col-span-2"
            ayuda="Norma y documentos internos contra los que se audita."
          >
            {/* Area de texto y no una linea: los criterios son varios
                —la norma, el procedimiento, la ley— y en un campo de una
                linea se escriben a ciegas, sin ver lo que uno puso. */}
            <AreaTexto
              id="criterios"
              name="criterios"
              rows={2}
              required
              minLength={5}
              placeholder="ISO 9001 y los procedimientos del proceso auditado."
            />
          </GrupoCampo>

          {/* Varios procesos y no uno. Una auditoría interna del SGC
              recorre cinco o seis; antes había que elegir uno y escribir
              los demás en el alcance, que es texto libre y no se puede
              contar ni filtrar.

              Casillas y no un `select multiple`: en el celular, que es
              desde donde se mira en depósito, un desplegable múltiple
              obliga a mantener apretada una tecla que no existe. */}
          {/* NO SOLO SE AUDITAN PROCESOS. Una auditoría también se hace
              contra la información documentada: un procedimiento, un
              instructivo, un registro. La lista sale de ese módulo, así
              que crece sola a medida que se cargan documentos.

              No reemplaza al cuadro de procesos: lo suma. Una auditoría
              puede abarcar procesos, documentos o los dos. */}
          <GrupoCampo
            etiqueta="Documentos auditados"
            requerido={documentos.length > 0}
            className="sm:col-span-2"
            ayuda={
              documentos.length === 0
                ? "Todavía no hay documentos cargados en Información Documentada."
                : elegidosDocumentos.length === 0
                  ? "Elija al menos uno. Puede elegir varios."
                  : `${elegidosDocumentos.length} ${
                      elegidosDocumentos.length === 1
                        ? "documento elegido"
                        : "documentos elegidos"
                    }.`
            }
          >
            {documentos.length === 0 ? (
              <p
                className="rounded-md border border-dashed border-borde p-3 text-[11px]
                           leading-relaxed text-atenuado-contraste"
              >
                Información Documentada está vacío. Cuando se carguen documentos van a
                aparecer acá para elegirlos.
              </p>
            ) : (
              <div
                className="max-h-56 overflow-y-auto rounded-md border border-borde
                           bg-fondo p-2"
              >
                <ul className="grid gap-0.5 sm:grid-cols-2">
                  {documentos.map((documento) => (
                    <li key={documento.id}>
                      <label
                        className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1
                                   text-xs transition-colors hover:bg-acento/60"
                      >
                        <input
                          type="checkbox"
                          name="documentos"
                          value={documento.id}
                          checked={elegidosDocumentos.includes(documento.id)}
                          onChange={() => alternarDocumento(documento.id)}
                          className="size-3.5 shrink-0 accent-primario"
                        />
                        {documento.codigo ? (
                          <span className="tabular text-atenuado-contraste">
                            {documento.codigo}
                          </span>
                        ) : null}
                        <span className="min-w-0 truncate">{documento.titulo}</span>
                      </label>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </GrupoCampo>


          <GrupoCampo
            etiqueta="Auditor"
            htmlFor="auditor_lider_id"
            requerido
            ayuda="Recibe la notificación y queda a cargo del informe."
          >
            <Seleccion id="auditor_lider_id" name="auditor_lider_id" defaultValue={usuarioActual}>
              {usuarios.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Fecha planificada" htmlFor="fecha_planificada" requerido>
            <Entrada
              id="fecha_planificada"
              name="fecha_planificada"
              type="date"
              value={planificada}
              min={hoy}
              required
              onChange={(evento) => definirPlanificada(evento.target.value || hoy)}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Avisar a toda la empresa el"
            requerido
            htmlFor="fecha_aviso"
            ayuda={`Ese día sale un correo a ${CORREO_TODOS} anunciando la auditoría.`}
          >
            <Entrada
              id="fecha_aviso"
              name="fecha_aviso"
              type="date"
              required
              defaultValue={sumarDias(planificada, -7)}
              min={hoy}
              max={planificada}
            />
          </GrupoCampo>
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            Planificar auditoría
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
