import type { RolUsuario } from "@/lib/tipos";

/**
 * Estructura del menu. Cada entrada declara que roles la ven; la
 * restriccion real la aplican las politicas RLS de la base de datos,
 * esto solo evita mostrar lo que la persona no puede usar.
 *
 * La misma estructura alimenta las dos formas del menu: la barra
 * horizontal de pantalla grande y el cajon lateral del celular. Son dos
 * dibujos de un solo arbol, no dos menus que hay que mantener iguales.
 *
 * El segundo nivel —`subentradas`— son atajos a vistas que YA existen:
 * una pestana, un filtro, un alta. No se inventa ninguna. Un submenu que
 * lleva a una pantalla que no esta es peor que no tener submenu.
 */

export type FaseModulo = "operativo" | "en_construccion";

export interface SubentradaNavegacion {
  titulo: string;
  ruta: string;
  /** Solo para quien puede escribir: un alta no le sirve a Direccion. */
  soloGestion?: boolean;
}

export interface EntradaNavegacion {
  titulo: string;
  ruta: string;
  icono: string;
  roles?: RolUsuario[];
  fase: FaseModulo;
  /** Texto mostrado en los modulos que aun no tienen interfaz completa. */
  notaFase?: string;
  subentradas?: SubentradaNavegacion[];
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
      { titulo: "Aplicaciones", ruta: "/aplicaciones", icono: "LayoutGrid", fase: "operativo" },
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
        subentradas: [
          { titulo: "Vigentes", ruta: "/documentos?vista=vigentes" },
          { titulo: "En elaboración", ruta: "/documentos?vista=en-proceso" },
          { titulo: "Obsoletos", ruta: "/documentos?vista=obsoletos" },
          { titulo: "Por revisar", ruta: "/documentos?filtro=por-revisar" },
          { titulo: "Nuevo documento", ruta: "/documentos/nuevo", soloGestion: true },
        ],
      },
      {
        titulo: "No conformidades",
        ruta: "/no-conformidades",
        icono: "TriangleAlert",
        fase: "operativo",
        subentradas: [
          { titulo: "Todas", ruta: "/no-conformidades" },
          { titulo: "Abiertas", ruta: "/no-conformidades?estado=abiertas" },
          { titulo: "Cerradas", ruta: "/no-conformidades?estado=cerrada" },
          { titulo: "Registrar desviación", ruta: "/no-conformidades/nueva", soloGestion: true },
        ],
      },
      {
        titulo: "Riesgos y oportunidades",
        ruta: "/riesgos",
        icono: "ShieldAlert",
        fase: "operativo",
        subentradas: [
          { titulo: "Listado", ruta: "/riesgos" },
          { titulo: "Matriz 5×5", ruta: "/riesgos/matriz" },
          { titulo: "Nuevo riesgo", ruta: "/riesgos/nuevo", soloGestion: true },
        ],
      },
      {
        titulo: "Auditorías internas",
        ruta: "/auditorias",
        icono: "ClipboardCheck",
        fase: "operativo",
        subentradas: [
          { titulo: "Listado", ruta: "/auditorias" },
          { titulo: "Nueva auditoría", ruta: "/auditorias/nueva", soloGestion: true },
        ],
      },
      {
        titulo: "Indicadores y objetivos",
        ruta: "/indicadores",
        icono: "TrendingUp",
        fase: "operativo",
        subentradas: [
          { titulo: "Listado", ruta: "/indicadores" },
          { titulo: "Nuevo indicador", ruta: "/indicadores/nuevo", soloGestion: true },
        ],
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
        subentradas: [
          { titulo: "Listado", ruta: "/proveedores" },
          { titulo: "Nuevo proveedor", ruta: "/proveedores/nuevo", soloGestion: true },
        ],
      },
      {
        titulo: "Infraestructura",
        ruta: "/activos",
        icono: "Wrench",
        fase: "operativo",
        subentradas: [
          { titulo: "Listado", ruta: "/activos" },
          { titulo: "Nuevo activo", ruta: "/activos/nuevo", soloGestion: true },
        ],
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

/**
 * Filtra el menu segun el rol de la persona conectada.
 *
 * Tambien saca los atajos de alta cuando el perfil es de solo lectura:
 * ofrecerle "Nuevo documento" a Direccion es prometer un boton que la
 * pantalla despues le va a negar.
 */
export function navegacionParaRol(rol: RolUsuario): GrupoNavegacion[] {
  const puedeEscribir = rol !== "direccion";

  return NAVEGACION.map((grupo) => ({
    ...grupo,
    entradas: grupo.entradas
      .filter((entrada) => !entrada.roles || entrada.roles.includes(rol))
      .map((entrada) => ({
        ...entrada,
        subentradas: entrada.subentradas?.filter(
          (sub) => !sub.soloGestion || puedeEscribir,
        ),
      })),
  })).filter((grupo) => grupo.entradas.length > 0);
}

/** Busca la nota de fase de un modulo por su ruta. */
export function entradaPorRuta(ruta: string): EntradaNavegacion | undefined {
  return NAVEGACION.flatMap((grupo) => grupo.entradas).find((entrada) => entrada.ruta === ruta);
}
