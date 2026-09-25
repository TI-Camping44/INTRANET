"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { CampoPropuestas } from "@/app/(sgc)/no-conformidades/campo-propuestas";
import {
  actualizarNoConformidad,
  crearNoConformidad,
} from "@/app/(sgc)/no-conformidades/acciones";
import {
  DEPARTAMENTOS,
  DEPARTAMENTOS_VIGENTES,
  DIAS_LIMITE_CIERRE_NC,
  ETIQUETAS_ORIGEN_NC,
  ETIQUETAS_SEVERIDAD_NC,
  ORIGENES_NC_VIGENTES,
} from "@/lib/constantes";
import { formatearFecha, hoyEnAsuncion, sumarDias } from "@/lib/formato";

interface Opcion {
  id: string;
  nombre?: string;
  codigo?: string;
  nombre_completo?: string;
  razon_social?: string;
}

/**
 * Alta de una desviacion.
 *
 * El formulario quedo con los campos que Calidad efectivamente completa.
 * Los que se sacaron —requisito incumplido, norma de referencia, cliente
 * afectado y sede— se sacaron por la misma razon: nadie los iba a llenar
 * bien, y un campo que se completa mal es peor que uno que no esta.
 *
 * Es el mismo formulario para dar de alta y para editar. Se pasa
 * `inicial` y cambia lo que tiene que cambiar: los valores, el boton y a
 * donde vuelve al guardar. Tener dos formularios distintos para los
 * mismos campos es tener dos lugares donde agregar el campo siguiente, y
 * uno de los dos se olvida.
 */
export interface NoConformidadInicial {
  id: string;
  titulo: string;
  descripcion: string;
  consecuencias: string | null;
  origen: string;
  severidad: string;
  area: string | null;
  empresa_afectada_id: string | null;
  proceso_id: string | null;
  responsable_id: string | null;
  correccion_inmediata: string | null;
  propuestas_mejora: string[] | null;
  fecha_deteccion: string;
}

