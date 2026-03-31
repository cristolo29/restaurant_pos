import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import PrivateRoute from './components/PrivateRoute'
import Login   from './pages/Login'
import Mesas   from './pages/Mesas'
import Comanda from './pages/Comanda'
import Cobro   from './pages/Cobro'
import Cocina  from './pages/Cocina'
import Admin     from './pages/Admin'
import Dashboard from './pages/Dashboard'

function App() {
  return (
    <BrowserRouter>
      <Routes>

        {/* Pública */}
        <Route path="/login" element={<Login />} />

        {/* Mozo / Cajero / Admin */}
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

        {/* Solo cocinero */}
        <Route path="/cocina" element={
          <PrivateRoute roles={['cocinero', 'admin']}>
            <Cocina />
          </PrivateRoute>
        } />

        {/* Solo admin */}
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

        {/* Catch-all → login */}
        <Route path="*" element={<Navigate to="/login" replace />} />

      </Routes>
    </BrowserRouter>
  )
}

export default App
