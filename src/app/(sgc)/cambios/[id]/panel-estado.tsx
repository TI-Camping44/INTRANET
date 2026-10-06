"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Boton } from "@/components/ui/boton";
import { AreaTexto, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { cambiarEstadoCambio } from "@/app/(sgc)/cambios/acciones";
import {
  DECISIONES_CAMBIO,
  ETIQUETAS_DECISION_CAMBIO,
  TRANSICIONES_CAMBIO,
  type EstadoCambio,
} from "@/lib/cambios";

/**
 * El ciclo del cambio, en un solo panel.
 *
 * UN SOLO PASO: cerrar. Calidad lo definió el 6 de octubre: el cambio se
 * planifica y se cierra diciendo si fue eficaz. Salieron la aprobación y
 * el registro de implementación, y del cierre salieron los dos campos de
 * información documentada.
 *
 * Lo que queda es lo que el procedimiento sí exige: el resultado, la
 * observación del seguimiento y —si no fue eficaz— la decisión entre
 * ajuste, reversión o acción correctiva. Esa tercera abre una no
 * conformidad de verdad.
 *
 * Los botones salen de `TRANSICIONES_CAMBIO`, la misma tabla que usa la
 * acción de servidor para decidir si acepta. Así la pantalla no puede
 * ofrecer algo que el servidor va a rechazar.
 *
 * QUIÉN PUEDE, lo decide el servidor. Acá se muestra el botón igual:
 * ocultar no es un control de acceso, y alguien que no puede aprobar
 * merece leer por qué en vez de no encontrar el botón.
 */
export function PanelEstado({
  cambioId,
  estado,
}: {
  cambioId: string;
  estado: EstadoCambio;
}) {
  const router = useRouter();
  const [destino, definirDestino] = React.useState<EstadoCambio | null>(null);
  const [enviando, definirEnviando] = React.useState(false);
  const [error, definirError] = React.useState<string | null>(null);
  const [resultado, definirResultado] = React.useState("eficaz");

  const posibles = TRANSICIONES_CAMBIO[estado];
  if (posibles.length === 0) return null;

  const etiquetas: Partial<Record<EstadoCambio, string>> = {
    borrador: "Devolver a borrador",
    cerrado: "Cerrar el cambio",
    // Los tres de abajo ya no se ofrecen: quedan por si un registro
    // viejo todavia los tiene como estado.
    en_aprobacion: "Enviar a aprobación",
    aprobado: "Aprobar",
    implementado: "Registrar implementación",
    rechazado: "Rechazar",
  };

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!destino) return;

    definirEnviando(true);
    definirError(null);

    const datos = new FormData(evento.currentTarget);
    const respuesta = await cambiarEstadoCambio(cambioId, destino, datos);

    definirEnviando(false);

    if (!respuesta.exito) {
      definirError(respuesta.error);
      return;
    }

    toast.success(respuesta.mensaje ?? "Actualizado.");
    definirDestino(null);
    router.refresh();
  }

  return (
    <Tarjeta className="p-4">
      <p className="text-xs font-semibold">Siguiente paso</p>

      <div className="mt-2 flex flex-wrap gap-2">
        {posibles.map((posible) => (
          <Boton
            key={posible}
            tamano="pequeno"
            variante={destino === posible ? "primario" : "contorno"}
            onClick={() => {
              definirError(null);
              definirDestino(destino === posible ? null : posible);
            }}
          >
            {etiquetas[posible] ?? posible}
          </Boton>
        ))}
      </div>

      {destino ? (
        <form onSubmit={enviar} className="mt-4 border-t border-borde pt-4">
          {destino === "rechazado" ? (
            <GrupoCampo
              etiqueta="Motivo del rechazo"
              htmlFor="motivo_rechazo"
              requerido
              ayuda="Vuelve a borrador para corregirlo, así que diga qué hay que corregir."
            >
              <AreaTexto id="motivo_rechazo" name="motivo_rechazo" rows={3} required minLength={10} />
            </GrupoCampo>
          ) : null}

          {destino === "cerrado" ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <GrupoCampo etiqueta="Resultado" htmlFor="resultado" requerido>
                <Seleccion
                  id="resultado"
                  name="resultado"
                  value={resultado}
                  onChange={(evento) => definirResultado(evento.target.value)}
                >
                  <option value="eficaz">Eficaz</option>
                  <option value="no_eficaz">No eficaz</option>
                </Seleccion>
              </GrupoCampo>

              {resultado === "no_eficaz" ? (
                <GrupoCampo
                  etiqueta="Decisión"
                  htmlFor="decision"
                  requerido
                  ayuda="«Acción correctiva» abre una no conformidad de verdad, con su número, su plazo de cinco días y su responsable, y la deja vinculada a este cambio."
                >
                  <Seleccion id="decision" name="decision" defaultValue="ajuste">
                    {DECISIONES_CAMBIO.map((valor) => (
                      <option key={valor} value={valor}>
                        {ETIQUETAS_DECISION_CAMBIO[valor]}
                      </option>
                    ))}
                  </Seleccion>
                </GrupoCampo>
              ) : null}

              <GrupoCampo
                etiqueta="Observación del seguimiento"
                htmlFor="seguimiento_observacion"
                requerido
                className="sm:col-span-2"
                ayuda="Qué mostró el indicador contra el criterio de éxito."
              >
                <AreaTexto
                  id="seguimiento_observacion"
                  name="seguimiento_observacion"
                  rows={3}
                  required
                  minLength={10}
                />
              </GrupoCampo>

            </div>
          ) : null}

          {error ? <p className="mt-3 text-xs text-semaforo-critico">{error}</p> : null}

          <div className="mt-4 flex justify-end">
            <Boton type="submit" tamano="pequeno" cargando={enviando}>
              Confirmar
            </Boton>
          </div>
        </form>
      ) : null}
    </Tarjeta>
  );
}