export function FormularioNoConformidad({
  procesos,
  empresas,
  usuarios,
  inicial,
}: {
  procesos: Opcion[];
  empresas: Opcion[];
  usuarios: Opcion[];
  /** Cuando viene, el formulario edita esa desviación en vez de crear una. */
  inicial?: NoConformidadInicial;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);

  const hoy = hoyEnAsuncion();

  // El plazo de cierre no se elige: son diez dias corridos desde la
  // deteccion. Se muestra para que quien registra sepa a que se
  // compromete, pero lo fija la base de datos.
  const [deteccion, definirDeteccion] = React.useState(inicial?.fecha_deteccion ?? hoy);
  const limite = sumarDias(deteccion, DIAS_LIMITE_CIERRE_NC);

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const datos = new FormData(evento.currentTarget);
    const resultado = inicial
      ? await actualizarNoConformidad(inicial.id, datos)
      : await crearNoConformidad(datos);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "No conformidad registrada.");
      router.push(`/no-conformidades/${inicial?.id ?? resultado.id}`);
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
              defaultValue={inicial?.titulo}
              placeholder="Faltante de stock en el conteo cíclico de depósito"
              required
              minLength={5}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Descripción de la No Conformidad"
            htmlFor="descripcion"
            requerido
            className="sm:col-span-2"
            ayuda="Qué ocurrió, dónde y cuándo. Es la evidencia objetiva del hallazgo."
          >
            <AreaTexto
              id="descripcion"
              name="descripcion"
              defaultValue={inicial?.descripcion}
              rows={4}
              required
              minLength={15}
            />
          </GrupoCampo>

          {/* La descripcion dice QUE paso; esto dice QUE PROVOCA. Hasta
              ahora iban en el mismo parrafo y no son lo mismo: el impacto
              es lo que decide la severidad y la urgencia. */}
          <GrupoCampo
            etiqueta="Consecuencias/Impacto de los eventos que ocasiona la No Conformidad"
            htmlFor="consecuencias"
            requerido
            className="sm:col-span-2"
            ayuda="Qué provocó o puede provocar: a qué cliente, proceso o departamento afectó, y con qué alcance."
          >
            <AreaTexto
              id="consecuencias"
              name="consecuencias"
              defaultValue={inicial?.consecuencias ?? ""}
              rows={3}
              required
              minLength={15}
            />
          </GrupoCampo>

          <GrupoCampo etiqueta="Origen" htmlFor="origen" requerido>
            <Seleccion id="origen" name="origen" defaultValue={inicial?.origen ?? "proceso_interno"}>
              {ORIGENES_NC_VIGENTES.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS_ORIGEN_NC[valor]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Severidad" htmlFor="severidad" requerido>
            <Seleccion id="severidad" name="severidad" defaultValue={inicial?.severidad ?? "menor"}>
              {Object.entries(ETIQUETAS_SEVERIDAD_NC).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Departamento"
            htmlFor="area"
            requerido
            ayuda="Departamento que debe gestionar la No Conformidad y su posterior Acción Correctiva."
          >
            <Seleccion id="area" name="area" defaultValue={inicial?.area ?? ""} required>
              <option value="" disabled>
                Elija el departamento
              </option>
              {DEPARTAMENTOS_VIGENTES.map((valor) => (
                <option key={valor} value={valor}>
                  {DEPARTAMENTOS[valor]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Empresa" htmlFor="empresa_afectada_id" requerido>
            <Seleccion
              id="empresa_afectada_id"
              name="empresa_afectada_id"
              defaultValue={inicial?.empresa_afectada_id ?? empresas[0]?.id ?? ""}
              required
            >
              {empresas.map((empresa) => (
                <option key={empresa.id} value={empresa.id}>
                  {empresa.razon_social ?? empresa.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Proceso afectado" htmlFor="proceso_id">
            <Seleccion id="proceso_id" name="proceso_id" defaultValue={inicial?.proceso_id ?? ""}>
              <option value="">Sin proceso asociado</option>
              {procesos.map((proceso) => (
                <option key={proceso.id} value={proceso.id}>
                  {proceso.codigo} · {proceso.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Responsable de la acción correctiva"
            htmlFor="responsable_id"
            requerido
            ayuda="Recibe la notificación y es quien analiza la causa y propone la acción. Sin responsable, la no conformidad no le llega a nadie."
          >
            <Seleccion
              id="responsable_id"
              name="responsable_id"
              required
              defaultValue={inicial?.responsable_id ?? ""}
            >
              <option value="" disabled>
                Elija a la persona
              </option>
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
            requerido
            className="sm:col-span-2"
            ayuda="Qué se hizo en el momento para contener el problema."
          >
            <AreaTexto
              id="correccion_inmediata"
              name="correccion_inmediata"
              defaultValue={inicial?.correccion_inmediata ?? ""}
              rows={2}
              required
              minLength={5}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Propuestas de mejora"
            requerido
            className="sm:col-span-2"
            ayuda="Ideas para que no vuelva a pasar. Puede cargar más de una."
          >
            <CampoPropuestas iniciales={inicial?.propuestas_mejora ?? []} requerido />
          </GrupoCampo>

          <GrupoCampo etiqueta="Fecha de detección" htmlFor="fecha_deteccion" requerido>
            <Entrada
              id="fecha_deteccion"
              name="fecha_deteccion"
              type="date"
              value={deteccion}
              max={hoy}
              required
              onChange={(evento) => definirDeteccion(evento.target.value || hoy)}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Fecha límite de cierre"
            ayuda={`Son ${DIAS_LIMITE_CIERRE_NC} días corridos desde la detección y los calcula el sistema.`}
          >
            <p
              className="flex h-9 items-center rounded-md border border-borde bg-acento/40 px-3
                         text-xs font-medium tabular text-atenuado-contraste"
            >
              {formatearFecha(limite)}
            </p>
          </GrupoCampo>
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            {inicial ? "Guardar cambios" : "Registrar no conformidad"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
