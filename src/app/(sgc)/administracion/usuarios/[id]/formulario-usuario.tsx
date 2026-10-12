"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Boton } from "@/components/ui/boton";
import { GrupoCampo, Seleccion } from "@/components/ui/campo";
import { Tarjeta } from "@/components/ui/tarjeta";
import { actualizarUsuario } from "@/app/(sgc)/administracion/usuarios/acciones";
import { DESCRIPCION_ROL, ETIQUETAS_ROL } from "@/lib/constantes";
import {
  CANALES_DE_VENTA,
  GRUPOS_DE_CANAL,
  type CanalDeVenta,
} from "@/lib/permisos-ventas";
import type { RolUsuario } from "@/lib/tipos";

interface UsuarioFicha {
  id: string;
  nombre_completo: string;
  correo: string;
  rol: RolUsuario;
  superior_id: string | null;
  proceso_id: string | null;
  puesto_id: string | null;
  vendedor_planilla: string | null;
  ventas_canales: string[] | null;
  activo: boolean;
}

/**
 * Todo lo que se le configura a una persona, en una pantalla.
 *
 * ES EL MISMO FORMULARIO QUE LA FILA, con los mismos campos y la misma
 * acción de servidor: no hay dos lugares donde se guarde un usuario, hay
 * dos puertas. La fila sirve para el ajuste rápido —cambiarle el rol a
 * alguien— y la ficha para mirar a una persona entera, con los nombres de
 * los campos a la vista y lo que su rol le habilita debajo.
 *
 * EL ROL CAMBIA LO QUE SE MUESTRA DEBAJO, así que se lleva en estado: si
 * alguien pasa a Dirección, el selector de canales deja de tener sentido
 * —Dirección ve todas las ventas— y tiene que decirlo en el momento, no
 * después de guardar.
 */
