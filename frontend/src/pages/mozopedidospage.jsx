import { useEffect, useState, useRef } from 'react'
import PanelLayout from '../components/layout/panellayout'
import { getProductos, crearPedido, misPedidos } from '../api/mozo'
import { useToast, ToastContainer } from '../hooks/usetoast'

const NAV = [{ to: '/mozo', label: 'Pedidos', icon: '▦', end: true }]

function fmtFecha(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export default function MozoPedidosPage() {
  const [productos, setProductos] = useState([])
  const [sel, setSel] = useState({})
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [nombrePedido, setNombrePedido] = useState('')
  const [metodo, setMetodo] = useState('efectivo')
  const [recibido, setRecibido] = useState('')
  const [saving, setSaving] = useState(false)
  const { toasts, toast } = useToast()
  const prevPago = useRef({})

  const loadProductos = async () => {
    try { setProductos(await getProductos()) } catch { toast.error('No se pudo cargar el stock.') }
  }
  const loadPedidos = async (notificar = false) => {
    try {
      const data = await misPedidos()
      if (notificar) for (const p of data) {
        if (prevPago.current[p.id_pedido] === false && p.pagado) toast.success(`Pedido "${p.nombre}" cobrado ✓`)
      }
      prevPago.current = Object.fromEntries(data.map(p => [p.id_pedido, p.pagado]))
      setPedidos(data)
    } catch { /* silencioso */ }
  }
  useEffect(() => {
    (async () => { await Promise.all([loadProductos(), loadPedidos(false)]); setLoading(false) })()
    const t = setInterval(() => loadPedidos(true), 8000)
    return () => clearInterval(t)
  }, [])

  const setCantSimple = (id, val) => {
    const n = parseInt(val, 10)
    setSel(s => { const next = { ...s }; if (isNaN(n) || n <= 0) delete next[id]; else next[id] = { cantidad: n, gustos: {}, nombre: productos.find(p => p.id_producto === id)?.nombre, precio: productos.find(p => p.id_producto === id)?.precio }; return next })
  }
  const setCantGusto = (idProd, idGusto, val) => {
    const n = parseInt(val, 10)
    const P = productos.find(p => p.id_producto === idProd)
    setSel(s => {
      const prod = s[idProd] || { gustos: {} }
      const gustos = { ...prod.gustos }
      if (isNaN(n) || n <= 0) delete gustos[idGusto]; else gustos[idGusto] = n
      const cantidad = Object.values(gustos).reduce((a, b) => a + b, 0)
      const next = { ...s }
      if (cantidad === 0) delete next[idProd]; else next[idProd] = { cantidad, gustos, nombre: P?.nombre, precio: P?.precio }
      return next
    })
  }

  const items = Object.entries(sel)
  const totalUnidades = items.reduce((a, [, v]) => a + v.cantidad, 0)
  const totalPlata = items.reduce((a, [, v]) => a + v.cantidad * Number(v.precio || 0), 0)
  const vuelto = metodo === 'efectivo' ? (Number(recibido) || 0) - totalPlata : 0
  const faltaPlata = metodo === 'efectivo' && recibido !== '' && Number(recibido) < totalPlata

  const abrir = () => {
    if (items.length === 0) return toast.error('Agregá al menos un producto.')
    setNombrePedido(''); setMetodo('efectivo'); setRecibido(''); setShowModal(true)
  }

  const enviar = async () => {
    if (!nombrePedido.trim()) return toast.error('Poné un nombre al pedido.')
    if (metodo === 'efectivo' && (recibido === '' || Number(recibido) < totalPlata)) {
      return toast.error('Lo recibido no puede ser menor al total.')
    }
    setSaving(true)
    try {
      const payload = items.map(([id_producto, v]) => ({
        id_producto, cantidad: v.cantidad,
        gustos: Object.entries(v.gustos).map(([id_gusto, cantidad]) => ({ id_gusto, cantidad })),
      }))
      const rec = metodo === 'efectivo' ? Number(recibido) : null
      const res = await crearPedido(nombrePedido.trim(), payload, metodo, rec)
      toast.success(res.message)
      setSel({}); setShowModal(false)
      await Promise.all([loadProductos(), loadPedidos(false)])
    } catch (err) { toast.error(err.message) } finally { setSaving(false) }
  }

  return (
    <PanelLayout nav={NAV} brandSub="mozo">
      <ToastContainer toasts={toasts} />
      <div style={styles.header}>
        <h1 style={styles.title}>Nuevo pedido</h1>
        <p style={styles.sub}>Elegí productos y cantidades</p>
      </div>

      {loading ? (
        <div style={styles.loading}><span className="spinner" /> Cargando…</div>
      ) : (
        <>
          <div style={styles.grid}>
            {productos.map(p => {
              const cur = sel[p.id_producto]
              return (
                <div key={p.id_producto} style={{ ...styles.prodCard, ...(cur ? styles.prodActive : {}) }}>
                  <div style={styles.prodTop}>
                    <span style={styles.prodNombre}>{p.nombre}</span>
                    <span style={styles.prodStock}>${p.precio} · stock {p.stock}</span>
                  </div>
                  {p.tiene_gustos ? (
                    <div style={styles.gustos}>
                      {p.gustos.map(g => (
                        <div key={g.id_gusto} style={styles.gustoRow}>
                          <span style={styles.gustoN}>{g.nombre} <span style={styles.gStock}>({g.stock})</span></span>
                          <input style={styles.mini} type="number" min="0" placeholder="0"
                            value={cur?.gustos?.[g.id_gusto] ?? ''}
                            onChange={e => setCantGusto(p.id_producto, g.id_gusto, e.target.value)} />
                        </div>
                      ))}
                      {cur && <div style={styles.subtotal}>total: {cur.cantidad}</div>}
                    </div>
                  ) : (
                    <input style={{ width: '100%' }} type="number" min="0" placeholder="0"
                      value={cur?.cantidad ?? ''} onChange={e => setCantSimple(p.id_producto, e.target.value)} />
                  )}
                </div>
              )
            })}
          </div>

          {items.length > 0 && (
            <div style={styles.resumen}>
              <span style={styles.resumenTxt}>{items.length} prod · {totalUnidades} u · ${totalPlata}</span>
              <button className="btn btn-primary" onClick={abrir}>Confirmar pedido</button>
            </div>
          )}

          <h2 style={{ ...styles.sectionTitle, marginTop: 40 }}>Mis pedidos</h2>
          {pedidos.length === 0 ? <p style={styles.sub}>Todavía no hiciste pedidos.</p> : (
            <div style={styles.pedList}>
              {pedidos.map(p => (
                <div key={p.id_pedido} className="card" style={styles.pedCard}>
                  <div style={styles.pedTop}>
                    <strong style={{ color: '#f0ede8' }}>{p.nombre}</strong>
                    <span className={`badge ${p.pagado ? 'badge-active' : 'badge-pending'}`}>{p.pagado ? 'pagado' : 'a cobrar'}</span>
                  </div>
                  <div style={styles.chips}>
                    {p.items.map((it, i) => <span key={i} style={styles.chip}>{it.producto}{it.gusto ? ` ${it.gusto}` : ''} ×{it.cantidad}</span>)}
                  </div>
                  <div style={styles.fecha}>{fmtFecha(p.created_at)} · ${p.total} · {p.metodo_pago ?? '—'}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {showModal && (
        <div style={styles.overlay} onClick={() => !saving && setShowModal(false)}>
          <div className="card" style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Resumen del pedido</h3>

            <div style={styles.resList}>
              {items.map(([id, v]) => (
                <div key={id} style={styles.resRow}>
                  <span>{v.nombre} ×{v.cantidad}</span>
                  <span style={styles.mono}>${v.cantidad * Number(v.precio || 0)}</span>
                </div>
              ))}
            </div>
            <div style={styles.totalRow}><span>Total</span><span style={styles.totalNum}>${totalPlata}</span></div>

            <input autoFocus value={nombrePedido} onChange={e => setNombrePedido(e.target.value)}
              placeholder='Nombre del pedido (ej. "Mesa 5")' style={{ marginTop: 14 }} disabled={saving} />

            <div style={styles.metodoRow}>
              <button className={`btn btn-sm ${metodo === 'efectivo' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMetodo('efectivo')}>Efectivo</button>
              <button className={`btn btn-sm ${metodo === 'transferencia' ? 'btn-primary' : 'btn-ghost'}`} onClick={() => setMetodo('transferencia')}>Transferencia</button>
            </div>

            {metodo === 'efectivo' && (
              <div style={{ marginTop: 12 }}>
                <label style={styles.label}>¿Con cuánto paga?</label>
                <input type="number" min="0" value={recibido} onChange={e => setRecibido(e.target.value)} placeholder="0" disabled={saving} />
                {recibido !== '' && (
                  faltaPlata
                    ? <div style={styles.warn}>Falta plata: el total es ${totalPlata}</div>
                    : <div style={styles.vuelto}>Vuelto: ${vuelto}</div>
                )}
              </div>
            )}

            <div style={styles.modalBtns}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={enviar} disabled={saving || faltaPlata}>
                {saving ? <span className="spinner" /> : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PanelLayout>
  )
}

const styles = {
  header: { marginBottom: 20 },
  title: { fontSize: 22, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  sub: { fontSize: 13, color: '#5a5754' },
  loading: { display: 'flex', alignItems: 'center', gap: 10, color: '#5a5754', fontSize: 13, padding: 24 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 },
  prodCard: { background: '#141414', border: '1px solid #2e2e2e', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 },
  prodActive: { borderColor: '#e8c547', background: '#1a160c' },
  prodTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  prodNombre: { fontSize: 14, fontWeight: 500, color: '#f0ede8' },
  prodStock: { fontSize: 11, color: '#5a5754', fontFamily: "'DM Mono', monospace" },
  gustos: { display: 'flex', flexDirection: 'column', gap: 6 },
  gustoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  gustoN: { fontSize: 12, color: '#9a9690' },
  gStock: { color: '#5a5754' },
  mini: { width: 56 },
  subtotal: { fontSize: 11, color: '#e8c547', fontFamily: "'DM Mono', monospace", textAlign: 'right' },
  resumen: { position: 'sticky', bottom: 16, marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, background: '#1a160c', border: '1px solid #3d2e10', borderRadius: 10, padding: '12px 16px' },
  resumenTxt: { fontSize: 13, color: '#e8c547', fontFamily: "'DM Mono', monospace" },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#f0ede8', marginBottom: 12 },
  pedList: { display: 'flex', flexDirection: 'column', gap: 12 },
  pedCard: { display: 'flex', flexDirection: 'column', gap: 8 },
  pedTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  chips: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip: { fontSize: 12, color: '#9a9690', background: '#181818', border: '1px solid #2e2e2e', borderRadius: 6, padding: '3px 8px' },
  fecha: { fontSize: 11, color: '#5a5754' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 },
  modal: { width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 16, fontWeight: 600, color: '#f0ede8', marginBottom: 12 },
  resList: { display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 },
  resRow: { display: 'flex', justifyContent: 'space-between', fontSize: 13, color: '#f0ede8' },
  mono: { fontFamily: "'DM Mono', monospace", color: '#9a9690' },
  totalRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #2e2e2e', paddingTop: 10, fontSize: 14, color: '#f0ede8' },
  totalNum: { fontSize: 18, fontWeight: 600, color: '#e8c547', fontFamily: "'DM Mono', monospace" },
  metodoRow: { display: 'flex', gap: 8, marginTop: 14 },
  label: { display: 'block', fontSize: 12, color: '#9a9690', fontFamily: "'DM Mono', monospace", marginBottom: 6 },
  warn: { marginTop: 8, fontSize: 12, color: '#d57b7b', background: '#1e1010', border: '1px solid #3a1a1a', borderRadius: 6, padding: '6px 10px' },
  vuelto: { marginTop: 8, fontSize: 13, color: '#4caf7d', fontFamily: "'DM Mono', monospace" },
  modalBtns: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
}