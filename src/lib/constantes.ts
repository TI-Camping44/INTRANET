/**
 * Etiquetas y catalogos de la interfaz. Toda la nomenclatura visible del
 * sistema se centraliza aqui para que Calidad pueda ajustar la
 * terminologia en un unico lugar.
 */

import type {
  AreaOrganizacional,
  EstadoAccion,
  EstadoActivo,
  EstadoAuditoria,
  EstadoCapacitacion,
  EstadoDocumento,
  EstadoNoConformidad,
  EstadoProveedor,
  EstadoRevision,
  EstadoRiesgo,
  FrecuenciaMedicion,
  NivelRiesgo,
  OrigenNoConformidad,
  ResultadoEficacia,
  RolUsuario,
  SentidoIndicador,
  SeveridadNoConformidad,
  TipoAccion,
  TipoCapacitacion,
  TipoCompetencia,
  TipoDocumento,
  TipoHallazgo,
  TipoProceso,
  TipoRiesgo,
  TratamientoRiesgo,
} from "@/lib/tipos";

/**
 * Como se llama el sistema en la barra, en el ingreso y en los correos.
 *
 * Se llamo «Intranet SGC» mientras Calidad era todo lo que habia. Ya no:
 * la portada son las publicaciones, los cumpleaños y el directorio, el
 * SGC es una seccion, y Aplicaciones es otra. El nombre tenia que dejar
 * de nombrar a una sola de las tres.
 */
export const NOMBRE_SISTEMA = "Intranet";
export const NOMBRE_EMPRESA = "Camping 44 S.A.";
export const DOMINIO_AUTORIZADO = "camping44.com.py";

// ---------------------------------------------------------------------
// Roles
// ---------------------------------------------------------------------
export const ETIQUETAS_ROL: Record<RolUsuario, string> = {
  administrador_sgc: "Administrador SGC",
  responsable_proceso: "Responsable de proceso",
  colaborador: "Colaborador",
  auditor: "Auditor",
  direccion: "Dirección",
};

export const DESCRIPCION_ROL: Record<RolUsuario, string> = {
  administrador_sgc: "Control total del sistema de gestión.",
  responsable_proceso: "Gestiona la documentación y los registros de sus procesos.",
  colaborador: "Consulta documentación vigente y registra desviaciones.",
  auditor: "Lectura amplia y gestión de auditorías internas.",
  direccion: "Consulta de indicadores y tableros, sin edición.",
};

/** Perfiles que pueden crear y editar registros del sistema. */
export const ROLES_GESTION: RolUsuario[] = ["administrador_sgc", "responsable_proceso"];

// ---------------------------------------------------------------------
// Documentos
// ---------------------------------------------------------------------
export const ETIQUETAS_TIPO_DOCUMENTO: Record<TipoDocumento, string> = {
  manual: "Manual de proceso",
  instructivo: "Instructivo",
  protocolo: "Protocolo",
  formulario: "Formulario",
  politica: "Política",
  procedimiento: "Procedimiento",
  registro: "Registro",
  plan: "Plan",
  externo: "Otro",
};

/**
 * Los tipos que usa Camping 44, en el orden que definio Calidad.
 *
 * «Otro» es el valor `externo` del enumerado con otra etiqueta. Se
 * reusa en vez de agregar un valor nuevo por la misma razon que con los
 * origenes de no conformidad: agregar a un enumerado obliga a una
 * migracion aparte —un valor recien agregado no se puede usar en la
 * misma transaccion— y aca lo unico que cambia es como se lo llama.
 *
 * Los tres que quedan afuera —procedimiento, registro, plan— siguen en
 * `ETIQUETAS_TIPO_DOCUMENTO` porque hay documentos cargados con ellos y
 * hay que poder mostrarlos, pero no se ofrecen ni en el alta ni en los
 * filtros.
 */
export const TIPOS_DOCUMENTO_VIGENTES: TipoDocumento[] = [
  "manual",
  "instructivo",
  "protocolo",
  "formulario",
  "politica",
  "externo",
];

export const ETIQUETAS_ESTADO_DOCUMENTO: Record<EstadoDocumento, string> = {
  borrador: "Borrador",
  en_revision: "En revisión",
  vigente: "Vigente",
  obsoleto: "Obsoleto",
};

