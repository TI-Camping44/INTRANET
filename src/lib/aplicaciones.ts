/**
 * Las aplicaciones que Camping 44 ya tiene publicadas.
 *
 * Catálogos, tableros e informes que viven en GitHub Pages y que hasta
 * ahora había que conocer de memoria o tener en los marcadores. La
 * intranet no los reemplaza ni los copia: los reúne y les pone nombre,
 * que es lo que faltaba.
 *
 * La lista es fija a propósito. Son diez enlaces que cambian poco, y una
 * pantalla de administración para eso sería más trabajo de mantener que
 * de editar este archivo. Cuando se vuelvan muchos o los tenga que
 * cambiar alguien que no toca código, pasa a una tabla.
 *
 * Cada dirección se comprobó contra el repositorio: los diez tienen su
 * `index.html`, y el título de cada tarjeta es el de la propia página, no
 * uno inventado acá.
 */

/** A quién le sirve, para que la lista se pueda agrupar y filtrar. */
export type PublicoAplicacion = "comercial" | "operaciones" | "tecnologia" | "direccion";

export interface Aplicacion {
  nombre: string;
  descripcion: string;
  url: string;
  publico: PublicoAplicacion;
}

export const ETIQUETAS_PUBLICO: Record<PublicoAplicacion, string> = {
  comercial: "Comercial y marketing",
  operaciones: "Operaciones",
  tecnologia: "Tecnología",
  direccion: "Dirección",
};

/** El orden en que se muestran los grupos. */
export const ORDEN_PUBLICO: PublicoAplicacion[] = [
  "comercial",
  "operaciones",
  "tecnologia",
  "direccion",
];

const BASE = "https://ti-camping44.github.io";

export const APLICACIONES: Aplicacion[] = [
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
    nombre: "Tickets de TI",
    descripcion: "Los pedidos de soporte informático y su estado.",
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
