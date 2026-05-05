/**
 * FerrePOS — Archivado Mensual de Ventas
 * ========================================
 * Mueve las ventas del mes anterior de la hoja VENTAS (base de datos principal)
 * a un Google Sheets separado de almacenamiento histórico.
 *
 * Estructura del archivo de almacenamiento:
 *   • Una hoja por mes, nombrada "Enero 2025", "Febrero 2025", etc.
 *   • Mismas columnas que VENTAS, ordenadas por fecha ascendente.
 *   • Las hojas se acumulan cronológicamente (la más reciente al final).
 *
 * CONFIGURACIÓN — 3 pasos, una sola vez:
 *   1. Deja ARCHIVE_SS_ID = '' y ejecuta archivarVentasMensuales().
 *      → El script crea el archivo de almacenamiento y te imprime su ID en los Logs.
 *   2. Copia ese ID y pégalo en ARCHIVE_SS_ID abajo.
 *   3. Ejecuta setupArchiveTrigger() para crear el trigger mensual automático.
 *
 * NOTA: Este archivo comparte proyecto con Code.gs, por lo que tiene acceso
 * directo a SS_ID, TAB_SALES, SALE_COLS y todas las utilidades definidas allí.
 */

// ──────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN
// ──────────────────────────────────────────────────────────────────────────────

/** ID del Google Sheets de almacenamiento histórico.
 *  Déjalo vacío ('') la primera vez; el script lo crea y te dice el ID. */
var ARCHIVE_SS_ID = '';

/** Nombre del archivo que se crea si ARCHIVE_SS_ID está vacío. */
var ARCHIVE_FILE_NAME = 'Archivo de Ventas — El Obraje';

/** Nombres de meses en español (índice 0 = Enero). */
var MESES_ES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

// ──────────────────────────────────────────────────────────────────────────────
// FUNCIÓN PRINCIPAL
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Archiva las ventas del mes anterior.
 * Llamada automáticamente por el trigger mensual (día 1, ~1:00 AM).
 * También puede ejecutarse manualmente desde el editor en cualquier momento.
 *
 * Flujo:
 *   1. Determina el mes a archivar (mes anterior al actual).
 *   2. Abre / crea el archivo de almacenamiento.
 *   3. Lee VENTAS y separa las filas del mes objetivo.
 *   4. Las escribe en la hoja "Mes Año" del archivo de almacenamiento.
 *   5. Reconstruye VENTAS sin esas filas (borra archivadas, conserva el resto).
 *   6. Envía un email de resumen al dueño del script.
 */
