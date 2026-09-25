"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Save } from "lucide-react";
import { Boton } from "@/components/ui/boton";
import { Entrada, Seleccion } from "@/components/ui/campo";
import { TablaCelda, TablaFila } from "@/components/ui/tabla";
import { actualizarUsuario } from "@/app/(sgc)/administracion/usuarios/acciones";
import { ETIQUETAS_ROL } from "@/lib/constantes";
import { formatearFechaHora } from "@/lib/formato";
import {
  CANALES_DE_VENTA,
  GRUPOS_DE_CANAL,
  type CanalDeVenta,
} from "@/lib/permisos-ventas";
import type { RolUsuario } from "@/lib/tipos";

interface UsuarioFila {
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
            aria-label={`Líder inmediato de ${usuario.nombre_completo}`}
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

          {/* El nombre con el que la persona figura en el tablero
              comercial. Se carga a mano porque no hay forma automatica de
              unir un correo de Google con un nombre completo de Odoo, y
              adivinar por parecido es como alguien termina viendo las
              ventas de otro. Vacio = no es comercial. */}
          <Entrada
            name="vendedor_planilla"
            defaultValue={usuario.vendedor_planilla ?? ""}
            placeholder="Vendedor en la planilla"
            aria-label={`Nombre de ${usuario.nombre_completo} en el tablero comercial`}
            className="h-8 w-auto min-w-[13rem] text-xs"
          />

          <SelectorCanalesDeVenta usuario={usuario} />

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

/**
 * Que ventas ve esta persona, ademas de las suyas.
 *
 * Va plegado porque son seis casillas en una fila que ya esta llena, y
 * porque la mayoria de la gente no lleva ninguna marcada. El resumen
 * dice de un vistazo si tiene algo asignado, sin tener que abrirlo.
 *
 * Los grupos son atajos: marcan y desmarcan sus canales. Lo que se
 * guarda son los canales, asi que abajo quedan sueltos para el caso
 * raro —ver Salon sin Online— sin que eso complique la base.
 */
function SelectorCanalesDeVenta({ usuario }: { usuario: UsuarioFila }) {
  const [canales, definirCanales] = React.useState<string[]>(usuario.ventas_canales ?? []);
  const veTodo = usuario.rol === "direccion";

  function alternar(canal: CanalDeVenta, marcado: boolean) {
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

  if (veTodo) {
    return (
      <span className="whitespace-nowrap text-[11px] text-atenuado-contraste">
        Ve todas las ventas (Dirección)
      </span>
    );
  }

  return (
    <details className="text-[11px]">
      <summary className="cursor-pointer whitespace-nowrap select-none">
        Ve ventas de:{" "}
        <span className="font-medium">
          {canales.length === 0
            ? "solo las suyas"
            : `${canales.length} canal${canales.length === 1 ? "" : "es"}`}
        </span>
      </summary>

      <div className="mt-1.5 rounded-md border border-borde bg-tarjeta p-2">
        {/* El formulario manda los canales, no los grupos: las casillas de
            grupo no tienen `name` a proposito. */}
        {GRUPOS_DE_CANAL.map((grupo) => {
          const completo = grupo.canales.every((c) => canales.includes(c));
          return (
            <label key={grupo.nombre} className="flex items-center gap-1.5 py-0.5 font-medium">
              <input
                type="checkbox"
                checked={completo}
                onChange={(evento) => alternarGrupo(grupo.canales, evento.target.checked)}
                className="size-3.5 accent-[#E01E37]"
              />
              {grupo.nombre}
            </label>
          );
        })}

        <div className="mt-1.5 border-t border-borde pt-1.5">
          {CANALES_DE_VENTA.map((canal) => (
            <label key={canal} className="flex items-center gap-1.5 py-0.5 text-atenuado-contraste">
              <input
                type="checkbox"
                name="ventas_canales"
                value={canal}
                checked={canales.includes(canal)}
                onChange={(evento) => alternar(canal, evento.target.checked)}
                className="size-3.5 accent-[#E01E37]"
              />
              {canal}
            </label>
          ))}
        </div>
      </div>
    </details>
  );
}
