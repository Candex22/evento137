import { useEffect, useState } from 'react'
import AdminLayout from '../components/layout/adminlayout'
import { getHistorialPedidos, countPendientes } from '../api/admin'
import { useToast, ToastContainer } from '../hooks/usetoast'

const ESTADO_BADGE = { confirmado: 'badge-active', rechazado: 'badge-inactive' }
const ESTADO_LABEL = { confirmado: 'aceptado', rechazado: 'rechazado' }

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
const fmtMoney = v => money.format(Number(v) || 0)

function fmtFecha(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export default function AdminHistorialPage() {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const [filtro, setFiltro] = useState('todos')
  const { toasts, toast } = useToast()

  useEffect(() => {
    (async () => {
      try {
        const [data, count] = await Promise.all([getHistorialPedidos(), countPendientes()])
        setPedidos(data)
        setPendingCount(count.total)
      } catch {
        toast.error('No se pudo cargar el historial.')
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const visibles = pedidos.filter(p => filtro === 'todos' || p.estado === filtro)

  return (
    <AdminLayout pendingCount={pendingCount}>
      <ToastContainer toasts={toasts} />
      <div style={{ marginBottom: 20 }}>
        <h1 style={styles.title}>Historial de pedidos</h1>
        <p style={styles.sub}>Todos los pedidos aceptados y rechazados</p>
      </div>

      <div style={styles.filtros}>
        {['todos', 'confirmado', 'rechazado'].map(f => (
          <button
            key={f}
            style={{ ...styles.filtro, ...(filtro === f ? styles.filtroActive : {}) }}
            onClick={() => setFiltro(f)}
          >
            {f === 'todos' ? 'Todos' : f === 'confirmado' ? 'Aceptados' : 'Rechazados'}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={styles.loading}><span className="spinner" /> Cargando…</div>
      ) : visibles.length === 0 ? (
        <div className="empty-state"><div className="icon">⟲</div><h3>Sin pedidos en el historial</h3></div>
      ) : (
        <div style={styles.list}>
          {visibles.map(p => (
            <div key={p.id_pedido} className="card" style={styles.card}>
              <div style={styles.cardTop}>
                <div>
                  <div style={styles.nombre}>{p.nombre}</div>
                  <div style={styles.meta}>
                    Mozo: {p.mozo_nombre} {p.mozo_apellido}
                    {' · '}Cajero: {p.cajero_nombre ? `${p.cajero_nombre} ${p.cajero_apellido}` : '—'}
                  </div>
                </div>
                <span className={`badge ${ESTADO_BADGE[p.estado] || 'badge-user'}`}>
                  {ESTADO_LABEL[p.estado] || p.estado}
                </span>
              </div>

              <div style={styles.items}>
                {p.items.map((it, i) => (
                  <span key={i} style={styles.chip}>
                    {it.producto} ×{it.cantidad} · {fmtMoney(it.subtotal)}
                  </span>
                ))}
              </div>

              {p.estado === 'rechazado' && p.motivo_rechazo && (
                <div style={styles.motivo}>Motivo: {p.motivo_rechazo}</div>
              )}

              <div style={styles.foot}>
                <span style={styles.fecha}>
                  {fmtFecha(p.resolved_at || p.created_at)}
                  {p.estado === 'confirmado' && (p.pagado ? ' · ✓ pagado' : ' · sin pagar')}
                </span>
                <span style={styles.total}>{fmtMoney(p.total)}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </AdminLayout>
  )
}

const styles = {
  title:    { fontSize: 22, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  sub:      { fontSize: 13, color: '#5a5754' },
  loading:  { display: 'flex', alignItems: 'center', gap: 10, color: '#5a5754', fontSize: 13, padding: 24 },
  filtros:  { display: 'flex', gap: 8, marginBottom: 20 },
  filtro:   { background: '#141414', border: '1px solid #2e2e2e', borderRadius: 6, color: '#9a9690', fontSize: 12, padding: '6px 12px', cursor: 'pointer' },
  filtroActive: { borderColor: '#e89547', color: '#e89547', background: '#1e1a0e' },
  list:     { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 16 },
  card:     { display: 'flex', flexDirection: 'column', gap: 12 },
  cardTop:  { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 },
  nombre:   { fontSize: 14, fontWeight: 600, color: '#f0ede8' },
  meta:     { fontSize: 11, color: '#9a9690', fontFamily: "'DM Mono', monospace", marginTop: 3 },
  items:    { display: 'flex', flexWrap: 'wrap', gap: 6, borderTop: '1px solid #2e2e2e', paddingTop: 12 },
  chip:     { fontSize: 12, color: '#9a9690', background: '#181818', border: '1px solid #2e2e2e', borderRadius: 6, padding: '3px 8px' },
  motivo:   { fontSize: 12, color: '#d57b7b', background: '#1e1010', border: '1px solid #3a1a1a', borderRadius: 6, padding: '6px 10px' },
  foot:     { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid #2e2e2e', paddingTop: 10 },
  fecha:    { fontSize: 11, color: '#5a5754', fontFamily: "'DM Mono', monospace" },
  total:    { fontSize: 16, fontWeight: 600, color: '#e8c547', fontFamily: "'DM Mono', monospace" },
}