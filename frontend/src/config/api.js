/**
 * Configuración centralizada de la API.
 * REACT_APP_API_URL debe estar en frontend/.env (ej: http://localhost:5000)
 */
const API_BASE_URL =
  process.env.REACT_APP_API_URL ||
  (typeof window !== 'undefined' && window.__ENV__?.REACT_APP_API_URL) ||
  'http://localhost:5000';

export default API_BASE_URL;

/** URL base para recursos estáticos (uploads) del backend */
export function getUploadsUrl(path) {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = API_BASE_URL.replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}