function archivarVentasMensuales() {
  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    // ── Mes a archivar: el mes anterior al actual ────────────────────────────
    var hoy        = new Date();
    var mesObjeto  = new Date(hoy.getFullYear(), hoy.getMonth() - 1, 1);
    var mesIdx     = mesObjeto.getMonth();       // 0-based
    var anio       = mesObjeto.getFullYear();
    var nombreHoja = MESES_ES[mesIdx] + ' ' + anio; // "Marzo 2025"

    Logger.log('══════════════════════════════════════════════');
    Logger.log('Iniciando archivado de: ' + nombreHoja);
    Logger.log('Fecha de ejecución: ' + hoy.toISOString());
    Logger.log('══════════════════════════════════════════════');

    // ── 1. Archivo de almacenamiento ─────────────────────────────────────────
    var archiveSS = abrirOCrearArchivo_();

    // ── 2. Leer ventas de la BD principal ────────────────────────────────────
    var ss         = SpreadsheetApp.openById(SS_ID);
    var salesSheet = ss.getSheetByName(TAB_SALES);
    var allData    = salesSheet.getDataRange().getValues();

    if (allData.length < 2) {
      Logger.log('La hoja VENTAS está vacía. Nada que archivar.');
      return;
    }

    var headers  = allData[0];
    var rows     = allData.slice(1);
    // Filtra filas completamente vacías (pueden aparecer si hubo clearContent previo)
    rows = rows.filter(function(r) { return r.some(function(c) { return c !== ''; }); });

    var fechaCol = headers.indexOf('Fecha');
    if (fechaCol === -1) throw new Error('Columna "Fecha" no encontrada en VENTAS');

    // ── 3. Separar filas ─────────────────────────────────────────────────────
    var toArchive = [];
    var toKeep    = [];

    rows.forEach(function(row) {
      var raw  = row[fechaCol];
      var d    = (raw instanceof Date) ? raw : new Date(raw);
      var esDelMes = !isNaN(d.getTime())
                     && d.getFullYear() === anio
                     && d.getMonth()    === mesIdx;
      (esDelMes ? toArchive : toKeep).push(row);
    });

    if (toArchive.length === 0) {
      Logger.log('No hay ventas del mes ' + nombreHoja + ' en VENTAS. Nada que archivar.');
      return;
    }

    Logger.log('Ventas a archivar : ' + toArchive.length);
    Logger.log('Ventas que quedan : ' + toKeep.length);

    // Ordenar por fecha ascendente antes de escribir
    toArchive.sort(function(a, b) {
      var da = (a[fechaCol] instanceof Date) ? a[fechaCol] : new Date(a[fechaCol]);
      var db = (b[fechaCol] instanceof Date) ? b[fechaCol] : new Date(b[fechaCol]);
      return da - db;
    });

    // ── 4. Escribir en el archivo de almacenamiento ──────────────────────────
    var hojaArchivo = obtenerOCrearHojaMes_(archiveSS, nombreHoja, headers);

    // Verificar que no se dupliquen ventas (si el script se ejecutó parcialmente antes)
    var primeraFilaLibre = hojaArchivo.getLastRow() + 1;
    if (primeraFilaLibre > 2) {
      Logger.log('⚠ La hoja "' + nombreHoja + '" ya tiene ' + (primeraFilaLibre - 2) + ' filas. Se agregarán al final.');
    }

    hojaArchivo
      .getRange(primeraFilaLibre, 1, toArchive.length, headers.length)
      .setValues(toArchive);

    Logger.log('✅ ' + toArchive.length + ' filas escritas en "' + nombreHoja + '".');

    // ── 5. Limpiar VENTAS: elimina archivadas, conserva el resto ────────────
    var numCols = headers.length;
    var lastRow = salesSheet.getLastRow();

    if (lastRow > 1) {
      salesSheet.getRange(2, 1, lastRow - 1, numCols).clearContent();
    }

    if (toKeep.length > 0) {
      salesSheet.getRange(2, 1, toKeep.length, numCols).setValues(toKeep);
    }

    Logger.log('✅ VENTAS reconstruida. Filas conservadas: ' + toKeep.length);

    // ── 6. Email de resumen ──────────────────────────────────────────────────
    enviarResumenEmail_(nombreHoja, toArchive.length, toKeep.length, archiveSS.getUrl());

    Logger.log('══════════════════════════════════════════════');
    Logger.log('Archivado de ' + nombreHoja + ' completado.');
    Logger.log('══════════════════════════════════════════════');

  } catch (err) {
    Logger.log('❌ ERROR en archivarVentasMensuales: ' + err.message);
    throw err; // Re-lanza para que Vercel / el trigger notifique el fallo

  } finally {
    lock.releaseLock();
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// ARCHIVADO MANUAL DE UN MES ESPECÍFICO
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Archiva un mes/año concreto en lugar del mes anterior automático.
 * Útil para recuperar meses que quedaron sin archivar.
 *
 * Uso desde el editor de Apps Script:
 *   archivarMesEspecifico(2025, 3)   // Archiva Marzo 2025
 *   archivarMesEspecifico(2025, 12)  // Archiva Diciembre 2025
 *
 * @param {number} anio  Año con 4 dígitos (ej. 2025)
 * @param {number} mes   Mes en formato 1-12 (1 = Enero, 12 = Diciembre)
 */
function archivarMesEspecifico(anio, mes) {
  if (!anio || !mes || mes < 1 || mes > 12) {
    throw new Error(
      'Parámetros incorrectos.\n' +
      'Uso: archivarMesEspecifico(anio, mes)\n' +
      'Ejemplo: archivarMesEspecifico(2025, 3)'
    );
  }

  var mesIdx     = mes - 1; // 0-based
  var nombreHoja = MESES_ES[mesIdx] + ' ' + anio;

  Logger.log('Archivado manual solicitado: ' + nombreHoja);

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);

  try {
    var archiveSS  = abrirOCrearArchivo_();
    var ss         = SpreadsheetApp.openById(SS_ID);
    var salesSheet = ss.getSheetByName(TAB_SALES);
    var allData    = salesSheet.getDataRange().getValues();

    if (allData.length < 2) {
      Logger.log('La hoja VENTAS está vacía. Nada que archivar.');
      return;
    }

    var headers  = allData[0];
    var rows     = allData.slice(1).filter(function(r) {
      return r.some(function(c) { return c !== ''; });
    });
    var fechaCol = headers.indexOf('Fecha');
    if (fechaCol === -1) throw new Error('Columna "Fecha" no encontrada en VENTAS');

    var toArchive = [];
    var toKeep    = [];

    rows.forEach(function(row) {
      var raw = row[fechaCol];
      var d   = (raw instanceof Date) ? raw : new Date(raw);
      var ok  = !isNaN(d.getTime()) && d.getFullYear() === anio && d.getMonth() === mesIdx;
      (ok ? toArchive : toKeep).push(row);
    });

    if (toArchive.length === 0) {
      Logger.log('No se encontraron ventas de ' + nombreHoja + ' en VENTAS.');
      return;
    }

    toArchive.sort(function(a, b) {
      var da = (a[fechaCol] instanceof Date) ? a[fechaCol] : new Date(a[fechaCol]);
      var db = (b[fechaCol] instanceof Date) ? b[fechaCol] : new Date(b[fechaCol]);
      return da - db;
    });

    var hojaArchivo    = obtenerOCrearHojaMes_(archiveSS, nombreHoja, headers);
    var primeraFilaLib = hojaArchivo.getLastRow() + 1;

    hojaArchivo
      .getRange(primeraFilaLib, 1, toArchive.length, headers.length)
      .setValues(toArchive);

    var numCols = headers.length;
    var lastRow = salesSheet.getLastRow();
    if (lastRow > 1) {
      salesSheet.getRange(2, 1, lastRow - 1, numCols).clearContent();
    }
    if (toKeep.length > 0) {
      salesSheet.getRange(2, 1, toKeep.length, numCols).setValues(toKeep);
    }

    Logger.log('✅ ' + toArchive.length + ' ventas de ' + nombreHoja + ' archivadas. ' + toKeep.length + ' permanecen en VENTAS.');
    enviarResumenEmail_(nombreHoja, toArchive.length, toKeep.length, archiveSS.getUrl());

  } finally {
    lock.releaseLock();
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DEL TRIGGER MENSUAL
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Crea el trigger que ejecuta archivarVentasMensuales() automáticamente
 * el día 1 de cada mes entre la 1:00 y 2:00 AM.
 *
 * EJECUTAR UNA SOLA VEZ manualmente desde el editor de Apps Script.
 * Si se ejecuta de nuevo, elimina el trigger anterior antes de crear el nuevo
 * (evita duplicados).
 */
function setupArchiveTrigger() {
  // Eliminar triggers previos del mismo handler para evitar ejecuciones dobles
  ScriptApp.getProjectTriggers().forEach(function(t) {
    if (t.getHandlerFunction() === 'archivarVentasMensuales') {
      ScriptApp.deleteTrigger(t);
      Logger.log('Trigger previo eliminado.');
    }
  });

  // Crear trigger: día 1 de cada mes, entre 1:00 y 2:00 AM
  ScriptApp.newTrigger('archivarVentasMensuales')
    .timeBased()
    .onMonthDay(1)
    .atHour(1)
    .create();

  Logger.log('✅ Trigger mensual creado: día 1 de cada mes a la 1:00 – 2:00 AM.');

  try {
    SpreadsheetApp.getUi().alert(
      '✅ Trigger creado correctamente.\n\n' +
      'archivarVentasMensuales() se ejecutará automáticamente\n' +
      'el día 1 de cada mes entre la 1:00 y 2:00 AM.\n\n' +
      'Para probar ahora: ejecuta archivarVentasMensuales() manualmente\n' +
      '(archivará las ventas del mes anterior).\n\n' +
      'Para archivar un mes concreto:\n' +
      'archivarMesEspecifico(2025, 3)  →  Marzo 2025'
    );
  } catch (e) {
    // getUi() no disponible si se llama desde trigger — ignorar
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// UTILIDADES INTERNAS
// ──────────────────────────────────────────────────────────────────────────────

/**
 * Abre el archivo de almacenamiento por ARCHIVE_SS_ID.
 * Si ARCHIVE_SS_ID está vacío, crea un nuevo Spreadsheet, imprime su ID
 * en los Logs y lanza un error para que el usuario lo configure.
 */
function abrirOCrearArchivo_() {
  if (ARCHIVE_SS_ID && ARCHIVE_SS_ID.trim() !== '') {
    return SpreadsheetApp.openById(ARCHIVE_SS_ID.trim());
  }

  // ── Crear el archivo por primera vez ──────────────────────────────────────
  var nuevo = SpreadsheetApp.create(ARCHIVE_FILE_NAME);
  var id    = nuevo.getId();
  var url   = nuevo.getUrl();

  // Renombra la hoja vacía por defecto a "Índice"
  var hojaPorDefecto = nuevo.getSheets()[0];
  hojaPorDefecto.setName('Índice');

  // Cabecera del índice
  hojaPorDefecto.getRange('A1').setValue(ARCHIVE_FILE_NAME);
  hojaPorDefecto.getRange('A1')
    .setFontWeight('bold')
    .setFontSize(14)
    .setFontColor('#1e3a5f');
  hojaPorDefecto.getRange('A2').setValue('Archivo histórico de ventas — generado automáticamente por FerrePOS');
  hojaPorDefecto.getRange('A2').setFontColor('#666666').setFontStyle('italic');
  hojaPorDefecto.getRange('A4').setValue('⚠ No modificar ni eliminar este archivo manualmente.');
  hojaPorDefecto.getRange('A4').setFontColor('#cc0000').setFontWeight('bold');
  hojaPorDefecto.setColumnWidth(1, 500);

  Logger.log('╔══════════════════════════════════════════════════════════════╗');
  Logger.log('║  ARCHIVO DE ALMACENAMIENTO CREADO EXITOSAMENTE              ║');
  Logger.log('╠══════════════════════════════════════════════════════════════╣');
  Logger.log('║  Nombre : ' + ARCHIVE_FILE_NAME);
  Logger.log('║  URL    : ' + url);
  Logger.log('║  ID     : ' + id);
  Logger.log('╠══════════════════════════════════════════════════════════════╣');
  Logger.log('║  ⚠ ACCIÓN REQUERIDA:                                        ║');
  Logger.log('║  1. Copia el ID de arriba.                                  ║');
  Logger.log('║  2. Pégalo en la variable ARCHIVE_SS_ID al inicio           ║');
  Logger.log('║     del archivo ArchivoVentas.gs.                           ║');
  Logger.log('║  3. Vuelve a ejecutar esta función.                         ║');
  Logger.log('╚══════════════════════════════════════════════════════════════╝');

  throw new Error(
    'Archivo de almacenamiento creado.\n' +
    'ID: ' + id + '\n\n' +
    'Cópialo en la variable ARCHIVE_SS_ID del script y vuelve a ejecutar.'
  );
}

/**
 * Devuelve la hoja del mes en el archivo de almacenamiento.
 * Si no existe la crea con cabecera formateada y columnas ajustadas.
 *
 * @param {Spreadsheet} archiveSS  - El Spreadsheet de almacenamiento.
 * @param {string}      nombreHoja - Ej. "Marzo 2025".
 * @param {Array}       headers    - Cabecera de VENTAS para replicar.
 * @returns {Sheet}
 */
function obtenerOCrearHojaMes_(archiveSS, nombreHoja, headers) {
  var sheet = archiveSS.getSheetByName(nombreHoja);

  if (sheet) {
    Logger.log('Hoja existente encontrada: ' + nombreHoja);
    return sheet;
  }

  // Insertar la hoja nueva al final (orden cronológico natural)
  sheet = archiveSS.insertSheet(nombreHoja);

  // Cabecera con el mismo estilo que la BD principal
  sheet.getRange(1, 1, 1, headers.length)
    .setValues([headers])
    .setFontWeight('bold')
    .setBackground('#1e3a5f')
    .setFontColor('#ffffff');

  sheet.setFrozenRows(1);

  // Anchos de columna adaptados al contenido típico de VENTAS
  var anchos = {
    'ID_Venta':    150,
    'Fecha':       170,
    'Productos':   450,
    'Total':       110,
    'Metodo_Pago': 140,
    'Cliente':     180,
    'Notas':       220,
    'Codigo_SAT':  160,
  };
  headers.forEach(function(h, i) {
    if (anchos[h]) sheet.setColumnWidth(i + 1, anchos[h]);
  });

  // Alineación de la columna Total a la derecha (si existe)
  var totalIdx = headers.indexOf('Total');
  if (totalIdx !== -1) {
    sheet.getRange(1, totalIdx + 1, sheet.getMaxRows(), 1)
      .setHorizontalAlignment('right');
  }

  Logger.log('Hoja creada: ' + nombreHoja);
  return sheet;
}

/**
 * Envía un correo de resumen al propietario del script.
 * Si falla (sin permisos de Gmail o cuenta de servicio), solo lo loguea — no bloquea.
 */
function enviarResumenEmail_(mes, archivadas, restantes, urlArchivo) {
  try {
    var email  = Session.getActiveUser().getEmail();
    var asunto = '✅ Ventas archivadas — ' + mes + ' | El Obraje';
    var cuerpo =
      'El archivado mensual de ventas se completó correctamente.\n\n' +
      '  Mes archivado     : ' + mes + '\n' +
      '  Ventas archivadas : ' + archivadas + ' registros\n' +
      '  Ventas activas    : ' + restantes  + ' (permanecen en VENTAS)\n\n' +
      'Archivo de almacenamiento histórico:\n' +
      urlArchivo + '\n\n' +
      '— FerrePOS / El Obraje\n' +
      '  Ejecutado: ' + new Date().toLocaleString('es-MX');

    MailApp.sendEmail(email, asunto, cuerpo);
    Logger.log('Email de resumen enviado a: ' + email);
  } catch (e) {
    // El email es informativo — no interrumpe el archivado si falla
    Logger.log('No se pudo enviar email de resumen: ' + e.message);
  }
}