export const ETIQUETAS_ESTADO_REVISION: Record<EstadoRevision, string> = {
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado",
};

/**
 * Prefijo de codigo sugerido segun el tipo de documento.
 *
 * Ojo: estos prefijos los definio el proyecto a falta de dato, y la
 * codificacion real de Camping 44 es otra. El juego documental de TI usa
 * <TIPO>-<AREA>-<NN> (POL-IT-01, PROC-IT-02, PLAN-IT-04) y el perfil de
 * puesto usa R-02-01. Cuando Calidad confirme la codificacion definitiva,
 * es este mapa el que hay que corregir.
 */
export const PREFIJO_CODIGO_DOCUMENTO: Record<TipoDocumento, string> = {
  manual: "MP",
  instructivo: "IT",
  protocolo: "PT",
  formulario: "F",
  politica: "POL",
  procedimiento: "PROC",
  registro: "REG",
  plan: "PLAN",
  externo: "DOC",
};

// ---------------------------------------------------------------------
// No conformidades
// ---------------------------------------------------------------------
/**
 * Origen del hallazgo, con la redaccion del formulario de Calidad.
 *
 * Los valores del enumerado quedaron con el nombre que tenian: la
 * etiqueta cambio, el significado no. "proveedor" es la evaluacion de
 * asociados de negocio y "auditoria_externa" es la de certificacion,
 * que es la unica auditoria externa que recibe la empresa.
 */
export const ETIQUETAS_ORIGEN_NC: Record<OrigenNoConformidad, string> = {
  auditoria_interna: "Hallazgo de auditoría interna",
  auditoria_externa: "Hallazgo de auditoría de certificación",
  reclamo_cliente: "Reclamo de cliente",
  proceso_interno: "Incumplimiento de procesos",
  proveedor: "Evaluación de asociados de negocio",
  requisito_legal: "Incumplimiento de requisitos legales",
  inspeccion: "Inspección",
  otro: "Otro",
};

/**
 * Los seis origenes que Calidad ofrece hoy. "inspeccion" y "otro" siguen
 * en el enumerado porque de un tipo de PostgreSQL no se saca un valor,
 * pero no se ofrecen ni en el alta ni en los filtros.
 */
export const ORIGENES_NC_VIGENTES: OrigenNoConformidad[] = [
  "auditoria_interna",
  "auditoria_externa",
  "reclamo_cliente",
  "proceso_interno",
  "proveedor",
  "requisito_legal",
];

/**
 * El orden es el que pidio Calidad: de mayor a menor gravedad. El
 * enumerado de PostgreSQL conserva su orden propio; este es el que se ve.
 */
export const ETIQUETAS_SEVERIDAD_NC: Record<SeveridadNoConformidad, string> = {
  mayor: "Mayor",
  menor: "Menor",
  observacion: "Observación/Recomendación",
};

/**
 * Los nombres de los estados son los que usa Calidad desde el 23 de
 * septiembre: Abierto, En proceso y Cerrado. El valor guardado no
 * cambio —sigue siendo 'abierta', 'en_tratamiento', 'cerrada'— porque lo
 * que cambio es como se lo llama, no que es.
 *
 * El cierre se muestra partido en «en plazo» y «fuera de plazo», y eso
 * no sale de aca: sale de `pasoDeNoConformidad` en lib/no-conformidades,
 * que mira tambien la columna `cierre_en_plazo`.
 */
export const ETIQUETAS_ESTADO_NC: Record<EstadoNoConformidad, string> = {
  abierta: "Abierto",
  en_tratamiento: "En proceso",
  cerrada: "Cerrado",
  en_analisis: "En análisis",
  en_verificacion: "En verificación",
  anulada: "Anulada",
};

/**
 * El ciclo de una no conformidad, en los tres pasos que lleva Calidad:
 * se abre cuando se levanta, pasa a tratamiento cuando se completa la
 * accion correctiva y se cierra cuando Calidad verifica que fue eficaz.
 *
 * Los tres estados intermedios del diseno original quedan en el
 * enumerado por la misma razon que los origenes retirados, y la
 * migracion 20260901000100 ya llevo los registros existentes a estos
 * tres.
 */
