/**
 * Tipos del dominio del SGC. Reflejan las enumeraciones y tablas de las
 * migraciones de `supabase/migrations`. Se mantienen a mano, sin generador,
 * para no sumar dependencias al proyecto.
 */

export type RolUsuario =
  | "administrador_sgc"
  | "responsable_proceso"
  | "colaborador"
  | "auditor"
  | "direccion";

export type TipoDocumento =
  | "manual"
  | "procedimiento"
  | "instructivo"
  | "formulario"
  | "politica"
  | "registro"
  | "externo";

export type EstadoDocumento = "borrador" | "en_revision" | "vigente" | "obsoleto";
export type EstadoRevision = "pendiente" | "aprobado" | "rechazado";

export type OrigenNoConformidad =
  | "auditoria_interna"
  | "auditoria_externa"
  | "reclamo_cliente"
  | "proceso_interno"
  | "proveedor"
  | "inspeccion"
  | "requisito_legal"
  | "otro";

export type SeveridadNoConformidad = "menor" | "mayor" | "critica";

export type EstadoNoConformidad =
  | "abierta"
  | "en_analisis"
  | "en_tratamiento"
  | "en_verificacion"
  | "cerrada"
  | "anulada";

export type TipoAccion = "correccion" | "accion_correctiva" | "accion_preventiva" | "mejora";

export type EstadoAccion = "pendiente" | "en_curso" | "ejecutada" | "verificada" | "cancelada";

export type CategoriaIshikawa =
  | "metodo"
  | "maquina"
  | "mano_de_obra"
  | "material"
  | "medicion"
  | "medio_ambiente";

export type TipoRiesgo = "riesgo" | "oportunidad";

export type EstadoRiesgo =
  | "identificado"
  | "en_tratamiento"
  | "controlado"
  | "materializado"
  | "cerrado";

export type TratamientoRiesgo = "evitar" | "mitigar" | "transferir" | "aceptar" | "explotar";

export type TipoProceso = "estrategico" | "operativo" | "apoyo";

export type ResultadoEficacia = "eficaz" | "parcialmente_eficaz" | "no_eficaz" | "pendiente";

export type EstadoProveedor =
  | "en_evaluacion"
  | "aprobado"
  | "condicional"
  | "rechazado"
  | "inactivo";

export type EstadoActivo = "operativo" | "en_mantenimiento" | "fuera_de_servicio" | "dado_de_baja";

export type EstadoAuditoria =
  | "planificada"
  | "en_ejecucion"
  | "informe_pendiente"
  | "cerrada"
  | "cancelada";

export type TipoHallazgo =
  | "no_conformidad_mayor"
  | "no_conformidad_menor"
  | "observacion"
  | "oportunidad_mejora"
  | "fortaleza";

export type FrecuenciaMedicion =
  | "diaria"
  | "semanal"
  | "mensual"
  | "bimestral"
  | "trimestral"
  | "semestral"
  | "anual";

export type SentidoIndicador = "mayor_mejor" | "menor_mejor" | "rango";

export type TipoNotificacion =
  | "documento_publicado"
  | "documento_por_revisar"
  | "revision_solicitada"
  | "no_conformidad_asignada"
  | "accion_por_vencer"
  | "accion_vencida"
  | "escalamiento"
  | "riesgo_por_reevaluar"
  | "auditoria_programada"
  | "indicador_fuera_de_meta"
  | "mantenimiento_programado"
  | "general";

export type NivelRiesgo = "bajo" | "medio" | "alto" | "critico";

// ---------------------------------------------------------------------
// Entidades
// ---------------------------------------------------------------------

export interface Usuario {
  id: string;
  empresa_id: string;
  correo: string;
  nombre_completo: string;
  rol: RolUsuario;
  puesto_id: string | null;
  proceso_id: string | null;
  superior_id: string | null;
  telefono: string | null;
  url_avatar: string | null;
  activo: boolean;
  ultimo_ingreso: string | null;
}

export interface Proceso {
  id: string;
  empresa_id: string;
  codigo: string;
  nombre: string;
  tipo: TipoProceso;
  descripcion: string | null;
  responsable_id: string | null;
  activo: boolean;
}

