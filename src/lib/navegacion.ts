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
    titulo: "General",
    entradas: [
      { titulo: "Panel", ruta: "/panel", icono: "LayoutDashboard", fase: "operativo" },
      { titulo: "Buscar", ruta: "/buscar", icono: "Search", fase: "operativo" },
    ],
  },
  {
    titulo: "Módulos core",
    entradas: [
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
    ],
  },
  {
    titulo: "Evaluación y mejora",
    entradas: [
      {
        titulo: "Auditorías internas",
        ruta: "/auditorias",
        icono: "ClipboardCheck",
        fase: "en_construccion",
        notaFase: "Programa anual, planes y hallazgos. Interfaz prevista para septiembre de 2026.",
      },
      {
        titulo: "Indicadores y objetivos",
        ruta: "/indicadores",
        icono: "TrendingUp",
        fase: "en_construccion",
        notaFase:
          "Carga periódica, meta contra real y tendencia. Interfaz prevista para septiembre de 2026.",
      },
      {
        titulo: "Satisfacción del cliente",
        ruta: "/satisfaccion",
        icono: "Smile",
        fase: "en_construccion",
        notaFase:
          "Preparado para consumir el panel de NPS existente. Integración prevista para octubre de 2026.",
      },
    ],
  },
  {
    titulo: "Apoyo",
    entradas: [
      {
        titulo: "Recursos humanos",
        ruta: "/recursos-humanos",
        icono: "Users",
        fase: "en_construccion",
        notaFase:
          "Puestos, matriz de competencias y capacitaciones. Interfaz prevista para octubre de 2026.",
      },
      {
        titulo: "Proveedores",
        ruta: "/proveedores",
        icono: "Truck",
        fase: "en_construccion",
        notaFase: "Evaluación y reevaluación periódica. Interfaz prevista para septiembre de 2026.",
      },
      {
        titulo: "Infraestructura",
        ruta: "/activos",
        icono: "Wrench",
        fase: "en_construccion",
        notaFase:
          "Inventario y mantenimientos preventivos con calendario. Interfaz prevista para octubre de 2026.",
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
