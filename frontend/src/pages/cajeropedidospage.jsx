import { useEffect, useState, useRef } from 'react'
import PanelLayout from '../components/layout/panellayout'
import { porCobrar, marcarPagado } from '../api/cajero'
import { useToast, ToastContainer } from '../hooks/usetoast'

const NAV = [{ to: '/cajero', label: 'Cobros', icon: '▦', end: true }]
function fmtHora(iso) { return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) }

export default function CajeroPedidosPage() {
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState({})
  const [metodoSel, setMetodoSel] = useState({})  // override por pedido
  const { toasts, toast } = useToast()
  const prevIds = useRef(new Set())

  const load = async (notificar = false) => {
    try {
      const data = await porCobrar()
      if (notificar) {
        const nuevos = data.filter(p => !prevIds.current.has(p.id_pedido))
        if (nuevos.length > 0) toast.success(`${nuevos.length} pedido(s) por cobrar`)
      }
      prevIds.current = new Set(data.map(p => p.id_pedido))
      setPedidos(data)
    } catch { if (!notificar) toast.error('No se pudieron cargar los cobros.') }
    finally { setLoading(false) }
  }
  useEffect(() => {
    load(false)
    const t = setInterval(() => load(true), 8000)
    return () => clearInterval(t)
  }, [])

  const onCobrar = async (p) => {
    setBusy(b => ({ ...b, [p.id_pedido]: true }))
    try {
      const metodo = metodoSel[p.id_pedido] || p.metodo_pago
      const res = await marcarPagado(p.id_pedido, metodo)
      toast.success(res.message)
      await load(false)
    } catch (err) { toast.error(err.message) }
    finally { setBusy(b => { const n = { ...b }; delete n[p.id_pedido]; return n }) }
  }

  return (
    <PanelLayout nav={NAV} brandSub="cajero">
      <ToastContainer toasts={toasts} />
      <div style={styles.header}>
        <h1 style={styles.title}>Pedidos por cobrar</h1>
        <p style={styles.sub}>Marcá los que ya se pagaron</p>
      </div>

      {loading ? (
        <div style={styles.loading}><span className="spinner" /> Cargando…</div>
      ) : pedidos.length === 0 ? (
        <div className="empty-state"><div className="icon">✓</div><h3>No hay pedidos por cobrar</h3></div>
      ) : (
        <div style={styles.list}>
          {pedidos.map(p => {
            const metodo = metodoSel[p.id_pedido] || p.metodo_pago
            const vuelto = p.metodo_pago === 'efectivo' && p.recibido != null ? Number(p.recibido) - Number(p.total) : null
            return (
              <div key={p.id_pedido} className="card" style={styles.card}>
                <div style={styles.cardTop}>
                  <div>
                    <div style={styles.mozo}>{p.mozo_nombre} {p.mozo_apellido}</div>
                    <div style={styles.pedidoNombre}>{p.nombre}</div>
                  </div>
                  <span style={styles.hora}>{fmtHora(p.created_at)}</span>
                </div>

                <div style={styles.items}>
                  {p.items.map((it, i) => (
                    <div key={i} style={styles.itemRow}>
                      <span>{it.producto}{it.gusto ? ` (${it.gusto})` : ''}</span>
                      <span style={styles.itemCant}>×{it.cantidad}</span>
                    </div>
                  ))}
                </div>

                <div style={styles.pago}>
                  <div style={styles.pagoLine}><span>Total</span><span style={styles.total}>${p.total}</span></div>
                  {p.metodo_pago === 'efectivo' && p.recibido != null && (
                    <>
                      <div style={styles.pagoLine}><span>Recibe</span><span style={styles.mono}>${Number(p.recibido)}</span></div>
                      <div style={styles.pagoLine}><span>Vuelto</span><span style={styles.vuelto}>${vuelto}</span></div>
                    </>
                  )}
                </div>

                <div style={styles.metodoRow}>
                  <button className={`btn btn-sm ${metodo === 'efectivo' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMetodoSel(m => ({ ...m, [p.id_pedido]: 'efectivo' }))}>Efectivo</button>
                  <button className={`btn btn-sm ${metodo === 'transferencia' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMetodoSel(m => ({ ...m, [p.id_pedido]: 'transferencia' }))}>Transfer.</button>
                  <button className="btn btn-success btn-sm" style={{ marginLeft: 'auto' }} disabled={busy[p.id_pedido]} onClick={() => onCobrar(p)}>
                    {busy[p.id_pedido] ? <span className="spinner" /> : 'Cobrado'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </PanelLayout>
  )
}

const styles = {
  header: { marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  sub: { fontSize: 13, color: '#5a5754' },
  loading: { display: 'flex', alignItems: 'center', gap: 10, color: '#5a5754', fontSize: 13, padding: 24 },
  list: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 },
  card: { display: 'flex', flexDirection: 'column', gap: 12 },
  cardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  mozo: { fontSize: 14, fontWeight: 600, color: '#f0ede8' },
  pedidoNombre: { fontSize: 12, color: '#9a9690', fontFamily: "'DM Mono', monospace", marginTop: 2 },
  hora: { fontSize: 11, color: '#5a5754', fontFamily: "'DM Mono', monospace" },
  items: { display: 'flex', flexDirection: 'column', gap: 5, borderTop: '1px solid #2e2e2e', paddingTop: 12 },
  itemRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#f0ede8' },
  itemCant: { fontFamily: "'DM Mono', monospace", color: '#9a9690' },
  pago: { display: 'flex', flexDirection: 'column', gap: 4, borderTop: '1px solid #2e2e2e', paddingTop: 12 },
  pagoLine: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#9a9690' },
  total: { fontSize: 16, fontWeight: 600, color: '#e8c547', fontFamily: "'DM Mono', monospace" },
  mono: { fontFamily: "'DM Mono', monospace", color: '#f0ede8' },
  vuelto: { fontFamily: "'DM Mono', monospace", color: '#4caf7d', fontWeight: 600 },
  metodoRow: { display: 'flex', gap: 8, alignItems: 'center', borderTop: '1px solid #2e2e2e', paddingTop: 12 },
}