/**
 * Envía la ticketera de TI a la Intranet (Informática → Seguimiento de tickets).
 *
 * Va en el proyecto de Apps Script de la planilla «TICKETS - BASE». La
 * Intranet guarda una copia de solo lectura: la base sigue siendo esta
 * planilla, y los pedidos se siguen haciendo por el formulario de siempre.
 *
 * Cómo se instala:
 *   1. Pegar este archivo en el proyecto de la ticketera.
 *   2. Propiedades del script → agregar INTRANET_SECRETO con el secreto de
 *      la integración «ticketera_ti». En la base solo se guarda su hash
 *      (tabla secretos_de_integracion); si se pierde, se genera uno nuevo
 *      y se actualizan los dos lados.
 *   3. Ejecutar una vez instalarEnvioALaIntranet(): autoriza el script y
 *      deja el envío programado cada hora.
 *
 *   4. Para el aviso a Informática → Automatismos, agregar también la
 *      propiedad INTRANET_SECRETO_AUTOMATISMOS. Sin ella el envío sigue
 *      funcionando y simplemente no avisa.
 *
 * Llama a la función recibir_ticketera() de la base de la Intranet. La
 * clave pública de Supabase no es un secreto (es la misma que usa el
 * navegador); lo que protege la función es INTRANET_SECRETO.
 */

const INTRANET_URL = 'https://koeifivmgivdhhsghgte.supabase.co/rest/v1/rpc/recibir_ticketera';
const INTRANET_CLAVE_PUBLICA = 'sb_publishable_C-xo3VnoRoEKd4cIiXp78w_bd-zaurk';
const INTRANET_ID_PLANILLA = '1GYDerRfmgkk_-7zHGCNI98_UEutVoMhMdDFoPFhbcxQ';
const INTRANET_HOJA_TICKETS = 'Respuestas de formulario 1';
const INTRANET_HOJA_COMENTARIOS = 'Comentarios';
const INTRANET_ZONA = 'America/Asuncion';

/** Deja programado el envío cada hora. Correr una vez a mano. */
function instalarEnvioALaIntranet() {
  ScriptApp.getProjectTriggers()
    .filter(function (d) { return d.getHandlerFunction() === 'enviarTicketsALaIntranet'; })
    .forEach(function (d) { ScriptApp.deleteTrigger(d); });
  ScriptApp.newTrigger('enviarTicketsALaIntranet').timeBased().everyHours(1).create();
  return enviarTicketsALaIntranet();
}

/**
 * Manda todos los tickets y comentarios. Es reintentable: no duplica.
 * Además avisa a Informática → Automatismos si salió bien o mal, así la
 * Intranet se entera si este envío deja de correr.
 */
function enviarTicketsALaIntranet() {
  try {
    const resultado = enviarTicketsALaIntranetSinAviso_();
    avisarALaIntranet_('ticketera.envio-a-la-intranet', 'ok', resultado);
    return resultado;
  } catch (e) {
    avisarALaIntranet_('ticketera.envio-a-la-intranet', 'error', e && e.message ? e.message : String(e));
    throw e;
  }
}

function enviarTicketsALaIntranetSinAviso_() {
  const secreto = PropertiesService.getScriptProperties().getProperty('INTRANET_SECRETO');
  if (!secreto) throw new Error('Falta la propiedad del script INTRANET_SECRETO.');

  const libro = SpreadsheetApp.openById(INTRANET_ID_PLANILLA);
  const tickets = leerTicketsParaLaIntranet_(libro.getSheetByName(INTRANET_HOJA_TICKETS));
  const comentarios = leerComentariosParaLaIntranet_(libro.getSheetByName(INTRANET_HOJA_COMENTARIOS));

  const respuesta = UrlFetchApp.fetch(INTRANET_URL, {
    method: 'post',
    contentType: 'application/json',
    headers: { apikey: INTRANET_CLAVE_PUBLICA },
    payload: JSON.stringify({ p_secreto: secreto, p_tickets: tickets, p_comentarios: comentarios }),
    muteHttpExceptions: true,
  });

  const codigo = respuesta.getResponseCode();
  if (codigo !== 200) {
    throw new Error('La Intranet rechazó el envío (' + codigo + '): ' + respuesta.getContentText());
  }
  return respuesta.getContentText();
}

