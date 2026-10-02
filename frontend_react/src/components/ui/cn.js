/** Une clases condicionales ignorando valores falsos. */
export default function cn(...partes) {
  return partes.filter(Boolean).join(' ')
}
