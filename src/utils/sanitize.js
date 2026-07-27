/**
 * Utilidades de sanitización para prevenir XSS.
 * Siempre usar escapeHTML() antes de inyectar datos del servidor en el DOM.
 */
const ESCAPE_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const ESCAPE_RE = /[&<>"']/g;

export function escapeHTML(str) {
  if (str == null) return '';
  return String(str).replace(ESCAPE_RE, (ch) => ESCAPE_MAP[ch]);
}
