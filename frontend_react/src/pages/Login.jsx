import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import useAuth from '../store/useAuth'
import { login } from '../api/auth'

const RUTAS = { admin: '/dashboard', cocinero: '/cocina', cajero: '/mesas' }

export default function Login() {
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [cargando, setCargando] = useState(false)
  const [shake, setShake] = useState(false)
  const setUsuario = useAuth(s => s.setUsuario)
  const usuario    = useAuth(s => s.usuario)
  const navigate   = useNavigate()

  if (usuario) return <Navigate to={RUTAS[usuario.rol_nombre] || '/mesas'} replace />

  const presionar = (val) => {
    if (val === 'DEL') return setPin(p => p.slice(0, -1))
    if (pin.length >= 6) return
    setPin(p => p + val)
  }

  const ingresar = async () => {
    if (!pin) return
    setCargando(true)
    setError('')
    try {
      const { usuario, access_token } = await login(pin)
      setUsuario(usuario, access_token)
      navigate(RUTAS[usuario.rol_nombre] || '/mesas', { replace: true })
    } catch {
      setError('PIN incorrecto. Intenta de nuevo.')
      setPin('')
      setShake(true)
      setTimeout(() => setShake(false), 500)
    } finally {
      setCargando(false)
    }
  }

  const teclas = ['1','2','3','4','5','6','7','8','9','DEL','0','OK']

  return (
    <div className="min-h-screen bg-[#18181b] flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#f59e0b]/10 border border-[#f59e0b]/25 mb-4">
            <span className="text-2xl">🍽️</span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Orbezo</h1>
          <p className="text-[#71717a] text-sm mt-1">Resto Bar · Sistema de gestión</p>
        </div>

        {/* Card */}
        <div className="bg-[#27272a] border border-[#3f3f46] rounded-3xl p-8 shadow-2xl">
          <p className="text-[#a1a1aa] text-sm text-center mb-6">Ingresa tu PIN de acceso</p>

          {/* Puntos */}
          <div className={`flex justify-center gap-3 mb-6 ${shake ? 'animate-bounce' : ''}`}>
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full border-2 transition-all duration-200 ${
                  i < pin.length
                    ? 'bg-[#f59e0b] border-[#f59e0b] scale-110'
                    : 'bg-transparent border-[#52525b]'
                }`}
              />
            ))}
          </div>

          {/* Error */}
          <div className={`text-center mb-4 h-5 transition-opacity ${error ? 'opacity-100' : 'opacity-0'}`}>
            <span className="text-amber-300 text-xs">{error}</span>
          </div>

          {/* Teclado */}
          <div className="grid grid-cols-3 gap-2.5">
            {teclas.map(t => (
              <button
                key={t}
                onClick={() => t === 'OK' ? ingresar() : presionar(t)}
                disabled={cargando}
                className={`h-14 rounded-xl text-lg font-semibold transition-all active:scale-95 disabled:opacity-40
                  ${t === 'OK'
                    ? 'bg-[#f59e0b] text-black hover:bg-[#d97706] shadow-lg shadow-[#f59e0b]/20'
                    : t === 'DEL'
                    ? 'bg-[#3f3f46] text-[#a1a1aa] hover:bg-[#52525b] hover:text-white'
                    : 'bg-[#3f3f46] text-white hover:bg-[#52525b]'
                  }`}
              >
                {cargando && t === 'OK' ? '...' : t}
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-[#3f3f46] text-xs mt-6">Orbezo POS v2.0</p>
      </div>
    </div>
  )
}
