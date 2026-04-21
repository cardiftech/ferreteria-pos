/**
 * FerrePOS — Google Apps Script API v2
 * ======================================
 * Despliega como Web App:
 *   Execute as: Me
 *   Who has access: Anyone
 *
 * Columnas exactas de Google Sheets (sin tildes, sin espacios en el nombre de clave):
 *
 * INVENTARIO (A→P):
 *   Codigo | Clave | Descripcion | Unidad | Bar_code |
 *   Precio_distribuidor_IVA | Precio_mayoreo_IVA | Precio_medio_mayoreo_IVA | Precio_publico_IVA |
 *   Codigo_SAT | Marca | Stock_Actual | Stock_Minimo | Imagen | Almacen_1 | Almacen_2
 *
 * VENTAS (A→G):
 *   ID_Venta | Fecha | Productos | Total | Metodo_Pago | Cliente | Pagos
 *
 * CLIENTES (A→D):
 *   ID_Cliente | Nombre | Telefono | Tipo_Precio
 */

// ── CONFIGURACIÓN ─────────────────────────────────────────────────────────────
var SS_ID         = '1gLNQGu7lulgbw1ylRGfoY3YTnePpHoxWzFl5tTt_th4';
var TAB_INVENTORY = 'INVENTARIO';
var TAB_SALES     = 'VENTAS';
var TAB_CLIENTS   = 'CLIENTES';

var INV_COLS = [
  'Codigo','Clave','Descripcion','Unidad','Bar_code',
  'Precio_distribuidor_IVA','Precio_mayoreo_IVA','Precio_medio_mayoreo_IVA','Precio_publico_IVA',
  'Codigo_SAT','Marca','Stock_Actual','Stock_Minimo','Imagen','Almacen_1','Almacen_2'
];

var SALE_COLS   = ['ID_Venta','Fecha','Productos','Total','Metodo_Pago','Cliente','Pagos'];
var CLIENT_COLS = ['ID_Cliente','Nombre','Telefono','Tipo_Precio'];
// ─────────────────────────────────────────────────────────────────────────────


// ── GET ───────────────────────────────────────────────────────────────────────
function doGet(e) {
  var action = (e.parameter && e.parameter.action) || 'getInventory';
  try {
    if (action === 'getInventory')   return jsonOk(getInventory_());
    if (action === 'getClients')     return jsonOk(getClients_());
    if (action === 'getSalesReport') return jsonOk(getSalesReport_());
    if (action === 'ping')           return jsonOk({ status: 'ok', ts: new Date().toISOString() });
    return jsonErr('Acción GET desconocida: ' + action, 400);
  } catch (err) {
    return jsonErr(err.message, 500);
  }
}


// ── POST ──────────────────────────────────────────────────────────────────────
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
    var payload = JSON.parse(e.postData.contents);
    var action  = payload.action;

    if (action === 'registerSale')  return jsonOk(registerSale_(payload));
    if (action === 'updateProduct') return jsonOk(updateProduct_(payload));
    if (action === 'addProduct')    return jsonOk(addProduct_(payload));
    if (action === 'addClient')     return jsonOk(addClient_(payload));

    return jsonErr('Acción POST desconocida: ' + action, 400);
  } catch (err) {
    return jsonErr(err.message, 500);
  } finally {
    lock.releaseLock();
  }
}


// ── HANDLERS ─────────────────────────────────────────────────────────────────

function getInventory_() {
  var sheet  = getSheet_(TAB_INVENTORY);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return { data: [], timestamp: now_(), count: 0 };

  var headers = values[0];
  var data    = values.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[String(h)] = row[i]; });
    return obj;
  });

  return { data: data, timestamp: now_(), count: data.length };
}

function getClients_() {
  var sheet = getSheet_(TAB_CLIENTS);
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return { data: [], timestamp: now_() };

  var headers = values[0];
  var data    = values.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[String(h)] = row[i]; });
    return obj;
  });

  return { data: data, timestamp: now_() };
}

/**
 * Devuelve inventario + ventas para el panel admin.
 */
