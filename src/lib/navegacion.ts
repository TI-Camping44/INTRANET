import type { RolUsuario } from "@/lib/tipos";

/**
 * Estructura del menu lateral. Cada entrada declara que roles la ven;
 * la restriccion real la aplican las politicas RLS de la base de datos,
 * esto solo evita mostrar lo que la persona no puede usar.
 */

export type FaseModulo = "operativo" | "en_construccion";

export interface EntradaNavegacion {
  titulo: string;
  ruta: string;
  icono: string;
  roles?: RolUsuario[];
  fase: FaseModulo;
  /** Texto mostrado en los modulos que aun no tienen interfaz completa. */
  notaFase?: string;
}

export interface GrupoNavegacion {
  titulo: string;
  entradas: EntradaNavegacion[];
}

export const NAVEGACION: GrupoNavegacion[] = [
  {
    titulo: "Intranet",
    entradas: [
      { titulo: "Inicio", ruta: "/inicio", icono: "Home", fase: "operativo" },
      { titulo: "Directorio", ruta: "/directorio", icono: "Contact", fase: "operativo" },
      { titulo: "Buscar", ruta: "/buscar", icono: "Search", fase: "operativo" },
    ],
  },
  {
    titulo: "Calidad · SGC",
    entradas: [
      { titulo: "Panel de calidad", ruta: "/panel", icono: "LayoutDashboard", fase: "operativo" },
      {
        titulo: "Documentación",
        ruta: "/documentos",
        icono: "FileText",
        fase: "operativo",
      },
      {
        titulo: "No conformidades",
        ruta: "/no-conformidades",
        icono: "TriangleAlert",
        fase: "operativo",
      },
      {
        titulo: "Riesgos y oportunidades",
        ruta: "/riesgos",
        icono: "ShieldAlert",
        fase: "operativo",
      },
      {
        titulo: "Auditorías internas",
        ruta: "/auditorias",
        icono: "ClipboardCheck",
        fase: "operativo",
      },
      {
        titulo: "Indicadores y objetivos",
        ruta: "/indicadores",
        icono: "TrendingUp",
        fase: "operativo",
      },
      {
        titulo: "Satisfacción del cliente",
        ruta: "/satisfaccion",
        icono: "Smile",
        fase: "operativo",
      },
      {
        titulo: "Recursos humanos",
        ruta: "/recursos-humanos",
        icono: "Users",
        fase: "operativo",
      },
      {
        titulo: "Proveedores",
        ruta: "/proveedores",
        icono: "Truck",
        fase: "operativo",
      },
      {
        titulo: "Infraestructura",
        ruta: "/activos",
        icono: "Wrench",
        fase: "operativo",
      },
    ],
  },
  {
    titulo: "Administración",
    entradas: [
      {
        titulo: "Usuarios y roles",
        ruta: "/administracion/usuarios",
        icono: "UserCog",
        roles: ["administrador_sgc"],
        fase: "operativo",
      },
      {
        titulo: "Bitácora",
        ruta: "/bitacora",
        icono: "History",
        roles: ["administrador_sgc", "auditor", "direccion"],
        fase: "operativo",
      },
    ],
  },
];

/** Filtra el menu segun el rol de la persona conectada. */
export function navegacionParaRol(rol: RolUsuario): GrupoNavegacion[] {
  return NAVEGACION.map((grupo) => ({
    ...grupo,
    entradas: grupo.entradas.filter((entrada) => !entrada.roles || entrada.roles.includes(rol)),
  })).filter((grupo) => grupo.entradas.length > 0);
}

/** Busca la nota de fase de un modulo por su ruta. */
export function entradaPorRuta(ruta: string): EntradaNavegacion | undefined {
  return NAVEGACION.flatMap((grupo) => grupo.entradas).find((entrada) => entrada.ruta === ruta);
}
