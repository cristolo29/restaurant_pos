import { createPortal } from 'react-dom'
import { useState } from 'react'
import DocumentoComprobante from './DocumentoComprobante'
import ControlesImpresion from './ControlesImpresion'
import { cssPagina, guardarFormato, imprimirComprobante, leerFormato } from './impresion'

/**
 * Selector de formato + «Imprimir» + (opcional) vista previa del documento.
 * La copia que se imprime es un portal en <body>: al imprimir se oculta toda la app y solo sale el documento,
 * con paginación normal (no depende de la ventana modal ni de posiciones fijas).
 */
export default function ImpresionComprobante({ c, mesa, atendidoPor, porDefecto = 'a4', vistaPrevia = true, className }) {
  const [formato, setFormato] = useState(() => leerFormato(porDefecto))
  const elegir = (f) => { setFormato(f); guardarFormato(f) }

  return (
    <div className={className}>
      <ControlesImpresion formato={formato} onFormato={elegir} onImprimir={() => imprimirComprobante(c, formato)} />
      {vistaPrevia && (
        <div className={formato === 'ticket' ? 'mt-4 rounded-control bg-zinc-300 py-4 overflow-x-auto' : 'mt-4 rounded-control overflow-hidden'}>
          <div className={formato === 'ticket' ? 'mx-auto w-fit bg-white px-[4mm] shadow' : ''}>
            <DocumentoComprobante c={c} variante={formato} mesa={mesa} atendidoPor={atendidoPor} />
          </div>
        </div>
      )}
      {createPortal(
        <div className="cp-print">
          <style>{cssPagina(formato)}</style>
          <DocumentoComprobante c={c} variante={formato} mesa={mesa} atendidoPor={atendidoPor} />
        </div>,
        document.body,
      )}
    </div>
  )
}
