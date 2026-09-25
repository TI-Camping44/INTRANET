/**
 * Reclamos de Clientes (MP-EST-04, ISO 9001:2026 · 8.2.1 y 9.1.2).
 *
 * LA GRAVEDAD DEL HECHO DEFINE EL PLAN, no la intensidad del reclamo. Es
 * la primera frase del procedimiento y la que evita que el cliente que
 * grita más fuerte se lleve el mejor plan.
 *
 * DOS COSAS SUBEN EL PLAN Y NINGUNA LO BAJA: la reincidencia —segunda
 * falla al mismo cliente en seis meses— y el rechazo del cliente, que
 * escala al plan siguiente para una segunda propuesta. Por eso el plan se
 * guarda y no se deriva de la gravedad cada vez: el plan vigente puede
 * ser mayor que el que le tocaba al hecho.
 *
 * Las reglas viven acá y en la base. Si cambian, cambian en los dos lados.
 */

export type GravedadReclamo = "leve" | "real" | "grave";
export type PlanReclamo = "a" | "b" | "c";
export type EstadoReclamo =
  | "registrado"
  | "contactado"
  | "plan_definido"
  | "resuelto"
  | "cerrado"
  | "no_conciliado";
export type EstadoClienteReclamo =
  | "en_gestion"
  | "recuperado"
  | "en_observacion"
  | "perdido"
  | "no_conciliado";
export type OrigenReclamo =
  | "encuesta_nps"
  | "reclamo_directo"
  | "resena_negativa"
  | "devolucion_cambio"
  | "error_facturacion"
  | "incumplimiento_entrega"
  | "falla_servicio_tecnico"
  | "incumplimiento_condicion"
  | "queja_verbal";
export type TipoFallaReclamo =
  | "picking_despacho_entrega"
  | "facturacion_cobro_credito"
  | "tecnica_producto_garantia"
  | "tramite_regulatorio"
  | "atencion_salon_stand_instruccion"
  | "pedido_mayorista"
  | "producto_defectuoso_proveedor"
  | "otro";

export const ETIQUETAS_GRAVEDAD_RECLAMO: Record<GravedadReclamo, string> = {
  leve: "Leve",
  real: "Real",
  grave: "Grave",
};

/** Los ejemplos del procedimiento, para que quien clasifica no adivine. */
export const EJEMPLOS_GRAVEDAD_RECLAMO: Record<GravedadReclamo, string> = {
  leve: "Demora en entrega, error de comunicación, mala atención",
  real: "Artículo defectuoso, error de despacho o facturación con perjuicio económico",
  grave: "Falla de seguridad, error en material controlado, reclamo público",
};

export const GRAVEDADES_RECLAMO: GravedadReclamo[] = ["leve", "real", "grave"];

export const ETIQUETAS_PLAN_RECLAMO: Record<PlanReclamo, string> = {
  a: "Plan A · Falla leve",
  b: "Plan B · Falla real",
  c: "Plan C · Falla grave",
};

export const ETIQUETAS_ESTADO_RECLAMO: Record<EstadoReclamo, string> = {
  registrado: "Registrado",
  contactado: "Cliente contactado",
  plan_definido: "Plan definido",
  resuelto: "Resuelto",
  cerrado: "Cerrado",
  no_conciliado: "No conciliado",
};

export const ETIQUETAS_ESTADO_CLIENTE_RECLAMO: Record<EstadoClienteReclamo, string> = {
  en_gestion: "En gestión",
  recuperado: "Recuperado",
  en_observacion: "En observación",
  perdido: "Perdido",
  no_conciliado: "No conciliado",
};

export const ESTADOS_CLIENTE_FINAL: EstadoClienteReclamo[] = [
  "recuperado",
  "en_observacion",
  "perdido",
];

export const ETIQUETAS_ORIGEN_RECLAMO: Record<OrigenReclamo, string> = {
  encuesta_nps: "Mala calificación en encuesta NPS",
  reclamo_directo: "Reclamo por cualquier vía",
  resena_negativa: "Reseña negativa",
  devolucion_cambio: "Devolución o cambio por falla",
  error_facturacion: "Error de facturación",
  incumplimiento_entrega: "Incumplimiento de entrega o daño en despacho",
  falla_servicio_tecnico: "Falla de servicio técnico",
  incumplimiento_condicion: "Incumplimiento de una condición pactada",
  queja_verbal: "Queja verbal, aunque no sea formal",
};

