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
  /**
   * Restringe el atajo a roles concretos.
   *
   * Es mas estrecho que `soloGestion`, que solo saca a Direccion. El alta
   * de documentos, por ejemplo, la hace unicamente el Administrador SGC:
   * ofrecersela a un colaborador es prometer un boton que la pantalla
   * despues le niega. El control real sigue estando en RLS.
   */
  roles?: RolUsuario[];
}

export interface EntradaNavegacion {
  titulo: string;
  ruta: string;
  icono: string;
  roles?: RolUsuario[];
  fase: FaseModulo;
  /** Texto mostrado en los modulos que aun no tienen interfaz completa. */
  notaFase?: string;
  /** Se muestra solo a quien esta vinculado al informe comercial. */
  soloComerciales?: boolean;
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
      {
        // Solo la ve quien esta vinculado al informe comercial. No es un
        // control de acceso —la pantalla vuelve a comprobarlo, y el dato
        // se filtra en el servidor— es para no ofrecerle a cuarenta
        // personas una pantalla que les va a decir «usted no es
        // comercial».
        titulo: "Mis ventas",
        ruta: "/mis-ventas",
        icono: "TrendingUp",
        fase: "operativo",
        soloComerciales: true,
      },
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
        // Cuatro atajos, con la misma forma que los demas modulos: el
        // listado entero, los dos cortes que la gente pide, y el alta.
        // «En elaboracion» y «Por revisar» son vistas de trabajo de
        // Calidad, que las tiene igual dentro del modulo.
        subentradas: [
          { titulo: "Todos", ruta: "/documentos" },
          { titulo: "Vigentes", ruta: "/documentos?vista=vigentes" },
          { titulo: "Obsoletos", ruta: "/documentos?vista=obsoletos" },
          {
            titulo: "+ Nuevo Documento",
            ruta: "/documentos/nuevo",
            roles: ["administrador_sgc"],
          },
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
          {
            titulo: "+ Nueva No Conformidad",
            ruta: "/no-conformidades/nueva",
            soloGestion: true,
          },
        ],
      },
      {
        // Va pegado a No conformidades a proposito: un cambio que sale
        // mal termina en una accion correctiva, y una accion correctiva
        // eficaz suele terminar en un cambio. Se leen juntos.
        titulo: "Planificación y Gestión de Cambios",
        ruta: "/cambios",
        icono: "GitBranch",
        fase: "operativo",
        subentradas: [
          { titulo: "Todos", ruta: "/cambios" },
          { titulo: "En aprobación", ruta: "/cambios?vista=aprobacion" },
          { titulo: "Seguimiento vencido", ruta: "/cambios?vista=vencidos" },
          { titulo: "+ Nuevo Cambio", ruta: "/cambios/nuevo", soloGestion: true },
        ],
      },
      {
        // Las acciones viven dentro de su no conformidad, pero la
        // pregunta «que esta pendiente y quien lo debe» no se contesta
        // abriendo quince fichas. Por eso tienen listado propio.
        titulo: "Acciones correctivas",
        ruta: "/acciones",
        icono: "ListChecks",
        fase: "operativo",
        // Los mismos cuatro atajos que no conformidades, y por la misma
        // razon: el menu contesta «donde esta el listado» y «como cargo
        // una». «Vencidas» y «A mi cargo» son cortes de trabajo, y estan
        // igual en los filtros del listado.
        subentradas: [
          { titulo: "Todas", ruta: "/acciones" },
          { titulo: "Abiertas", ruta: "/acciones?estado=abierta" },
          { titulo: "Cerradas", ruta: "/acciones?estado=ejecutada" },
          {
            titulo: "+ Nueva Acción Correctiva",
            ruta: "/acciones/nueva",
            soloGestion: true,
          },
        ],
      },
      {
        // Riesgos y oportunidades se separan porque no se valoran igual:
        // unos por Probabilidad x Severidad, las otras por Beneficio x
        // Factibilidad. Es lo que fija el instructivo de Calidad.
        titulo: "Riesgos y oportunidades",
        ruta: "/riesgos",
        icono: "ShieldAlert",
        fase: "operativo",
        subentradas: [
          { titulo: "Riesgos", ruta: "/riesgos" },
          { titulo: "Oportunidades", ruta: "/oportunidades" },
          { titulo: "Matriz 5×5", ruta: "/riesgos/matriz" },
          { titulo: "+ Nuevo riesgo", ruta: "/riesgos/nuevo", soloGestion: true },
          { titulo: "+ Nueva oportunidad", ruta: "/oportunidades/nueva", soloGestion: true },
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
export function navegacionParaRol(
  rol: RolUsuario,
  opciones: { esComercial?: boolean } = {},
): GrupoNavegacion[] {
  const puedeEscribir = rol !== "direccion";

  return NAVEGACION.map((grupo) => ({
    ...grupo,
    entradas: grupo.entradas
      .filter((entrada) => !entrada.soloComerciales || opciones.esComercial === true)
      .filter((entrada) => !entrada.roles || entrada.roles.includes(rol))
      .map((entrada) => ({
        ...entrada,
        subentradas: entrada.subentradas?.filter(
          (sub) =>
            (!sub.soloGestion || puedeEscribir) && (!sub.roles || sub.roles.includes(rol)),
        ),
      })),
  })).filter((grupo) => grupo.entradas.length > 0);
}

/** Busca la nota de fase de un modulo por su ruta. */
export function entradaPorRuta(ruta: string): EntradaNavegacion | undefined {
  return NAVEGACION.flatMap((grupo) => grupo.entradas).find((entrada) => entrada.ruta === ruta);
}