function getSalesReport_() {
  var ss = SpreadsheetApp.openById(SS_ID);

  // Inventario
  var invSheet   = ss.getSheetByName(TAB_INVENTORY);
  var invValues  = invSheet.getDataRange().getValues();
  var invHeaders = invValues[0];
  var products   = invValues.slice(1).map(function(row) {
    var obj = {};
    invHeaders.forEach(function(h, i) { obj[String(h)] = row[i]; });
    return {
      Bar_code:          String(obj.Bar_code   || ''),
      Descripcion:       String(obj.Descripcion || ''),
      Marca:             String(obj.Marca        || ''),
      Stock_Actual:      Number(obj.Stock_Actual) || 0,
      Stock_Minimo:      Number(obj.Stock_Minimo) || 0,
      Precio_publico_IVA: Number(obj.Precio_publico_IVA) || 0,
    };
  });

  // Ventas
  var salesSheet  = ss.getSheetByName(TAB_SALES);
  var salesValues = salesSheet.getDataRange().getValues();
  var sales = [];

  if (salesValues.length > 1) {
    var sHeaders = salesValues[0];
    sales = salesValues.slice(1).map(function(row) {
      var obj = {};
      sHeaders.forEach(function(h, i) { obj[String(h)] = row[i]; });

      var fechaRaw = obj.Fecha;
      var fechaStr = '';
      if (fechaRaw instanceof Date) {
        fechaStr = fechaRaw.toISOString();
      } else if (fechaRaw) {
        fechaStr = String(fechaRaw);
      }

      return {
        ID_Venta:    String(obj.ID_Venta    || ''),
        Fecha:       fechaStr,
        Productos:   String(obj.Productos   || '[]'),
        Total:       Number(obj.Total)       || 0,
        Metodo_Pago: String(obj.Metodo_Pago || ''),
        Cliente:     String(obj.Cliente     || ''),
      };
    }).reverse();
  }

  return { products: products, sales: sales, timestamp: now_() };
}

/**
 * Registra una venta en VENTAS y descuenta stock en INVENTARIO.
 * Cada item puede tener `warehouse`: 'Almacen_1' | 'Almacen_2'.
 * Se descuenta en esa columna Y en Stock_Actual.
 */
function registerSale_(payload) {
  var sale  = payload.sale  || {};
  var items = payload.items || [];
  if (!items.length) throw new Error('La venta no contiene artículos');

  var ss       = SpreadsheetApp.openById(SS_ID);
  var invSheet = ss.getSheetByName(TAB_INVENTORY);
  var invData  = invSheet.getDataRange().getValues();
  var headers  = invData[0];

  var bcCol  = indexOrError_(headers, 'Bar_code');
  var stkCol = indexOrError_(headers, 'Stock_Actual');
  var a1Col  = indexOrError_(headers, 'Almacen_1');
  var a2Col  = indexOrError_(headers, 'Almacen_2');

  items.forEach(function(item) {
    for (var i = 1; i < invData.length; i++) {
      if (String(invData[i][bcCol]).trim() !== String(item.Bar_code).trim()) continue;

      var curStock = Number(invData[i][stkCol]);
      var qty      = Number(item.quantity);
      var newStock = curStock - qty;
      if (newStock < 0) throw new Error('Stock insuficiente para: ' + item.Descripcion + ' (disponible: ' + curStock + ')');

      // Descuenta Stock_Actual
      invSheet.getRange(i + 1, stkCol + 1).setValue(newStock);
      invData[i][stkCol] = newStock;

      // Descuenta el almacén correspondiente
      var whCol = (item.warehouse === 'Almacen_2') ? a2Col : a1Col;
      var curWh = Number(invData[i][whCol]);
      var newWh = Math.max(0, curWh - qty);
      invSheet.getRange(i + 1, whCol + 1).setValue(newWh);
      invData[i][whCol] = newWh;

      break;
    }
  });

  // Registra en VENTAS
  var saleId = 'VTA-' + new Date().getTime();
  var productsSummary = JSON.stringify(items.map(function(i) {
    return {
      c: i.Bar_code,
      n: i.Descripcion,
      q: i.quantity,
      p: i.activePrice,
      wh: i.warehouse,
      pl: i.priceLevel,
    };
  }));

  var salesSheet = ss.getSheetByName(TAB_SALES);
  salesSheet.appendRow([
    saleId,
    now_(),
    productsSummary,
    Number(sale.total) || 0,
    sale.paymentMethod || '',
    sale.customer      || '',
    sale.pagos         || '',
  ]);

  return { success: true, saleId: saleId, timestamp: now_() };
}