/** Lee la hoja por el nombre de cada columna, no por su posición. */
function leerTicketsParaLaIntranet_(hoja) {
  if (!hoja) throw new Error('No encuentro la hoja ' + INTRANET_HOJA_TICKETS);
  const valores = hoja.getDataRange().getValues();
  const titulos = valores.shift().map(normalizarTitulo_);
  // Se busca por el comienzo del título y sin tildes ni espacios: la
  // planilla dice «Área / Sector» y «Descripción del problema o
  // solicitud», y un retoque del formulario no tiene que cortar el envío.
  const col = function () {
    for (let i = 0; i < arguments.length; i++) {
      const buscado = normalizarTitulo_(arguments[i]);
      const indice = titulos.findIndex(function (t) { return t.indexOf(buscado) === 0; });
      if (indice >= 0) return indice;
    }
    return -1;
  };
  const c = {
    fecha: col('Marca temporal'),
    correo: col('Dirección de correo'),
    area: col('Área'),
    tipo: col('Tipo de solicitud'),
    categoria: col('Categoría'),
    prioridad: col('Prioridad'),
    descripcion: col('Descripción'),
    adjunto: col('Adjunt'),
    impacto: col('Impacto'),
    numero: col('N° Ticket', 'Nº Ticket', 'Ticket'),
    estado: col('Estado'),
    responsable: col('Responsable'),
    inicio: col('Fecha Inicio'),
    cierre: col('Fecha Cierr'),
    observaciones: col('Observaciones'),
    comprometida: col('Fecha comprometida'),
    avance: col('Avance'),
  };
  if (c.numero < 0) throw new Error('No encuentro la columna «N° Ticket».');

  const v = function (fila, i) { return i >= 0 ? fila[i] : ''; };
  return valores
    .filter(function (fila) { return String(v(fila, c.numero)).trim() !== ''; })
    .map(function (fila) {
      return {
        numero: String(v(fila, c.numero)).trim(),
        fecha_solicitud: fechaHoraIntranet_(v(fila, c.fecha)),
        solicitante_correo: textoIntranet_(v(fila, c.correo)),
        area: textoIntranet_(v(fila, c.area)),
        tipo_solicitud: textoIntranet_(v(fila, c.tipo)),
        categoria: textoIntranet_(v(fila, c.categoria)),
        prioridad: textoIntranet_(v(fila, c.prioridad)),
        descripcion: textoIntranet_(v(fila, c.descripcion)),
        adjunto: textoIntranet_(v(fila, c.adjunto)),
        impacto: textoIntranet_(v(fila, c.impacto)),
        estado: textoIntranet_(v(fila, c.estado)),
        responsable_correo: textoIntranet_(v(fila, c.responsable)),
        fecha_inicio: fechaIntranet_(v(fila, c.inicio)),
        fecha_cierre: fechaIntranet_(v(fila, c.cierre)),
        fecha_comprometida: fechaIntranet_(v(fila, c.comprometida)),
        observaciones: textoIntranet_(v(fila, c.observaciones)),
        avance: textoIntranet_(v(fila, c.avance)).replace('%', '').replace(',', '.').trim(),
      };
    });
}

function leerComentariosParaLaIntranet_(hoja) {
  if (!hoja) return [];
  const valores = hoja.getDataRange().getValues();
  valores.shift();
  return valores
    .filter(function (fila) { return String(fila[1]).trim() !== '' && String(fila[3]).trim() !== ''; })
    .map(function (fila) {
      return {
        fecha: fechaHoraIntranet_(fila[0]),
        numero_ticket: String(fila[1]).trim(),
        autor_correo: textoIntranet_(fila[2]),
        mensaje: String(fila[3]),
        id_mensaje: textoIntranet_(fila[4]),
      };
    });
}

