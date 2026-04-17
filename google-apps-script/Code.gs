/**
 * FerrePOS — Google Apps Script API
 * ===================================
 * Despliega como Web App:
 *   Execute as: Me
 *   Who has access: Anyone (o Anyone with Google account para mayor seguridad)
 *
 * Luego copia la URL resultante a VITE_GAS_URL en tu archivo .env
 */

// ── CONFIGURACIÓN ────────────────────────────────────────────────────────────
const SS_ID         = '1gLNQGu7lulgbw1ylRGfoY3YTnePpHoxWzFl5tTt_th4';
const TAB_INVENTORY = 'INVENTARIO';
const TAB_SALES     = 'VENTAS';

// Columnas esperadas (orden en la hoja)
const INV_COLS  = ['Codigo_Barras','Producto','Categoria','Stock_Actual','Precio_Venta','Imagen','Stock_Minimo'];
const SALE_COLS = ['ID_Venta','Fecha','Productos','Total','Metodo_Pago','Factura_PDF','Cliente','Notas'];
// ─────────────────────────────────────────────────────────────────────────────


// ── GET ───────────────────────────────────────────────────────────────────────
function doGet(e) {
  const action = (e.parameter && e.parameter.action) || 'getInventory';

  try {
    if (action === 'getInventory') return jsonOk(getInventory_());
    if (action === 'ping')         return jsonOk({ status: 'ok', ts: new Date().toISOString() });
    return jsonErr('Acción GET desconocida: ' + action, 400);
  } catch (err) {
    return jsonErr(err.message, 500);
  }
}


// ── POST ──────────────────────────────────────────────────────────────────────
function doPost(e) {
  // Lock para evitar condiciones de carrera en escrituras concurrentes
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);

  try {
    const payload = JSON.parse(e.postData.contents);
    const { action } = payload;

    if (action === 'registerSale')  return jsonOk(registerSale_(payload));
    if (action === 'updateProduct') return jsonOk(updateProduct_(payload));
    if (action === 'addProduct')    return jsonOk(addProduct_(payload));

    return jsonErr('Acción POST desconocida: ' + action, 400);
  } catch (err) {
    return jsonErr(err.message, 500);
  } finally {
    lock.releaseLock();
  }
}


// ── HANDLERS ─────────────────────────────────────────────────────────────────

/**
 * Devuelve todo el inventario como array de objetos + timestamp para el cliente.
 */
function getInventory_() {
  const sheet  = getSheet_(TAB_INVENTORY);
  const values = sheet.getDataRange().getValues();
  if (values.length < 2) return { data: [], timestamp: now_(), count: 0 };

  const headers = values[0];
  const data    = values.slice(1).map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[h] = row[i]; });
    return obj;
  });

  return { data: data, timestamp: now_(), count: data.length };
}

/**
 * Registra una venta en VENTAS y descuenta el stock en INVENTARIO.
 * Payload esperado: { sale: { total, paymentMethod, customer, notes }, items: [...] }
 */
