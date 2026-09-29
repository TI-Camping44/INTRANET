"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { actualizarReclamo, crearReclamo } from "@/app/(sgc)/reclamos/acciones";
import {
  EJEMPLOS_GRAVEDAD_RECLAMO,
  ETIQUETAS_GRAVEDAD_RECLAMO,
  ETIQUETAS_ORIGEN_RECLAMO,
  ETIQUETAS_PLAN_RECLAMO,
  ETIQUETAS_TIPO_FALLA,
  GRAVEDADES_RECLAMO,
  ORIGENES_RECLAMO,
  planDelCaso,
  RESPONSABLE_POR_TIPO_FALLA,
  TIPOS_FALLA_RECLAMO,
  type GravedadReclamo,
  type TipoFallaReclamo,
} from "@/lib/reclamos";
import { DEPARTAMENTOS, DEPARTAMENTOS_VIGENTES } from "@/lib/constantes";

interface Persona {
  id: string;
  nombre_completo: string;
}

interface Cliente {
  id: string;
  razon_social: string;
}

export interface ReclamoInicial {
  id: string;
  titulo: string;
  descripcion: string;
  cliente_id: string | null;
  cliente_nombre: string;
  origen: string;
  tipo_falla: string;
  gravedad: GravedadReclamo;
  gestor_id: string | null;
  responsable_area_id: string | null;
  material_controlado: boolean;
  departamentos_intervinientes: string[];
}

/**
 * Alta y edición de un reclamo.
 *
 * EL ORDEN ES EL DEL PROCEDIMIENTO: qué pasó, a quién, cómo nos
 * enteramos, qué gravedad tiene, dónde se originó y quién lo gestiona.
 *
 * LA GRAVEDAD MUESTRA EL PLAN QUE VA A TOCAR mientras se elige, con sus
 * plazos. No es decoración: quien clasifica tiene que ver la consecuencia
 * de clasificar, porque de ahí salen 3, 7 o 15 días hábiles de plazo.
 *
 * El plan definitivo lo calcula el servidor, porque puede subir un nivel
 * por reincidencia y eso depende de lo que ya está guardado.
 */
