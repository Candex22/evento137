import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/authcontext'

import LoginPage         from './pages/loginpage'
import RegisterPage      from './pages/registerpage'
import AdminPanelPage    from './pages/adminpanelpage'
import AdminPendingPage  from './pages/adminpendingpage'
import AdminUsersPage    from './pages/adminuserspage'
import AdminRolesPage    from './pages/adminrolespage'
import AdminMovimientosPage from './pages/adminmovimientospage'
import AdminHistorialPage from './pages/adminhistorialpage'
import AdminEntradasPage from './pages/adminentradaspage'
import BuffetStockPage   from './pages/buffetstockpage'
import MozoPedidosPage   from './pages/mozopedidospage'
import CajeroPedidosPage from './pages/cajeropedidospage'
import EntradasPage      from './pages/entradaspage'
import AdminCatalogoPage from './pages/admincatalogopage'

function homeFor(user) {
  if (!user) return '/login'
  if (user.rol === 'administrador')    return '/admin'
  if (user.rol === 'buffet')   return '/buffet'
  if (user.rol === 'mozo')     return '/mozo'
  if (user.rol === 'cajero')   return '/cajero'
  if (user.rol === 'entradas') return '/entradas'
  return '/dashboard'
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="page-loading"><span className="spinner" /> Cargando…</div>
  if (!user)   return <Navigate to="/login" replace />
  return children
}

function RequireRole({ roles, children }) {
  const { user, loading } = useAuth()
  if (loading) return <div className="page-loading"><span className="spinner" /> Cargando…</div>
  if (!user)   return <Navigate to="/login" replace />
  if (!roles.includes(user.rol)) return <Navigate to={homeFor(user)} replace />
  return children
}

export default function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return <div className="page-loading"><span className="spinner" /> Iniciando…</div>
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login"    element={user ? <Navigate to={homeFor(user)} replace /> : <LoginPage />} />
        <Route path="/register" element={user ? <Navigate to={homeFor(user)} replace /> : <RegisterPage />} />

        <Route path="/admin"             element={<RequireRole roles={['administrador']}><AdminPanelPage /></RequireRole>} />
        <Route path="/admin/pending"     element={<RequireRole roles={['administrador']}><AdminPendingPage /></RequireRole>} />
        <Route path="/admin/users"       element={<RequireRole roles={['administrador']}><AdminUsersPage /></RequireRole>} />
        <Route path="/admin/roles"       element={<RequireRole roles={['administrador']}><AdminRolesPage /></RequireRole>} />
        <Route path="/admin/movimientos" element={<RequireRole roles={['administrador']}><AdminMovimientosPage /></RequireRole>} />
        <Route path="/admin/pedidos"     element={<RequireRole roles={['administrador']}><AdminHistorialPage /></RequireRole>} />
        <Route path="/admin/entradas"    element={<RequireRole roles={['administrador']}><AdminEntradasPage /></RequireRole>} />
        <Route path="/admin/catalogo" element={<RequireRole role="admin"><AdminCatalogoPage /></RequireRole>} />

        <Route path="/buffet"   element={<RequireRole roles={['buffet', 'administrador']}><BuffetStockPage /></RequireRole>} />
        <Route path="/mozo"     element={<RequireRole roles={['mozo', 'administrador']}><MozoPedidosPage /></RequireRole>} />
        <Route path="/cajero"   element={<RequireRole roles={['cajero', 'administrador']}><CajeroPedidosPage /></RequireRole>} />
        <Route path="/entradas" element={<RequireRole roles={['entradas', 'administrador']}><EntradasPage /></RequireRole>} />

        <Route path="/dashboard" element={<RequireAuth><div style={{padding:40,color:'#9a9690'}}>Dashboard — próximamente</div></RequireAuth>} />

        <Route path="*" element={<Navigate to={homeFor(user)} replace />} />
      </Routes>
    </BrowserRouter>
  )
}