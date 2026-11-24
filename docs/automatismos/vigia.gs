/**
 * TI · Vigía de automatismos
 *
 * Lee cada hora las ejecuciones de Apps Script de esta cuenta —lo mismo
 * que la pantalla «Mis ejecuciones»— con la API de Apps Script
 * (processes.list) y las manda a la Intranet, Informática → Automatismos.
 * Así la Intranet sabe cuándo corrió cada script con activador de tiempo
 * y si terminó bien, sin tocar el código de ningún otro proyecto.
 *
 * Cómo se instala:
 *   1. Proyecto independiente, con este archivo y el appsscript.json de
 *      al lado (que declara los permisos: leer las ejecuciones y llamar a
 *      la Intranet).
 *   2. Propiedad del script INTRANET_SECRETO_AUTOMATISMOS con el secreto
 *      de los automatismos.
 *   3. Ejecutar una vez instalarVigia(): autoriza y deja la corrida
 *      programada cada hora.
 *
 * Solo mira los activadores de TIEMPO: son los que se pueden callar sin
 * que nadie note. Los de «al editar» o «al enviar el formulario» corren
 * cuando alguien hace algo y no tienen un ritmo que controlar. La ticketera
 * no se mira acá porque sus funciones ya avisan solas.
 */

const VIGIA_URL_BASE = 'https://koeifivmgivdhhsghgte.supabase.co/rest/v1/rpc/';
const VIGIA_CLAVE_PUBLICA = 'sb_publishable_C-xo3VnoRoEKd4cIiXp78w_bd-zaurk';
const VIGIA_PROYECTOS_EXCLUIDOS = ['Tickets TI - Automatización', 'TI · Vigía de automatismos'];
const VIGIA_HORAS_PRIMERA_VEZ = 24;
// La API admite 60 consultas por minuto: entre página y página se espera.
const VIGIA_ESPERA_ENTRE_PAGINAS_MS = 1500;
const VIGIA_HORAS_SOLAPAMIENTO = 3;

/** Deja programada la corrida cada hora. Correr una vez a mano. */
function instalarVigia() {
  ScriptApp.getProjectTriggers()
    .filter(function (a) { return a.getHandlerFunction() === 'vigilarAutomatismos'; })
    .forEach(function (a) { ScriptApp.deleteTrigger(a); });
  ScriptApp.newTrigger('vigilarAutomatismos').timeBased().everyHours(1).create();
  return vigilarAutomatismos();
}

function vigilarAutomatismos() {
  const propiedades = PropertiesService.getScriptProperties();
  const secreto = propiedades.getProperty('INTRANET_SECRETO_AUTOMATISMOS');
  if (!secreto) throw new Error('Falta la propiedad del script INTRANET_SECRETO_AUTOMATISMOS.');

  const ahora = new Date();
  const ultima = propiedades.getProperty('VIGIA_ULTIMA_CORRIDA');
  const desde = ultima
    ? new Date(new Date(ultima).getTime() - VIGIA_HORAS_SOLAPAMIENTO * 3600000)
    : new Date(ahora.getTime() - VIGIA_HORAS_PRIMERA_VEZ * 3600000);

  const procesos = leerProcesos_(desde);
  const porClave = {};
  procesos.forEach(function (p) {
    if (VIGIA_PROYECTOS_EXCLUIDOS.indexOf(p.projectName) >= 0) return;
    const resultado = resultadoDe_(p.processStatus);
    if (!resultado) return; // en curso o en espera: todavía no dice nada
    const clave = claveDe_(p.projectName, p.functionName);
    if (!clave) return;
    (porClave[clave] = porClave[clave] || { proyecto: p.projectName, funcion: p.functionName, corridas: [] })
      .corridas.push({ en: p.startTime, resultado: resultado, estado: p.processStatus, duracion: p.duration });
  });

  // De cada automatismo se manda lo que dice su estado y no cada corrida:
  // hay scripts que corren cada minuto, y guardar miles de renglones por
  // día no agrega nada. Va la última corrida y, si hubo errores, el último
  // error con cuántas fallaron.
  const ejecuciones = [];
  Object.keys(porClave).forEach(function (clave) {
    const grupo = porClave[clave];
    const corridas = grupo.corridas.sort(function (a, b) { return new Date(a.en) - new Date(b.en); });
    const errores = corridas.filter(function (c) { return c.resultado === 'error'; });
    const ultima = corridas[corridas.length - 1];
    const ultimoError = errores[errores.length - 1];
    const resumen = errores.length + ' de ' + corridas.length + ' corridas con error desde '
      + Utilities.formatDate(desde, 'America/Asuncion', 'dd/MM HH:mm') + '.';
    const base = {
      clave: clave,
      nombre: grupo.proyecto + ' · ' + grupo.funcion,
      donde_vive: grupo.proyecto + ' · ' + grupo.funcion,
      frecuencia_horas: frecuenciaDe_(corridas),
    };
    const fila = function (c) {
      return Object.assign({}, base, {
        en: c.en,
        resultado: c.resultado,
        mensaje: c.resultado === 'error'
          ? 'Apps Script la marcó ' + estadoLegible_(c.estado) + '. ' + resumen + ' El detalle está en «Mis ejecuciones».'
          : (errores.length ? resumen : null),
        duracion_segundos: segundosDe_(c.duracion),
      });
    };
    if (ultimoError && ultimoError !== ultima) ejecuciones.push(fila(ultimoError));
    ejecuciones.push(fila(ultima));
  });

  // El vigía también avisa de sí mismo: si deja de correr, se ve caído.
  ejecuciones.push({
    clave: 'ti.vigia-de-automatismos',
    nombre: 'Vigía de automatismos',
    donde_vive: 'TI · Vigía de automatismos · vigilarAutomatismos',
    frecuencia_horas: 1,
    en: ahora.toISOString(),
    resultado: 'ok',
    mensaje: procesos.length + ' ejecuciones leídas desde ' + desde.toISOString(),
  });

  let respuesta = null;
  for (let i = 0; i < ejecuciones.length; i += 500) {
    respuesta = UrlFetchApp.fetch(VIGIA_URL_BASE + 'registrar_ejecuciones', {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: VIGIA_CLAVE_PUBLICA },
      payload: JSON.stringify({
        p_secreto: secreto,
        p_ejecuciones: ejecuciones.slice(i, i + 500),
        p_responsable_correo: Session.getEffectiveUser().getEmail(),
      }),
      muteHttpExceptions: true,
    });
    if (respuesta.getResponseCode() !== 200) {
      throw new Error('La Intranet rechazó el envío (' + respuesta.getResponseCode() + '): ' + respuesta.getContentText());
    }
  }

  propiedades.setProperty('VIGIA_ULTIMA_CORRIDA', ahora.toISOString());
  return respuesta ? respuesta.getContentText() : 'sin ejecuciones';
}

