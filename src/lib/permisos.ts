import type { RolUsuario } from "@/lib/tipos";

/**
 * Catálogo de módulos y permisos por rol.
 *
 * HASTA ACÁ LOS PERMISOS ESTABAN ESCRITOS EN EL CÓDIGO: las políticas
 * RLS nombraban al rol y el menú tenía su propia lista. Para cambiar
 * quién ve qué había que tocar SQL y desplegar. Ahora la matriz es una
 * fila de `permisos`, se edita desde Configuraciones y la leen los dos
 * lados: las políticas de la base y el menú.
 *
 * **Las claves de acá son las mismas que el `CHECK` de `permisos` en la
 * base.** Si se agrega un módulo, se agrega en los dos lados; si no, la
 * pantalla ofrece una casilla que la base rechaza.
 *
 * El control real sigue estando en RLS. Esto decide qué se dibuja; la
 * base decide qué se puede leer y escribir, y es la que manda.
 */

export const CLAVES_MODULO = [
  // Intranet
  "inicio",
  "directorio",
  "aplicaciones",
  "mis_ventas",
  // Calidad · SGC
  "panel",
  "documentos",
  "riesgos",
  "objetivos",
  "auditorias",
  "cambios",
  "no_conformidades",
  "acciones",
  "reclamos",
  "satisfaccion",
  "activos",
  "personas",
  "proveedores",
  // Configuraciones
  "usuarios",
  "padron",
  "ingresos",
  "bitacora",
] as const;

export type ClaveModulo = (typeof CLAVES_MODULO)[number];

export type GrupoModulo = "Intranet" | "Calidad · SGC" | "Configuraciones";

export interface Modulo {
  clave: ClaveModulo;
  nombre: string;
  grupo: GrupoModulo;
  /**
   * Qué habilita «editar» en este módulo. Va en la pantalla de
   * permisos: una casilla que no dice qué habilita se marca a ciegas.
   */
  queEsEditar: string;
}

export const MODULOS: Modulo[] = [
  {
    clave: "inicio",
    nombre: "Inicio",
    grupo: "Intranet",
    queEsEditar: "Publicar en el muro y fijar publicaciones.",
  },
  {
    clave: "directorio",
    nombre: "Directorio y organigrama",
    grupo: "Intranet",
    queEsEditar: "Mover el organigrama y corregir la línea de reporte.",
  },
  {
    clave: "aplicaciones",
    nombre: "Aplicaciones",
    grupo: "Intranet",
    queEsEditar: "No aplica: es una lista de enlaces.",
  },
  {
    clave: "mis_ventas",
    nombre: "Mis ventas",
    grupo: "Intranet",
    queEsEditar: "No aplica: el informe se lee, no se carga acá.",
  },
  {
    clave: "panel",
    nombre: "Panel de calidad",
    grupo: "Calidad · SGC",
    queEsEditar: "No aplica: el panel resume lo que hay en los módulos.",
  },
  {
    clave: "documentos",
    nombre: "Información documentada",
    grupo: "Calidad · SGC",
    queEsEditar: "Cargar documentos y moverlos por el circuito de validación.",
  },
  {
    clave: "riesgos",
    nombre: "Riesgos y oportunidades",
    grupo: "Calidad · SGC",
    queEsEditar: "Cargar riesgos y oportunidades, y sus acciones de tratamiento.",
  },
  {
    clave: "objetivos",
    nombre: "Objetivos e indicadores",
    grupo: "Calidad · SGC",
    queEsEditar: "Cargar objetivos, su plan y las mediciones del calendario.",
  },
  {
    clave: "auditorias",
    nombre: "Auditorías internas",
    grupo: "Calidad · SGC",
    queEsEditar: "Planificar auditorías y llevar su ejecución.",
  },
  {
    clave: "cambios",
    nombre: "Planificación y gestión de cambios",
    grupo: "Calidad · SGC",
    queEsEditar: "Registrar cambios y llevarlos por su aprobación.",
  },
  {
    clave: "no_conformidades",
    nombre: "No conformidades",
    grupo: "Calidad · SGC",
    queEsEditar: "Levantar no conformidades y cargar la causa raíz.",
  },
  {
    clave: "acciones",
    nombre: "Acciones correctivas",
    grupo: "Calidad · SGC",
    queEsEditar: "Cargar acciones y verificar su eficacia.",
  },
  {
    clave: "reclamos",
    nombre: "Reclamos de clientes",
    grupo: "Calidad · SGC",
    queEsEditar: "Registrar reclamos y llevar el caso.",
  },
  {
    clave: "satisfaccion",
    nombre: "Satisfacción del cliente",
    grupo: "Calidad · SGC",
    queEsEditar: "Cargar encuestas y respuestas de NPS.",
  },
  {
    clave: "activos",
    nombre: "Infraestructura y activos",
    grupo: "Calidad · SGC",
    queEsEditar: "Cargar activos y registrar mantenimientos.",
  },
  {
    clave: "personas",
    nombre: "Personas",
    grupo: "Calidad · SGC",
    queEsEditar: "Perfiles de puesto, competencias y acciones de formación.",
  },
  {
    clave: "proveedores",
    nombre: "Asociados de negocio",
    grupo: "Calidad · SGC",
    queEsEditar: "Cargar asociados y registrar sus evaluaciones.",
  },
  {
    clave: "usuarios",
    nombre: "Usuarios y roles",
    grupo: "Configuraciones",
    queEsEditar: "Cambiar el rol, el líder y el estado de una persona.",
  },
  {
    clave: "padron",
    nombre: "Padrón de la nómina",
    grupo: "Configuraciones",
    queEsEditar: "No aplica: el padrón se corrige en Odoo y se vuelve a cargar.",
  },
  {
    clave: "ingresos",
    nombre: "Ingresos al sistema",
    grupo: "Configuraciones",
    queEsEditar: "No aplica: el historial lo escribe un disparador.",
  },
  {
    clave: "bitacora",
    nombre: "Bitácora",
    grupo: "Configuraciones",
    queEsEditar: "No aplica: la bitácora no se edita, es el registro de auditoría.",
  },
];

