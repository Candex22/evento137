import { useEffect, useState } from 'react'
import AdminLayout from '../components/layout/adminlayout'
import { getUsuarios, activarUsuario, desactivarUsuario, eliminarUsuario, countPendientes } from '../api/admin'
import { useToast, ToastContainer } from '../hooks/usetoast'

const ESTADO_BADGE = {
  activo:   'badge-active',
  inactivo: 'badge-inactive',
  pendiente:'badge-pending',
}
const ROL_BADGE = {
  admin: 'badge-admin',
  usuario:       'badge-user',
}

export default function AdminUsersPage() {
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]     = useState({})
  const [pendingCount, setPendingCount] = useState(0)
  const [filter, setFilter] = useState('todos')
  const { toasts, toast }   = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const [data, count] = await Promise.all([getUsuarios(), countPendientes()])
      setUsers(data)
      setPendingCount(count.total)
    } catch {
      toast.error('No se pudieron cargar los usuarios.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const doAction = async (id, actionFn, successMsg) => {
    setBusy(b => ({ ...b, [id]: true }))
    try {
      await actionFn(id)
      toast.success(successMsg)
      load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(b => { const n = { ...b }; delete n[id]; return n })
    }
  }

  const filtered = filter === 'todos'
    ? users
    : users.filter(u => u.estado === filter || u.rol === filter)

  return (
    <AdminLayout pendingCount={pendingCount}>
      <ToastContainer toasts={toasts} />

      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Gestión de usuarios</h1>
          <p style={styles.sub}>{users.length} usuario{users.length !== 1 ? 's' : ''} en el sistema</p>
        </div>
        <div style={styles.filters}>
              {['todos','activo','inactivo','pendiente','admin','mozo','cajero','buffet','entradas'].map(f => (            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                ...styles.filterBtn,
                ...(filter === f ? styles.filterBtnActive : {}),
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={styles.loading}><span className="spinner" /> Cargando…</div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          <div className="icon">◈</div>
          <h3>Sin usuarios</h3>
          <p>No hay usuarios que coincidan con el filtro.</p>
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
                  <th>Rol</th>
                  <th>Estado</th>
                  <th>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(u => (
                  <tr key={u.id_user}>
                    <td><strong>{u.nombre} {u.apellido}</strong></td>
                    <td><span style={styles.mono}>{u.name_user}</span></td>
                    <td>{u.correo_electronico}</td>
                    <td><span className={`badge ${ROL_BADGE[u.rol] || 'badge-user'}`}>{u.rol}</span></td>
                    <td><span className={`badge ${ESTADO_BADGE[u.estado] || 'badge-user'}`}>{u.estado}</span></td>
                    <td>
                      <div style={styles.actions}>
                        {(u.estado === 'inactivo' || u.estado === 'pendiente') && (
                          <button
                            className="btn btn-success btn-sm"
                            disabled={busy[u.id_user]}
                            onClick={() => doAction(u.id_user, activarUsuario, 'Usuario activado.')}
                          >
                            Activar
                          </button>
                        )}
                        {u.estado === 'activo' && (
                          <button
                            className="btn btn-warn btn-sm"
                            disabled={busy[u.id_user]}
                            onClick={() => doAction(u.id_user, desactivarUsuario, 'Usuario desactivado.')}
                          >
                            Desactivar
                          </button>
                        )}
                        <button
                          className="btn btn-danger btn-sm"
                          disabled={busy[u.id_user]}
                          onClick={() => {
                            if (confirm(`¿Eliminar a ${u.name_user}? Esta acción no se puede deshacer.`))
                              doAction(u.id_user, eliminarUsuario, 'Usuario eliminado.')
                          }}
                        >
                          Eliminar
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
  header:  { marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 16 },
  title:   { fontSize: 22, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  sub:     { fontSize: 13, color: '#5a5754' },
  loading: { display: 'flex', alignItems: 'center', gap: 10, color: '#5a5754', fontSize: 13, padding: 24 },
  mono:    { fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#9a9690' },
  actions: { display: 'flex', gap: 6 },
  filters: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  filterBtn: {
    background: 'transparent',
    border: '1px solid #2e2e2e',
    borderRadius: 20,
    color: '#9a9690',
    fontSize: 11,
    padding: '4px 12px',
    cursor: 'pointer',
    fontFamily: "'DM Mono', monospace",
    textTransform: 'lowercase',
    transition: 'all .12s',
  },
  filterBtnActive: {
    background: '#2a1f0a',
    borderColor: '#e89547',
    color: '#e89547',
  },
}