export const ORIGENES_RECLAMO: OrigenReclamo[] = [
  "reclamo_directo",
  "encuesta_nps",
  "resena_negativa",
  "devolucion_cambio",
  "error_facturacion",
  "incumplimiento_entrega",
  "falla_servicio_tecnico",
  "incumplimiento_condicion",
  "queja_verbal",
];

/**
 * El tipo de falla y a qué responsable le corresponde.
 *
 * Es la tabla de la actividad 3 del procedimiento. El texto del
 * responsable es de referencia y no un control: el caso guarda a la
 * persona que efectivamente responde, porque los cargos del
 * procedimiento no coinciden uno a uno con los puestos cargados.
 */
export const ETIQUETAS_TIPO_FALLA: Record<TipoFallaReclamo, string> = {
  picking_despacho_entrega: "Error de picking, despacho, entrega, daño en tránsito o demora",
  facturacion_cobro_credito: "Error de facturación, cobro, crédito o nota de crédito",
  tecnica_producto_garantia: "Falla técnica del producto, reparación o garantía",
  tramite_regulatorio: "Trámite ante la DIGEMABEL, carnet, permiso o entrega de material controlado",
  atencion_salon_stand_instruccion:
    "Atención en salón, asesoramiento, stand de tiro o centro de instrucción",
  pedido_mayorista: "Pedido del canal mayorista",
  producto_defectuoso_proveedor: "Producto defectuoso de origen (proveedor)",
  otro: "Otro",
};

export const RESPONSABLE_POR_TIPO_FALLA: Record<TipoFallaReclamo, string> = {
  picking_despacho_entrega: "Jefe de Operaciones y Logística",
  facturacion_cobro_credito: "Jefe de Administración",
  tecnica_producto_garantia: "Jefe de Operaciones y Logística",
  tramite_regulatorio: "Jefe de Operaciones y Logística",
  atencion_salon_stand_instruccion: "Jefe del Canal Consumidor Final",
  pedido_mayorista: "Supervisor del Canal Mayorista",
  producto_defectuoso_proveedor: "Jefe de Operaciones y Logística",
  otro: "A definir con el gestor del caso",
};

export const TIPOS_FALLA_RECLAMO: TipoFallaReclamo[] = [
  "picking_despacho_entrega",
  "facturacion_cobro_credito",
  "tecnica_producto_garantia",
  "tramite_regulatorio",
  "atencion_salon_stand_instruccion",
  "pedido_mayorista",
  "producto_defectuoso_proveedor",
  "otro",
];

/* ------------------------------------------------------------------ */
/* Gravedad, plan y escalamiento                                       */
/* ------------------------------------------------------------------ */

const PLAN_POR_GRAVEDAD: Record<GravedadReclamo, PlanReclamo> = {
  leve: "a",
  real: "b",
  grave: "c",
};

const ORDEN_PLAN: PlanReclamo[] = ["a", "b", "c"];

/** El plan siguiente. Del C no se sube: no hay nivel superior. */
export function planSiguiente(plan: PlanReclamo): PlanReclamo {
  const indice = ORDEN_PLAN.indexOf(plan);
  return ORDEN_PLAN[Math.min(indice + 1, ORDEN_PLAN.length - 1)];
}

/**
 * El plan que le corresponde a un hecho.
 *
 * La reincidencia sube un nivel respecto del que toca por la gravedad. Si
 * el hecho ya es Grave, no hay nivel superior al que subir: lo dice el
 * procedimiento con esas palabras.
 */
export function planDelCaso(gravedad: GravedadReclamo, esReincidencia: boolean): PlanReclamo {
  const base = PLAN_POR_GRAVEDAD[gravedad];
  return esReincidencia ? planSiguiente(base) : base;
}

/** Si el plan vigente puede convivir con la gravedad: nunca por debajo. */
export function planEsCoherente(gravedad: GravedadReclamo, plan: PlanReclamo): boolean {
  return ORDEN_PLAN.indexOf(plan) >= ORDEN_PLAN.indexOf(PLAN_POR_GRAVEDAD[gravedad]);
}

/** Cuántos meses mira la reincidencia. Está también en SQL. */
export const MESES_REINCIDENCIA_RECLAMO = 6;

/**
 * El umbral del indicador mensual de reincidencia.
 *
 * Si la tasa supera este valor dos meses seguidos, se abre una no
 * conformidad. Es lo que reemplaza al análisis de causa por caso en el
 * Plan A: no se analiza cada demora, se analiza la recurrencia.
 */