export const ESTADOS_NC_VIGENTES: EstadoNoConformidad[] = [
  "abierta",
  "en_tratamiento",
  "cerrada",
];

/**
 * Areas de la organizacion. Es la dimension que Calidad mas pide para
 * las no conformidades y la que Sofidya no permite: saber cuales son las
 * de cada departamento.
 *
 * La misma lista esta en el CHECK de no_conformidades.area. Si cambia,
 * cambia en los dos lados.
 */
export const AREAS_ORGANIZACIONALES: Record<AreaOrganizacional, string> = {
  administracion: "Administración",
  tesoreria_caja: "Tesorería/Caja",
  creditos_cobranzas: "Créditos y Cobranzas",
  contabilidad: "Contabilidad",
  recepcion: "Recepción",
  consumidor_final: "Consumidor Final",
  mayorista: "Mayorista",
  marketing: "Marketing",
  operaciones_logistica: "Operaciones y Logística",
  informatica: "Informática",
  capital_humano: "Capital Humano",
  gestion_calidad: "Sistema de Gestión de la Calidad",
  gestion_regulatoria: "Gestión Regulatoria",
  directorio: "Directorio",
  // Retirada: queda para poder mostrar lo cargado antes del cambio.
  logistica_operaciones: "Operaciones y Logística",
};

/**
 * Las areas que se ofrecen hoy, en el orden de Calidad. La retirada
 * queda fuera: ya no se elige, pero se sigue pudiendo mostrar.
 */
export const AREAS_VIGENTES: AreaOrganizacional[] = [
  "administracion",
  "tesoreria_caja",
  "creditos_cobranzas",
  "contabilidad",
  "recepcion",
  "consumidor_final",
  "mayorista",
  "marketing",
  "operaciones_logistica",
  "informatica",
  "capital_humano",
  "gestion_calidad",
  "gestion_regulatoria",
  "directorio",
];

export const ETIQUETAS_TIPO_ACCION: Record<TipoAccion, string> = {
  correccion: "Corrección",
  accion_correctiva: "Acción correctiva",
  accion_preventiva: "Acción preventiva",
  mejora: "Mejora",
};

export const ETIQUETAS_ESTADO_ACCION: Record<EstadoAccion, string> = {
  pendiente: "Pendiente",
  en_curso: "En curso",
  ejecutada: "Ejecutada",
  verificada: "Verificada",
  cancelada: "Cancelada",
};

export const ETIQUETAS_EFICACIA: Record<ResultadoEficacia, string> = {
  eficaz: "Eficaz",
  parcialmente_eficaz: "Parcialmente eficaz",
  no_eficaz: "No eficaz",
  pendiente: "Pendiente de verificar",
};

export const ETIQUETAS_TIPO_CAPACITACION: Record<TipoCapacitacion, string> = {
  interna: "Interna",
  externa: "Externa",
  en_linea: "En línea",
  induccion: "Inducción",
};

export const ETIQUETAS_ESTADO_CAPACITACION: Record<EstadoCapacitacion, string> = {
  planificada: "Planificada",
  en_curso: "En curso",
  finalizada: "Finalizada",
  cancelada: "Cancelada",
};

export const ETIQUETAS_TIPO_COMPETENCIA: Record<TipoCompetencia, string> = {
  tecnica: "Técnica",
  conductual: "Conductual",
  legal: "Legal",
};

/**
 * Escala de dominio de una competencia. La usa la matriz por puesto y la
 * evaluacion de cada persona, para que ambas hablen de lo mismo.
 */
export const NIVELES_COMPETENCIA: Record<number, string> = {
  0: "Sin dominio",
  1: "Básico",
  2: "En desarrollo",
  3: "Competente",
  4: "Avanzado",
  5: "Referente",
};

/** Estados en los que una no conformidad se considera abierta. */
/**
 * Las cinco preguntas del analisis de causa raiz, con la redaccion de
 * Calidad. La primera nombra la desviacion y la ultima dice
 * explicitamente que ahi termina la cadena: quien completa el formulario
 * tiene que saber que ese renglon es la causa raiz y no un sintoma mas.
 *
 * Viven aca y no en el componente porque las usan dos pantallas: el
 * analisis de la ficha y el formulario con el que se responde la accion
 * correctiva.
 */
