const GAS_URL = import.meta.env.VITE_GAS_URL;

if (!GAS_URL || GAS_URL.includes('TU_SCRIPT_ID')) {
  console.warn(
    '[API] VITE_GAS_URL no está configurada. ' +
    'Copia .env.example a .env y agrega la URL de tu Web App de GAS.'
  );
}

async function request({ method = 'GET', params = {}, body } = {}) {
  let url = GAS_URL;

  if (method === 'GET' && Object.keys(params).length) {
    url += '?' + new URLSearchParams(params).toString();
  }

  const res = await fetch(url, {
    method,
    redirect: 'follow',
    // Sin Content-Type para evitar preflight CORS con GAS
    ...(body !== undefined && { body: JSON.stringify(body) }),
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Respuesta inválida del servidor: ${text.slice(0, 120)}`);
  }
}

export const api = {
  getInventory: () =>
    request({ params: { action: 'getInventory' } }),

  registerSale: (data) =>
    request({ method: 'POST', body: { action: 'registerSale', ...data } }),

  updateProduct: (product) =>
    request({ method: 'POST', body: { action: 'updateProduct', product } }),

  addProduct: (product) =>
    request({ method: 'POST', body: { action: 'addProduct', product } }),

  ping: () =>
    request({ params: { action: 'ping' } }),
};
