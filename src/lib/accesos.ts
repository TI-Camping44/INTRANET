/**
 * La matriz de accesos por puesto (NC-2026-019).
 *
 * Qué recibe cada puesto en cada sistema. Viven acá —y no en
 * `acciones.ts`— las listas que comparten la pantalla y la acción de
 * servidor, y tienen que coincidir con los `CHECK` de
 * `accesos_por_puesto` en la base: si se agrega un nivel, va en los dos
 * lados.
 */

export type NivelAcceso =
  | "sin_acceso"
  | "solo_lectura"
  | "usuario"
  | "facturacion"
  | "responsable"
  | "administrador";

export const ETIQUETAS_NIVEL: Record<NivelAcceso, string> = {
  sin_acceso: "Sin acceso",
  solo_lectura: "Solo lectura",
  usuario: "Usuario",
  facturacion: "Facturación",
  responsable: "Responsable",
  administrador: "Administrador",
};

/** Abreviatura para la celda de la matriz, que es angosta. */
export const ABREVIATURA_NIVEL: Record<NivelAcceso, string> = {
  sin_acceso: "—",
  solo_lectura: "Lect.",
  usuario: "Us.",
  facturacion: "Fact.",
  responsable: "Resp.",
  administrador: "Adm.",
};

/** Cuánto pesa cada nivel: sirve para pintar la celda de más a menos. */
export const PESO_NIVEL: Record<NivelAcceso, number> = {
  sin_acceso: 0,
  solo_lectura: 1,
  usuario: 2,
  facturacion: 3,
  responsable: 4,
  administrador: 5,
};

export type ColumnaOdoo =
  | "odoo_ventas"
  | "odoo_inventario"
  | "odoo_compras"
  | "odoo_contabilidad"
  | "odoo_empleados"
  | "odoo_nomina"
  | "odoo_flota"
  | "odoo_reparaciones";

export interface ModuloOdoo {
  columna: ColumnaOdoo;
  nombre: string;
  /** Los niveles que tiene ese módulo en Odoo: no todos tienen los mismos. */
  niveles: NivelAcceso[];
  /** Qué significa cada nivel, en palabras, para quien valida la matriz. */
  ayuda: string;
}

/**
 * Los módulos de Odoo que usa la empresa, con los grupos de acceso que
 * ofrece cada uno. Nómina y Empleados van separados de los demás a
 * propósito: son los que abren sueldos y legajos.
 */
export const MODULOS_ODOO: ModuloOdoo[] = [
  {
    columna: "odoo_ventas",
    nombre: "Ventas",
    niveles: ["sin_acceso", "usuario", "responsable", "administrador"],
    ayuda: "Usuario: sus propios documentos · Responsable: todos los documentos.",
  },
  {
    columna: "odoo_inventario",
    nombre: "Inventario",
    niveles: ["sin_acceso", "usuario", "administrador"],
    ayuda: "Usuario: opera movimientos · Administrador: configura almacenes y reglas.",
  },
  {
    columna: "odoo_compras",
    nombre: "Compras",
    niveles: ["sin_acceso", "usuario", "administrador"],
    ayuda: "Usuario: carga pedidos · Administrador: aprueba y configura.",
  },
  {
    columna: "odoo_contabilidad",
    nombre: "Contabilidad",
    niveles: ["sin_acceso", "solo_lectura", "facturacion", "responsable", "administrador"],
    ayuda: "Facturación: emite facturas y cobros · Responsable: contabilidad completa.",
  },
  {
    columna: "odoo_empleados",
    nombre: "Empleados",
    niveles: ["sin_acceso", "responsable", "administrador"],
    ayuda: "Abre los legajos del personal.",
  },
  {
    columna: "odoo_nomina",
    nombre: "Nómina",
    niveles: ["sin_acceso", "responsable", "administrador"],
    ayuda: "Abre los sueldos. Solo Capital Humano y la Gerencia.",
  },
  {
    columna: "odoo_flota",
    nombre: "Flota",
    niveles: ["sin_acceso", "responsable", "administrador"],
    ayuda: "Vehículos, mantenimientos y combustible.",
  },
  {
    columna: "odoo_reparaciones",
    nombre: "Reparaciones",
    niveles: ["sin_acceso", "usuario", "administrador"],
    ayuda: "Órdenes del taller de armería (MP-MIS-07).",
  },
];

export const EMPRESAS_ODOO = ["camping44", "vitalica", "ambas"] as const;
export type EmpresaOdoo = (typeof EMPRESAS_ODOO)[number];

export const ETIQUETAS_EMPRESA_ODOO: Record<EmpresaOdoo, string> = {
  camping44: "Camping 44",
  vitalica: "Vitalica",
  ambas: "Camping 44 y Vitalica",
};

export const ESTADOS_MATRIZ = ["propuesta", "validada"] as const;
export type EstadoMatriz = (typeof ESTADOS_MATRIZ)[number];


export function esNivelDeModulo(modulo: ModuloOdoo, valor: string): valor is NivelAcceso {
  return (modulo.niveles as string[]).includes(valor);
}

export function esEmpresaOdoo(valor: string): valor is EmpresaOdoo {
  return (EMPRESAS_ODOO as readonly string[]).includes(valor);
}

/** Los módulos que dan acceso a datos del personal: sueldos y legajos. */
export const COLUMNAS_SENSIBLES: ColumnaOdoo[] = ["odoo_nomina", "odoo_empleados"];
