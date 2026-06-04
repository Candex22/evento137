import { useEffect, useState } from 'react'
import AdminLayout from '../components/layout/adminlayout'
import { getMovimientos, countPendientes } from '../api/admin'
import { useToast, ToastContainer } from '../hooks/usetoast'

function fmtFecha(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

const TIPO_BADGE = { ingreso: 'badge-active', egreso: 'badge-inactive', ajuste: 'badge-pending' }

export default function AdminMovimientosPage() {
  const [movs, setMovs] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const { toasts, toast } = useToast()

  useEffect(() => {
    (async () => {
      try {
        const [data, count] = await Promise.all([getMovimientos(), countPendientes()])
        setMovs(data)
        setPendingCount(count.total)
      } catch {
        toast.error('No se pudieron cargar los movimientos.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  return (
    <AdminLayout pendingCount={pendingCount}>
      <ToastContainer toasts={toasts} />
      <div style={{ marginBottom: 28 }}>
        <h1 style={styles.title}>Movimientos de stock</h1>
        <p style={styles.sub}>Ingresos (buffet) y egresos (pedidos confirmados)</p>
      </div>

      {loading ? (
        <div style={styles.loading}><span className="spinner" /> Cargando…</div>
      ) : movs.length === 0 ? (
        <div className="empty-state"><div className="icon">◷</div><h3>Sin movimientos</h3></div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Producto</th><th>Tipo</th><th>Cant.</th><th>Por</th><th>Fecha</th></tr></thead>
              <tbody>
                {movs.map(m => {
                  const esEgreso = m.tipo === 'egreso'
                  return (
                    <tr key={m.id_movimiento}>
                      <td><strong>{m.producto}</strong></td>
                      <td><span className={`badge ${TIPO_BADGE[m.tipo] || 'badge-user'}`}>{m.tipo}</span></td>
                      <td><span style={{ ...styles.cant, color: esEgreso ? '#d57b7b' : '#4caf7d' }}>{esEgreso ? '−' : '+'}{m.cantidad}</span></td>
                      <td><span style={styles.mono}>{m.usuario ?? '—'}</span></td>
                      <td><span style={styles.fecha}>{fmtFecha(m.created_at)}</span></td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </AdminLayout>
  )
}

const styles = {
  title:   { fontSize: 22, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  sub:     { fontSize: 13, color: '#5a5754' },
  loading: { display: 'flex', alignItems: 'center', gap: 10, color: '#5a5754', fontSize: 13, padding: 24 },
  cant:    { fontFamily: "'DM Mono', monospace", fontSize: 13 },
  mono:    { fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#9a9690' },
  fecha:   { fontSize: 12, color: '#5a5754' },
}