export const UMBRAL_REINCIDENCIA_MENSUAL = 5;

/* ------------------------------------------------------------------ */
/* Plazos                                                              */
/* ------------------------------------------------------------------ */

/**
 * Los plazos de cada plan, en días hábiles.
 *
 * DEL PROCEDIMIENTO: primer contacto 24 h hábiles (12 en el Plan C),
 * definición del plan el mismo día / 2 días / 48 horas por escrito, y
 * resolución 3 / 7 / 15 días hábiles desde el contacto.
 *
 * «24 horas hábiles» se toma como UN día hábil y «12 horas hábiles» como
 * el mismo día. Es una interpretación: si Calidad quiere horario
 * comercial real —de 8 a 17, por ejemplo— la cuenta es otra y hay que
 * cambiarla acá.
 */
export const PLAZOS_RECLAMO: Record<
  PlanReclamo,
  { contacto: number; definicionPlan: number; resolucion: number }
> = {
  a: { contacto: 1, definicionPlan: 0, resolucion: 3 },
  b: { contacto: 1, definicionPlan: 2, resolucion: 7 },
  c: { contacto: 0, definicionPlan: 2, resolucion: 15 },
};

/** Días hábiles para ejecutar la acción correctiva en los planes B y C. */
export const DIAS_ACCION_CORRECTIVA_RECLAMO = 10;

/** Días corridos para verificar con el cliente después de cerrar un Plan C. */
export const DIAS_VERIFICACION_PLAN_C = 30;

/**
 * Suma días hábiles a una fecha.
 *
 * LUNES A SÁBADO CUENTAN, el domingo no, y no hay calendario de feriados:
 * la empresa abre los sábados y la intranet todavía no tiene los feriados
 * cargados. Es una decisión a confirmar con Calidad; está en un solo
 * lugar para que cambiarla sea cambiar esta función.
 *
 * Se cuenta en UTC a propósito: acá solo interesa el día de la semana, y
 * en hora local un cambio de horario puede correr un día.
 */
export function sumarDiasHabiles(fecha: string, dias: number): string {
  const partes = fecha.split("-").map(Number);
  let actual = Date.UTC(partes[0], partes[1] - 1, partes[2]);
  let restantes = dias;

  // Con cero días el plazo vence el mismo día, salvo que caiga domingo.
  while (restantes > 0 || new Date(actual).getUTCDay() === 0) {
    actual += 86_400_000;
    if (new Date(actual).getUTCDay() !== 0) restantes -= 1;
  }

  return new Date(actual).toISOString().slice(0, 10);
}

/** Los tres vencimientos de un caso, a partir de una fecha de arranque. */
export function vencimientosDelPlan(
  plan: PlanReclamo,
  desde: string,
): { contacto: string; definicionPlan: string; resolucion: string } {
  const plazos = PLAZOS_RECLAMO[plan];
  return {
    contacto: sumarDiasHabiles(desde, plazos.contacto),
    definicionPlan: sumarDiasHabiles(desde, plazos.contacto + plazos.definicionPlan),
    resolucion: sumarDiasHabiles(desde, plazos.contacto + plazos.resolucion),
  };
}

/** Si un vencimiento ya pasó y el paso sigue sin hacerse. */
export function vencido(limite: string, hecho: string | null, hoy: Date = new Date()): boolean {
  if (hecho) return false;
  return new Date(`${limite}T12:00:00`).getTime() < hoy.getTime();
}

/* ------------------------------------------------------------------ */
/* Ciclo del caso                                                      */
/* ------------------------------------------------------------------ */

/**
 * A dónde puede ir cada estado.
 *
 * Una sola tabla, que usan la pantalla para ofrecer y el servidor para
 * rechazar. «No conciliado» se puede alcanzar desde cualquier punto en
 * que ya se habló con el cliente: es un final, no un paso.
 */
export const TRANSICIONES_RECLAMO: Record<EstadoReclamo, EstadoReclamo[]> = {
  registrado: ["contactado"],
  contactado: ["plan_definido", "no_conciliado"],
  plan_definido: ["resuelto", "no_conciliado"],
  resuelto: ["cerrado", "no_conciliado"],
  cerrado: [],
  no_conciliado: [],
};

export function puedePasarA(desde: EstadoReclamo, hasta: EstadoReclamo): boolean {
  return TRANSICIONES_RECLAMO[desde].includes(hasta);
}