export interface Documento {
  id: string;
  empresa_id: string;
  codigo: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoDocumento;
  estado: EstadoDocumento;
  proceso_id: string | null;
  norma_id: string | null;
  responsable_id: string;
  elaborador_id: string | null;
  aprobador_id: string | null;
  version_actual: number;
  fecha_aprobacion: string | null;
  fecha_vigencia: string | null;
  fecha_proxima_revision: string | null;
  periodicidad_revision_meses: number;
  es_demostracion: boolean;
  creado_en: string;
  actualizado_en: string;
}

export interface DocumentoVersion {
  id: string;
  documento_id: string;
  version: number;
  etiqueta: string;
  estado: EstadoDocumento;
  resumen_cambios: string | null;
  ruta_archivo: string | null;
  nombre_archivo: string | null;
  tamano_bytes: number | null;
  tipo_mime: string | null;
  elaborado_por: string | null;
  aprobado_por: string | null;
  fecha_aprobacion: string | null;
  creado_en: string;
}

export interface NoConformidad {
  id: string;
  empresa_id: string;
  codigo: string;
  titulo: string;
  descripcion: string;
  origen: OrigenNoConformidad;
  severidad: SeveridadNoConformidad;
  estado: EstadoNoConformidad;
  proceso_id: string | null;
  sede_id: string | null;
  norma_id: string | null;
  cliente_id: string | null;
  requisito_incumplido: string | null;
  correccion_inmediata: string | null;
  conclusion_causa_raiz: string | null;
  detectado_por: string | null;
  responsable_id: string | null;
  fecha_deteccion: string;
  fecha_limite_cierre: string | null;
  fecha_cierre: string | null;
  eficacia: ResultadoEficacia;
  observacion_eficacia: string | null;
  riesgo_id: string | null;
  es_demostracion: boolean;
  creado_en: string;
}

export interface NcAccion {
  id: string;
  no_conformidad_id: string;
  tipo: TipoAccion;
  descripcion: string;
  responsable_id: string | null;
  fecha_limite: string;
  estado: EstadoAccion;
  fecha_ejecucion: string | null;
  evidencia: string | null;
  verificado_por: string | null;
  fecha_verificacion: string | null;
  nivel_escalamiento: number;
  fecha_ultima_alerta: string | null;
}

export interface NcPorque {
  id: string;
  no_conformidad_id: string;
  orden: number;
  pregunta: string;
  respuesta: string;
}

export interface NcIshikawa {
  id: string;
  no_conformidad_id: string;
  categoria: CategoriaIshikawa;
  causa: string;
  es_causa_raiz: boolean;
}

export interface Riesgo {
  id: string;
  empresa_id: string;
  codigo: string;
  titulo: string;
  descripcion: string | null;
  tipo: TipoRiesgo;
  categoria: string | null;
  proceso_id: string | null;
  responsable_id: string | null;
  estado: EstadoRiesgo;
  causas: string | null;
  consecuencias: string | null;
  controles_existentes: string | null;
  tratamiento: TratamientoRiesgo;
  probabilidad: number;
  impacto: number;
  nivel: number;
  probabilidad_residual: number | null;
  impacto_residual: number | null;
  nivel_residual: number | null;
  fecha_identificacion: string;
  fecha_ultima_evaluacion: string;
  fecha_proxima_revision: string | null;
  es_demostracion: boolean;
}

export interface Notificacion {
  id: string;
  usuario_id: string;
  tipo: TipoNotificacion;
  titulo: string;
  mensaje: string;
  enlace: string | null;
  entidad: string | null;
  entidad_id: string | null;
  leida: boolean;
  leida_en: string | null;
  creado_en: string;
}

export interface RegistroBitacora {
  id: number;
  tabla: string;
  registro_id: string | null;
  accion: "creacion" | "edicion" | "eliminacion";
  usuario_id: string | null;
  usuario_correo: string | null;
  campos_modificados: string[] | null;
  valores_anteriores: Record<string, unknown> | null;
  valores_nuevos: Record<string, unknown> | null;
  creado_en: string;
}

export interface ResultadoBusqueda {
  entidad: string;
  entidad_etiqueta: string;
  id: string;
  codigo: string;
  titulo: string;
  detalle: string;
  estado: string;
  enlace: string;
  relevancia: number;
}

/** Respuesta estandar de las acciones de servidor. */
export type ResultadoAccion =
  | { exito: true; mensaje?: string; id?: string }
  | { exito: false; error: string };