/**
 * Lista de distribucion interna de la empresa.
 *
 * Se usa para los avisos que van a todo el personal y no a una persona
 * —hoy, el aviso de auditoria—. Es una direccion de la empresa, no una
 * credencial: vive aca y no en una variable de entorno porque si cambia
 * tiene que cambiar a la vista, en una revision, y no en el panel de
 * Vercel donde nadie la encuentra.
 */
export const CORREO_TODOS = "todos@camping44.com.py";

/**
 * Los cuatro tipos de auditoria que usa Calidad, en su orden.
 *
 * 'proveedor' y 'seguimiento' siguen en el enumerado de la base porque de
 * un tipo de PostgreSQL no se saca un valor, pero no se ofrecen.
 */
export const ETIQUETAS_TIPO_AUDITORIA: Record<string, string> = {
  por_proceso: "Por proceso",
  interna: "Interna",
  externa: "Externa",
  terceros: "A terceros",
  proveedor: "A proveedor",
  seguimiento: "De seguimiento",
};

export const TIPOS_AUDITORIA_VIGENTES = ["por_proceso", "interna", "externa", "terceros"];

export const PREGUNTAS_CINCO_PORQUES = [
  "¿Por qué ocurrió la desviación?",
  "¿Por qué?",
  "¿Por qué?",
  "¿Por qué?",
  "¿Por qué? (Causa raíz)",
];

export const ESTADOS_NC_ABIERTOS: EstadoNoConformidad[] = [
  "abierta",
  "en_analisis",
  "en_tratamiento",
  "en_verificacion",
];

/**
 * Plazo para cerrar una no conformidad: cinco dias corridos desde la
 * deteccion, siempre. Lo bajo Calidad de diez a cinco.
 *
 * No se escribe a mano: lo fija el disparador completar_no_conformidad()
 * para que valga por cualquier via de escritura. Si cambia, cambia en los
 * dos lados.
 */
export const DIAS_LIMITE_CIERRE_NC = 5;

/** Dias sin resolver a partir de los cuales se escala al lider inmediato. */
export const DIAS_ESCALAMIENTO_NC = 10;

/** Segundo nivel de escalamiento. */
export const DIAS_ESCALAMIENTO_SEGUNDO_NIVEL = 20;

// ---------------------------------------------------------------------
// Riesgos
// ---------------------------------------------------------------------
export const ETIQUETAS_TIPO_RIESGO: Record<TipoRiesgo, string> = {
  riesgo: "Riesgo",
  oportunidad: "Oportunidad",
};

export const ETIQUETAS_ESTADO_RIESGO: Record<EstadoRiesgo, string> = {
  identificado: "Identificado",
  en_tratamiento: "En tratamiento",
  controlado: "Controlado",
  materializado: "Materializado",
  cerrado: "Cerrado",
};

export const ETIQUETAS_TRATAMIENTO_RIESGO: Record<TratamientoRiesgo, string> = {
  eliminar_fuente: "Eliminar la fuente",
  cambiar_probabilidad: "Cambiar la probabilidad",
  cambiar_consecuencia: "Cambiar la consecuencia",
  compartir: "Compartir el riesgo",
  evitar: "Evitar el riesgo",
  asumir: "Asumir por decisión informada",
  // Retirados: quedan por los riesgos ya cargados con ellos.
  mitigar: "Mitigar",
  transferir: "Transferir",
  aceptar: "Aceptar",
  explotar: "Explotar",
};

/**
 * Las seis opciones del instructivo, en su orden.
 *
 * Lo que las distingue no es el nombre: cada una dice QUE FACTOR puede
 * bajar en el residual. Si el residual muestra una baja en el factor que
 * la accion no afecta, la valoracion esta mal hecha. Una capacitacion
 * baja la probabilidad, no la severidad; un plan de contingencia baja la
 * severidad, no la probabilidad.
 */
export const TRATAMIENTOS_VIGENTES: TratamientoRiesgo[] = [
  "eliminar_fuente",
  "cambiar_probabilidad",
  "cambiar_consecuencia",
  "compartir",
  "evitar",
  "asumir",
];

