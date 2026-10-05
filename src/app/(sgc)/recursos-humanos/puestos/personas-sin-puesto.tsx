"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarImagen, AvatarRespaldo } from "@/components/ui/avatar";
import { Seleccion } from "@/components/ui/campo";
import { asignarPuestoAPersona } from "@/app/(sgc)/recursos-humanos/puestos/acciones";
import { iniciales } from "@/lib/utilidades";
import type { FilaPuesto } from "@/app/(sgc)/recursos-humanos/puestos/page";

/**
 * Quien entró al sistema y todavía no tiene puesto.
 *
 * Se alimenta solo. Cada persona que ingresa por primera vez carga sus
 * nombres, apellidos y fecha de nacimiento, y aparece acá hasta que el
 * Administrador SGC le asigne el puesto. Una persona no se adjudica el
 * suyo, y el disparador `usuarios_proteger_perfil` lo impide del otro
 * lado aunque alguien lo intente contra la API.
 *
 * El desplegable guarda al elegir, sin botón: es una sola decisión y
 * pedir un clic más para confirmarla no agrega nada.
 */
export function PersonasSinPuesto({
  personas,
  puestos,
  puedeAsignar,
}: {
  personas: {
    id: string;
    nombre_completo: string;
    correo: string;
    url_avatar: string | null;
  }[];
  puestos: FilaPuesto[];
  puedeAsignar: boolean;
}) {
  const router = useRouter();
  const [asignando, definirAsignando] = React.useState<string | null>(null);

  async function asignar(usuarioId: string, puestoId: string) {
    if (!puestoId) return;

    definirAsignando(usuarioId);
    const resultado = await asignarPuestoAPersona(usuarioId, puestoId);
    definirAsignando(null);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Puesto asignado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <ul className="divide-y divide-borde">
      {personas.map((persona) => (
        <li key={persona.id} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
          <Avatar className="size-7 shrink-0">
            {persona.url_avatar ? <AvatarImagen src={persona.url_avatar} alt="" /> : null}
            <AvatarRespaldo className="text-[10px]">
              {iniciales(persona.nombre_completo)}
            </AvatarRespaldo>
          </Avatar>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-medium">{persona.nombre_completo}</p>
            <p className="truncate text-[11px] text-atenuado-contraste">{persona.correo}</p>
          </div>

          {puedeAsignar ? (
            <Seleccion
              aria-label={`Asignar puesto a ${persona.nombre_completo}`}
              className="w-[16rem] shrink-0 text-xs"
              defaultValue=""
              disabled={asignando === persona.id}
              onChange={(evento) => asignar(persona.id, evento.target.value)}
            >
              <option value="" disabled>
                Asignar un puesto…
              </option>
              {puestos.map((puesto) => (
                <option key={puesto.id} value={puesto.id}>
                  {puesto.nombre}
                  {puesto.area ? ` · ${puesto.area}` : ""}
                </option>
              ))}
            </Seleccion>
          ) : null}
        </li>
      ))}
    </ul>
  );
}