export const GRUPOS_MODULO: GrupoModulo[] = ["Intranet", "Calidad · SGC", "Configuraciones"];

export interface PermisoDeModulo {
  ver: boolean;
  editar: boolean;
}

/** Lo que ve y edita un rol, módulo por módulo. */
export type PermisosDelRol = Record<ClaveModulo, PermisoDeModulo>;

const NINGUNO: PermisoDeModulo = { ver: false, editar: false };
const TODO: PermisoDeModulo = { ver: true, editar: true };

/** Matriz vacía, para completar con lo que devuelva la base. */
export function permisosVacios(): PermisosDelRol {
  return Object.fromEntries(
    CLAVES_MODULO.map((clave) => [clave, { ...NINGUNO }]),
  ) as PermisosDelRol;
}

/**
 * El piso del Administrador SGC.
 *
 * NO SE PUEDE QUITAR, ni desde la pantalla ni desde la base: una matriz
 * configurable permite dejar al sistema sin nadie capaz de entrar a
 * arreglarla. Las funciones `puede_ver()` y `puede_editar()` de la base
 * cortan antes de consultar la tabla cuando el rol es este, así que la
 * fila del Administrador no se consulta nunca.
 */
export function permisosDelAdministrador(): PermisosDelRol {
  return Object.fromEntries(
    CLAVES_MODULO.map((clave) => [clave, { ...TODO }]),
  ) as PermisosDelRol;
}

export const ROL_SIEMPRE_COMPLETO: RolUsuario = "administrador_sgc";

/** Si el rol conserva todo por diseño, la fila guardada no se mira. */
export function rolConPisoCompleto(rol: RolUsuario): boolean {
  return rol === ROL_SIEMPRE_COMPLETO;
}

/** El módulo, por su clave. */
export function moduloPorClave(clave: string): Modulo | undefined {
  return MODULOS.find((modulo) => modulo.clave === clave);
}

/** Si la clave es de un módulo conocido. Lo que llega del formulario no lo es por venir. */
export function esClaveDeModulo(valor: string): valor is ClaveModulo {
  return (CLAVES_MODULO as readonly string[]).includes(valor);
}