export const ETIQUETAS_NIVEL_RIESGO: Record<NivelRiesgo, string> = {
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
  critico: "Crítico",
};

/** Escala 1 a 5 de probabilidad, acordada con Calidad. */
export const ESCALA_PROBABILIDAD = [
  {
    valor: 1,
    etiqueta: "Muy baja",
    detalle: "No ocurrió en los últimos cinco años",
    control: "Control documentado, automatizado o a prueba de error, verificado y sin fallas",
  },
  {
    valor: 2,
    etiqueta: "Baja",
    detalle: "Ocurrió una vez en los últimos tres a cinco años",
    control: "Control documentado y aplicado, con fallas aisladas ya corregidas",
  },
  {
    valor: 3,
    etiqueta: "Media",
    detalle: "Ocurre una vez al año o una vez por temporada",
    control: "El control existe pero depende del criterio o la memoria de una persona",
  },
  {
    valor: 4,
    etiqueta: "Alta",
    detalle: "Ocurre varias veces al año",
    control: "El control es informal, no está documentado o no se verifica",
  },
  {
    valor: 5,
    etiqueta: "Muy alta",
    detalle: "Ocurre mensualmente o más, o está ocurriendo ahora",
    control: "No existe control",
  },
];

/**
 * Escala 1 a 5 de severidad, del instructivo de valoración.
 *
 * Se evalúa en seis dimensiones y se asigna el valor de la MÁS AFECTADA,
 * no el promedio. Y se valora el peor caso razonable —el peor desenlace
 * plausible dadas las circunstancias habituales— y no el peor caso
 * teórico imaginable.
 *
 * La dimensión económica no se usa todavía: el instructivo pide fijar
 * por escrito el umbral que separa los niveles 3, 4 y 5 como porcentaje
 * de la facturación mensual promedio, y Camping 44 no lo definió.
 */
export const ESCALA_SEVERIDAD = [
  {
    valor: 1,
    etiqueta: "Insignificante",
    detalle: "Se detecta y corrige antes de llegar al cliente",
    legal: "Sin efecto legal. Sin interrupción. Costo despreciable",
  },
  {
    valor: 2,
    etiqueta: "Menor",
    detalle: "Afecta a un cliente, se resuelve en el momento y queda conforme",
    legal: "Sin efecto legal. Interrupción menor a una hora",
  },
  {
    valor: 3,
    etiqueta: "Moderada",
    detalle: "Afecta a varios clientes o a una jornada. Queja formal o reseña negativa",
    legal: "Observación sin sanción. Interrupción de hasta un día",
  },
  {
    valor: 4,
    etiqueta: "Mayor",
    detalle: "Incumplimiento de lo comprometido. Pérdida del cliente o reintegro",
    legal: "Observación de autoridad con plazo. Suspensión parcial del servicio",
  },
  {
    valor: 5,
    etiqueta: "Crítica",
    detalle: "Afecta la seguridad o la salud de personas. Daño reputacional extendido",
    legal: "Sanción, clausura, pérdida de habilitación. Suspensión total",
  },
];

/**
 * Beneficio potencial de una oportunidad, 1 a 5.
 * Se asigna el valor de la dimensión MÁS FAVORECIDA.
 */
export const ESCALA_BENEFICIO = [
  { valor: 1, etiqueta: "Marginal", detalle: "Solo perceptible internamente. No cambia indicadores" },
  { valor: 2, etiqueta: "Menor", detalle: "Mejora puntual de un indicador, sin efecto en el cliente" },
  { valor: 3, etiqueta: "Moderado", detalle: "Mejora medible en un objetivo, ahorro sostenido o mejora que el cliente percibe" },
  { valor: 4, etiqueta: "Alto", detalle: "Mejora varios objetivos, habilita capacidad o diferencia el servicio" },
  { valor: 5, etiqueta: "Muy alto", detalle: "Cambia la propuesta de valor, abre un mercado o transforma la operación" },
];

/**
 * Factibilidad de una oportunidad, 1 a 5.
 *
 * Se evalúan cuatro dimensiones y se asigna la MÁS RESTRICTIVA: el cuello
 * de botella. Al revés que la severidad, acá se toma el valor más bajo.
 */
