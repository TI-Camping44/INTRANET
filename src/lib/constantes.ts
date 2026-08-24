/**
 * Etiquetas y catalogos de la interfaz. Toda la nomenclatura visible del
 * sistema se centraliza aqui para que Calidad pueda ajustar la
 * terminologia en un unico lugar.
 */

import type {
  CategoriaIshikawa,
  EstadoAccion,
  EstadoActivo,
  EstadoAuditoria,
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
  TipoDocumento,
  TipoHallazgo,
  TipoProceso,
  TipoRiesgo,
  TratamientoRiesgo,
} from "@/lib/tipos";

export const NOMBRE_SISTEMA = "Intranet SGC";
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
  manual: "Manual",
  procedimiento: "Procedimiento",
  instructivo: "Instructivo",
  formulario: "Formulario",
  politica: "Política",
  registro: "Registro",
  externo: "Documento externo",
};

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

/** Prefijo de codigo sugerido segun el tipo de documento. */
export const PREFIJO_CODIGO_DOCUMENTO: Record<TipoDocumento, string> = {
  manual: "MP",
  procedimiento: "MP-SOP",
  instructivo: "IT",
  formulario: "F",
  politica: "POL",
  registro: "REG",
  externo: "EXT",
};

// ---------------------------------------------------------------------
// No conformidades
// ---------------------------------------------------------------------
export const ETIQUETAS_ORIGEN_NC: Record<OrigenNoConformidad, string> = {
  auditoria_interna: "Auditoría interna",
  auditoria_externa: "Auditoría externa",
  reclamo_cliente: "Reclamo de cliente",
  proceso_interno: "Proceso interno",
  proveedor: "Proveedor",
  inspeccion: "Inspección",
  requisito_legal: "Requisito legal",
  otro: "Otro",
};

export const ETIQUETAS_SEVERIDAD_NC: Record<SeveridadNoConformidad, string> = {
  menor: "Menor",
  mayor: "Mayor",
  critica: "Crítica",
};

export const ETIQUETAS_ESTADO_NC: Record<EstadoNoConformidad, string> = {
  abierta: "Abierta",
  en_analisis: "En análisis",
  en_tratamiento: "En tratamiento",
  en_verificacion: "En verificación",
  cerrada: "Cerrada",
  anulada: "Anulada",
};

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

export const ETIQUETAS_ISHIKAWA: Record<CategoriaIshikawa, string> = {
  metodo: "Método",
  maquina: "Máquina",
  mano_de_obra: "Mano de obra",
  material: "Material",
  medicion: "Medición",
  medio_ambiente: "Medio ambiente",
};

export const ETIQUETAS_EFICACIA: Record<ResultadoEficacia, string> = {
  eficaz: "Eficaz",
  parcialmente_eficaz: "Parcialmente eficaz",
  no_eficaz: "No eficaz",
  pendiente: "Pendiente de verificar",
};

/** Estados en los que una no conformidad se considera abierta. */
export const ESTADOS_NC_ABIERTOS: EstadoNoConformidad[] = [
  "abierta",
  "en_analisis",
  "en_tratamiento",
  "en_verificacion",
];

/** Dias sin resolver a partir de los cuales se escala al jefe inmediato. */
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
  evitar: "Evitar",
  mitigar: "Mitigar",
  transferir: "Transferir",
  aceptar: "Aceptar",
  explotar: "Explotar",
};

export const ETIQUETAS_NIVEL_RIESGO: Record<NivelRiesgo, string> = {
  bajo: "Bajo",
  medio: "Medio",
  alto: "Alto",
  critico: "Crítico",
};

/** Escala 1 a 5 de probabilidad, acordada con Calidad. */
export const ESCALA_PROBABILIDAD = [
  { valor: 1, etiqueta: "Muy improbable", detalle: "Podría ocurrir en casos excepcionales" },
  { valor: 2, etiqueta: "Improbable", detalle: "Podría ocurrir alguna vez" },
  { valor: 3, etiqueta: "Posible", detalle: "Podría ocurrir en algún momento" },
  { valor: 4, etiqueta: "Probable", detalle: "Ocurre con cierta frecuencia" },
  { valor: 5, etiqueta: "Casi seguro", detalle: "Se espera que ocurra" },
];

/** Escala 1 a 5 de impacto, acordada con Calidad. */
export const ESCALA_IMPACTO = [
  { valor: 1, etiqueta: "Insignificante", detalle: "Sin efecto sobre el servicio" },
  { valor: 2, etiqueta: "Menor", detalle: "Efecto leve, se resuelve en el proceso" },
  { valor: 3, etiqueta: "Moderado", detalle: "Afecta al cliente o a un proceso completo" },
  { valor: 4, etiqueta: "Mayor", detalle: "Pérdida relevante o incumplimiento legal" },
  { valor: 5, etiqueta: "Catastrófico", detalle: "Compromete la continuidad del negocio" },
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
  no_conformidad_mayor: "No conformidad mayor",
  no_conformidad_menor: "No conformidad menor",
  observacion: "Observación",
  oportunidad_mejora: "Oportunidad de mejora",
  fortaleza: "Fortaleza",
};

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
