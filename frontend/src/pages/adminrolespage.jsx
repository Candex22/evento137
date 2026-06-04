import { useEffect, useState } from 'react'
import AdminLayout from '../components/layout/adminlayout'
import { getUsuariosRoles, cambiarRol, countPendientes } from '../api/admin'
import { useToast, ToastContainer } from '../hooks/usetoast'

const ROLES = ['administrador', 'mozo', 'cajero', 'buffet', 'entradas']

const ROL_COLOR = {
  administrador:  '#e89547',
  mozo:   '#5b9bd5',
  cajero: '#4caf7d',
  buffet: '#c97bd5',
  entradas: '#d5c35b',
}

export default function AdminRolesPage() {
  const [users, setUsers]   = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy]     = useState({})
  const [pendingCount, setPendingCount] = useState(0)
  const { toasts, toast }   = useToast()

  const load = async () => {
    setLoading(true)
    try {
      const [data, count] = await Promise.all([getUsuariosRoles(), countPendientes()])
      setUsers(data)
      setPendingCount(count.total)
    } catch {
      toast.error('No se pudieron cargar los usuarios.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const onChangeRol = async (id, nuevoRol, rolActual) => {
    if (nuevoRol === rolActual) return
    setBusy(b => ({ ...b, [id]: true }))
    // Optimista: refleja el cambio en la UI al instante
    setUsers(us => us.map(u => u.id_user === id ? { ...u, rol: nuevoRol } : u))
    try {
      await cambiarRol(id, nuevoRol)
      toast.success(`Rol actualizado a ${nuevoRol}.`)
    } catch (err) {
      toast.error(err.message)
      // Revertir si falla
      setUsers(us => us.map(u => u.id_user === id ? { ...u, rol: rolActual } : u))
    } finally {
      setBusy(b => { const n = { ...b }; delete n[id]; return n })
    }
  }

  return (
    <AdminLayout pendingCount={pendingCount}>
      <ToastContainer toasts={toasts} />

      <div style={styles.header}>
        <h1 style={styles.title}>Gestión de roles</h1>
        <p style={styles.sub}>Asigná el rol de cada usuario activo del sistema</p>
      </div>

      {loading ? (
        <div style={styles.loading}><span className="spinner" /> Cargando…</div>
      ) : users.length === 0 ? (
        <p style={styles.empty}>No hay usuarios activos para gestionar.</p>
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
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id_user}>
                    <td><strong>{u.nombre} {u.apellido}</strong></td>
                    <td><span style={styles.mono}>{u.name_user}</span></td>
                    <td>{u.correo_electronico}</td>
                    <td>
                      <div style={styles.rolCell}>
                        <span style={{ ...styles.dot, background: ROL_COLOR[u.rol] || '#9a9690' }} />
                        <select
                          value={u.rol}
                          disabled={busy[u.id_user]}
                          onChange={e => onChangeRol(u.id_user, e.target.value, u.rol)}
                          style={styles.select}
                        >
                          {ROLES.map(r => (
                            <option key={r} value={r}>{r}</option>
                          ))}
                        </select>
                        {busy[u.id_user] && <span className="spinner" />}
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
  empty:   { fontSize: 13, color: '#5a5754', padding: '16px 0' },
  mono:    { fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#9a9690' },
  rolCell: { display: 'flex', alignItems: 'center', gap: 8 },
  dot:     { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  select:  {
    background: '#181818',
    color: '#f0ede8',
    border: '1px solid #2e2e2e',
    borderRadius: 6,
    padding: '5px 10px',
    fontSize: 13,
    fontFamily: "'DM Mono', monospace",
    cursor: 'pointer',
    textTransform: 'capitalize',
  },
}