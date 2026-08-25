"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { crearAuditoria } from "@/app/(sgc)/auditorias/acciones";
import { hoyEnAsuncion, sumarDias } from "@/lib/formato";

interface Opcion {
  id: string;
  nombre?: string;
  codigo?: string;
  nombre_completo?: string;
  anio?: number;
}

const TIPOS_AUDITORIA = {
  interna: "Interna",
  externa: "Externa",
  proveedor: "A proveedor",
  seguimiento: "De seguimiento",
};

export function FormularioAuditoria({
  programas,
  procesos,
  normas,
  sedes,
  usuarios,
  usuarioActual,
}: {
  programas: Opcion[];
  procesos: Opcion[];
  normas: Opcion[];
  sedes: Opcion[];
  usuarios: Opcion[];
  usuarioActual: string;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
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
      <Tarjeta className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <GrupoCampo
            etiqueta="Programa anual"
            htmlFor="programa_id"
            ayuda="Agrupa la auditoría dentro del plan del ejercicio."
          >
            <Seleccion id="programa_id" name="programa_id" defaultValue={programas[0]?.id ?? ""}>
              <option value="">Fuera de programa</option>
              {programas.map((programa) => (
                <option key={programa.id} value={programa.id}>
                  {programa.nombre} ({programa.anio})
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Tipo" htmlFor="tipo" requerido>
            <Seleccion id="tipo" name="tipo" defaultValue="interna">
              {Object.entries(TIPOS_AUDITORIA).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
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
            htmlFor="alcance"
            className="sm:col-span-2"
            ayuda="Qué procesos, sedes y períodos quedan comprendidos."
          >
            <AreaTexto id="alcance" name="alcance" rows={2} />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Criterios"
            htmlFor="criterios"
            className="sm:col-span-2"
            ayuda="Norma y documentos internos contra los que se audita."
          >
            <Entrada
              id="criterios"
              name="criterios"
              placeholder="ISO 9001:2015 y MP-SOP-04."
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Proceso auditado" htmlFor="proceso_id">
            <Seleccion id="proceso_id" name="proceso_id">
              <option value="">Sin proceso específico</option>
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

          <GrupoCampo
            etiqueta="Auditor líder"
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
              defaultValue={sumarDias(hoyEnAsuncion(), 30)}
              required
            />
          </GrupoCampo>
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" disabled={enviando}>
            {enviando ? "Planificando…" : "Planificar auditoría"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
