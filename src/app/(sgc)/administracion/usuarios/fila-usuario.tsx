"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Seleccion } from "@/components/ui/campo";
import { TablaCelda, TablaFila } from "@/components/ui/tabla";
import { actualizarUsuario } from "@/app/(sgc)/administracion/usuarios/acciones";
import { ETIQUETAS_ROL } from "@/lib/constantes";
import { formatearFechaHora } from "@/lib/formato";
import type { RolUsuario } from "@/lib/tipos";

interface UsuarioFila {
  id: string;
  nombre_completo: string;
  correo: string;
  rol: RolUsuario;
  superior_id: string | null;
  proceso_id: string | null;
  puesto_id: string | null;
  activo: boolean;
  ultimo_ingreso: string | null;
}

/** Fila editable del padron de usuarios. */
export function FilaUsuario({
  usuario,
  personas,
  procesos,
  puestos,
}: {
  usuario: UsuarioFila;
  personas: { id: string; nombre_completo: string }[];
  procesos: { id: string; nombre: string }[];
  puestos: { id: string; nombre: string }[];
}) {
  const router = useRouter();
  const [guardando, definirGuardando] = React.useState(false);

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirGuardando(true);
    const resultado = await actualizarUsuario(usuario.id, new FormData(evento.currentTarget));
    definirGuardando(false);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Usuario actualizado.");
      router.refresh();
    } else {
      toast.error(resultado.error);
    }
  }

  return (
    <TablaFila>
      <TablaCelda>
        <p className="text-xs font-medium">{usuario.nombre_completo}</p>
        <p className="text-[11px] text-atenuado-contraste">{usuario.correo}</p>
      </TablaCelda>

      <TablaCelda colSpan={6} className="p-0">
        <form onSubmit={guardar} className="flex flex-wrap items-center gap-2 px-3 py-2">
          <Seleccion
            name="rol"
            defaultValue={usuario.rol}
            aria-label={`Rol de ${usuario.nombre_completo}`}
            className="h-8 w-auto min-w-[10rem] text-xs"
          >
            {Object.entries(ETIQUETAS_ROL).map(([valor, etiqueta]) => (
              <option key={valor} value={valor}>
                {etiqueta}
              </option>
            ))}
          </Seleccion>

          <Seleccion
            name="superior_id"
            defaultValue={usuario.superior_id ?? ""}
            aria-label={`Jefe inmediato de ${usuario.nombre_completo}`}
            className="h-8 w-auto min-w-[11rem] text-xs"
          >
            <option value="">Sin jefe asignado</option>
            {personas
              .filter((persona) => persona.id !== usuario.id)
              .map((persona) => (
                <option key={persona.id} value={persona.id}>
                  {persona.nombre_completo}
                </option>
              ))}
          </Seleccion>

          <Seleccion
            name="proceso_id"
            defaultValue={usuario.proceso_id ?? ""}
            aria-label={`Proceso de ${usuario.nombre_completo}`}
            className="h-8 w-auto min-w-[10rem] text-xs"
          >
            <option value="">Sin proceso</option>
            {procesos.map((proceso) => (
              <option key={proceso.id} value={proceso.id}>
                {proceso.nombre}
              </option>
            ))}
          </Seleccion>

          <Seleccion
            name="puesto_id"
            defaultValue={usuario.puesto_id ?? ""}
            aria-label={`Puesto de ${usuario.nombre_completo}`}
            className="h-8 w-auto min-w-[10rem] text-xs"
          >
            <option value="">Sin puesto</option>
            {puestos.map((puesto) => (
              <option key={puesto.id} value={puesto.id}>
                {puesto.nombre}
              </option>
            ))}
          </Seleccion>

          <label className="flex items-center gap-1.5 whitespace-nowrap text-[11px]">
            <input
              type="checkbox"
              name="activo"
              defaultChecked={usuario.activo}
              className="size-3.5 accent-[#E01E37]"
            />
            Activo
          </label>

          <span className="text-[10px] text-atenuado-contraste">
            {usuario.ultimo_ingreso
              ? `Último ingreso: ${formatearFechaHora(usuario.ultimo_ingreso)}`
              : "Sin ingresos"}
          </span>

          <Boton
            type="submit"
            tamano="iconoPequeno"
            variante="contorno"
            disabled={guardando}
            aria-label={`Guardar cambios de ${usuario.nombre_completo}`}
            className="ml-auto"
          >
            <Save />
          </Boton>
        </form>
      </TablaCelda>
    </TablaFila>
  );
}
