/**
 * Datos del emisor que se imprimen en el comprobante. Se leen de variables de entorno de Vite
 * (ver frontend_react/.env.example); aquí NO hay datos fiscales de ejemplo. Solo se imprime lo que exista.
 */
export function leerEmisor(env = {}) {
  const v = (k) => String(env[k] ?? '').trim()
  return {
    nombre: v('VITE_EMISOR_NOMBRE') || 'Orbezo Resto Bar',
    ruc: v('VITE_EMISOR_RUC'),
    direccion: v('VITE_EMISOR_DIRECCION'),
    telefono: v('VITE_EMISOR_TELEFONO'),
    logo: v('VITE_EMISOR_LOGO'),
    // Línea discreta opcional (p. ej. "Documento interno"); vacía por defecto: el sistema no afirma nada fiscal.
    leyenda: v('VITE_COMPROBANTE_LEYENDA'),
  }
}

export const EMISOR = leerEmisor(import.meta.env)