function normalizarTitulo_(texto) {
  return String(texto).normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '').toLowerCase();
}

function textoIntranet_(valor) {
  return valor === null || valor === undefined ? '' : String(valor).trim();
}

/** Una celda de fecha y hora, o un texto «d/m/aaaa h:mm:ss», a ISO. */
function fechaHoraIntranet_(valor) {
  const fecha = aFecha_(valor);
  return fecha ? Utilities.formatDate(fecha, INTRANET_ZONA, "yyyy-MM-dd'T'HH:mm:ssXXX") : '';
}

/** Una celda de fecha, o un texto «d/m/aaaa», a «aaaa-mm-dd». */
function fechaIntranet_(valor) {
  const fecha = aFecha_(valor);
  return fecha ? Utilities.formatDate(fecha, INTRANET_ZONA, 'yyyy-MM-dd') : '';
}

function aFecha_(valor) {
  if (valor instanceof Date && !isNaN(valor)) return valor;
  const texto = textoIntranet_(valor);
  const m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]),
    Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
}

/**
 * Avisa a la Intranet (Informática → Automatismos) que un script corrió.
 * Nunca rompe al que avisa: si falta la propiedad o la Intranet no
 * responde, sigue de largo.
 */
function avisarALaIntranet_(clave, resultado, mensaje) {
  try {
    const secreto = PropertiesService.getScriptProperties().getProperty('INTRANET_SECRETO_AUTOMATISMOS');
    if (!secreto) return;
    UrlFetchApp.fetch(INTRANET_URL.replace('recibir_ticketera', 'registrar_latido'), {
      method: 'post',
      contentType: 'application/json',
      headers: { apikey: INTRANET_CLAVE_PUBLICA },
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
}

// ---------------------------------------------------------------------
// Avisos de los demás automatismos de la ticketera
//
// Los activadores de este proyecto se crearon a mano y llaman a cada
// función por su nombre. Para que avisen sin tocar los activadores, en
// Código.gs cada función pasó a llamarse <nombre>_sinAviso_ y acá queda
// una con el nombre original que la corre y avisa cómo salió. Para
// volver atrás: borrar estas funciones y devolverles el nombre en
// Código.gs.
// ---------------------------------------------------------------------

function conAvisoALaIntranet_(clave, funcion, argumentos) {
  try {
    const resultado = funcion.apply(null, argumentos);
    avisarALaIntranet_(clave, 'ok');
    return resultado;
  } catch (e) {
    avisarALaIntranet_(clave, 'error', e && e.message ? e.message : String(e));
    throw e;
  }
}

function revisarSLA() { return conAvisoALaIntranet_('ticketera.revisar-sla', revisarSLA_sinAviso_, arguments); }
function revisarEspera() { return conAvisoALaIntranet_('ticketera.revisar-espera', revisarEspera_sinAviso_, arguments); }
function buscarRespuestas() { return conAvisoALaIntranet_('ticketera.buscar-respuestas', buscarRespuestas_sinAviso_, arguments); }
function sincronizarDirectorio() { return conAvisoALaIntranet_('ticketera.sincronizar-directorio', sincronizarDirectorio_sinAviso_, arguments); }
function resumenSemanal() { return conAvisoALaIntranet_('ticketera.resumen-semanal', resumenSemanal_sinAviso_, arguments); }
function informeSemanalAutomatico() { return conAvisoALaIntranet_('ticketera.informe-semanal', informeSemanalAutomatico_sinAviso_, arguments); }
function informeMensualAutomatico() { return conAvisoALaIntranet_('ticketera.informe-mensual', informeMensualAutomatico_sinAviso_, arguments); }
function informeAnualAutomatico() { return conAvisoALaIntranet_('ticketera.informe-anual', informeAnualAutomatico_sinAviso_, arguments); }
