import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Delete, UtensilsCrossed } from 'lucide-react'
import useAuth from '../store/useAuth'
import { login } from '../api/auth'
import { Button, cn } from '../components/ui'

import { homeParaRol } from '../config/navegacion'

const LARGO_PIN = 6
const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'DEL', '0', 'OK']

export default function Login() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [shake, setShake] = useState(false)
  const setUsuario = useAuth(s => s.setUsuario)
  const usuario    = useAuth(s => s.usuario)
  const navigate   = useNavigate()

  if (usuario) return <Navigate to={homeParaRol(usuario.rol_nombre)} replace />

  const presionar = (val) => {
    if (cargando) return
    setError('')
    if (val === 'DEL') return setPin(p => p.slice(0, -1))
    if (pin.length >= LARGO_PIN) return
    setPin(p => p + val)
  }

  const ingresar = async () => {
    if (!pin || cargando) return
    setCargando(true)
    setError('')
    try {
      const { usuario, access_token } = await login(pin)
      setUsuario(usuario, access_token)
      navigate(homeParaRol(usuario.rol_nombre), { replace: true })
    } catch (e) {
      setError(e.response ? 'PIN incorrecto. Inténtalo de nuevo.' : 'No hay conexión con el servidor.')
      setPin('')
      setShake(true)
      setTimeout(() => setShake(false), 450)
    } finally {
      setCargando(false)
    }
  }

  // Teclado físico (lector, PC): dígitos, borrar y Enter
  const onKeyDown = (e) => {
    if (/^\d$/.test(e.key)) presionar(e.key)
    else if (e.key === 'Backspace') presionar('DEL')
    else if (e.key === 'Enter') ingresar()
  }

  return (
    <main className="min-h-dvh bg-app flex items-center justify-center px-4 py-8" onKeyDown={onKeyDown}>
      <div className="w-full max-w-sm">

        <div className="text-center mb-8">
          <div className="inline-grid place-items-center size-16 rounded-panel bg-accent/10 border border-accent/25 text-accent mb-4">
            <UtensilsCrossed className="size-8" aria-hidden="true" />
          </div>
          <h1 className="text-3xl font-bold text-ink tracking-tight">Orbezo</h1>
          <p className="text-muted text-sm mt-1">Resto Bar · Punto de venta</p>
        </div>

        <div className="bg-surface border border-line rounded-panel p-6 sm:p-8 shadow-2xl">
          <p id="pin-label" className="text-soft text-sm text-center mb-5">Ingresa tu PIN de acceso</p>

          <div
            role="img"
            aria-labelledby="pin-label"
            aria-description={`${pin.length} de ${LARGO_PIN} dígitos`}
            className={cn('flex justify-center gap-3 mb-4', shake && 'animate-shake')}
          >
            {Array.from({ length: LARGO_PIN }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  'size-4 rounded-full border-2 transition-all duration-150',
                  i < pin.length ? 'bg-accent border-accent scale-110' : 'border-line-strong',
                )}
              />
            ))}
          </div>

          <div className="h-6 mb-3 text-center" role="alert" aria-live="assertive">
            {error && <span className="text-danger text-sm font-medium">{error}</span>}
          </div>

          <div className="grid grid-cols-3 gap-3">
            {TECLAS.map(t => {
              if (t === 'OK') {
                return (
                  <Button key={t} variant="primary" size="lg" onClick={ingresar} loading={cargando} disabled={!pin} aria-label="Ingresar" className="text-lg">
                    {!cargando && 'OK'}
                  </Button>
                )
              }
              if (t === 'DEL') {
                return (
                  <Button key={t} variant="secondary" size="lg" iconOnly icon={Delete} onClick={() => presionar(t)} disabled={cargando || !pin} aria-label="Borrar último dígito" className="w-full" />
                )
              }
              return (
                <Button key={t} variant="secondary" size="lg" onClick={() => presionar(t)} disabled={cargando} className="text-xl num bg-raised hover:bg-raised-hover text-ink">
                  {t}
                </Button>
              )
            })}
          </div>
        </div>

        <p className="text-center text-faint text-xs mt-6">Orbezo POS v2.0</p>
      </div>
    </main>
  )
}
