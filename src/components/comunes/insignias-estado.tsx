import { Insignia } from "@/components/ui/insignia";
import {
  ETIQUETAS_ESTADO_ACCION,
  ETIQUETAS_ESTADO_ACTIVO,
  ETIQUETAS_ESTADO_AUDITORIA,
  ETIQUETAS_ESTADO_DOCUMENTO,
  ETIQUETAS_ESTADO_NC,
  ETIQUETAS_ESTADO_PROVEEDOR,
  ETIQUETAS_ESTADO_RIESGO,
  ETIQUETAS_NIVEL_RIESGO,
  ETIQUETAS_SEVERIDAD_NC,
} from "@/lib/constantes";
import { etiquetaNivelRiesgo } from "@/lib/riesgos";
import type {
  EstadoAccion,
  EstadoActivo,
  EstadoAuditoria,
  EstadoDocumento,
  EstadoNoConformidad,
  EstadoProveedor,
  EstadoRiesgo,
  SeveridadNoConformidad,
} from "@/lib/tipos";

type Variante = React.ComponentProps<typeof Insignia>["variante"];

const VARIANTE_ESTADO_DOCUMENTO: Record<EstadoDocumento, Variante> = {
  borrador: "neutra",
  en_revision: "advertencia",
  vigente: "exito",
  obsoleto: "contorno",
};

export function InsigniaEstadoDocumento({ estado }: { estado: EstadoDocumento }) {
  return (
    <Insignia variante={VARIANTE_ESTADO_DOCUMENTO[estado]}>
      {ETIQUETAS_ESTADO_DOCUMENTO[estado]}
    </Insignia>
  );
}

const VARIANTE_ESTADO_NC: Record<EstadoNoConformidad, Variante> = {
  abierta: "peligro",
  en_analisis: "atencion",
  en_tratamiento: "advertencia",
  en_verificacion: "primaria",
  cerrada: "exito",
  anulada: "contorno",
};

export function InsigniaEstadoNC({ estado }: { estado: EstadoNoConformidad }) {
  return (
    <Insignia variante={VARIANTE_ESTADO_NC[estado]}>{ETIQUETAS_ESTADO_NC[estado]}</Insignia>
  );
}

const VARIANTE_SEVERIDAD: Record<SeveridadNoConformidad, Variante> = {
  menor: "neutra",
  mayor: "atencion",
  critica: "peligro",
};

export function InsigniaSeveridad({ severidad }: { severidad: SeveridadNoConformidad }) {
  return (
    <Insignia variante={VARIANTE_SEVERIDAD[severidad]}>
      {ETIQUETAS_SEVERIDAD_NC[severidad]}
    </Insignia>
  );
}

const VARIANTE_ESTADO_ACCION: Record<EstadoAccion, Variante> = {
  pendiente: "neutra",
  en_curso: "advertencia",
  ejecutada: "primaria",
  verificada: "exito",
  cancelada: "contorno",
};

export function InsigniaEstadoAccion({ estado }: { estado: EstadoAccion }) {
  return (
    <Insignia variante={VARIANTE_ESTADO_ACCION[estado]}>
      {ETIQUETAS_ESTADO_ACCION[estado]}
    </Insignia>
  );
}

const VARIANTE_ESTADO_RIESGO: Record<EstadoRiesgo, Variante> = {
  identificado: "advertencia",
  en_tratamiento: "primaria",
  controlado: "exito",
  materializado: "peligro",
  cerrado: "contorno",
};

export function InsigniaEstadoRiesgo({ estado }: { estado: EstadoRiesgo }) {
  return (
    <Insignia variante={VARIANTE_ESTADO_RIESGO[estado]}>
      {ETIQUETAS_ESTADO_RIESGO[estado]}
    </Insignia>
  );
}

/** Semaforo del nivel de riesgo: Probabilidad x Impacto. */
export function InsigniaNivelRiesgo({
  nivel,
  mostrarValor = true,
}: {
  nivel: number | null | undefined;
  mostrarValor?: boolean;
}) {
  const etiqueta = etiquetaNivelRiesgo(nivel);
  if (!etiqueta) return <span className="text-atenuado-contraste">—</span>;

  const variante: Record<string, Variante> = {
    bajo: "exito",
    medio: "advertencia",
    alto: "atencion",
    critico: "peligro",
  };

  return (
    <Insignia variante={variante[etiqueta]}>
      {ETIQUETAS_NIVEL_RIESGO[etiqueta]}
      {mostrarValor ? ` · ${nivel}` : ""}
    </Insignia>
  );
}

const VARIANTE_ESTADO_AUDITORIA: Record<EstadoAuditoria, Variante> = {
  planificada: "neutra",
  en_ejecucion: "advertencia",
  informe_pendiente: "atencion",
  cerrada: "exito",
  cancelada: "contorno",
};

export function InsigniaEstadoAuditoria({ estado }: { estado: EstadoAuditoria }) {
  return (
    <Insignia variante={VARIANTE_ESTADO_AUDITORIA[estado]}>
      {ETIQUETAS_ESTADO_AUDITORIA[estado]}
    </Insignia>
  );
}

const VARIANTE_ESTADO_PROVEEDOR: Record<EstadoProveedor, Variante> = {
  en_evaluacion: "advertencia",
  aprobado: "exito",
  condicional: "atencion",
  rechazado: "peligro",
  inactivo: "contorno",
};

export function InsigniaEstadoProveedor({ estado }: { estado: EstadoProveedor }) {
  return (
    <Insignia variante={VARIANTE_ESTADO_PROVEEDOR[estado]}>
      {ETIQUETAS_ESTADO_PROVEEDOR[estado]}
    </Insignia>
  );
}

const VARIANTE_ESTADO_ACTIVO: Record<EstadoActivo, Variante> = {
  operativo: "exito",
  en_mantenimiento: "advertencia",
  fuera_de_servicio: "peligro",
  dado_de_baja: "contorno",
};

export function InsigniaEstadoActivo({ estado }: { estado: EstadoActivo }) {
  return (
    <Insignia variante={VARIANTE_ESTADO_ACTIVO[estado]}>
      {ETIQUETAS_ESTADO_ACTIVO[estado]}
    </Insignia>
  );
}

/** Marca visible para los registros cargados por el seed de demostración. */
export function InsigniaDemostracion() {
  return (
    <Insignia variante="contorno" className="border-dashed">
      Demostración
    </Insignia>
  );
}
