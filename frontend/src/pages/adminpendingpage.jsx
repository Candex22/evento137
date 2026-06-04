import { useEffect, useState } from 'react'
import AdminLayout from '../components/layout/adminlayout'
import { getPendientes, aprobarUsuario, rechazarUsuario, countPendientes } from '../api/admin'
import { useToast, ToastContainer } from '../hooks/usetoast'

export default function AdminPendingPage() {
  const [users, setUsers]         = useState([])
  const [loading, setLoading]     = useState(true)
  const [pending, setPending]     = useState({})  // { [id]: 'approve'|'reject' }
  const [pendingCount, setPendingCount] = useState(0)
  const { toasts, toast }         = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const [data, count] = await Promise.all([getPendientes(), countPendientes()])
      setUsers(data)
      setPendingCount(count.total)
    } catch {
      toast.error('No se pudieron cargar los usuarios pendientes.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleAction = async (id, action) => {
    setPending(p => ({ ...p, [id]: action }))
    try {
      if (action === 'approve') {
        await aprobarUsuario(id)
        toast.success('Usuario aprobado correctamente.')
      } else {
        await rechazarUsuario(id)
        toast.success('Usuario rechazado correctamente.')
      }
      setUsers(prev => prev.filter(u => u.id_user !== id))
      setPendingCount(c => Math.max(0, c - 1))
    } catch (err) {
      toast.error(err.message)
    } finally {
      setPending(p => { const n = { ...p }; delete n[id]; return n })
    }
  }

  return (
    <AdminLayout pendingCount={pendingCount}>
      <ToastContainer toasts={toasts} />

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Usuarios pendientes</h1>
          <p style={styles.sub}>Solicitudes de registro esperando aprobación</p>
        </div>
      </div>

      {loading ? (
        <div style={styles.loading}><span className="spinner" /> Cargando…</div>
      ) : users.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">✓</div>
          <h3>Sin pendientes</h3>
          <p>No hay solicitudes de registro pendientes.</p>
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Nombre</th>
                  <th>Usuario</th>
                  <th>Correo</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id_user}>
                    <td>
                      <strong>{u.nombre} {u.apellido}</strong>
                    </td>
                    <td>
                      <span style={styles.mono}>{u.name_user}</span>
                    </td>
                    <td>{u.correo_electronico}</td>
                    <td>
                      <div style={styles.actions}>
                        <button
                          className="btn btn-success btn-sm"
                          disabled={!!pending[u.id_user]}
                          onClick={() => handleAction(u.id_user, 'approve')}
                        >
                          {pending[u.id_user] === 'approve' ? <span className="spinner" /> : '✓'} Aprobar
                        </button>
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={!!pending[u.id_user]}
                          onClick={() => handleAction(u.id_user, 'reject')}
                        >
                          {pending[u.id_user] === 'reject' ? <span className="spinner" /> : '✕'} Rechazar
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

const styles = {
  header:  { marginBottom: 28 },
  title:   { fontSize: 22, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  sub:     { fontSize: 13, color: '#5a5754' },
  loading: { display: 'flex', alignItems: 'center', gap: 10, color: '#5a5754', fontSize: 13, padding: 24 },
  mono:    { fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#9a9690' },
  actions: { display: 'flex', gap: 8 },
}