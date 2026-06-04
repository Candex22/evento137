import { useEffect, useState, useRef } from 'react'
import PanelLayout from '../components/layout/panellayout'
import { pedidosPendientes, confirmarPedido, rechazarPedido, getProductos, actualizarPrecio, getHistorial, porCobrar, marcarPagado } from '../api/cajero'
import { useToast, ToastContainer } from '../hooks/usetoast'

const NAV = [
  { to: '/cajero', label: 'Pedidos', icon: '▦', end: true },
]

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
const fmtMoney = v => money.format(Number(v) || 0)

function fmtFecha(iso) {
  const d = new Date(iso)
  return d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

function fmtFechaLarga(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export default function CajeroPedidosPage() {
  const [pedidos, setPedidos]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [busy, setBusy]         = useState({})
  const [rejectId, setRejectId] = useState(null)
  const [motivo, setMotivo]     = useState('')
  const { toasts, toast }       = useToast()
  const prevIds = useRef(new Set())

  // Pestaña activa + estado de la gestión de precios
  const [tab, setTab]               = useState('pedidos')
  const [productos, setProductos]   = useState([])
  const [precioDraft, setPrecioDraft] = useState({})  // { id_producto: valorEditado }
  const [savingPrecio, setSavingPrecio] = useState({})

  // Historial de pedidos resueltos por este cajero
  const [historial, setHistorial] = useState([])
  const [loadingHist, setLoadingHist] = useState(false)

  const loadHistorial = async () => {
    setLoadingHist(true)
    try {
      setHistorial(await getHistorial())
    } catch {
      toast.error('No se pudo cargar el historial.')
    } finally {
      setLoadingHist(false)
    }
  }

  // Pedidos aceptados pendientes de cobro
  const [cobrar, setCobrar] = useState([])
  const [loadingCobrar, setLoadingCobrar] = useState(false)

  const loadCobrar = async (silencioso = false) => {
    if (!silencioso) setLoadingCobrar(true)
    try {
      setCobrar(await porCobrar())
    } catch {
      if (!silencioso) toast.error('No se pudo cargar lo pendiente de cobro.')
    } finally {
      setLoadingCobrar(false)
    }
  }

  const onPagar = async (id) => {
    setBusy(b => ({ ...b, [id]: true }))
    try {
      const res = await marcarPagado(id)
      toast.success(res.message)
      await loadCobrar(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(b => { const n = { ...b }; delete n[id]; return n })
    }
  }

  const loadProductos = async () => {
    try {
      const data = await getProductos()
      setProductos(data)
      setPrecioDraft(Object.fromEntries(data.map(p => [p.id_producto, String(p.precio)])))
    } catch {
      toast.error('No se pudieron cargar los productos.')
    }
  }

  const guardarPrecio = async (id) => {
    const valor = precioDraft[id]
    if (valor === '' || valor === undefined || isNaN(Number(valor)) || Number(valor) < 0) {
      return toast.error('Ingresá un precio válido (0 o mayor).')
    }
    setSavingPrecio(s => ({ ...s, [id]: true }))
    try {
      const res = await actualizarPrecio(id, Number(valor))
      toast.success(res.message)
      await loadProductos()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSavingPrecio(s => { const n = { ...s }; delete n[id]; return n })
    }
  }

  const load = async (notificar = false) => {
    try {
      const data = await pedidosPendientes()
      if (notificar) {
        const nuevos = data.filter(p => !prevIds.current.has(p.id_pedido))
        if (nuevos.length > 0) toast.success(`${nuevos.length} pedido(s) nuevo(s)`)
      }
      prevIds.current = new Set(data.map(p => p.id_pedido))
      setPedidos(data)
    } catch {
      if (!notificar) toast.error('No se pudieron cargar los pedidos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(false)
    const t = setInterval(() => load(true), 8000)  // polling
    return () => clearInterval(t)
  }, [])

  // Al cambiar de pestaña, cargar lo que corresponda
  useEffect(() => {
    if (tab === 'precios') loadProductos()
    if (tab === 'historial') loadHistorial()
    if (tab === 'por_cobrar') {
      loadCobrar(false)
      const t = setInterval(() => loadCobrar(true), 8000)
      return () => clearInterval(t)
    }
  }, [tab])

  const onConfirmar = async (id) => {
    setBusy(b => ({ ...b, [id]: true }))
    try {
      const res = await confirmarPedido(id)
      toast.success(res.message)
      await load(false)
    } catch (err) {
      toast.error(err.message)   // acá llega "Stock insuficiente: ..."
    } finally {
      setBusy(b => { const n = { ...b }; delete n[id]; return n })
    }
  }

  const onRechazar = async () => {
    if (!motivo.trim()) return toast.error('Escribí el motivo del rechazo.')
    const id = rejectId
    setBusy(b => ({ ...b, [id]: true }))
    try {
      const res = await rechazarPedido(id, motivo.trim())
      toast.success(res.message)
      setRejectId(null)
      setMotivo('')
      await load(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setBusy(b => { const n = { ...b }; delete n[id]; return n })
    }
  }

  return (
    <PanelLayout nav={NAV} brandSub="cajero">
      <ToastContainer toasts={toasts} />

      <div style={styles.header}>
        <h1 style={styles.title}>
          {{ pedidos: 'Pedidos pendientes', por_cobrar: 'Por cobrar', precios: 'Precios', historial: 'Mi historial' }[tab]}
        </h1>
        <p style={styles.sub}>
          {{
            pedidos: 'Revisá y confirmá o rechazá cada pedido',
            por_cobrar: 'Pedidos aceptados esperando el pago del mozo',
            precios: 'Fijá el precio de cada producto',
            historial: 'Pedidos que aceptaste o rechazaste',
          }[tab]}
        </p>
      </div>

      <div style={styles.tabs}>
        <button style={{ ...styles.tab, ...(tab === 'pedidos' ? styles.tabActive : {}) }} onClick={() => setTab('pedidos')}>Pedidos</button>
        <button style={{ ...styles.tab, ...(tab === 'por_cobrar' ? styles.tabActive : {}) }} onClick={() => setTab('por_cobrar')}>
          Por cobrar{cobrar.length > 0 ? ` (${cobrar.length})` : ''}
        </button>
        <button style={{ ...styles.tab, ...(tab === 'precios' ? styles.tabActive : {}) }} onClick={() => setTab('precios')}>Precios</button>
        <button style={{ ...styles.tab, ...(tab === 'historial' ? styles.tabActive : {}) }} onClick={() => setTab('historial')}>Historial</button>
      </div>

      {tab === 'por_cobrar' ? (
        loadingCobrar ? (
          <div style={styles.loading}><span className="spinner" /> Cargando…</div>
        ) : cobrar.length === 0 ? (
          <div className="empty-state"><div className="icon">$</div><h3>No hay pedidos por cobrar</h3><p>Los aceptados sin pagar aparecen acá.</p></div>
        ) : (
          <div style={styles.list}>
            {cobrar.map(p => (
              <div key={p.id_pedido} className="card" style={styles.card}>
                <div style={styles.cardTop}>
                  <div>
                    <div style={styles.mozo}>{p.mozo_nombre} {p.mozo_apellido}</div>
                    <div style={styles.pedidoNombre}>{p.nombre}</div>
                  </div>
                  <span style={styles.hora}>{fmtFecha(p.resolved_at || p.created_at)}</span>
                </div>
                <div style={styles.items}>
                  {p.items.map((it, i) => (
                    <div key={i} style={styles.itemRow}>
                      <span style={{ color: '#f0ede8' }}>{it.producto} ×{it.cantidad}</span>
                      <span style={styles.itemCant}>{fmtMoney(it.subtotal)}</span>
                    </div>
                  ))}
                </div>
                <div style={styles.totalRow}>
                  <span style={styles.totalLabel}>Total a cobrar</span>
                  <span style={styles.totalValue}>{fmtMoney(p.total)}</span>
                </div>
                <div style={styles.actions}>
                  <button className="btn btn-success btn-sm" disabled={busy[p.id_pedido]} onClick={() => onPagar(p.id_pedido)}>
                    {busy[p.id_pedido] ? <span className="spinner" /> : 'Pagado'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === 'historial' ? (
        loadingHist ? (
          <div style={styles.loading}><span className="spinner" /> Cargando…</div>
        ) : historial.length === 0 ? (
          <div className="empty-state"><div className="icon">⟲</div><h3>Todavía no resolviste pedidos</h3></div>
        ) : (
          <div style={styles.list}>
            {historial.map(p => (
              <div key={p.id_pedido} className="card" style={styles.card}>
                <div style={styles.cardTop}>
                  <div>
                    <div style={styles.mozo}>{p.mozo_nombre} {p.mozo_apellido}</div>
                    <div style={styles.pedidoNombre}>{p.nombre}</div>
                  </div>
                  <span className={`badge ${p.estado === 'confirmado' ? 'badge-active' : 'badge-inactive'}`}>
                    {p.estado === 'confirmado' ? 'aceptado' : 'rechazado'}
                  </span>
                </div>
                <div style={styles.items}>
                  {p.items.map((it, i) => (
                    <span key={i} style={styles.histChip}>{it.producto} ×{it.cantidad} · {fmtMoney(it.subtotal)}</span>
                  ))}
                </div>
                {p.estado === 'rechazado' && p.motivo_rechazo && (
                  <div style={styles.warn}>Motivo: {p.motivo_rechazo}</div>
                )}
                <div style={styles.totalRow}>
                  <span style={styles.histFecha}>
                    {fmtFechaLarga(p.resolved_at || p.created_at)}
                    {p.estado === 'confirmado' && (p.pagado ? ' · ✓ pagado' : ' · sin pagar')}
                  </span>
                  <span style={styles.totalValue}>{fmtMoney(p.total)}</span>
                </div>
              </div>
            ))}
          </div>
        )
      ) : tab === 'precios' ? (
        productos.length === 0 ? (
          <div className="empty-state"><div className="icon">$</div><h3>No hay productos cargados</h3></div>
        ) : (
          <div style={styles.precioList}>
            {productos.map(p => (
              <div key={p.id_producto} className="card" style={styles.precioRow}>
                <div>
                  <div style={styles.mozo}>{p.nombre}</div>
                  <div style={styles.pedidoNombre}>stock {p.stock} · actual {fmtMoney(p.precio)}</div>
                </div>
                <div style={styles.precioEdit}>
                  <input
                    type="number" min="0" step="0.01"
                    value={precioDraft[p.id_producto] ?? ''}
                    onChange={e => setPrecioDraft(d => ({ ...d, [p.id_producto]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && guardarPrecio(p.id_producto)}
                    style={styles.precioInput}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={savingPrecio[p.id_producto]}
                    onClick={() => guardarPrecio(p.id_producto)}
                  >
                    {savingPrecio[p.id_producto] ? <span className="spinner" /> : 'Guardar'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )
      ) : loading ? (
        <div style={styles.loading}><span className="spinner" /> Cargando…</div>
      ) : pedidos.length === 0 ? (
        <div className="empty-state"><div className="icon">✓</div><h3>No hay pedidos pendientes</h3><p>Los nuevos aparecen solos.</p></div>
      ) : (
        <div style={styles.list}>
          {pedidos.map(p => {
            const totalU = p.items.reduce((s, i) => s + i.cantidad, 0)
            const hayFaltante = p.items.some(i => i.cantidad > i.stock)
            return (
              <div key={p.id_pedido} className="card" style={styles.card}>
                <div style={styles.cardTop}>
                  <div>
                    <div style={styles.mozo}>{p.mozo_nombre} {p.mozo_apellido}</div>
                    <div style={styles.pedidoNombre}>{p.nombre} · {p.items.length} prod · {totalU} u.</div>
                  </div>
                  <span style={styles.hora}>{fmtFecha(p.created_at)}</span>
                </div>

                <div style={styles.items}>
                  {p.items.map((it, i) => {
                    const falta = it.cantidad > it.stock
                    return (
                      <div key={i} style={styles.itemRow}>
                        <span style={{ color: falta ? '#d57b7b' : '#f0ede8' }}>{it.producto}</span>
                        <span style={styles.itemCant}>
                          ×{it.cantidad}
                          <span style={{ ...styles.itemStock, color: falta ? '#d57b7b' : '#5a5754' }}>
                            (stock {it.stock})
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>

                <div style={styles.totalRow}>
                  <span style={styles.totalLabel}>Total a cobrar</span>
                  <span style={styles.totalValue}>{fmtMoney(p.total)}</span>
                </div>

                {hayFaltante && <div style={styles.warn}>⚠ No hay stock suficiente para confirmar</div>}

                <div style={styles.actions}>
                  <button className="btn btn-danger btn-sm" disabled={busy[p.id_pedido]} onClick={() => { setRejectId(p.id_pedido); setMotivo('') }}>
                    Rechazar
                  </button>
                  <button className="btn btn-success btn-sm" disabled={busy[p.id_pedido] || hayFaltante} onClick={() => onConfirmar(p.id_pedido)}>
                    {busy[p.id_pedido] ? <span className="spinner" /> : 'Confirmar'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Modal de rechazo con motivo obligatorio */}
      {rejectId !== null && (
        <div style={styles.overlay} onClick={() => setRejectId(null)}>
          <div className="card" style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Motivo del rechazo</h3>
            <p style={styles.sub}>El mozo lo verá para explicarlo en la mesa</p>
            <textarea
              autoFocus value={motivo} rows={3}
              onChange={e => setMotivo(e.target.value)}
              placeholder="Ej. No hay stock de gaseosa, ofrecer otra opción"
              style={{ marginTop: 12, marginBottom: 16, resize: 'vertical', width: '100%' }}
            />
            <div style={styles.modalBtns}>
              <button className="btn btn-ghost" onClick={() => setRejectId(null)}>Cancelar</button>
              <button className="btn btn-danger" onClick={onRechazar} disabled={busy[rejectId]}>
                {busy[rejectId] ? <span className="spinner" /> : 'Rechazar pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PanelLayout>
  )
}

const styles = {
  header:    { marginBottom: 16 },
  tabs:      { display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid #2e2e2e' },
  tab:       { background: 'none', border: 'none', color: '#5a5754', fontSize: 13, fontWeight: 500, padding: '8px 12px', cursor: 'pointer', borderBottom: '2px solid transparent', marginBottom: -1 },
  tabActive: { color: '#e8c547', borderBottomColor: '#e8c547' },
  precioList:{ display: 'flex', flexDirection: 'column', gap: 10 },
  precioRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  precioEdit:{ display: 'flex', alignItems: 'center', gap: 8 },
  precioInput:{ width: 110, textAlign: 'right' },
  totalRow:  { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid #2e2e2e', paddingTop: 10 },
  totalLabel:{ fontSize: 12, color: '#9a9690', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: "'DM Mono', monospace" },
  totalValue:{ fontSize: 18, fontWeight: 600, color: '#e8c547', fontFamily: "'DM Mono', monospace" },
  histChip:  { fontSize: 12, color: '#9a9690', background: '#181818', border: '1px solid #2e2e2e', borderRadius: 6, padding: '3px 8px' },
  histFecha: { fontSize: 11, color: '#5a5754', fontFamily: "'DM Mono', monospace" },
  title:     { fontSize: 22, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  sub:       { fontSize: 13, color: '#5a5754' },
  loading:   { display: 'flex', alignItems: 'center', gap: 10, color: '#5a5754', fontSize: 13, padding: 24 },
  list:      { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 },
  card:      { display: 'flex', flexDirection: 'column', gap: 12 },
  cardTop:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
  mozo:      { fontSize: 14, fontWeight: 600, color: '#f0ede8' },
  pedidoNombre: { fontSize: 12, color: '#9a9690', fontFamily: "'DM Mono', monospace", marginTop: 2 },
  hora:      { fontSize: 11, color: '#5a5754', fontFamily: "'DM Mono', monospace" },
  items:     { display: 'flex', flexDirection: 'column', gap: 6, borderTop: '1px solid #2e2e2e', paddingTop: 12 },
  itemRow:   { display: 'flex', justifyContent: 'space-between', fontSize: 13 },
  itemCant:  { fontFamily: "'DM Mono', monospace", color: '#9a9690' },
  itemStock: { fontSize: 11, marginLeft: 6 },
  warn:      { fontSize: 12, color: '#d57b7b', background: '#1e1010', border: '1px solid #3a1a1a', borderRadius: 6, padding: '6px 10px' },
  actions:   { display: 'flex', justifyContent: 'flex-end', gap: 8 },
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 },
  modal:     { width: '100%', maxWidth: 420 },
  modalTitle:{ fontSize: 16, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  modalBtns: { display: 'flex', justifyContent: 'flex-end', gap: 10 },
}