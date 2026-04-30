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
 *   Codigo_SAT | PROVEEDOR | Stock_Actual | Stock_Minimo | Imagen | Local | Bodeguita
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
  'Codigo_SAT','PROVEEDOR','Stock_Actual','Stock_Minimo','Imagen','Local','Bodeguita'
];

var SALE_COLS   = ['ID_Venta','Fecha','Productos','Total','Metodo_Pago','Cliente','Notas','Codigo_SAT'];
var CLIENT_COLS = ['ID_Cliente','Nombre','Telefono','Tipo_Precio'];
// ─────────────────────────────────────────────────────────────────────────────


// ── GET ───────────────────────────────────────────────────────────────────────
function doGet(e) {
  var p      = e.parameter || {};
  var action = p.action || 'getInventory';
  var offset = parseInt(p.offset || '0')  || 0;
  var limit  = parseInt(p.limit  || '0')  || 0; // 0 = sin límite (devuelve todo)

  try {
    if (action === 'getInventory')   return jsonOk(getInventory_(offset, limit));
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

/**
 * Devuelve el inventario paginado.
 * offset  = fila inicial (0-based, sin contar cabecera)
 * limit   = cuántas filas devolver (0 = todo)
 *
 * Respuesta: { data, total, hasMore, timestamp }
 *
 * OPTIMIZACIÓN para inventarios grandes (10,000+ productos):
 *   En lugar de leer TODAS las filas con getDataRange() en cada petición
 *   (lo que implicaría leer 18,000 filas 9 veces), se lee SOLO el rango
 *   exacto del lote actual con getRange(). Reduce la carga de Sheets
 *   de O(n × lotes) a O(lote) por petición.
 */
function getInventory_(offset, limit) {
  var sheet   = getSheet_(TAB_INVENTORY);
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();

  if (lastRow < 2 || lastCol < 1) {
    return { data: [], total: 0, hasMore: false, timestamp: now_() };
  }

  var total   = lastRow - 1;                           // filas de datos (sin cabecera)
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];

  var start = (offset && offset > 0) ? offset : 0;    // 0-based desde la primera fila de datos
  var count = (limit  && limit  > 0)
    ? Math.min(limit, total - start)
    : (total - start);

  if (start >= total || count <= 0) {
    return { data: [], total: total, hasMore: false, timestamp: now_() };
  }

  // Lee SOLO las filas del lote actual — fila Sheets = offset + 2 (cabecera ocupa fila 1)
  var sheetStartRow = start + 2;
  var pageValues    = sheet.getRange(sheetStartRow, 1, count, lastCol).getValues();

  var data = pageValues.map(function(row) {
    var obj = {};
    headers.forEach(function(h, i) { obj[String(h)] = row[i]; });
    return obj;
  });

  return {
    data:      data,
    total:     total,
    hasMore:   (start + count) < total,
    timestamp: now_(),
  };
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
      Bar_code:           String(obj.Bar_code    || ''),
      Descripcion:        String(obj.Descripcion || ''),
      PROVEEDOR:          String(obj.PROVEEDOR    || ''),
      Stock_Actual:       parseNum_(obj.Stock_Actual),
      Stock_Minimo:       parseNum_(obj.Stock_Minimo),
      Precio_publico_IVA: parseNum_(obj.Precio_publico_IVA),
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
 * Cada item puede tener `warehouse`: 'Local' | 'Bodeguita'.
 * Se descuenta en esa columna Y en Stock_Actual.
 *
 * ESTRATEGIA "VALIDAR TODO ANTES DE ESCRIBIR NADA":
 *   Paso 1 — Valida stock suficiente para TODOS los ítems. Si alguno falla,
 *             se lanza un error SIN haber modificado ninguna celda.
 *   Paso 2 — Solo si el paso 1 completa sin errores, aplica todos los cambios.
 *   Esto elimina el riesgo de inventario parcialmente descontado ante un fallo a mitad.
 */
function registerSale_(payload) {
  var sale  = payload.sale  || {};
  var items = payload.items || [];
  if (!items.length) throw new Error('La venta no contiene artículos');

  var ss       = SpreadsheetApp.openById(SS_ID);
  var invSheet = ss.getSheetByName(TAB_INVENTORY);
  var invData  = invSheet.getDataRange().getValues();
  var headers  = invData[0];

  var bcCol     = indexOrError_(headers, 'Bar_code');
  var stkCol    = indexOrError_(headers, 'Stock_Actual');
  var a1Col     = indexOrError_(headers, 'Local');
  var a2Col     = indexOrError_(headers, 'Bodeguita');
  var codigoCol = headers.indexOf('Codigo'); // -1 si no existe — no es error
  var claveCol  = headers.indexOf('Clave');  // ídem

  // ── PASO 1: VALIDAR TODO — sin tocar ninguna celda ───────────────────────
  var updates = []; // acumula { rowIdx, stkCol, newStock, whCol, newWh }

  items.forEach(function(item) {
    var found    = false;
    var searchKey = String(item.Bar_code).trim();
    for (var i = 1; i < invData.length; i++) {
      // Busca primero por Bar_code; si está vacío, por Codigo y luego por Clave.
      // Esto permite vender productos que no tienen código de barras asignado
      // en Sheets (el PWA usa Codigo/Clave como clave de respaldo).
      var rowBarCode = String(invData[i][bcCol]).trim();
      var rowCodigo  = codigoCol >= 0 ? String(invData[i][codigoCol]).trim() : '';
      var rowClave   = claveCol  >= 0 ? String(invData[i][claveCol ]).trim() : '';
      var matches    = rowBarCode === searchKey
                    || (rowBarCode === '' && rowCodigo !== '' && rowCodigo === searchKey)
                    || (rowBarCode === '' && rowCodigo === '' && rowClave !== '' && rowClave === searchKey);
      if (!matches) continue;
      found = true;

      var curStock = parseNum_(invData[i][stkCol]);
      var qty      = Number(item.quantity);
      var newStock = curStock - qty;

      if (newStock < 0) {
        throw new Error(
          'Stock insuficiente para: ' + (item.Descripcion || item.Bar_code) +
          ' (disponible: ' + curStock + ', solicitado: ' + qty + ')'
        );
      }

      var whCol = (item.warehouse === 'Bodeguita') ? a2Col : a1Col;
      var curWh = parseNum_(invData[i][whCol]);
      var newWh = Math.max(0, curWh - qty);

      updates.push({
        rowIdx:   i,
        stkCol:   stkCol,
        newStock: newStock,
        whCol:    whCol,
        newWh:    newWh,
      });
      break;
    }
    if (!found) {
      throw new Error('Producto no encontrado en inventario: ' + (item.Bar_code || item.Descripcion));
    }
  });

  // ── PASO 2: APLICAR — solo llega aquí si TODOS los ítems pasaron validación ──
  updates.forEach(function(u) {
    invSheet.getRange(u.rowIdx + 1, u.stkCol + 1).setValue(u.newStock);
    invSheet.getRange(u.rowIdx + 1, u.whCol  + 1).setValue(u.newWh);
  });

  // Registra en VENTAS
  var saleId = 'VTA-' + new Date().getTime();

  // Formato legible para la columna Productos
  var productsSummary = items.map(function(item) {
    var precio = Number(item.activePrice) || 0;
    var subtotal = precio * Number(item.quantity);
    return item.quantity + 'x  ' + (item.Descripcion || '') +
           '  —  $' + precio.toLocaleString() +
           ' c/u  |  Subtotal: $' + subtotal.toLocaleString() +
           '  (' + (item.warehouse || '') + ')';
  }).join('\n');

  // Códigos SAT únicos de todos los productos de la venta
  var satMap = {};
  items.forEach(function(item) {
    var sat = String(item.Codigo_SAT || '').trim();
    if (sat) satMap[sat] = true;
  });
  var satCodes = Object.keys(satMap).join(', ');

  var salesSheet = ss.getSheetByName(TAB_SALES);
  salesSheet.appendRow([
    saleId,
    now_(),
    productsSummary,
    Number(sale.total) || 0,
    sale.paymentMethod || '',
    sale.customer      || '',
    sale.notas         || '',
    satCodes,
  ]);

  return { success: true, saleId: saleId, timestamp: now_() };
}

/**
 * Actualiza los campos de un producto (búsqueda por Bar_code).
 */
function updateProduct_(payload) {
  var product = payload.product || {};
  if (!product.Bar_code) throw new Error('Bar_code es obligatorio');

  var sheet      = getSheet_(TAB_INVENTORY);
  var data       = sheet.getDataRange().getValues();
  var headers    = data[0];
  var bcCol      = indexOrError_(headers, 'Bar_code');
  var codigoCol  = headers.indexOf('Codigo');
  var claveCol   = headers.indexOf('Clave');
  var searchKey  = String(product.Bar_code).trim();

  for (var i = 1; i < data.length; i++) {
    // Mismo criterio de búsqueda que registerSale_: Bar_code → Codigo → Clave
    var rowBarCode = String(data[i][bcCol]).trim();
    var rowCodigo  = codigoCol >= 0 ? String(data[i][codigoCol]).trim() : '';
    var rowClave   = claveCol  >= 0 ? String(data[i][claveCol ]).trim() : '';
    var matches    = rowBarCode === searchKey
                  || (rowBarCode === '' && rowCodigo !== '' && rowCodigo === searchKey)
                  || (rowBarCode === '' && rowCodigo === '' && rowClave !== '' && rowClave === searchKey);
    if (!matches) continue;
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

/**
 * Convierte un valor de celda a número limpio.
 * Maneja: 5, "5", "$5.00", "$5,000.00", "5,5" (coma decimal), etc.
 */
function parseNum_(val) {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return val;
  return parseFloat(String(val).replace(/[$\s]/g, '').replace(/,/g, '')) || 0;
}

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