export const ESCALA_FACTIBILIDAD = [
  { valor: 1, etiqueta: "Muy difícil", detalle: "Inversión no presupuestada y competencia inexistente. Más de dieciocho meses" },
  { valor: 2, etiqueta: "Difícil", detalle: "Inversión a aprobar y competencia a contratar o formar. Doce a dieciocho meses" },
  { valor: 3, etiqueta: "Moderada", detalle: "Reasignar recursos y capacitar. Seis a doce meses" },
  { valor: 4, etiqueta: "Factible", detalle: "Presupuesto y competencia disponibles. Tres a seis meses" },
  { valor: 5, etiqueta: "Muy factible", detalle: "Con los recursos y las personas actuales. Menos de tres meses" },
];

// ---------------------------------------------------------------------
// Auditorias, indicadores, proveedores y activos
// ---------------------------------------------------------------------
export const ETIQUETAS_ESTADO_AUDITORIA: Record<EstadoAuditoria, string> = {
  planificada: "Planificada",
  en_ejecucion: "En ejecución",
  informe_pendiente: "Informe pendiente",
  cerrada: "Cerrada",
  cancelada: "Cancelada",
};

export const ETIQUETAS_TIPO_HALLAZGO: Record<TipoHallazgo, string> = {
  no_conformidad_menor: "No conformidad menor",
  no_conformidad_mayor: "No conformidad mayor",
  observacion: "Observación/Recomendación",
  otro: "Otros",
  oportunidad_mejora: "Oportunidad de mejora",
  fortaleza: "Fortaleza",
};

/**
 * Los cuatro tipos de hallazgo que ofrece Calidad, en su orden.
 *
 * «Oportunidad de mejora» y «Fortaleza» siguen en el enumerado porque
 * puede haber hallazgos cargados con ellos y hay que poder mostrarlos,
 * pero no se ofrecen. De los cuatro vigentes, los tres primeros derivan
 * en no conformidad; «Otros» no.
 */
export const TIPOS_HALLAZGO_VIGENTES: TipoHallazgo[] = [
  "no_conformidad_menor",
  "no_conformidad_mayor",
  "observacion",
  "otro",
];

export const ETIQUETAS_FRECUENCIA: Record<FrecuenciaMedicion, string> = {
  diaria: "Diaria",
  semanal: "Semanal",
  mensual: "Mensual",
  bimestral: "Bimestral",
  trimestral: "Trimestral",
  semestral: "Semestral",
  anual: "Anual",
};

export const ETIQUETAS_SENTIDO: Record<SentidoIndicador, string> = {
  mayor_mejor: "Mayor es mejor",
  menor_mejor: "Menor es mejor",
  rango: "Dentro de rango",
};

export const ETIQUETAS_ESTADO_PROVEEDOR: Record<EstadoProveedor, string> = {
  en_evaluacion: "En evaluación",
  aprobado: "Aprobado",
  condicional: "Condicional",
  rechazado: "Rechazado",
  inactivo: "Inactivo",
};

export const ETIQUETAS_ESTADO_ACTIVO: Record<EstadoActivo, string> = {
  operativo: "Operativo",
  en_mantenimiento: "En mantenimiento",
  fuera_de_servicio: "Fuera de servicio",
  dado_de_baja: "Dado de baja",
};

export const ETIQUETAS_TIPO_PROCESO: Record<TipoProceso, string> = {
  estrategico: "Estratégico",
  operativo: "Operativo",
  apoyo: "Apoyo",
};

// ---------------------------------------------------------------------
// Parametros de alertas
// ---------------------------------------------------------------------
/** Ventana de aviso para documentos que se acercan a su revision. */
export const DIAS_AVISO_REVISION_DOCUMENTO = 30;

/** Ventana de aviso para acciones proximas a vencer. */
export const DIAS_AVISO_ACCION = 3;

/** Tamano maximo por archivo adjunto: 20 MB. */
export const TAMANO_MAXIMO_ADJUNTO = 20 * 1024 * 1024;

export const BUCKET_ADJUNTOS = "adjuntos-sgc";
