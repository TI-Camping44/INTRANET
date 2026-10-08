"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Boton } from "@/components/ui/boton";
import { AreaTexto, GrupoCampo, Seleccion } from "@/components/ui/campo";
import { cambiarEstadoObjetivo } from "@/app/(sgc)/indicadores/acciones";
import {
  ESTADOS_OBJETIVO,
  ETIQUETAS_ESTADO_OBJETIVO,
  type EstadoObjetivo,
} from "@/lib/objetivos";

/**
 * Mueve el objetivo por sus cuatro estados.
 *
 * CERRAR EXIGE DECLARAR EL RESULTADO. Al elegir «Cerrado» aparecen las
 * dos preguntas que faltan: si se alcanzó y por qué. Un objetivo cerrado
 * sin resultado no dice nada, y la Revisión por la Dirección se apoya
 * justamente en eso. La acción de servidor y el `CHECK` de la base lo
 * controlan también: la pantalla puede fallar, la restricción no.
 */
export function EstadoDelObjetivo({
  objetivoId,
  estado,
  alcanzado,
  comentario,
  puedeGestionar,
}: {
  objetivoId: string;
  estado: EstadoObjetivo;
  alcanzado: boolean | null;
  comentario: string | null;
  puedeGestionar: boolean;
}) {
  const router = useRouter();
  const [elegido, definirElegido] = React.useState<EstadoObjetivo>(estado);
  const [guardando, definirGuardando] = React.useState(false);

  const cierra = elegido === "cerrado";
  const cambio = elegido !== estado;

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirGuardando(true);

    const resultado = await cambiarEstadoObjetivo(objetivoId, new FormData(evento.currentTarget));
    definirGuardando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Estado actualizado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  if (!puedeGestionar) {
    return (
      <p className="text-xs">
        <span className="font-medium">{ETIQUETAS_ESTADO_OBJETIVO[estado]}</span>
      </p>
    );
  }

  return (
    <form onSubmit={guardar} className="space-y-3">
      <GrupoCampo etiqueta="Estado" htmlFor="estado">
        <Seleccion
          id="estado"
          name="estado"
          value={elegido}
          onChange={(evento) => definirElegido(evento.target.value as EstadoObjetivo)}
        >
          {ESTADOS_OBJETIVO.map((valor) => (
            <option key={valor} value={valor}>
              {ETIQUETAS_ESTADO_OBJETIVO[valor]}
            </option>
          ))}
        </Seleccion>
      </GrupoCampo>

      {cierra ? (
        <>
          <GrupoCampo
            etiqueta="¿Se alcanzó el objetivo?"
            htmlFor="objetivo_alcanzado"
            requerido
          >
            <Seleccion
              id="objetivo_alcanzado"
              name="objetivo_alcanzado"
              required
              defaultValue={alcanzado === null ? "" : alcanzado ? "si" : "no"}
            >
              <option value="" disabled>
                Elija…
              </option>
              <option value="si">Sí, se alcanzó</option>
              <option value="no">No se alcanzó</option>
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Comentarios"
            htmlFor="comentario_cierre"
            ayuda="Por qué se alcanzó o por qué no. Es lo que se lee en la Revisión por la Dirección."
          >
            <AreaTexto
              id="comentario_cierre"
              name="comentario_cierre"
              rows={3}
              defaultValue={comentario ?? ""}
            />
          </GrupoCampo>
        </>
      ) : null}

      {cambio || cierra ? (
        <Boton type="submit" tamano="pequeno" cargando={guardando}>
          Guardar estado
        </Boton>
      ) : null}
    </form>
  );
}
