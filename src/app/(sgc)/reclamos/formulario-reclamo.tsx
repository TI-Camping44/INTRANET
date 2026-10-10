"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { actualizarReclamo, crearReclamo } from "@/app/(sgc)/reclamos/acciones";
import {
  SelectorCliente,
  type ClienteBuscable,
} from "@/app/(sgc)/reclamos/selector-cliente";
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

interface Persona {
  id: string;
  nombre_completo: string;
}

type Cliente = ClienteBuscable;

export interface ReclamoInicial {
  id: string;
  titulo: string;
  descripcion: string;
  cliente_id: string | null;
  cliente_nombre: string;
  origen: string;
  tipo_falla: string;
  gravedad: GravedadReclamo;
  responsable_area_id: string | null;
}

/**
 * Alta y edición de un reclamo.
 *
 * EL ORDEN ES EL DEL PROCEDIMIENTO: qué pasó, a quién, cómo nos
 * enteramos, qué gravedad tiene y dónde se originó.
 *
 * SALIERON TRES CAMPOS DEL ALTA el 9 de octubre: el gestor del caso,
 * «Involucra material controlado» y los otros departamentos
 * intervinientes. Las tres columnas quedan en la base y la ficha las
 * sigue mostrando: lo que se saca es la pregunta al registrar, que es
 * cuando todavía no se sabe la respuesta.
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

          {/* UN SOLO CAMPO PARA EL CLIENTE. Eran dos —la lista y el
              nombre a mano— y el de la derecha ganaba siempre, así que
              el reclamo quedaba sin cliente identificado; sin cliente no
              hay forma de detectar la reincidencia, que es lo que sube
              el plan de nivel. */}
          <GrupoCampo
            etiqueta="Cliente"
            htmlFor="buscar-cliente"
            requerido
            className="sm:col-span-2"
            ayuda="Escriba el nombre, el RUC o la cédula y elija de la lista."
          >
            <SelectorCliente
              clientes={clientes}
              inicialId={inicial?.cliente_id}
              inicialNombre={inicial?.cliente_nombre}
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
