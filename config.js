// Same-origin (localhost dev, or if this frontend is ever served from Render
// itself) uses relative paths. Any other host (e.g. Netlify) talks to the
// Render backend directly.
const API_BASE = (location.hostname === 'localhost' || location.hostname.endsWith('onrender.com'))
  ? ''
  : 'https://trip-tales-0sb4.onrender.com';

function apiFetch(path, options = {}) {
  return fetch(API_BASE + path, { ...options, credentials: 'include' });
}
