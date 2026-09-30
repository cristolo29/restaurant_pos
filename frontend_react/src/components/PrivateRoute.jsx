import { Navigate } from 'react-router-dom'
import useAuth from '../store/useAuth'

import { homeParaRol } from '../config/navegacion'

/**
 * PrivateRoute — protege una ruta por autenticación y opcionalmente por rol.
 *
 * props:
 *   roles?: string[]  — si se pasa, solo esos roles pueden acceder.
 *                       Si el usuario tiene otro rol, se redirige a su home.
 */
export default function PrivateRoute({ children, roles }) {
  const usuario = useAuth(s => s.usuario)

  // Sin sesión → login
  if (!usuario) return <Navigate to="/login" replace />

  // Rol no permitido → redirigir al home del rol
  if (roles && !roles.includes(usuario.rol_nombre)) {
    return <Navigate to={homeParaRol(usuario.rol_nombre)} replace />
  }

  return children
}
