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
  /**
   * El modulo no tiene pantalla propia: su ruta redirige a uno de sus
   * submodulos. Sin esto, el menu agrega un «Ir a X» que lleva al mismo
   * lugar que la primera subentrada, y quedan dos lineas para el mismo
   * destino.
   */
  sinPantallaPropia?: boolean;
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
      // La busqueda NO va en la barra: ya esta el campo de arriba, que
      // lleva a la misma pantalla. Dos accesos al mismo lugar, uno al
      // lado del otro, se leen como dos cosas distintas.
      // `/buscar` sigue existiendo: es adonde escribe el campo.
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
    // EL ORDEN LO FIJO CALIDAD y no es alfabetico ni historico: baja por
    // el ciclo del sistema de gestion. Primero donde se mira el estado
    // (Panel), despues lo que lo sostiene (informacion documentada,
    // riesgos, objetivos), despues como se controla (auditoria, cambios)
    // y por ultimo lo que sale mal y como se trata (no conformidades,
    // acciones, reclamos). Al final los modulos de soporte.
    //
    // Satisfaccion del cliente salio de aca: es el NPS, lo lleva
    // Marketing, y ya esta publicado en Aplicaciones como «Panel de NPS».
    // La pantalla /satisfaccion sigue existiendo y se llega por ahi.
    entradas: [
      { titulo: "Panel de calidad", ruta: "/panel", icono: "LayoutDashboard", fase: "operativo" },
      {
        titulo: "Información documentada",
        ruta: "/documentos",
        icono: "FileText",
        fase: "operativo",
        subentradas: [
          { titulo: "Todos", ruta: "/documentos" },
          {
            titulo: "+ Nuevo Documento",
            ruta: "/documentos/nuevo",
            roles: ["administrador_sgc"],
          },
        ],
      },
      {
        titulo: "Riesgos y Oportunidades",
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
        titulo: "Objetivos e Indicadores",
        ruta: "/indicadores",
        icono: "TrendingUp",
        fase: "operativo",
        subentradas: [
          { titulo: "Listado", ruta: "/indicadores" },
          // La hoja 6.2.2 es otro formulario de Calidad —el F-EST-01-06—
          // y tiene una fila por accion, no por indicador: va en su
          // propia pantalla.
          { titulo: "Plan de Objetivos", ruta: "/indicadores/plan" },
          { titulo: "Nuevo indicador", ruta: "/indicadores/nuevo", soloGestion: true },
        ],
      },
      {
        titulo: "Auditoría",
        ruta: "/auditorias",
        icono: "ClipboardCheck",
        fase: "operativo",
        subentradas: [
          { titulo: "Todos", ruta: "/auditorias" },
          { titulo: "+ Nueva auditoría", ruta: "/auditorias/nueva", soloGestion: true },
        ],
      },
      {
        titulo: "Planificación y Gestión de Cambios",
        ruta: "/cambios",
        icono: "GitBranch",
        fase: "operativo",
        subentradas: [
          { titulo: "Todos", ruta: "/cambios" },
          { titulo: "+ Nuevo Cambio", ruta: "/cambios/nuevo", soloGestion: true },
        ],
      },
      {
        titulo: "No Conformidades",
        ruta: "/no-conformidades",
        icono: "TriangleAlert",
        fase: "operativo",
        subentradas: [
          { titulo: "Todos", ruta: "/no-conformidades" },
          {
            titulo: "+ Nueva No Conformidad",
            ruta: "/no-conformidades/nueva",
            soloGestion: true,
          },
        ],
      },
      {
        // Va pegada a No Conformidades: las acciones viven dentro de su
        // desviacion, pero la pregunta «que esta pendiente y quien lo
        // debe» no se contesta abriendo quince fichas.
        titulo: "Acciones Correctivas",
        ruta: "/acciones",
        icono: "ListChecks",
        fase: "operativo",
        subentradas: [
          { titulo: "Todos", ruta: "/acciones" },
          {
            titulo: "+ Nueva Acción Correctiva",
            ruta: "/acciones/nueva",
            soloGestion: true,
          },
        ],
      },
      {
        titulo: "Reclamos de Clientes",
        ruta: "/reclamos",
        icono: "MessageSquareWarning",
        fase: "operativo",
        subentradas: [
          { titulo: "Abiertos", ruta: "/reclamos" },
          { titulo: "Fuera de plazo", ruta: "/reclamos?vista=plazo" },
          { titulo: "Cerrados", ruta: "/reclamos?vista=cerrados" },
          { titulo: "+ Nuevo Reclamo", ruta: "/reclamos/nuevo", soloGestion: true },
        ],
      },
      {
        titulo: "Infraestructura y Tecnología",
        ruta: "/activos",
        icono: "Wrench",
        fase: "operativo",
        // Edilicios y tecnologicos se llevan por separado desde el 6
        // de octubre. Son dos cortes del mismo inventario, no dos
        // tablas: comparten el calendario de mantenimientos y el
        // historial.
        subentradas: [
          { titulo: "Todos", ruta: "/activos" },
          { titulo: "Activos Edilicios", ruta: "/activos?clase=edilicio" },
          { titulo: "Activos Tecnológicos", ruta: "/activos?clase=tecnologico" },
          {
            titulo: "+ Nuevo Activo Edilicio",
            ruta: "/activos/nuevo?clase=edilicio",
            soloGestion: true,
          },
          {
            titulo: "+ Nuevo Activo Tecnológico",
            ruta: "/activos/nuevo?clase=tecnologico",
            soloGestion: true,
          },
        ],
      },
      {
        titulo: "Personas",
        ruta: "/recursos-humanos",
        icono: "Users",
        fase: "operativo",
        // Dos submodulos, como lo pidio Direccion el 5 de octubre. El
        // perfil de puesto es documental —el puesto y su PDF firmado— y
        // la formacion es un plan anual con su calendario: no comparten
        // ni una pantalla ni un criterio.
        // `/recursos-humanos` solo redirige a los puestos, asi que un
        // «Ir a Personas» seria la misma linea dos veces.
        sinPantallaPropia: true,
        subentradas: [
          { titulo: "Perfil de Resultados de Puesto", ruta: "/recursos-humanos/puestos" },
          { titulo: "Formación y Competencia", ruta: "/recursos-humanos/formacion" },
          // El alta de las dos vive en un dialogo de su listado, no en
          // una pantalla propia: `?nuevo=1` lo abre al llegar.
          {
            titulo: "+ Nuevo Puesto",
            ruta: "/recursos-humanos/puestos?nuevo=1",
            soloGestion: true,
          },
          {
            titulo: "+ Nueva Formación",
            ruta: "/recursos-humanos/formacion?nuevo=1",
            soloGestion: true,
          },
        ],
      },
      {
        titulo: "Asociados de Negocio",
        ruta: "/proveedores",
        icono: "Truck",
        fase: "operativo",
        subentradas: [
          { titulo: "Todos", ruta: "/proveedores" },
          { titulo: "+ Nuevo Asociado de Negocio", ruta: "/proveedores/nuevo", soloGestion: true },
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
