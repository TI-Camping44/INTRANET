/**
 * Reglas de las altas y bajas de accesos (NC-2026-019).
 *
 * La matriz de accesos por puesto dice qué corresponde; un movimiento
 * registra qué se hizo con UNA persona. Los pasos se arman acá, a partir
 * de la fila del puesto, cuando se da de alta el movimiento, y después
 * quedan fijos en la base: si mañana cambia la matriz, lo que se hizo
 * con esta persona no cambia.
 *
 * Los criterios de baja son los del Responsable de TI: en Google
 * Workspace se quita la licencia y no se suspende la cuenta —sin
 * licencia no entra y no cuesta—, y en Odoo se archiva el usuario.
 */

import {
  ABREVIATURA_NIVEL,
  ETIQUETAS_EMPRESA_ODOO,
  ETIQUETAS_NIVEL,
  MODULOS_ODOO,
  esEmpresaOdoo,
  type ColumnaOdoo,
  type NivelAcceso,
} from "@/lib/accesos";
import { ETIQUETAS_ROL } from "@/lib/constantes";
import type { RolUsuario } from "@/lib/tipos";

export const TIPOS_MOVIMIENTO = ["alta", "baja"] as const;
export type TipoMovimiento = (typeof TIPOS_MOVIMIENTO)[number];

export const ETIQUETAS_TIPO_MOVIMIENTO: Record<TipoMovimiento, string> = {
  alta: "Ingreso",
  baja: "Desvinculación",
};

export const ESTADOS_PASO = ["pendiente", "hecho", "no_aplica"] as const;
export type EstadoPaso = (typeof ESTADOS_PASO)[number];

export const ETIQUETAS_ESTADO_PASO: Record<EstadoPaso, string> = {
  pendiente: "Pendiente",
  hecho: "Hecho",
  no_aplica: "No aplica",
};

export function esTipoMovimiento(valor: string): valor is TipoMovimiento {
  return (TIPOS_MOVIMIENTO as readonly string[]).includes(valor);
}

export function esEstadoPaso(valor: string): valor is EstadoPaso {
  return (ESTADOS_PASO as readonly string[]).includes(valor);
}

/** La fila de la matriz que hace falta para armar los pasos. */
export type FilaMatriz = {
  google_workspace: boolean | null;
  intranet_rol: RolUsuario | null;
  odoo_empresas: string | null;
  otros_accesos: string | null;
  estado: string | null;
} & Partial<Record<ColumnaOdoo, string | null>>;

export interface PasoArmado {
  sistema: string;
  descripcion: string;
  /** Lo que la matriz dice que no corresponde arranca como «No aplica». */
  estado: EstadoPaso;
  observacion: string | null;
}

const MATRIZ_PROPUESTA = " (la fila de la matriz todavía es una propuesta)";

/** «Ventas: Usuario · Inventario: Usuario», solo lo que no es «Sin acceso». */
function describirOdoo(fila: FilaMatriz): string | null {
  const partes = MODULOS_ODOO.flatMap((modulo) => {
    const nivel = fila[modulo.columna] as NivelAcceso | null | undefined;
    if (!nivel || nivel === "sin_acceso") return [];
    return [`${modulo.nombre}: ${ETIQUETAS_NIVEL[nivel] ?? ABREVIATURA_NIVEL[nivel] ?? nivel}`];
  });
  return partes.length > 0 ? partes.join(" · ") : null;
}

