"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserMinus } from "lucide-react";
import { Avatar, AvatarImagen, AvatarRespaldo } from "@/components/ui/avatar";
import { Boton } from "@/components/ui/boton";
import { Seleccion } from "@/components/ui/campo";
import { Insignia } from "@/components/ui/insignia";
import {
  quitarPersonaDePuesto,
  sumarPersonaAPuesto,
} from "@/app/(sgc)/recursos-humanos/puestos/acciones";
import { iniciales } from "@/lib/utilidades";

export interface PersonaEnPuesto {
  id: string;
  nombre_completo: string;
  correo: string;
  url_avatar: string | null;
  /** Falso cuando este es el segundo puesto de la persona. */
  esPrincipal: boolean;
}

/**
 * Quién ocupa el puesto, y el alta y la baja de personas en él.
 *
 * HASTA DOS PUESTOS POR PERSONA. El desplegable solo ofrece a quien
 * tiene lugar: con los dos puestos ocupados, la persona no aparece. El
 * tope real igual no está acá —está en la tabla, que tiene dos columnas
 * y ninguna tercera—, porque ocultar una opción no es un control.
 *
 * El segundo puesto se marca. Sin la marca, dos personas «en este
 * puesto» se leen igual, y una de ellas lo tiene como su puesto
 * principal y la otra no: para la dotación no es lo mismo.
 */
export function PersonasDelPuesto({
  puestoId,
  personas,
  disponibles,
  puedeAsignar,
}: {
  puestoId: string;
  personas: PersonaEnPuesto[];
  disponibles: { id: string; nombre_completo: string; cuantosPuestos: number }[];
  puedeAsignar: boolean;
}) {
  const router = useRouter();
  const [procesando, definirProcesando] = React.useState<string | null>(null);

  async function sumar(usuarioId: string) {
    if (!usuarioId) return;
    definirProcesando(usuarioId);
    const resultado = await sumarPersonaAPuesto(usuarioId, puestoId);
    definirProcesando(null);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Asignado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  async function quitar(usuarioId: string, nombre: string) {
    if (!confirm(`¿Sacar a ${nombre} de este puesto?`)) return;

    definirProcesando(usuarioId);
    const resultado = await quitarPersonaDePuesto(usuarioId, puestoId);
    definirProcesando(null);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Listo.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <div className="space-y-3">
      {personas.length === 0 ? (
        <p className="text-xs leading-relaxed text-atenuado-contraste">
          Puesto vacante. Se asigna desde acá, o desde «Personas sin puesto» en el listado.
        </p>
      ) : (
        <ul className="space-y-2">
          {personas.map((persona) => (
            <li key={persona.id} className="flex items-center gap-2">
              <Avatar className="size-7 shrink-0">
                {persona.url_avatar ? <AvatarImagen src={persona.url_avatar} alt="" /> : null}
                <AvatarRespaldo className="text-[10px]">
                  {iniciales(persona.nombre_completo)}
                </AvatarRespaldo>
              </Avatar>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-medium">
                  {persona.nombre_completo}
                </span>
                <span className="block truncate text-[11px] text-atenuado-contraste">
                  {persona.correo}
                </span>
                {persona.esPrincipal ? null : (
                  <Insignia variante="contorno" className="mt-1">
                    Segundo puesto
                  </Insignia>
                )}
              </span>

              {puedeAsignar ? (
                <Boton
                  variante="fantasma"
                  tamano="pequeno"
                  aria-label={`Sacar a ${persona.nombre_completo} de este puesto`}
                  cargando={procesando === persona.id}
                  onClick={() => quitar(persona.id, persona.nombre_completo)}
                >
                  <UserMinus />
                </Boton>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      {puedeAsignar ? (
        disponibles.length === 0 ? (
          <p className="border-t border-borde pt-3 text-[11px] text-atenuado-contraste">
            No queda nadie con lugar: el resto ya ocupa sus dos puestos.
          </p>
        ) : (
          <div className="border-t border-borde pt-3">
            <Seleccion
              aria-label="Sumar una persona a este puesto"
              className="w-full text-xs"
              value=""
              disabled={procesando !== null}
              onChange={(evento) => sumar(evento.target.value)}
            >
              <option value="">Sumar una persona a este puesto…</option>
              {disponibles.map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                  {persona.cuantosPuestos === 1 ? " · sería su segundo puesto" : ""}
                </option>
              ))}
            </Seleccion>
          </div>
        )
      ) : null}
    </div>
  );
}
