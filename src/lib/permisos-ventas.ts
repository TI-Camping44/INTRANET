import type { RolUsuario } from "@/lib/tipos";

/**
 * Quien puede ver las ventas de quien.
 *
 * Por defecto cada comercial ve LO SUYO Y NADA MAS. Un jefe ve ademas el
 * detalle, vendedor por vendedor, de los canales que tenga asignados.
 *
 * SE CONFIGURA POR CANAL Y NO POR JERARQUIA. `usuarios.superior_id` ya
 * existe, pero solo dos de cuarenta y nueve personas entraron al sistema,
 * asi que casi nadie tiene su lider cargado y un permiso que dependiera de
 * eso no funcionaria para nadie. El canal, en cambio, es lo que define la
 * propia planilla: con configurar a los jefes alcanza.
 *
 * SE GUARDAN LOS CANALES, NO LOS GRUPOS. Los grupos son un atajo de la
 * pantalla de configuracion —Comercial piensa en «Consumidor Final»— pero
 * lo que se guarda son los canales sueltos. Asi, el dia que alguien tenga
 * que ver Salon sin Online, se marca y listo, sin cambiar la base.
 */

/** Los canales tal como los nombra la planilla. */
export const CANALES_DE_VENTA = [
  "Salon",
  "Online",
  "Venta Externa",
  "E-commerce",
  "Mayoristas",
  "Directorio",
] as const;

export type CanalDeVenta = (typeof CANALES_DE_VENTA)[number];

/**
 * Los grupos con los que trabaja Comercial, para la pantalla de
 * configuracion. Marcar el grupo marca sus canales.
 */
export const GRUPOS_DE_CANAL: { nombre: string; canales: CanalDeVenta[] }[] = [
  {
    nombre: "Consumidor Final",
    canales: ["Salon", "Online", "Venta Externa", "E-commerce"],
  },
  { nombre: "Mayoristas", canales: ["Mayoristas"] },
  { nombre: "Directorio", canales: ["Directorio"] },
];

export function esCanalDeVenta(valor: string): valor is CanalDeVenta {
  return (CANALES_DE_VENTA as readonly string[]).includes(valor);
}

/**
 * Los canales cuyo detalle puede ver esta persona.
 *
 * DIRECCION VE TODO, sin configurar nada: es el punto del rol. El
 * Administrador SGC NO entra en esa excepcion —administrar el sistema no
 * es motivo para ver cuanto vende cada uno—, pero puede asignarselo a
 * mano, que al menos queda a la vista de quien mire la configuracion.
 *
 * Devolver siempre la lista completa para Direccion, en vez de un valor
 * especial, evita que cada pantalla tenga que acordarse del caso.
 */
export function canalesVisiblesPara(
  rol: RolUsuario,
  canalesAsignados: string[] | null,
): CanalDeVenta[] {
  if (rol === "direccion") return [...CANALES_DE_VENTA];
  return (canalesAsignados ?? []).filter(esCanalDeVenta);
}

/** Si esta persona ve algo mas que su propia fila. */
export function esJefeDeVentas(rol: RolUsuario, canalesAsignados: string[] | null): boolean {
  return canalesVisiblesPara(rol, canalesAsignados).length > 0;
}
