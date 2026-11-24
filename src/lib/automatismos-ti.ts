/**
 * Reglas del estado de los automatismos de TI.
 *
 * Un Apps Script que pierde su activador o su autorización deja de
 * correr sin avisar a nadie. Cada script avisa a la Intranet que corrió
 * (`registrar_latido()`) y el estado sale de comparar el último aviso con
 * la frecuencia esperada.
 *
 * Viven acá porque las usan la pantalla y el trabajo programado de las
 * 11:00: si cada uno tuviera su propia cuenta, la pantalla podría decir
 * «al día» de un automatismo por el que ya llegó el aviso de caído.
 */

export type EstadoAutomatismo =
  | "al_dia"
  | "atrasado"
  | "caido"
  | "con_error"
  | "conectado"
  | "sin_conectar"
  | "pausado";

export const ETIQUETAS_ESTADO_AUTOMATISMO: Record<EstadoAutomatismo, string> = {
  al_dia: "Al día",
  atrasado: "Atrasado",
  caido: "Caído",
  con_error: "Con error",
  conectado: "Conectado",
  sin_conectar: "Sin conectar",
  pausado: "Pausado",
};

/** Qué quiere decir cada estado, para la leyenda de la pantalla. */
export const DEFINICION_ESTADO_AUTOMATISMO: Record<EstadoAutomatismo, string> = {
  al_dia: "Avisó dentro de su frecuencia.",
  atrasado: "Pasó su frecuencia sin avisar, pero todavía no dos ciclos.",
  caido: "Pasaron dos ciclos o más sin avisar.",
  con_error: "Su último aviso fue un error.",
  conectado: "Avisa, pero no tiene frecuencia cargada: no se puede controlar si se calló.",
  sin_conectar: "Todavía no avisó nunca: falta pegarle el código.",
  pausado: "Se dejó de controlar a propósito.",
};

export const VARIANTE_ESTADO_AUTOMATISMO: Record<
  EstadoAutomatismo,
  "exito" | "advertencia" | "peligro" | "neutra" | "contorno" | "atencion"
> = {
  al_dia: "exito",
  atrasado: "advertencia",
  caido: "peligro",
  con_error: "atencion",
  conectado: "contorno",
  sin_conectar: "neutra",
  pausado: "neutra",
};

/** El orden en que se listan: primero lo que pide atención. */
export const ORDEN_ESTADO_AUTOMATISMO: Record<EstadoAutomatismo, number> = {
  caido: 0,
  con_error: 1,
  atrasado: 2,
  sin_conectar: 3,
  conectado: 4,
  al_dia: 5,
  pausado: 6,
};

/** Ciclos sin avisar a partir de los cuales un automatismo está caído. */
export const CICLOS_PARA_CAIDO = 2;

/**
 * Margen sobre la frecuencia antes de llamarlo atrasado. Un activador
 * «cada hora» de Apps Script corre en cualquier momento dentro de la
 * hora, así que uno que avisó a las 9:05 y a las 10:50 no está atrasado.
 */
export const MARGEN_HORAS_ATRASO = 1;

export interface DatosEstadoAutomatismo {
  vigente: boolean;
  frecuencia_horas: number | null;
  ultimo_latido_en: string | null;
  ultimo_resultado: string | null;
}

/** Horas desde el último aviso, o `null` si nunca avisó. */
export function horasDesdeUltimoAviso(
  ultimo: string | null,
  ahora: Date = new Date(),
): number | null {
  if (!ultimo) return null;
  const fecha = new Date(ultimo);
  if (Number.isNaN(fecha.getTime())) return null;
  return (ahora.getTime() - fecha.getTime()) / 3_600_000;
}

