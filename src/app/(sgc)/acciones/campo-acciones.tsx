"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto, Entrada, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { hoyEnAsuncion, sumarDias } from "@/lib/formato";

/**
 * Las acciones de la respuesta: una o varias, cada una con su
 * responsable y su plazo.
 *
 * De una misma causa raíz suelen salir dos o tres acciones —capacitar,
 * cambiar el instructivo, poner un control— y cada una la ejecuta una
 * persona distinta. Con un solo cuadro había que elegir una y escribir
 * las demás en el mismo párrafo, y entonces el responsable quedaba mal:
 * figuraba uno solo para un trabajo de tres.
 *
 * Los tres campos de cada acción se envían con el mismo `name`, que es
 * como el navegador manda una lista. La acción de servidor las recoge
 * con `getAll` y las arma por posición: el primer responsable es del
 * primer plazo y de la primera descripción. Por eso los tres campos se
 * envían siempre, aunque estén vacíos, y por eso el bloque entero se
 * agrega y se quita junto.
 */
export interface AccionInicial {
  id: string;
  descripcion: string;
  responsable_id: string | null;
  fecha_limite: string;
}

export function CampoAcciones({
  personas,
  usuarioActual,
  iniciales = [],
}: {
  personas: { id: string; nombre_completo: string }[];
  usuarioActual: string;
  /** Las ya cargadas, cuando se está editando la respuesta. */
  iniciales?: AccionInicial[];
}) {
  const plazoPorDefecto = sumarDias(hoyEnAsuncion(), 15);

  // Cada bloque lleva el id de la acción que ya existe, o vacío si es
  // nueva. Sin eso, guardar una edición no sabría cuál fila actualizar y
  // habría que borrarlas todas y volver a crearlas, perdiendo el estado
  // de ejecución de las que ya estaban cerradas.
  const [bloques, definirBloques] = React.useState(() =>
    iniciales.length > 0
      ? iniciales.map((accion, indice) => ({ clave: indice, accion }))
      : [{ clave: 0, accion: null as AccionInicial | null }],
  );
  const siguiente = React.useRef(Math.max(iniciales.length, 1));

  function agregar() {
    definirBloques((actuales) => [...actuales, { clave: siguiente.current++, accion: null }]);
  }

  function quitar(clave: number) {
    definirBloques((actuales) =>
      actuales.length === 1 ? actuales : actuales.filter((otra) => otra.clave !== clave),
    );
  }

  return (
    <div className="space-y-3">
      {bloques.map(({ clave, accion }, indice) => (
        <div key={clave} className="rounded-md border border-borde p-3">
          {/* Vacío en las nuevas. Va siempre, aunque esté vacío, para
              que las cuatro listas del envío midan lo mismo. */}
          <input type="hidden" name="accion_id" value={accion?.id ?? ""} />
          <div className="mb-2 flex items-center justify-between">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-atenuado-contraste">
              Acción {indice + 1}
            </p>
            {bloques.length > 1 ? (
              <Boton
                type="button"
                variante="fantasma"
                tamano="pequeno"
                onClick={() => quitar(clave)}
                aria-label={`Quitar la acción ${indice + 1}`}
              >
                <X /> Quitar
              </Boton>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <GrupoCampo
              etiqueta="Descripción de la acción"
              htmlFor={`accion-descripcion-${clave}`}
              requerido
              className="sm:col-span-2"
              ayuda="Qué se hará concretamente para eliminar la causa."
            >
              <AreaTexto
                id={`accion-descripcion-${clave}`}
                name="accion_descripcion"
                defaultValue={accion?.descripcion ?? ""}
                rows={3}
                required
                minLength={10}
              />
            </GrupoCampo>

            <GrupoCampo
              etiqueta="Responsable de ejecutarla"
              htmlFor={`accion-responsable-${clave}`}
              ayuda="Recibe la notificación de asignación."
            >
              <Seleccion
                id={`accion-responsable-${clave}`}
                name="accion_responsable"
                defaultValue={accion ? (accion.responsable_id ?? "") : indice === 0 ? usuarioActual : ""}
              >
                <option value="">Asignar más adelante</option>
                {personas.map((persona) => (
                  <option key={persona.id} value={persona.id}>
                    {persona.nombre_completo}
                  </option>
                ))}
              </Seleccion>
            </GrupoCampo>

            <GrupoCampo
              etiqueta="Fecha límite"
              htmlFor={`accion-fecha-${clave}`}
              requerido
              ayuda="Cuándo tiene que estar ejecutada."
            >
              <Entrada
                id={`accion-fecha-${clave}`}
                name="accion_fecha_limite"
                type="date"
                defaultValue={accion?.fecha_limite ?? plazoPorDefecto}
                required
              />
            </GrupoCampo>
          </div>
        </div>
      ))}

      <Boton type="button" variante="contorno" tamano="pequeno" onClick={agregar}>
        <Plus /> Agregar otra acción
      </Boton>
    </div>
  );
}
