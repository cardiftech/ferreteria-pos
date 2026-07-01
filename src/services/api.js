const GAS_URL = import.meta.env.VITE_GAS_URL;

if (!GAS_URL || GAS_URL.includes('TU_SCRIPT_ID')) {
  console.warn(
    '[API] VITE_GAS_URL no está configurada. ' +
    'Copia .env.example a .env y agrega la URL de tu Web App de GAS.'
  );
}

// 45 s: da margen suficiente al cold-start de GAS (~20-25 s el primer request del día)
const API_TIMEOUT_MS = 45_000;
// Reintentos para errores de red transitorios (micro-cortes de WiFi/móvil).
// Los timeouts NO se reintentan — si tardó 45 s una vez, volvería a tardar.
const MAX_RETRIES    = 2;

async function request({ method = 'GET', params = {}, body } = {}) {
  let url = GAS_URL;

  if (method === 'GET' && Object.keys(params).length) {
    url += '?' + new URLSearchParams(params).toString();
  }

  let lastErr;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    // Espera progresiva antes de cada reintento: 0 ms → 1 000 ms → 2 000 ms
    if (attempt > 0) {
      await new Promise(r => setTimeout(r, 1_000 * attempt));
    }

    const controller = new AbortController();
    const timeoutId  = setTimeout(() => controller.abort(), API_TIMEOUT_MS);

    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal:   controller.signal,
        ...(body !== undefined && { body: JSON.stringify(body) }),
      });

      const text = await res.text();
      try {
        return JSON.parse(text);
      } catch {
        throw new Error(`Respuesta inválida del servidor: ${text.slice(0, 120)}`);
      }
    } catch (err) {
      if (err.name === 'AbortError') {
        // Timeout: no tiene sentido reintentar — lanza de inmediato
        throw new Error('El servidor tardó demasiado (45 s) — verifica tu conexión e intenta de nuevo');
      }

      // Los POST NO se reintentan: si GAS procesó la escritura pero la respuesta
      // se perdió, reintentar registraría la misma operación dos veces
      // (venta duplicada, producto duplicado, etc.).
      // Solo los GET son idempotentes y pueden reintentarse con seguridad.
      if (method !== 'GET') throw err;

      lastErr = err;
      // Sigue al siguiente intento (si queda alguno)
      continue;
    } finally {
      // finally cubre todos los caminos de salida (return, throw, continue)
      clearTimeout(timeoutId);
    }
  }

  // Agotados los reintentos — lanza el último error de red
  throw lastErr;
}

export const api = {
  getInventory: ({ offset = 0, limit = 0 } = {}) =>
    request({ params: { action: 'getInventory', offset, limit } }),

  getClients: () =>
    request({ params: { action: 'getClients' } }),

  // Ventas recientes de la hoja VENTAS (más nueva primero). limit = cuántas traer.
  getSales: ({ limit = 200 } = {}) =>
    request({ params: { action: 'getSales', limit } }),

  // Reporte completo (ventas + inventario). Respaldo de SOLO LECTURA para el
  // monitor de ventas cuando el Code.gs aún no tiene getSales desplegado.
  getSalesReport: () =>
    request({ params: { action: 'getSalesReport' } }),

  registerSale: (data) =>
    request({ method: 'POST', body: { action: 'registerSale', ...data } }),

  updateProduct: (product) =>
    request({ method: 'POST', body: { action: 'updateProduct', product } }),

  addProduct: (product) =>
    request({ method: 'POST', body: { action: 'addProduct', product } }),

  addClient: (client) =>
    request({ method: 'POST', body: { action: 'addClient', client } }),

  // Edita campos básicos de una venta (Total, Metodo_Pago, Cliente, Notas) por ID_Venta.
  updateSale: (sale) =>
    request({ method: 'POST', body: { action: 'updateSale', sale } }),

  // Elimina una venta por ID_Venta. No restaura stock — solo quita el registro.
  deleteSale: (sale) =>
    request({ method: 'POST', body: { action: 'deleteSale', sale } }),

  ping: () =>
    request({ params: { action: 'ping' } }),
};