export function estadoDelAutomatismo(
  automatismo: DatosEstadoAutomatismo,
  ahora: Date = new Date(),
): EstadoAutomatismo {
  if (!automatismo.vigente) return "pausado";
  const horas = horasDesdeUltimoAviso(automatismo.ultimo_latido_en, ahora);
  if (horas === null) return "sin_conectar";

  const frecuencia = automatismo.frecuencia_horas;
  // Callarse pesa más que haber fallado: un error de hace tres días en un
  // script que no volvió a correr es un script caído, no uno con error.
  if (frecuencia && horas > frecuencia * CICLOS_PARA_CAIDO + MARGEN_HORAS_ATRASO) return "caido";
  if (automatismo.ultimo_resultado === "error") return "con_error";
  if (!frecuencia) return "conectado";
  if (horas > frecuencia + MARGEN_HORAS_ATRASO) return "atrasado";
  return "al_dia";
}

/** «hace 3 horas», «hace 2 días». */
export function describirHace(ultimo: string | null, ahora: Date = new Date()): string {
  const horas = horasDesdeUltimoAviso(ultimo, ahora);
  if (horas === null) return "Nunca";
  if (horas < 1) {
    const minutos = Math.max(1, Math.round(horas * 60));
    return `hace ${minutos} min`;
  }
  if (horas < 48) {
    const redondeadas = Math.round(horas);
    return `hace ${redondeadas} ${redondeadas === 1 ? "hora" : "horas"}`;
  }
  const dias = Math.round(horas / 24);
  return `hace ${dias} días`;
}

/** «Cada hora», «Diario», «Semanal», «Cada 4 horas». */
export function describirFrecuencia(horas: number | null): string {
  if (!horas) return "Por evento o sin definir";
  if (horas === 1) return "Cada hora";
  if (horas === 24) return "Diario";
  if (horas === 168) return "Semanal";
  if (horas >= 720 && horas <= 744) return "Mensual";
  if (horas % 24 === 0) return `Cada ${horas / 24} días`;
  return `Cada ${horas} horas`;
}

/** Las frecuencias que ofrece el formulario. Se puede escribir otra. */
export const FRECUENCIAS_SUGERIDAS = [
  { horas: 1, etiqueta: "Cada hora" },
  { horas: 4, etiqueta: "Cada 4 horas" },
  { horas: 12, etiqueta: "Cada 12 horas" },
  { horas: 24, etiqueta: "Diario" },
  { horas: 168, etiqueta: "Semanal" },
  { horas: 744, etiqueta: "Mensual" },
] as const;

/** El mismo patrón del `CHECK` de `automatismos_ti.clave`. */
export const PATRON_CLAVE_AUTOMATISMO = /^[a-z0-9][a-z0-9._-]{2,79}$/;

/**
 * El código que se pega en cada proyecto de Apps Script. No lleva el
 * secreto: lo lee de las propiedades del script, así el código se puede
 * mostrar en pantalla y versionar sin exponer nada.
 */
export function codigoParaPegar(clave: string, urlBase: string, clavePublica: string): string {
  const url = `${urlBase.replace(/\/$/, "")}/rest/v1/rpc/registrar_latido`;
  return `/**
 * Avisa a la Intranet (Informática → Automatismos) que el script corrió.
 * Propiedad del script necesaria: INTRANET_SECRETO_AUTOMATISMOS.
 *
 * Uso, al final de la función que dispara el activador:
 *   avisarALaIntranet_('${clave}');                  // salió bien
 *   avisarALaIntranet_('${clave}', 'error', e.message); // en el catch
 */
function avisarALaIntranet_(clave, resultado, mensaje) {
  try {
    const secreto = PropertiesService.getScriptProperties().getProperty('INTRANET_SECRETO_AUTOMATISMOS');
    if (!secreto) return;
    UrlFetchApp.fetch('${url}', {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: '${clavePublica}' },
      payload: JSON.stringify({
        p_secreto: secreto,
        p_clave: clave,
        p_resultado: resultado || 'ok',
        p_mensaje: mensaje ? String(mensaje).slice(0, 2000) : null,
      }),
      muteHttpExceptions: true,
    });
  } catch (e) {
    // Avisar nunca puede romper el script que avisa.
  }
}`;
}
