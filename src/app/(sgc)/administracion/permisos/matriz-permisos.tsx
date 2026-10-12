"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Boton } from "@/components/ui/boton";
import { Aviso, AvisoDescripcion } from "@/components/ui/aviso";
import { Tarjeta } from "@/components/ui/tarjeta";
import { guardarPermisosDelRol } from "@/app/(sgc)/administracion/permisos/acciones";
import { DESCRIPCION_ROL, ETIQUETAS_ROL } from "@/lib/constantes";
import { GRUPOS_MODULO, MODULOS, type ClaveModulo, type PermisoDeModulo } from "@/lib/permisos";
import { cn } from "@/lib/utilidades";
import type { RolUsuario } from "@/lib/tipos";

type Matriz = Record<string, PermisoDeModulo>;

/**
 * La matriz de permisos, un rol por vez.
 *
 * UN ROL POR VEZ Y NO LA GRILLA ENTERA. Son veintiún módulos por cinco
 * roles por dos casillas: doscientas diez casillas en una pantalla, que
 * no se pueden mirar ni marcar sin equivocarse. Igual que en Odoo, se
 * edita un perfil y se ve completo lo que ese perfil puede hacer.
 */
export function MatrizPermisos({
  roles,
  matrices,
}: {
  roles: RolUsuario[];
  /** Lo guardado para cada rol editable. */
  matrices: Record<string, Matriz>;
}) {
  const router = useRouter();
  const [rol, definirRol] = React.useState<RolUsuario>(roles[0]);
  const [matriz, definirMatriz] = React.useState<Matriz>(matrices[roles[0]] ?? {});
  const [guardando, definirGuardando] = React.useState(false);
  const [sucio, definirSucio] = React.useState(false);

  function cambiarRol(nuevo: RolUsuario) {
    if (sucio && !confirm("Hay cambios sin guardar en este rol. ¿Los descarta?")) return;
    definirRol(nuevo);
    definirMatriz(matrices[nuevo] ?? {});
    definirSucio(false);
  }

  function alternar(modulo: ClaveModulo, campo: "ver" | "editar") {
    definirSucio(true);
    definirMatriz((actual) => {
      const antes = actual[modulo] ?? { ver: false, editar: false };
      const despues = { ...antes, [campo]: !antes[campo] };
      // Quitar «ver» se lleva «editar»: editar sin poder entrar no
      // significa nada, y la base lo rechaza con un CHECK.
      if (campo === "ver" && !despues.ver) despues.editar = false;
      // Y marcar «editar» enciende «ver», que es lo que la persona
      // quiere decir cuando lo marca.
      if (campo === "editar" && despues.editar) despues.ver = true;
      return { ...actual, [modulo]: despues };
    });
  }

  async function enviar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirGuardando(true);

    const datos = new FormData();
    datos.set("rol", rol);
    for (const modulo of MODULOS) {
      const valor = matriz[modulo.clave] ?? { ver: false, editar: false };
      if (valor.ver) datos.append("permiso", `${modulo.clave}:ver`);
      if (valor.editar) datos.append("permiso", `${modulo.clave}:editar`);
    }

    const resultado = await guardarPermisosDelRol(datos);

    if (resultado.exito) {
      toast.success(resultado.mensaje ?? "Permisos guardados.");
      definirSucio(false);
      router.refresh();
    } else {
      toast.error(resultado.error);
    }

    definirGuardando(false);
  }

  return (
    <form onSubmit={enviar}>
      {/* El selector de rol. Pestañas y no un desplegable: son cinco y
          conviene verlos todos, que es media decisión. */}
      <div className="mb-4 flex flex-wrap gap-1.5">
        {roles.map((valor) => (
          <button
            key={valor}
            type="button"
            onClick={() => cambiarRol(valor)}
            className={cn(
              "rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
              valor === rol
                ? "border-primario bg-primario text-white"
                : "border-borde bg-tarjeta text-atenuado-contraste hover:bg-acento/60",
            )}
          >
            {ETIQUETAS_ROL[valor]}
          </button>
        ))}
      </div>

      <Aviso className="mb-4">
        <AvisoDescripcion>{DESCRIPCION_ROL[rol]}</AvisoDescripcion>
      </Aviso>

      <div className="space-y-4">
        {GRUPOS_MODULO.map((grupo) => {
          const delGrupo = MODULOS.filter((modulo) => modulo.grupo === grupo);
          if (delGrupo.length === 0) return null;

          return (
            <Tarjeta key={grupo} className="overflow-hidden">
              <div className="border-b border-borde bg-acento/40 px-4 py-2">
                <h2 className="text-xs font-semibold">{grupo}</h2>
              </div>
              <ul className="divide-y divide-borde">
                {delGrupo.map((modulo) => {
                  const valor = matriz[modulo.clave] ?? { ver: false, editar: false };
                  const sinEdicion = modulo.queEsEditar.startsWith("No aplica");

                  return (
                    <li
                      key={modulo.clave}
                      className="flex flex-col gap-2 px-4 py-2.5 sm:flex-row sm:items-center
                                 sm:justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-medium">{modulo.nombre}</p>
                        <p className="text-[11px] leading-relaxed text-atenuado-contraste">
                          {modulo.queEsEditar}
                        </p>
                      </div>

                      <div className="flex shrink-0 gap-4">
                        <label className="flex cursor-pointer items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            checked={valor.ver}
                            onChange={() => alternar(modulo.clave, "ver")}
                            className="size-3.5 accent-primario"
                          />
                          Ver
                        </label>

                        {/* Los módulos que no se editan no ofrecen la
                            casilla: una casilla que no hace nada se
                            marca igual y después nadie entiende por qué
                            no cambió nada. */}
                        {sinEdicion ? (
                          <span className="w-[4.5rem] text-xs text-atenuado-contraste">—</span>
                        ) : (
                          <label className="flex w-[4.5rem] cursor-pointer items-center gap-1.5 text-xs">
                            <input
                              type="checkbox"
                              checked={valor.editar}
                              onChange={() => alternar(modulo.clave, "editar")}
                              className="size-3.5 accent-primario"
                            />
                            Editar
                          </label>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Tarjeta>
          );
        })}
      </div>

      <div className="mt-5 flex items-center justify-end gap-3">
        {sucio ? (
          <span className="text-xs text-atenuado-contraste">Hay cambios sin guardar.</span>
        ) : null}
        <Boton type="submit" cargando={guardando} disabled={!sucio}>
          Guardar permisos de {ETIQUETAS_ROL[rol]}
        </Boton>
      </div>
    </form>
  );
}
