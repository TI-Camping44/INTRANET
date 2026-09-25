/**
 * Planificación y Gestión de Cambios (ISO 9001:2026 · 6.3).
 *
 * LA REGLA DE FONDO, definida por Calidad: todo cambio significativo al
 * SGC se registra acá ANTES de hacerse. El módulo no existe para dejar
 * constancia de lo que ya pasó, sino para obligar a pensarlo antes:
 * qué se busca, qué puede salir mal, qué recursos hacen falta, a quién
 * hay que avisar, y cómo se va a saber si funcionó.
 *
 * LO QUE SEPARA ESTO DE UNA LISTA DE AVISOS es el indicador y el criterio
 * de éxito. Se definen antes de implementar y se revisan en una fecha
 * fijada de antemano; si el cambio falla, hay que decidir entre ajuste,
 * reversión o acción correctiva. Elegir la tercera abre una no
 * conformidad de verdad, con su número y su plazo.
 *
 * Las reglas viven acá y en la base de datos. Si cambian, cambian en los
 * dos lados.
 */

/** Los cambios que Calidad considera significativos, «como mínimo». */
export type TipoCambio =
  | "alta_proceso"
  | "baja_proceso"
  | "cambio_responsable_proceso"
  | "nueva_habilitacion"
  | "perdida_habilitacion"
  | "cambio_sistema"
  | "mudanza_deposito_local"
  | "nueva_linea_productos_controlados"
  | "cambio_normativo"
  | "otro";

export type EstadoCambio =
  | "borrador"
  | "en_aprobacion"
  | "aprobado"
  | "rechazado"
  | "implementado"
  | "cerrado";

export type ResultadoCambio = "pendiente" | "eficaz" | "no_eficaz";

export type DecisionCambio = "ajuste" | "reversion" | "accion_correctiva";

/**
 * «Como mínimo» quiere decir que la lista no se cierra: por eso está
 * `otro`. Sin esa salida, un cambio que Calidad no previó se registraría
 * mal clasificado o no se registraría.
 */
export const ETIQUETAS_TIPO_CAMBIO: Record<TipoCambio, string> = {
  alta_proceso: "Alta de un proceso",
  baja_proceso: "Baja de un proceso",
  cambio_responsable_proceso: "Cambio de responsable de un proceso",
  nueva_habilitacion: "Nueva habilitación",
  perdida_habilitacion: "Pérdida de una habilitación",
  cambio_sistema: "Cambio de sistema (ERP, Intranet)",
  mudanza_deposito_local: "Mudanza de depósito o local",
  nueva_linea_productos_controlados: "Nueva línea de productos controlados",
  cambio_normativo: "Cambio de la Ley 7411/2024 o de resoluciones de la DIGEMABEL",
  otro: "Otro cambio significativo",
};

export const TIPOS_CAMBIO: TipoCambio[] = [
  "alta_proceso",
  "baja_proceso",
  "cambio_responsable_proceso",
  "nueva_habilitacion",
  "perdida_habilitacion",
  "cambio_sistema",
  "mudanza_deposito_local",
  "nueva_linea_productos_controlados",
  "cambio_normativo",
  "otro",
];

export const ETIQUETAS_ESTADO_CAMBIO: Record<EstadoCambio, string> = {
  borrador: "Borrador",
  en_aprobacion: "En aprobación",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
  implementado: "Implementado",
  cerrado: "Cerrado",
};

export const ESTADOS_CAMBIO: EstadoCambio[] = [
  "borrador",
  "en_aprobacion",
  "aprobado",
  "rechazado",
  "implementado",
  "cerrado",
];

export const ETIQUETAS_RESULTADO_CAMBIO: Record<ResultadoCambio, string> = {
  pendiente: "Pendiente de seguimiento",
  eficaz: "Eficaz",
  no_eficaz: "No eficaz",
};

export const ETIQUETAS_DECISION_CAMBIO: Record<DecisionCambio, string> = {
  ajuste: "Ajuste",
  reversion: "Reversión",
  accion_correctiva: "Acción correctiva",
};

export const DECISIONES_CAMBIO: DecisionCambio[] = ["ajuste", "reversion", "accion_correctiva"];

/**
 * A dónde puede ir cada estado.
 *
 * SE ESCRIBE UNA VEZ Y LA USAN LOS DOS LADOS: la pantalla, para ofrecer
 * solo lo posible, y la acción de servidor, para rechazar lo demás. Sin
 * esto, el botón y la validación se irían separando con cada cambio.
 *
 * Un rechazo vuelve a borrador a propósito: la idea puede ser buena y
 * estar mal planteada, y obligar a empezar de cero perdería lo escrito.
 */
export const TRANSICIONES_CAMBIO: Record<EstadoCambio, EstadoCambio[]> = {
  borrador: ["en_aprobacion"],
  en_aprobacion: ["aprobado", "rechazado", "borrador"],
  aprobado: ["implementado"],
  rechazado: ["borrador"],
  implementado: ["cerrado"],
  cerrado: [],
};

export function puedePasarA(desde: EstadoCambio, hasta: EstadoCambio): boolean {
  return TRANSICIONES_CAMBIO[desde].includes(hasta);
}

/**
 * Colores del estado, de las variables del tema.
 *
 * Rechazado y «no eficaz» comparten el rojo del semáforo porque son la
 * misma noticia para quien mira la lista: esto no avanzó.
 */
export const CLASES_ESTADO_CAMBIO: Record<EstadoCambio, string> = {
  borrador: "text-atenuado-contraste",
  en_aprobacion: "text-semaforo-medio",
  aprobado: "text-semaforo-bajo",
  rechazado: "text-semaforo-critico",
  implementado: "text-primario",
  cerrado: "text-atenuado-contraste",
};

/**
 * Si el seguimiento está vencido.
 *
 * Un cambio implementado cuya fecha de revisión ya pasó es lo que este
 * módulo existe para que no ocurra: se implementó y nadie volvió a
 * mirarlo. La lista lo marca aparte.
 */
export function seguimientoVencido(
  estado: EstadoCambio,
  fechaRevision: string,
  hoy: Date = new Date(),
): boolean {
  if (estado !== "implementado") return false;
  // Las columnas `date` llegan como "2026-08-31" y se anclan al mediodía
  // para que en Asunción no se lean un día antes, igual que en formato.ts.
  const revision = new Date(`${fechaRevision}T12:00:00`);
  return revision.getTime() < hoy.getTime();
}

/**
 * Quién aprueba.
 *
 * El procedimiento dice «Gerencia de Área o el Directorio». La intranet
 * no tiene un rol de gerencia de departamento, así que aprueban Dirección
 * y el Administrador SGC, que es quien coordina Calidad. Si Calidad
 * quiere separarlo, se agrega un rol y se cambia acá y en la política de
 * la base; hoy sería inventar una jerarquía que el sistema no tiene.
 *
 * DIRECCIÓN ESCRIBE ACÁ aunque su perfil sea de solo lectura en el resto
 * del SGC: aprobar es justamente lo que el procedimiento le pide.
 */
export const ROLES_QUE_APRUEBAN_CAMBIOS = ["direccion", "administrador_sgc"] as const;

/**
 * Quién da seguimiento a la eficacia.
 *
 * El procedimiento nombra al «Coordinador de Auditoría, Calidad y Mejora
 * Continua», que en la intranet es el Administrador SGC. Es la misma
 * atribución que cerrar una no conformidad, y por el mismo motivo: quien
 * ejecutó el cambio no puede ser quien firma que salió bien.
 */
export const ROLES_QUE_SIGUEN_CAMBIOS = ["administrador_sgc"] as const;