function registerSale_(payload) {
  var sale  = payload.sale  || {};
  var items = payload.items || [];

  if (!items.length) throw new Error('La venta no contiene artículos');

  var ss       = SpreadsheetApp.openById(SS_ID);
  var invSheet = ss.getSheetByName(TAB_INVENTORY);
  var invData  = invSheet.getDataRange().getValues();
  var headers  = invData[0];
  var bcCol    = headers.indexOf('Codigo_Barras');
  var stkCol   = headers.indexOf('Stock_Actual');

  if (bcCol === -1 || stkCol === -1) {
    throw new Error('Columnas Codigo_Barras o Stock_Actual no encontradas en INVENTARIO');
  }

  // Descuenta stock
  items.forEach(function(item) {
    for (var i = 1; i < invData.length; i++) {
      if (String(invData[i][bcCol]) === String(item.Codigo_Barras)) {
        var current  = Number(invData[i][stkCol]);
        var newStock = current - Number(item.quantity);
        if (newStock < 0) {
          throw new Error('Stock insuficiente para: ' + item.Producto + ' (disponible: ' + current + ')');
        }
        invSheet.getRange(i + 1, stkCol + 1).setValue(newStock);
        invData[i][stkCol] = newStock; // actualiza copia en memoria para validaciones
        break;
      }
    }
  });

  // Registra la venta
  var saleId = 'VTA-' + new Date().getTime();
  var productsSummary = JSON.stringify(items.map(function(i) {
    return { c: i.Codigo_Barras, n: i.Producto, q: i.quantity, p: i.Precio_Venta };
  }));

  var salesSheet = ss.getSheetByName(TAB_SALES);
  salesSheet.appendRow([
    saleId,
    now_(),
    productsSummary,
    Number(sale.total) || 0,
    sale.paymentMethod || '',
    '',                  // Factura_PDF (vacío por ahora)
    sale.customer || '',
    sale.notes    || '',
  ]);

  return { success: true, saleId: saleId, timestamp: now_() };
}

/**
 * Actualiza los campos de un producto existente (búsqueda por Codigo_Barras).
 * Payload esperado: { product: { Codigo_Barras, ...campos } }
 */
function updateProduct_(payload) {
  var product = payload.product || {};
  if (!product.Codigo_Barras) throw new Error('Codigo_Barras es obligatorio');

  var sheet   = getSheet_(TAB_INVENTORY);
  var data    = sheet.getDataRange().getValues();
  var headers = data[0];
  var bcCol   = headers.indexOf('Codigo_Barras');

  for (var i = 1; i < data.length; i++) {
    if (String(data[i][bcCol]) === String(product.Codigo_Barras)) {
      headers.forEach(function(h, j) {
        if (product[h] !== undefined && product[h] !== null) {
          sheet.getRange(i + 1, j + 1).setValue(product[h]);
        }
      });
      return { success: true, message: 'Producto actualizado' };
    }
  }

  throw new Error('Producto no encontrado: ' + product.Codigo_Barras);
}

/**
 * Agrega un nuevo producto al inventario.
 * Payload esperado: { product: { Codigo_Barras, Producto, ... } }
 */
function addProduct_(payload) {
  var product = payload.product || {};
  if (!product.Codigo_Barras) throw new Error('Codigo_Barras es obligatorio');

  var sheet   = getSheet_(TAB_INVENTORY);
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];

  // Verificar duplicado
  var data  = sheet.getDataRange().getValues();
  var bcCol = headers.indexOf('Codigo_Barras');
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][bcCol]) === String(product.Codigo_Barras)) {
      throw new Error('Ya existe un producto con ese código: ' + product.Codigo_Barras);
    }
  }

  var row = headers.map(function(h) { return product[h] !== undefined ? product[h] : ''; });
  sheet.appendRow(row);

  return { success: true, message: 'Producto agregado' };
}


// ── UTILIDADES ────────────────────────────────────────────────────────────────

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
 * Crea las pestañas INVENTARIO y VENTAS con sus cabeceras si no existen.
 * En el editor de Apps Script: selecciona esta función y pulsa ▶ Run.
 */
function setupSheets() {
  var ss = SpreadsheetApp.openById(SS_ID);

  function ensureSheet(name, cols) {
    var sheet = ss.getSheetByName(name);
    if (!sheet) {
      sheet = ss.insertSheet(name);
      sheet.getRange(1, 1, 1, cols.length).setValues([cols]);
      sheet.getRange(1, 1, 1, cols.length)
        .setFontWeight('bold')
        .setBackground('#1e40af')
        .setFontColor('#ffffff');
      sheet.setFrozenRows(1);
    }
    return sheet;
  }

  ensureSheet(TAB_INVENTORY, INV_COLS);
  ensureSheet(TAB_SALES,     SALE_COLS);

  SpreadsheetApp.getUi().alert('✅ Pestañas configuradas correctamente.');
}