/** Desde dónde se puede registrar que el cliente rechazó la propuesta. */
export function admiteRechazo(estado: EstadoReclamo): boolean {
  return estado === "plan_definido" || estado === "resuelto";
}

/**
 * Si el caso exige acción correctiva para poder cerrarse.
 *
 * Planes B y C sí. El Plan A no: su recurrencia se detecta con el
 * indicador mensual de reincidencia, no analizando cada demora.
 */
export function exigeAccionCorrectiva(plan: PlanReclamo): boolean {
  return plan === "b" || plan === "c";
}

/** El Plan C abre una no conformidad por definición, no por decisión. */
export function exigeNoConformidad(plan: PlanReclamo): boolean {
  return plan === "c";
}

export const CLASES_ESTADO_RECLAMO: Record<EstadoReclamo, string> = {
  registrado: "text-semaforo-medio",
  contactado: "text-primario",
  plan_definido: "text-primario",
  resuelto: "text-semaforo-bajo",
  cerrado: "text-atenuado-contraste",
  no_conciliado: "text-semaforo-critico",
};

/* ------------------------------------------------------------------ */
/* Compensaciones                                                      */
/* ------------------------------------------------------------------ */

/** El menú de referencia del procedimiento, por gravedad. */
export const COMPENSACIONES_SUGERIDAS: Record<GravedadReclamo, string[]> = {
  leve: ["Pase al polígono de tiro", "Envío gratis en la próxima compra"],
  real: [
    "Reposición o cambio (con las formalidades legales si es material controlado)",
    "Servicio técnico sin cargo",
    "Clase de tiro",
    "Accesorio sin cargo",
    "Nota de crédito parcial",
  ],
  grave: ["Nota de crédito o reembolso total", "Plan a medida", "Invitación a evento"],
};

/**
 * Quién tiene que autorizar una compensación, según su monto.
 *
 * TODAVÍA NO SE HACE CUMPLIR, y es a propósito. Los cargos del
 * procedimiento —Supervisor y Jefe del Canal Consumidor Final— no
 * coinciden con los puestos cargados en la intranet, y adivinar quién
 * firma plata es exactamente lo que no hay que adivinar. La pantalla dice
 * qué nivel corresponde y guarda quién autorizó; cuando Calidad confirme
 * los puestos, se pasa a exigirlo.
 *
 * El porcentaje se calcula sobre el monto de la transacción afectada —la
 * factura vinculada al reclamo— y no sobre el perjuicio estimado.
 */
export const TRAMOS_AUTORIZACION: {
  hasta: number | null;
  autoriza: string;
  topePorcentaje: number | null;
  requiereCofirma: boolean;
}[] = [
  {
    hasta: 2_000_000,
    autoriza: "Supervisor del Canal Consumidor Final, con la conformidad del responsable del área",
    topePorcentaje: 50,
    requiereCofirma: false,
  },
  {
    hasta: 6_000_000,
    autoriza: "Jefe del Canal Consumidor Final",
    topePorcentaje: 100,
    requiereCofirma: false,
  },
  {
    hasta: null,
    autoriza: "Gerente Comercial y de Marketing",
    topePorcentaje: null,
    requiereCofirma: true,
  },
];

export function tramoDeAutorizacion(monto: number): (typeof TRAMOS_AUTORIZACION)[number] {
  return (
    TRAMOS_AUTORIZACION.find((tramo) => tramo.hasta !== null && monto <= tramo.hasta) ??
    TRAMOS_AUTORIZACION[TRAMOS_AUTORIZACION.length - 1]
  );
}

/**
 * Si la compensación pasa el tope porcentual de su tramo.
 *
 * `null` cuando no se puede saber, que no es lo mismo que «está bien»: sin
 * el monto de la factura no hay porcentaje que calcular, y la pantalla lo
 * dice en vez de dar por buena una compensación que podría exceder.
 */
export function excedeTopePorcentual(
  monto: number,
  montoFactura: number | null,
): boolean | null {
  const tramo = tramoDeAutorizacion(monto);
  if (tramo.topePorcentaje === null) return false;
  if (montoFactura === null || montoFactura <= 0) return null;
  return (monto / montoFactura) * 100 > tramo.topePorcentaje;
}

/** Máximo de compensaciones económicas por cliente y por año. */
export const MAXIMO_COMPENSACIONES_ANUALES = 2;