export function armarPasos(
  tipo: TipoMovimiento,
  fila: FilaMatriz | null,
  esDeVitalica: boolean,
): PasoArmado[] {
  const aviso = fila && fila.estado !== "validada" ? MATRIZ_PROPUESTA : "";
  const sinMatriz = "El puesto no tiene fila en la matriz de accesos: definir qué corresponde.";
  const nota = esDeVitalica
    ? "nota con el logotipo de Vitalica (sin código ni versión)"
    : "formulario";

  if (tipo === "alta") {
    const odoo = fila ? describirOdoo(fila) : null;
    const empresas =
      fila?.odoo_empresas && esEmpresaOdoo(fila.odoo_empresas)
        ? ETIQUETAS_EMPRESA_ODOO[fila.odoo_empresas]
        : null;

    return [
      {
        sistema: "Google Workspace",
        descripcion: "Crear la cuenta de correo y asignarle una licencia.",
        estado: fila && fila.google_workspace === false ? "no_aplica" : "pendiente",
        observacion:
          fila && fila.google_workspace === false
            ? `La matriz dice que el puesto no lleva correo${aviso}.`
            : null,
      },
      {
        sistema: "Odoo",
        descripcion: fila
          ? odoo
            ? `Crear el usuario${empresas ? ` en ${empresas}` : ""} con: ${odoo}.${aviso}`
            : "Crear el usuario sin módulos: la matriz no le da acceso a ninguno."
          : `Crear el usuario. ${sinMatriz}`,
        estado: fila && !odoo ? "no_aplica" : "pendiente",
        observacion: fila && !odoo ? `La matriz no le da acceso a Odoo${aviso}.` : null,
      },
      {
        sistema: "Intranet",
        descripcion: fila?.intranet_rol
          ? `Primer ingreso con Google y rol «${ETIQUETAS_ROL[fila.intranet_rol]}».`
          : "Primer ingreso con Google; el perfil nace como Colaborador.",
        estado: "pendiente",
        observacion: null,
      },
      ...(fila?.otros_accesos?.trim()
        ? [
            {
              sistema: "Otros accesos",
              descripcion: `Habilitar: ${fila.otros_accesos.trim()}`,
              estado: "pendiente" as EstadoPaso,
              observacion: null,
            },
          ]
        : []),
      {
        sistema: "Equipos",
        descripcion: `Entregar los equipos con la nota de entrega F-SOP-07-02 (${nota}).`,
        estado: "pendiente",
        observacion: null,
      },
      {
        sistema: "Nota de alta",
        descripcion: `Nota de alta de credenciales F-SOP-07-01 firmada (${nota}).`,
        estado: "pendiente",
        observacion: null,
      },
      {
        sistema: "Inducción",
        descripcion: "Inducción de IT y seguridad de la información.",
        estado: "pendiente",
        observacion: null,
      },
    ];
  }

  return [
    {
      sistema: "Google Workspace",
      descripcion:
        "Quitar la licencia de la cuenta. No se suspende: sin licencia no entra y no genera costo.",
      estado: "pendiente",
      observacion: null,
    },
    {
      sistema: "Odoo",
      descripcion: "Archivar el usuario.",
      estado: "pendiente",
      observacion: null,
    },
    {
      sistema: "Intranet",
      descripcion:
        "Reasignar lo que tenga a su cargo: acciones, no conformidades, documentos y procesos.",
      estado: "pendiente",
      observacion: null,
    },
    {
      sistema: "Otros accesos",
      descripcion: fila?.otros_accesos?.trim()
        ? `Dar de baja el resto de los accesos, entre ellos: ${fila.otros_accesos.trim()}`
        : "Dar de baja el resto de los accesos: Claude, tableros, aplicaciones y grupos de correo.",
      estado: "pendiente",
      observacion: null,
    },
    {
      sistema: "Equipos",
      descripcion: `Recibir los equipos con la nota de devolución F-SOP-07-02 (${nota}).`,
      estado: "pendiente",
      observacion: null,
    },
    {
      sistema: "Nota de baja",
      descripcion: "Nota de baja de credenciales firmada.",
      estado: "pendiente",
      observacion: null,
    },
  ];
}

/** Cuántos pasos quedan pendientes: un movimiento sin pendientes está completo. */
export function pendientes(pasos: { estado: string }[]): number {
  return pasos.filter((paso) => paso.estado === "pendiente").length;
}
