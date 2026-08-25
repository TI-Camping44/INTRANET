"use client";

import * as React from "react";
import { ChevronRight } from "lucide-react";
import { Avatar, AvatarImagen, AvatarRespaldo } from "@/components/ui/avatar";
import { EstadoVacio } from "@/components/ui/estado-vacio";
import { iniciales } from "@/lib/utilidades";
import { cn } from "@/lib/utilidades";

export interface Persona {
  id: string;
  nombre_completo: string;
  correo: string;
  telefono: string | null;
  url_avatar: string | null;
  superior_id: string | null;
  puestos: { nombre: string; area: string | null } | null;
  procesos: { nombre: string } | null;
}

/**
 * Organigrama a partir del campo "superior_id" de cada persona. No hay
 * una tabla de jerarquia aparte: la linea de reporte ya vive en el
 * legajo, y duplicarla seria garantizar que las dos se contradigan.
 *
 * Se dibuja como arbol desplegable y no como diagrama de cajas: con
 * cuarenta y nueve personas un diagrama no entra en una pantalla, y
 * menos en un celular.
 */
export function Organigrama({ personas }: { personas: Persona[] }) {
  const porSuperior = React.useMemo(() => {
    const mapa = new Map<string | null, Persona[]>();
    for (const persona of personas) {
      const clave = persona.superior_id;
      if (!mapa.has(clave)) mapa.set(clave, []);
      mapa.get(clave)!.push(persona);
    }
    mapa.forEach((lista) =>
      lista.sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, "es")),
    );
    return mapa;
  }, [personas]);

  // Quien no tiene superior encabeza. Si alguien apunta a una persona
  // inactiva o borrada, tambien queda arriba: mejor que desaparezca del
  // organigrama es que se vea suelto y se note.
  const identificadores = new Set(personas.map((persona) => persona.id));
  const raices = personas
    .filter((persona) => !persona.superior_id || !identificadores.has(persona.superior_id))
    .sort((a, b) => a.nombre_completo.localeCompare(b.nombre_completo, "es"));

  if (personas.length === 0) {
    return (
      <EstadoVacio
        titulo="Sin personas cargadas"
        descripcion="El organigrama se arma solo con el jefe inmediato de cada legajo."
      />
    );
  }

  return (
    <div className="space-y-1">
      <ul className="space-y-1">
        {raices.map((persona) => (
          <Nodo key={persona.id} persona={persona} porSuperior={porSuperior} nivel={0} />
        ))}
      </ul>

      <p className="pt-3 text-[11px] leading-relaxed text-atenuado-contraste">
        La jerarquía sale del jefe inmediato cargado en cada legajo. Si alguien está en el lugar
        equivocado, se corrige desde Usuarios y roles y el organigrama se acomoda solo.
      </p>
    </div>
  );
}

function Nodo({
  persona,
  porSuperior,
  nivel,
}: {
  persona: Persona;
  porSuperior: Map<string | null, Persona[]>;
  nivel: number;
}) {
  const hijos = porSuperior.get(persona.id) ?? [];
  // Los dos primeros niveles abren solos: es lo que alguien quiere ver
  // al entrar. Mas abajo se despliega a pedido.
  const [abierto, definirAbierto] = React.useState(nivel < 2);

  return (
    <li>
      <div
        className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-atenuado"
        style={{ marginLeft: nivel * 18 }}
      >
        {hijos.length > 0 ? (
          <button
            type="button"
            onClick={() => definirAbierto(!abierto)}
            className="shrink-0 rounded p-0.5 text-atenuado-contraste hover:text-texto"
            aria-label={abierto ? "Contraer" : "Desplegar"}
            aria-expanded={abierto}
          >
            <ChevronRight className={cn("size-3.5 transition-transform", abierto && "rotate-90")} />
          </button>
        ) : (
          <span className="w-[1.125rem] shrink-0" />
        )}

        <Avatar className="size-7 shrink-0">
          {persona.url_avatar ? (
            <AvatarImagen src={persona.url_avatar} alt={persona.nombre_completo} />
          ) : null}
          <AvatarRespaldo className="text-[10px]">
            {iniciales(persona.nombre_completo)}
          </AvatarRespaldo>
        </Avatar>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{persona.nombre_completo}</p>
          <p className="truncate text-[11px] text-atenuado-contraste">
            {persona.puestos?.nombre ?? "Sin puesto asignado"}
            {persona.puestos?.area ? ` · ${persona.puestos.area}` : ""}
          </p>
        </div>

        {hijos.length > 0 ? (
          <span className="shrink-0 text-[11px] tabular text-atenuado-contraste">
            {hijos.length} a cargo
          </span>
        ) : null}
      </div>

      {abierto && hijos.length > 0 ? (
        <ul className="mt-1 space-y-1">
          {hijos.map((hijo) => (
            <Nodo key={hijo.id} persona={hijo} porSuperior={porSuperior} nivel={nivel + 1} />
          ))}
        </ul>
      ) : null}
    </li>
  );
}
