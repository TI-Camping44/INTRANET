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

/** Manda todos los tickets y comentarios. Es reintentable: no duplica. */
function enviarTicketsALaIntranet() {
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
  const titulos = valores.shift().map(function (t) { return String(t).trim(); });
  const col = function (nombre) { return titulos.indexOf(nombre); };
  const c = {
    fecha: col('Marca temporal'),
    correo: col('Dirección de correo electrónico') >= 0 ? col('Dirección de correo electrónico') : col('Dirección de correo'),
    area: col('Área/Sector'),
    tipo: col('Tipo de solicitud'),
    categoria: col('Categoría del problema'),
    prioridad: col('Prioridad'),
    descripcion: col('Descripción'),
    adjunto: col('Adjunto'),
    impacto: col('Impacto'),
    numero: col('N° Ticket'),
    estado: col('Estado'),
    responsable: col('Responsable'),
    inicio: col('Fecha Inicio'),
    cierre: col('Fecha Cierra'),
    observaciones: col('Observaciones TI'),
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
        solicitante_correo: texto_(v(fila, c.correo)),
        area: texto_(v(fila, c.area)),
        tipo_solicitud: texto_(v(fila, c.tipo)),
        categoria: texto_(v(fila, c.categoria)),
        prioridad: texto_(v(fila, c.prioridad)),
        descripcion: texto_(v(fila, c.descripcion)),
        adjunto: texto_(v(fila, c.adjunto)),
        impacto: texto_(v(fila, c.impacto)),
        estado: texto_(v(fila, c.estado)),
        responsable_correo: texto_(v(fila, c.responsable)),
        fecha_inicio: fechaIntranet_(v(fila, c.inicio)),
        fecha_cierre: fechaIntranet_(v(fila, c.cierre)),
        fecha_comprometida: fechaIntranet_(v(fila, c.comprometida)),
        observaciones: texto_(v(fila, c.observaciones)),
        avance: texto_(v(fila, c.avance)).replace('%', '').replace(',', '.').trim(),
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
        autor_correo: texto_(fila[2]),
        mensaje: String(fila[3]),
        id_mensaje: texto_(fila[4]),
      };
    });
}

function texto_(valor) {
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
  const texto = texto_(valor);
  const m = texto.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  return new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]),
    Number(m[4] || 0), Number(m[5] || 0), Number(m[6] || 0));
}