/**
 * Actualiza los campos de un producto (búsqueda por Bar_code).
 */
function updateProduct_(payload) {
  var product = payload.product || {};
  if (!product.Bar_code) throw new Error('Bar_code es obligatorio');

  var sheet   = getSheet_(TAB_INVENTORY);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var bcCol   = indexOrError_(headers, 'Bar_code');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][bcCol]).trim() !== String(product.Bar_code).trim()) continue;
    headers.forEach(function(h, j) {
      if (product[h] !== undefined && product[h] !== null) {
        sheet.getRange(i + 1, j + 1).setValue(product[h]);
      }
    });
    return { success: true, message: 'Producto actualizado' };
  }

  throw new Error('Producto no encontrado: ' + product.Bar_code);
}

/**
 * Agrega un nuevo producto al inventario.
 */
function addProduct_(payload) {
  var product = payload.product || {};
  if (!product.Bar_code) throw new Error('Bar_code es obligatorio');

  var sheet   = getSheet_(TAB_INVENTORY);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  var data  = sheet.getDataRange().getValues();
  var bcCol = headers.indexOf('Bar_code');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][bcCol]).trim() === String(product.Bar_code).trim()) {
      throw new Error('Ya existe un producto con ese Bar_code: ' + product.Bar_code);
    }
  }

  var row = headers.map(function(h) { return product[h] !== undefined ? product[h] : ''; });
  sheet.appendRow(row);
  return { success: true, message: 'Producto agregado' };
}

/**
 * Agrega un nuevo cliente a CLIENTES.
 */
function addClient_(payload) {
  var client = payload.client || {};
  if (!client.Nombre) throw new Error('Nombre es obligatorio');

  var sheet = getSheet_(TAB_CLIENTS);
  var id    = 'CLI-' + new Date().getTime();

  sheet.appendRow([
    id,
    client.Nombre      || '',
    client.Telefono    || '',
    client.Tipo_Precio || 'Precio_publico_IVA',
  ]);

  return { success: true, ID_Cliente: id };
}


// ── UTILIDADES ────────────────────────────────────────────────────────────────

function indexOrError_(headers, col) {
  var idx = headers.indexOf(col);
  if (idx === -1) throw new Error('Columna no encontrada en INVENTARIO: ' + col);
  return idx;
}

function getSheet_(name) {
  var sheet = SpreadsheetApp.openById(SS_ID).getSheetByName(name);
  if (!sheet) throw new Error('Pestaña no encontrada: ' + name);
  return sheet;
}

function now_() {
  return new Date().toISOString();
}

function jsonOk(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function jsonErr(msg, code) {
  return ContentService
    .createTextOutput(JSON.stringify({ error: msg, code: code || 500 }))
    .setMimeType(ContentService.MimeType.JSON);
}


// ── SETUP INICIAL (ejecutar una sola vez manualmente) ─────────────────────────
/**
 * Crea las pestañas INVENTARIO, VENTAS y CLIENTES con sus cabeceras si no existen.
 * En el editor de Apps Script: selecciona esta función y pulsa ▶ Run.
 */
function setupSheets() {
  var ss = SpreadsheetApp.openById(SS_ID);

  function ensureSheet(name, cols) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
    }
    // Siempre actualiza la cabecera (no borra datos)
    sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
    sheet.getRange(1, 1, 1, cols.length)
      .setFontWeight('bold')
      .setBackground('#1e40af')
      .setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    return sheet;
  }

  ensureSheet(TAB_INVENTORY, INV_COLS);
  ensureSheet(TAB_SALES,     SALE_COLS);
  ensureSheet(TAB_CLIENTS,   CLIENT_COLS);

  SpreadsheetApp.getUi().alert('✅ Pestañas configuradas correctamente.');
}
