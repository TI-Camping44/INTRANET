/**
 * Las aplicaciones que Camping 44 ya tiene publicadas.
 *
 * Catálogos, tableros, informes y formularios de pedido que hasta ahora
 * había que conocer de memoria o tener en los marcadores. La intranet no
 * los reemplaza ni los copia: los reúne y les pone nombre, que es lo que
 * faltaba.
 *
 * La lista es fija a propósito. Son enlaces que cambian poco, y una
 * pantalla de administración para eso sería más trabajo de mantener que
 * de editar este archivo. Cuando se vuelvan muchos o los tenga que
 * cambiar alguien que no toca código, pasa a una tabla.
 *
 * De dónde salen las direcciones: las de GitHub Pages se comprobaron
 * contra el repositorio —cada una tiene su `index.html`— y el título de
 * la tarjeta es el de la propia página. Las tres de solicitudes las pasó
 * Facundo: son aplicaciones de Apps Script y un formulario de Google, que
 * viven fuera de GitHub y no se pueden comprobar desde el repositorio.
 */

/** A quién le sirve, para que la lista se pueda agrupar y filtrar. */
export type PublicoAplicacion =
  | "solicitudes"
  | "comercial"
  | "operaciones"
  | "tecnologia"
  | "direccion";

export interface Aplicacion {
  nombre: string;
  descripcion: string;
  url: string;
  publico: PublicoAplicacion;
}

export const ETIQUETAS_PUBLICO: Record<PublicoAplicacion, string> = {
  solicitudes: "Solicitudes y pedidos",
  comercial: "Comercial y marketing",
  operaciones: "Operaciones",
  tecnologia: "Tecnología",
  direccion: "Dirección",
};

/**
 * El orden en que se muestran los grupos.
 *
 * Las solicitudes van primero: son lo que cualquiera de los 49 abre en el
 * día a día. Los tableros los mira mucha menos gente y mucho menos
 * seguido.
 */
export const ORDEN_PUBLICO: PublicoAplicacion[] = [
  "solicitudes",
  "comercial",
  "operaciones",
  "tecnologia",
  "direccion",
];

const BASE = "https://ti-camping44.github.io";

export const APLICACIONES: Aplicacion[] = [
  {
    nombre: "Ticket de soporte de TI",
    descripcion: "Para pedir asistencia a Informática y seguir el pedido.",
    url:
      "https://script.google.com/a/macros/camping44.com.py/s/" +
      "AKfycbz-hpHVtLbQgn0hHvQQd-BZymgT40l-kyGqdXDaJ4L0ydThZJLowx031Uzu7-ti-SqtAg/exec",
    publico: "solicitudes",
  },
  {
    nombre: "Pedido a Logística",
    descripcion: "Para pedir movimientos, retiros y entregas al área de Logística.",
    url:
      "https://script.google.com/a/macros/camping44.com.py/s/" +
      "AKfycbyJHegM7gNFwSqrK2X8wVJwtF9f0tyfS1PLMVJMA4z4q3bT2DLD9-UOsFv-Z2REyYyI/exec",
    publico: "solicitudes",
  },
  {
    nombre: "Solicitud a Marketing",
    descripcion: "Para pedir piezas, publicaciones y material de comunicación.",
    url:
      "https://script.google.com/a/macros/camping44.com.py/s/" +
      "AKfycbwFbrMH9e09811aXm1K46GDSON1sNbUdddW21P8A4cSv7AzjKq3Ly04QnILaYnQ1Iewvw/exec",
    publico: "solicitudes",
  },
  {
    nombre: "Solicitud a Administración",
    descripcion: "Para los pedidos que resuelve Administración.",
    url:
      "https://script.google.com/a/macros/camping44.com.py/s/" +
      "AKfycbwDT73kTk3SXL_h4Df73t23RjbwtWRUURfXZ5jGQIdX6wZ_zKIh7xDB4IM3A8DKdMEH/exec",
    publico: "solicitudes",
  },
  {
    nombre: "Solicitud de compra interna",
    descripcion: "Para pedir la compra de insumos o equipamiento del área.",
    url:
      "https://docs.google.com/forms/d/e/" +
      "1FAIpQLSfiaCoYHde68BDDM8KEiVmoP9WmV9nm2M_e-fZbu1CgapUDPQ/viewform",
    publico: "solicitudes",
  },
  {
    nombre: "Catálogo mayorista",
    descripcion: "El catálogo para clientes mayoristas, con precios y disponibilidad.",
    url: `${BASE}/CATALOGO-ODOO/`,
    publico: "comercial",
  },
  {
    nombre: "Catálogo de salón",
    descripcion: "El catálogo para la venta en salón y consumidor final.",
    url: `${BASE}/CATALOGO-MINORISTA/`,
    publico: "comercial",
  },
  {
    nombre: "Tablero comercial",
    descripcion: "Ventas del año contra el anterior, por línea y por vendedor.",
    url: `${BASE}/INFORMEVENTASC44/`,
    publico: "comercial",
  },
  {
    nombre: "Informe de ventas · Vitálica",
    descripcion: "El mismo informe, para la operación de Vitálica.",
    url: `${BASE}/INFORMEVENTASVITALICA/`,
    publico: "comercial",
  },
  {
    nombre: "Panel de NPS",
    descripcion:
      "La medición de satisfacción que lleva Marketing. Es la fuente de " +
      "Satisfacción del cliente en esta intranet.",
    url: `${BASE}/NPS-REPORTE/`,
    publico: "comercial",
  },
  {
    nombre: "Stock y rotación",
    descripcion:
      "Clasificación ABC de productos por rotación. Es el objetivo de " +
      "Gestión de demanda del Plan Estratégico 2026.",
    url: `${BASE}/ROTACIONABC/`,
    publico: "operaciones",
  },
  {
    nombre: "Gestión regulatoria",
    descripcion: "Seguimiento de las gestiones ante DIGEMABEL.",
    url: `${BASE}/GESTIONREGULATORIA/`,
    publico: "operaciones",
  },
  {
    nombre: "Tablero de tickets de TI",
    descripcion: "Los pedidos de soporte informático ya cargados y su estado.",
    url: `${BASE}/Dashboard-tickets-it/`,
    publico: "tecnologia",
  },
  {
    nombre: "Gestión y soporte de TI",
    descripcion: "El informe de la operación de tecnología.",
    url: `${BASE}/INFORME/`,
    publico: "tecnologia",
  },
  {
    nombre: "Reporte de gestión de TI",
    descripcion: "La planificación y el avance del área de tecnología.",
    url: `${BASE}/Planificacion/`,
    publico: "tecnologia",
  },
];

/** Las aplicaciones agrupadas por público, en el orden de presentación. */
export function agruparAplicaciones(): { publico: PublicoAplicacion; aplicaciones: Aplicacion[] }[] {
  return ORDEN_PUBLICO.map((publico) => ({
    publico,
    aplicaciones: APLICACIONES.filter((a) => a.publico === publico),
  })).filter((grupo) => grupo.aplicaciones.length > 0);
}
