"use client";

import * as React from "react";
import { Plus, X } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { AreaTexto } from "@/components/ui/campo";

/**
 * Propuestas de mejora de la no conformidad: una o varias.
 *
 * De una misma desviación suelen salir dos o tres ideas, y hasta ahora
 * terminaban apiladas en un solo párrafo. Acá cada una va en su propio
 * cuadro y se guarda por separado, así se pueden leer una por una y
 * convertir en acción la que Calidad decida ejecutar.
 *
 * Cada cuadro se envía con el mismo `name`, que es como el navegador
 * manda una lista: la acción de servidor las recoge con
 * `datos.getAll("propuestas_mejora")`.
 */
export function CampoPropuestas({
  nombre = "propuestas_mejora",
  iniciales = [],
}: {
  nombre?: string;
  /** Las ya cargadas, cuando se está editando. */
  iniciales?: string[];
}) {
  // Se arranca con un cuadro vacío. Vacío no se guarda, así que quien no
  // tenga ninguna propuesta simplemente no lo completa. Al editar se
  // arranca con las que ya estaban, una por cuadro.
  const [cuadros, definirCuadros] = React.useState(() =>
    iniciales.length > 0 ? iniciales.map((texto, indice) => ({ clave: indice, texto })) : [{ clave: 0, texto: "" }],
  );
  const siguiente = React.useRef(Math.max(iniciales.length, 1));

  function agregar() {
    definirCuadros((actuales) => [...actuales, { clave: siguiente.current++, texto: "" }]);
  }

  function quitar(clave: number) {
    definirCuadros((actuales) =>
      actuales.length === 1 ? actuales : actuales.filter((otra) => otra.clave !== clave),
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {cuadros.map((cuadro, indice) => (
        <div key={cuadro.clave} className="flex items-start gap-2">
          <AreaTexto
            name={nombre}
            rows={2}
            defaultValue={cuadro.texto}
            aria-label={`Propuesta de mejora ${indice + 1}`}
            placeholder={indice === 0 ? "Qué se podría cambiar para que no vuelva a pasar." : ""}
          />
          {cuadros.length > 1 ? (
            <Boton
              type="button"
              variante="contorno"
              tamano="icono"
              onClick={() => quitar(cuadro.clave)}
              aria-label={`Quitar la propuesta ${indice + 1}`}
              title="Quitar esta propuesta"
            >
              <X />
            </Boton>
          ) : null}
        </div>
      ))}

      <div>
        <Boton type="button" variante="contorno" tamano="pequeno" onClick={agregar}>
          <Plus /> Agregar otra propuesta
        </Boton>
      </div>
    </div>
  );
}
