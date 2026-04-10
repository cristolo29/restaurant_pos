import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import useAuth from '../store/useAuth'
import { getDashboard } from '../api/dashboard'

const KPI = ({ icono, label, valor, sub, color }) => (
  <div className="bg-[#27272a] border border-[#3f3f46] rounded-2xl p-5">
    <div className="flex items-start justify-between mb-3">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${color}`}>
        {icono}
      </div>
    </div>
    <p className="text-[#71717a] text-xs uppercase tracking-wider mb-1">{label}</p>
    <p className="text-white text-2xl font-bold">{valor}</p>
    {sub && <p className="text-[#52525b] text-xs mt-1">{sub}</p>}
  </div>
)

const TooltipPersonalizado = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-[#27272a] border border-[#3f3f46] rounded-xl px-3 py-2 text-xs shadow-xl">
      <p className="text-[#a1a1aa] mb-1">{label}</p>
      <p className="text-[#f59e0b] font-bold">S/ {Number(payload[0].value).toFixed(2)}</p>
    </div>
  )
}

export default function Dashboard() {
  const navigate   = useNavigate()
  const cerrarSesion = useAuth(s => s.cerrarSesion)
  const [data, setData]       = useState(null)
  const [cargando, setCargando] = useState(true)
  const [menuAbierto, setMenuAbierto] = useState(false)

  const cargar = async () => {
    try {
      const d = await getDashboard()
      setData(d)
    } finally {
      setCargando(false)
    }
  }

  useEffect(() => {
    cargar()
    const t = setInterval(cargar, 30000)
    return () => clearInterval(t)
  }, [])

  const hoy = new Date().toLocaleDateString('es-PE', { weekday: 'long', day: 'numeric', month: 'long' })

  return (
    <div className="min-h-screen bg-[#18181b] text-white flex flex-col">

      {/* Header */}
      <header className="bg-[#27272a] px-4 sm:px-6 py-4 flex justify-between items-center border-b border-[#3f3f46] sticky top-0 z-10 relative">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30 flex items-center justify-center text-sm shrink-0">
            🍽️
          </div>
          <span className="text-white font-bold text-base sm:text-lg">Orbezo</span>
          <div className="w-px h-5 bg-[#3f3f46] shrink-0" />
          <span className="text-[#a1a1aa] text-sm truncate">Dashboard</span>
        </div>

        {/* Nav desktop */}
        <div className="hidden sm:flex items-center gap-2 shrink-0">
          <button onClick={() => navigate('/admin')}
            className="text-[#a1a1aa] hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-[#3f3f46] transition-colors flex items-center gap-1.5">
            <span>⚙️</span><span>Administración</span>
          </button>
          <button onClick={() => navigate('/mesas')}
            className="text-[#a1a1aa] hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-[#3f3f46] transition-colors flex items-center gap-1.5">
            <span>🪑</span><span>Mesas</span>
          </button>
          <button onClick={() => navigate('/cocina')}
            className="text-[#a1a1aa] hover:text-white text-sm px-3 py-1.5 rounded-lg hover:bg-[#3f3f46] transition-colors flex items-center gap-1.5">
            <span>👨‍🍳</span><span>Cocina</span>
          </button>
          <div className="w-px h-5 bg-[#3f3f46] mx-1" />
          <button onClick={() => { cerrarSesion(); navigate('/login') }}
            className="text-[#71717a] hover:text-[#f59e0b] text-sm transition-colors px-2 py-1.5 rounded-lg hover:bg-[#f59e0b]/10">
            Salir
          </button>
        </div>

        {/* Hamburguesa móvil */}
        <button
          onClick={() => setMenuAbierto(v => !v)}
          className="sm:hidden w-9 h-9 flex items-center justify-center rounded-lg hover:bg-[#3f3f46] transition-colors text-[#a1a1aa] hover:text-white text-lg shrink-0"
          aria-label="Menú"
        >
          {menuAbierto ? '✕' : '☰'}
        </button>

        {/* Dropdown móvil */}
        {menuAbierto && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuAbierto(false)} />
            <div className="absolute top-full right-0 left-0 bg-[#27272a] border-b border-[#3f3f46] z-50 py-2 shadow-xl sm:hidden">
              {[
                { icon: '⚙️', label: 'Administración', path: '/admin' },
                { icon: '🪑', label: 'Mesas',           path: '/mesas' },
                { icon: '👨‍🍳', label: 'Cocina',          path: '/cocina' },
              ].map(({ icon, label, path }) => (
                <button key={path}
                  onClick={() => { navigate(path); setMenuAbierto(false) }}
                  className="w-full flex items-center gap-3 px-5 py-3 text-[#a1a1aa] hover:text-white hover:bg-[#3f3f46] transition-colors text-sm text-left"
                >
                  <span className="text-base">{icon}</span>{label}
                </button>
              ))}
              <div className="mx-5 my-1 border-t border-[#3f3f46]" />
              <button
                onClick={() => { cerrarSesion(); navigate('/login') }}
                className="w-full flex items-center gap-3 px-5 py-3 text-[#ef4444] hover:bg-[#ef4444]/10 transition-colors text-sm text-left"
              >
                <span className="text-base">🚪</span>Salir
              </button>
            </div>
          </>
        )}
      </header>

      <main className="p-6 flex-1 max-w-7xl mx-auto w-full">

        {/* Título */}
        <div className="mb-8 flex items-end justify-between">
          <div>
            <h2 className="text-2xl font-bold text-white">Resumen del día</h2>
            <p className="text-[#71717a] text-sm mt-1 capitalize">{hoy}</p>
          </div>
          <button
            onClick={cargar}
            className="text-[#52525b] hover:text-[#a1a1aa] text-sm flex items-center gap-1.5 transition-colors"
          >
            ↻ Actualizar
          </button>
        </div>

        {cargando ? (
          <div className="flex items-center justify-center py-32">
            <p className="text-[#52525b]">Cargando datos...</p>
          </div>
        ) : (
          <div className="flex flex-col gap-6">

            {/* ── KPIs ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <KPI
                icono="💰"
                label="Ventas hoy"
                valor={`S/ ${Number(data.ventas_hoy).toFixed(2)}`}
                color="bg-[#f59e0b]/10"
              />
              <KPI
                icono="🧾"
                label="Comprobantes"
                valor={data.comprobantes_hoy}
                sub="emitidos hoy"
                color="bg-[#a78bfa]/10"
              />
              <KPI
                icono="🪑"
                label="Mesas ocupadas"
                valor={`${data.mesas_ocupadas} / ${data.mesas_total}`}
                sub={`${data.mesas_total - data.mesas_ocupadas} disponibles`}
                color="bg-[#f59e0b]/10"
              />
              <KPI
                icono="📋"
                label="Pedidos abiertos"
                valor={data.pedidos_abiertos}
                sub="en este momento"
                color="bg-[#22c55e]/10"
              />
            </div>

            {/* ── Gráfico + Top productos ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

              {/* Ventas últimos 7 días */}
              <div className="lg:col-span-2 bg-[#27272a] border border-[#3f3f46] rounded-2xl p-5">
                <p className="text-white font-semibold mb-1">Ventas últimos 7 días</p>
                <p className="text-[#71717a] text-xs mb-5">Total en soles (S/)</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.ventas_semana} barSize={28}>
                    <XAxis
                      dataKey="dia"
                      tick={{ fill: '#71717a', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#71717a', fontSize: 10 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={v => `S/${v}`}
                      width={52}
                    />
                    <Tooltip content={<TooltipPersonalizado />} cursor={{ fill: '#3f3f46' }} />
                    <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                      {data.ventas_semana.map((entry, i) => (
                        <Cell
                          key={i}
                          fill={i === 6 ? '#f59e0b' : '#3f3f46'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Top productos */}
              <div className="bg-[#27272a] border border-[#3f3f46] rounded-2xl p-5">
                <p className="text-white font-semibold mb-1">Top productos hoy</p>
                <p className="text-[#71717a] text-xs mb-4">Por unidades vendidas</p>
                {data.top_productos.length === 0 ? (
                  <p className="text-[#3f3f46] text-sm text-center py-8">Sin ventas hoy</p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {data.top_productos.map((p, i) => {
                      const max = data.top_productos[0].cantidad
                      const pct = Math.round((p.cantidad / max) * 100)
                      return (
                        <div key={i}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-white text-sm truncate pr-2">{p.nombre}</span>
                            <span className="text-[#71717a] text-xs shrink-0">{p.cantidad} uds</span>
                          </div>
                          <div className="h-1.5 bg-[#3f3f46] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#f59e0b]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* ── Comprobantes recientes ── */}
            <div className="bg-[#27272a] border border-[#3f3f46] rounded-2xl overflow-hidden">
              <div className="px-5 py-4 border-b border-[#3f3f46] flex justify-between items-center">
                <p className="text-white font-semibold">Últimos comprobantes</p>
                <span className="text-[#52525b] text-xs">{data.comprobantes_recientes.length} registros</span>
              </div>
              {data.comprobantes_recientes.length === 0 ? (
                <p className="text-[#3f3f46] text-sm text-center py-10">Sin comprobantes aún</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#3f3f46]">
                      <th className="px-5 py-3 text-left text-[#71717a] font-medium text-xs uppercase tracking-wider">N°</th>
                      <th className="px-5 py-3 text-left text-[#71717a] font-medium text-xs uppercase tracking-wider">Tipo</th>
                      <th className="px-5 py-3 text-left text-[#71717a] font-medium text-xs uppercase tracking-wider">Mesa</th>
                      <th className="px-5 py-3 text-left text-[#71717a] font-medium text-xs uppercase tracking-wider hidden sm:table-cell">Hora</th>
                      <th className="px-5 py-3 text-right text-[#71717a] font-medium text-xs uppercase tracking-wider">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3f3f46]">
                    {data.comprobantes_recientes.map((c, i) => (
                      <tr key={i} className="hover:bg-[#3f3f46]/30 transition-colors">
                        <td className="px-5 py-3 text-[#f59e0b] font-medium">{c.numero}</td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                            c.tipo === 'factura'
                              ? 'bg-[#a78bfa]/10 text-[#a78bfa]'
                              : 'bg-[#22c55e]/10 text-[#22c55e]'
                          }`}>
                            {c.tipo === 'factura' ? 'Factura' : 'Boleta'}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-[#a1a1aa]">Mesa {c.mesa}</td>
                        <td className="px-5 py-3 text-[#52525b] hidden sm:table-cell">{c.hora}</td>
                        <td className="px-5 py-3 text-white font-semibold text-right">S/ {Number(c.total).toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  )
}
