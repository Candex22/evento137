import { useEffect, useState } from 'react'
import AdminLayout from '../components/layout/adminlayout'
import { getMovimientos, getProductosAdmin, countPendientes } from '../api/admin'
import { useToast, ToastContainer } from '../hooks/usetoast'

function fmtFecha(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

const TIPO_BADGE = { ingreso: 'badge-active', egreso: 'badge-inactive', ajuste: 'badge-pending' }

export default function AdminMovimientosPage() {
  const [movs, setMovs] = useState([])
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const { toasts, toast } = useToast()

  useEffect(() => {
    (async () => {
      try {
        const [data, prods, count] = await Promise.all([getMovimientos(), getProductosAdmin(), countPendientes()])
        setMovs(data)
        setProductos(prods)
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

      {!loading && productos.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 style={styles.sectionTitle}>Stock por producto</h2>
          <div style={styles.cards}>
            {productos.map(p => {
              const total = p.total_ingresado ?? p.stock
              const pct = total > 0 ? Math.max(0, Math.min(100, (p.stock / total) * 100)) : 0
              return (
                <div key={p.id_producto} className="card" style={styles.prodCard}>
                  <div style={styles.prodNombre}>{p.nombre}</div>
                  <div style={styles.prodValor}>
                    <span style={styles.prodStock}>{p.stock}</span>
                    <span style={styles.prodTotal}>/{total}</span>
                  </div>
                  <div style={styles.barTrack}>
                    <div style={{ ...styles.barFill, width: `${pct}%` }} />
                  </div>
                  <div style={styles.prodHint}>disponible / total ingresado</div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {loading ? (
        <div style={styles.loading}><span className="spinner" /> Cargando…</div>
      ) : movs.length === 0 ? (
        <div className="empty-state"><div className="icon">◷</div><h3>Sin movimientos</h3></div>
      ) : (
        <section>
          <h2 style={styles.sectionTitle}>Movimientos</h2>
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
        </section>
      )}
    </AdminLayout>
  )
}

const styles = {
  title:   { fontSize: 22, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  sub:     { fontSize: 13, color: '#5a5754' },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#f0ede8', marginBottom: 12 },
  loading: { display: 'flex', alignItems: 'center', gap: 10, color: '#5a5754', fontSize: 13, padding: 24 },
  cant:    { fontFamily: "'DM Mono', monospace", fontSize: 13 },
  mono:    { fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#9a9690' },
  fecha:   { fontSize: 12, color: '#5a5754' },
  cards:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 },
  prodCard:{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14 },
  prodNombre: { fontSize: 13, fontWeight: 600, color: '#f0ede8' },
  prodValor:  { display: 'flex', alignItems: 'baseline', gap: 2 },
  prodStock:  { fontFamily: "'DM Mono', monospace", fontSize: 24, fontWeight: 600, color: '#e89547' },
  prodTotal:  { fontFamily: "'DM Mono', monospace", fontSize: 16, color: '#5a5754' },
  barTrack:{ height: 5, background: '#1e1e1e', borderRadius: 3, overflow: 'hidden' },
  barFill: { height: '100%', background: '#e89547', borderRadius: 3 },
  prodHint:{ fontSize: 10, color: '#5a5754', fontFamily: "'DM Mono', monospace" },
}