export function FormularioReclamo({
  personas,
  clientes,
  inicial,
}: {
  personas: Persona[];
  clientes: Cliente[];
  inicial?: ReclamoInicial;
}) {
  const router = useRouter();
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [gravedad, definirGravedad] = React.useState<GravedadReclamo>(
    inicial?.gravedad ?? "leve",
  );
  const [tipoFalla, definirTipoFalla] = React.useState<TipoFallaReclamo>(
    (inicial?.tipo_falla as TipoFallaReclamo) ?? "otro",
  );

  const planPrevisto = planDelCaso(gravedad, false);

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirEnviando(true);
    definirError(null);

    const datos = new FormData(evento.currentTarget);
    const resultado = inicial
      ? await actualizarReclamo(inicial.id, datos)
      : await crearReclamo(datos);

    definirEnviando(false);

    if (!resultado.exito) {
      definirError(resultado.error);
      return;
    }

    toast.success(resultado.mensaje ?? "Guardado.");
    router.push(inicial ? `/reclamos/${inicial.id}` : `/reclamos/${resultado.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={guardar}>
      <Tarjeta className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <GrupoCampo etiqueta="Título del caso" htmlFor="titulo" requerido className="sm:col-span-2">
            <Entrada
              id="titulo"
              name="titulo"
              defaultValue={inicial?.titulo}
              placeholder="Entrega con artículo que el cliente no pidió"
              required
              minLength={5}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Qué ocurrió"
            htmlFor="descripcion"
            requerido
            className="sm:col-span-2"
            ayuda="El hecho, con fecha y detalle. Es la base del caso y de lo que se le va a decir al cliente."
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

          <GrupoCampo
            etiqueta="Cliente"
            htmlFor="cliente_id"
            ayuda="Si el cliente no está en la lista, igual cargue el nombre abajo. Sin cliente identificado no se puede detectar la reincidencia."
          >
            <Seleccion id="cliente_id" name="cliente_id" defaultValue={inicial?.cliente_id ?? ""}>
              <option value="">Sin cliente de la lista</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.razon_social}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo etiqueta="Nombre del cliente" htmlFor="cliente_nombre" requerido>
            <Entrada
              id="cliente_nombre"
              name="cliente_nombre"
              defaultValue={inicial?.cliente_nombre}
              placeholder="Como figura en la factura"
              required
              minLength={3}
            />
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Cómo nos enteramos"
            htmlFor="origen"
            requerido
            ayuda="No todo reclamo llega como reclamo."
          >
            <Seleccion id="origen" name="origen" defaultValue={inicial?.origen ?? "reclamo_directo"}>
              {ORIGENES_RECLAMO.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS_ORIGEN_RECLAMO[valor]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Gravedad del hecho"
            htmlFor="gravedad"
            requerido
            ayuda="La gravedad del hecho, no la intensidad del reclamo."
          >
            <Seleccion
              id="gravedad"
              name="gravedad"
              value={gravedad}
              onChange={(evento) => definirGravedad(evento.target.value as GravedadReclamo)}
            >
              {GRAVEDADES_RECLAMO.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS_GRAVEDAD_RECLAMO[valor]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          {/* Quien clasifica tiene que ver la consecuencia de clasificar. */}
          <div className="rounded-md border border-borde bg-acento/40 p-3 text-[11px] leading-relaxed sm:col-span-2">
            <p className="text-atenuado-contraste">
              <span className="font-medium text-texto">
                {ETIQUETAS_GRAVEDAD_RECLAMO[gravedad]}:
              </span>{" "}
              {EJEMPLOS_GRAVEDAD_RECLAMO[gravedad]}
            </p>
            <p className="mt-1 font-medium">
              Le corresponde {ETIQUETAS_PLAN_RECLAMO[planPrevisto]}
              {planPrevisto === "a" ? ": contacto en 24 h hábiles, resolución en 3 días hábiles." : null}
              {planPrevisto === "b" ? ": contacto en 24 h hábiles, resolución en 7 días hábiles, y 5 porqués a cargo del área." : null}
              {planPrevisto === "c" ? ": contacto en 12 h hábiles, resolución en 15 días hábiles, y abre una no conformidad." : null}
            </p>
            <p className="mt-1 text-atenuado-contraste">
              Si es la segunda falla al mismo cliente en seis meses, el plan sube un nivel solo.
            </p>
          </div>

          <GrupoCampo
            etiqueta="Dónde se originó la falla"
            htmlFor="tipo_falla"
            requerido
            ayuda={`Responsable de referencia: ${RESPONSABLE_POR_TIPO_FALLA[tipoFalla]}`}
          >
            <Seleccion
              id="tipo_falla"
              name="tipo_falla"
              value={tipoFalla}
              onChange={(evento) => definirTipoFalla(evento.target.value as TipoFallaReclamo)}
            >
              {TIPOS_FALLA_RECLAMO.map((valor) => (
                <option key={valor} value={valor}>
                  {ETIQUETAS_TIPO_FALLA[valor]}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Responsable del área de origen"
            htmlFor="responsable_area_id"
            ayuda="Define y ejecuta la solución junto con el gestor."
          >
            <Seleccion
              id="responsable_area_id"
              name="responsable_area_id"
              defaultValue={inicial?.responsable_area_id ?? ""}
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
            etiqueta="Gestor del caso"
            htmlFor="gestor_id"
            className="sm:col-span-2"
            ayuda="Única voz frente al cliente: contacta, propone, confirma y cierra. No puede ser quien originó la falla."
          >
            <Seleccion id="gestor_id" name="gestor_id" defaultValue={inicial?.gestor_id ?? ""}>
              <option value="">Sin asignar</option>
              {personas.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>
        </div>

        {/* Material controlado: lo unico de este formulario que puede
            terminar en una inspeccion de la DIGEMABEL. */}
        <div className="mt-5 border-t border-borde pt-4">
          <label className="flex items-start gap-2 text-xs font-medium">
            <input
              type="checkbox"
              name="material_controlado"
              defaultChecked={inicial?.material_controlado}
              className="mt-0.5 size-3.5 accent-[#E01E37]"
            />
            <span>
              Involucra material controlado
              <span className="mt-0.5 block text-[11px] font-normal leading-relaxed text-atenuado-contraste">
                Un arma o accesorio con carnet a nombre del cliente no se cambia en el acto: el
                reingreso se tramita y el plazo del plan se suspende mientras dure el trámite ante
                la DIGEMABEL. El Asistente de Gestión Regulatoria participa siempre.
              </span>
            </span>
          </label>
        </div>

        {/* Cuando la falla toca a mas de un departamento. */}
        <div className="mt-5 border-t border-borde pt-4">
          <p className="text-xs font-medium">Otros departamentos intervinientes</p>
          <p className="mb-2 mt-0.5 text-[11px] text-atenuado-contraste">
            Solo si la falla involucra a más de uno. El principal ya queda arriba.
          </p>
          <div className="grid gap-1 sm:grid-cols-3">
            {DEPARTAMENTOS_VIGENTES.map((valor) => (
              <label key={valor} className="flex items-center gap-1.5 text-[11px]">
                <input
                  type="checkbox"
                  name="departamentos_intervinientes"
                  value={valor}
                  defaultChecked={inicial?.departamentos_intervinientes.includes(valor)}
                  className="size-3.5 accent-[#E01E37]"
                />
                {DEPARTAMENTOS[valor]}
              </label>
            ))}
          </div>
        </div>

        {error ? <p className="mt-4 text-xs text-semaforo-critico">{error}</p> : null}

        <div className="mt-6 flex justify-end gap-2">
          <Boton type="button" variante="contorno" onClick={() => router.back()}>
            Cancelar
          </Boton>
          <Boton type="submit" cargando={enviando}>
            {inicial ? "Guardar cambios" : "Registrar el reclamo"}
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
