/**
 * Configuración centralizada de la API.
 * REACT_APP_API_URL debe estar en frontend/.env (ej: http://localhost:5000)
 * Se elimina trailing slash para evitar problemas con CORS y rutas.
 */
const API_BASE_URL = (
  process.env.REACT_APP_API_URL ||
  (typeof window !== 'undefined' && window.__ENV__?.REACT_APP_API_URL) ||
  'http://localhost:5000'
).replace(/\/+$/, '');

export default API_BASE_URL;

/** Construir URL de la API sin doble slashes */
export function getApiUrl(path) {
  const base = API_BASE_URL.replace(/\/+$/, '');
  const p = path.startsWith('/') ? path.slice(1) : path;
  return `${base}/${p}`;
}

/** URL base para recursos estáticos (uploads) del backend */
export function getUploadsUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = API_BASE_URL.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