/** Todas las ejecuciones de activadores de tiempo desde una fecha, página por página. */
function leerProcesos_(desde) {
  const token = ScriptApp.getOAuthToken();
  const procesos = [];
  let pagina = '';
  do {
    const url = 'https://script.googleapis.com/v1/processes?pageSize=200'
      + '&userProcessFilter.types=TIME_DRIVEN'
      + '&userProcessFilter.startTime=' + encodeURIComponent(desde.toISOString())
      + (pagina ? '&pageToken=' + encodeURIComponent(pagina) : '');
    // Si Google corta por cuota, se espera a que se vacíe la ventana del
    // minuto y se reintenta: es un límite de ritmo, no un error de verdad.
    let respuesta = null;
    for (let intento = 0; intento < 4; intento++) {
      respuesta = UrlFetchApp.fetch(url, {
        headers: { Authorization: 'Bearer ' + token },
        muteHttpExceptions: true,
      });
      if (respuesta.getResponseCode() !== 429) break;
      Utilities.sleep(65000);
    }
    if (respuesta.getResponseCode() !== 200) {
      throw new Error('La API de Apps Script respondió ' + respuesta.getResponseCode() + ': ' + respuesta.getContentText());
    }
    const datos = JSON.parse(respuesta.getContentText());
    (datos.processes || []).forEach(function (p) { procesos.push(p); });
    pagina = datos.nextPageToken || '';
    if (pagina) Utilities.sleep(VIGIA_ESPERA_ENTRE_PAGINAS_MS);
  } while (pagina && procesos.length < 20000);
  return procesos;
}

function resultadoDe_(estado) {
  if (estado === 'COMPLETED') return 'ok';
  if (['FAILED', 'TIMED_OUT', 'CANCELED', 'UNKNOWN'].indexOf(estado) >= 0) return 'error';
  return null;
}

function estadoLegible_(estado) {
  return { FAILED: 'con error', TIMED_OUT: 'por tiempo agotado', CANCELED: 'cancelada', UNKNOWN: 'en estado desconocido' }[estado] || estado;
}

/** «Automatización Logística» + «revisarVencimientos» → automatizacion-logistica.revisarvencimientos */
function claveDe_(proyecto, funcion) {
  const limpiar = function (texto) {
    return String(texto || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  };
  const p = limpiar(proyecto).slice(0, 40) || 'proyecto';
  const f = limpiar(funcion).slice(0, 38);
  if (!f) return null;
  return (p + '.' + f).slice(0, 80);
}

/**
 * La frecuencia esperada, en horas, deducida del intervalo típico entre
 * corridas: la mediana, redondeada para arriba. Con menos de tres corridas
 * no se deduce nada y la Intranet queda pidiendo que alguien la cargue.
 */
function frecuenciaDe_(corridas) {
  if (corridas.length < 3) return null;
  const tiempos = corridas.map(function (c) { return new Date(c.en).getTime(); }).sort(function (a, b) { return a - b; });
  const intervalos = [];
  for (let i = 1; i < tiempos.length; i++) intervalos.push((tiempos[i] - tiempos[i - 1]) / 3600000);
  intervalos.sort(function (a, b) { return a - b; });
  const mediana = intervalos[Math.floor(intervalos.length / 2)];
  return Math.max(1, Math.ceil(mediana - 0.05));
}

function segundosDe_(duracion) {
  const m = String(duracion || '').match(/^([0-9.]+)s$/);
  return m ? m[1] : null;
}
