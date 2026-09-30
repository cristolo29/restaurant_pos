import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PrivateRoute from './components/PrivateRoute'
import Login   from './pages/Login'
import Mesas   from './pages/Mesas'
import Comanda from './pages/Comanda'
import Cobro   from './pages/Cobro'
import Cocina  from './pages/Cocina'
import Admin     from './pages/Admin'
import Dashboard from './pages/Dashboard'
import PorCobrar  from './pages/PorCobrar'
import MisPedidos from './pages/MisPedidos'
import AppShell from './components/AppShell'

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Pública */}
        <Route path="/login" element={<Login />} />

        {/* Rutas privadas dentro del shell de navegación */}
        <Route element={<PrivateRoute><AppShell /></PrivateRoute>}>
          <Route path="/mesas" element={
            <PrivateRoute roles={['mozo', 'cajero', 'admin']}>
              <Mesas />
            </PrivateRoute>
          } />
          <Route path="/comanda" element={
            <PrivateRoute roles={['mozo', 'cajero', 'admin']}>
              <Comanda />
            </PrivateRoute>
          } />
          <Route path="/cobro" element={
            <PrivateRoute roles={['cajero', 'admin']}>
              <Cobro />
            </PrivateRoute>
          } />
          <Route path="/por-cobrar" element={
            <PrivateRoute roles={['cajero', 'admin']}>
              <PorCobrar />
            </PrivateRoute>
          } />
          <Route path="/mis-pedidos" element={
            <PrivateRoute roles={['mozo']}>
              <MisPedidos />
            </PrivateRoute>
          } />
          <Route path="/cocina" element={
            <PrivateRoute roles={['cocinero', 'admin']}>
              <Cocina />
            </PrivateRoute>
          } />
          <Route path="/admin" element={
            <PrivateRoute roles={['admin']}>
              <Admin />
            </PrivateRoute>
          } />
          <Route path="/dashboard" element={
            <PrivateRoute roles={['admin']}>
              <Dashboard />
            </PrivateRoute>
          } />
        </Route>

        {/* Catch-all → login */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  )
}

export default App