export function FormularioUsuario({
  usuario,
  personas,
  procesos,
  puestos,
  vendedores,
}: {
  usuario: UsuarioFicha;
  personas: { id: string; nombre_completo: string }[];
  procesos: { id: string; nombre: string }[];
  puestos: { id: string; nombre: string }[];
  vendedores: string[];
}) {
  const router = useRouter();
  const [guardando, definirGuardando] = React.useState(false);
  const [rol, definirRol] = React.useState<RolUsuario>(usuario.rol);
  const [canales, definirCanales] = React.useState<string[]>(usuario.ventas_canales ?? []);

  async function guardar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    definirGuardando(true);
    const resultado = await actualizarUsuario(usuario.id, new FormData(evento.currentTarget));
    definirGuardando(false);

    if (!resultado.exito) {
      toast.error(resultado.error);
      return;
    }

    toast.success(resultado.mensaje ?? "Usuario actualizado.");
    router.refresh();
  }

  const veTodasLasVentas = rol === "direccion";

  function alternarCanal(canal: CanalDeVenta, marcado: boolean) {
    definirCanales((previos) =>
      marcado ? Array.from(new Set([...previos, canal])) : previos.filter((c) => c !== canal),
    );
  }

  function alternarGrupo(canalesDelGrupo: CanalDeVenta[], marcado: boolean) {
    definirCanales((previos) =>
      marcado
        ? Array.from(new Set([...previos, ...canalesDelGrupo]))
        : previos.filter((c) => !canalesDelGrupo.includes(c as CanalDeVenta)),
    );
  }

  return (
    <form onSubmit={guardar}>
      <Tarjeta className="p-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <GrupoCampo
            etiqueta="Rol"
            htmlFor="rol"
            ayuda={DESCRIPCION_ROL[rol]}
            className="sm:col-span-2"
          >
            <Seleccion
              id="rol"
              name="rol"
              value={rol}
              onChange={(evento) => definirRol(evento.target.value as RolUsuario)}
            >
              {Object.entries(ETIQUETAS_ROL).map(([valor, etiqueta]) => (
                <option key={valor} value={valor}>
                  {etiqueta}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Líder inmediato"
            htmlFor="superior_id"
            ayuda="A quién se le escala una acción correctiva vencida."
          >
            <Seleccion
              id="superior_id"
              name="superior_id"
              defaultValue={usuario.superior_id ?? ""}
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
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Puesto"
            htmlFor="puesto_id"
            ayuda="De acá sale el nivel exigido de cada competencia."
          >
            <Seleccion id="puesto_id" name="puesto_id" defaultValue={usuario.puesto_id ?? ""}>
              <option value="">Sin puesto</option>
              {puestos.map((puesto) => (
                <option key={puesto.id} value={puesto.id}>
                  {puesto.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          <GrupoCampo
            etiqueta="Proceso a cargo"
            htmlFor="proceso_id"
            ayuda="Solo si es responsable del proceso. Vacío para el resto."
          >
            <Seleccion id="proceso_id" name="proceso_id" defaultValue={usuario.proceso_id ?? ""}>
              <option value="">Sin proceso</option>
              {procesos.map((proceso) => (
                <option key={proceso.id} value={proceso.id}>
                  {proceso.nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          {/* CON QUÉ NOMBRE FIGURA EN EL TABLERO COMERCIAL. Se elige de
              la planilla y no se escribe: a mano, una letra de diferencia
              deja a la persona sin ver sus ventas y no avisa —queda en
              blanco, como si no vendiera—. */}
          <GrupoCampo
            etiqueta="Nombre en la planilla comercial"
            htmlFor="vendedor_planilla"
            ayuda="Con qué nombre figura en el tablero de ventas. Vacío si no es comercial."
          >
            <Seleccion
              id="vendedor_planilla"
              name="vendedor_planilla"
              defaultValue={usuario.vendedor_planilla ?? ""}
            >
              <option value="">No es comercial</option>

              {/* EL VALOR CARGADO VA AUNQUE YA NO ESTÉ EN LA PLANILLA: si
                  se renombró a alguien en la hoja, sin esta opción
                  guardar se lo borraría sin que nadie lo pida. */}
              {usuario.vendedor_planilla && !vendedores.includes(usuario.vendedor_planilla) ? (
                <option value={usuario.vendedor_planilla}>
                  {usuario.vendedor_planilla} (ya no está en la planilla)
                </option>
              ) : null}

              {vendedores.map((nombre) => (
                <option key={nombre} value={nombre}>
                  {nombre}
                </option>
              ))}
            </Seleccion>
          </GrupoCampo>

          {/* QUÉ VENTAS VE, ADEMÁS DE LAS SUYAS. Va por persona y no por
              rol: dos jefes con el mismo rol miran canales distintos. */}
          <div className="sm:col-span-2">
            <p className="mb-1.5 text-xs font-medium">Ventas que puede ver</p>
            {veTodasLasVentas ? (
              <p className="rounded-md border border-borde bg-acento/40 p-3 text-xs text-atenuado-contraste">
                Dirección ve todas las ventas, de todos los canales. No hace falta marcar nada.
              </p>
            ) : (
              <div className="rounded-md border border-borde p-3 text-xs">
                <p className="mb-2 text-[11px] text-atenuado-contraste">
                  Sin nada marcado ve <strong>solo las suyas</strong>. Los grupos son atajos:
                  lo que se guarda son los canales.
                </p>

                <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
                  <div>
                    {/* Las casillas de grupo NO tienen `name`: el
                        formulario manda los canales, no los grupos. */}
                    {GRUPOS_DE_CANAL.map((grupo) => {
                      const completo = grupo.canales.every((c) => canales.includes(c));
                      return (
                        <label
                          key={grupo.nombre}
                          className="flex items-center gap-1.5 py-0.5 font-medium"
                        >
                          <input
                            type="checkbox"
                            checked={completo}
                            onChange={(evento) =>
                              alternarGrupo(grupo.canales, evento.target.checked)
                            }
                            className="size-3.5 accent-[hsl(var(--primario))]"
                          />
                          {grupo.nombre}
                        </label>
                      );
                    })}
                  </div>

                  <div className="border-t border-borde pt-1.5 sm:border-l sm:border-t-0 sm:pl-4 sm:pt-0">
                    {CANALES_DE_VENTA.map((canal) => (
                      <label
                        key={canal}
                        className="flex items-center gap-1.5 py-0.5 text-atenuado-contraste"
                      >
                        <input
                          type="checkbox"
                          name="ventas_canales"
                          value={canal}
                          checked={canales.includes(canal)}
                          onChange={(evento) => alternarCanal(canal, evento.target.checked)}
                          className="size-3.5 accent-[hsl(var(--primario))]"
                        />
                        {canal}
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          <label className="flex items-start gap-2 rounded-md border border-borde p-3 text-xs sm:col-span-2">
            <input
              type="checkbox"
              name="activo"
              defaultChecked={usuario.activo}
              className="mt-0.5 size-3.5 shrink-0 accent-[hsl(var(--primario))]"
            />
            <span>
              Activo
              <span className="block text-[11px] leading-relaxed text-atenuado-contraste">
                Desmarcado, la persona deja de entrar al sistema. No se borra: lo que ya cargó
                sigue en su lugar y con su nombre.
              </span>
            </span>
          </label>
        </div>

        <div className="mt-5 flex justify-end">
          <Boton type="submit" cargando={guardando}>
            Guardar cambios
          </Boton>
        </div>
      </Tarjeta>
    </form>
  );
}
