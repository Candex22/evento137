import { useEffect, useState, useRef } from 'react'
import PanelLayout from '../components/layout/panellayout'
import { getProductos, crearPedido, misPedidos } from '../api/mozo'
import { useToast, ToastContainer } from '../hooks/usetoast'

const NAV = [
  { to: '/mozo', label: 'Pedidos', icon: '▦', end: true },
]

const ESTADO_BADGE = {
  pendiente:  'badge-pending',
  confirmado: 'badge-active',
  rechazado:  'badge-inactive',
}

const money = new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' })
const fmtMoney = v => money.format(Number(v) || 0)

function fmtFecha(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) +
    ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export default function MozoPedidosPage() {
  const [productos, setProductos] = useState([])
  const [cant, setCant]           = useState({})   // { id_producto: cantidad }
  const [pedidos, setPedidos]     = useState([])
  const [loading, setLoading]     = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [nombrePedido, setNombrePedido] = useState('')
  const [saving, setSaving]       = useState(false)
  const { toasts, toast }         = useToast()
  const prevEstados = useRef({})

  const loadProductos = async () => {
    try { setProductos(await getProductos()) }
    catch { toast.error('No se pudo cargar el stock.') }
  }

  // Trae mis pedidos y detecta cambios de estado para notificar
  const loadPedidos = async (notificar = false) => {
    try {
      const data = await misPedidos()
      if (notificar) {
        for (const p of data) {
          const antes = prevEstados.current[p.id_pedido]
          if (antes === 'pendiente' && p.estado !== 'pendiente') {
            if (p.estado === 'confirmado') toast.success(`Pedido "${p.nombre}" confirmado ✓`)
            if (p.estado === 'rechazado')  toast.error(`Pedido "${p.nombre}" rechazado`)
          }
        }
      }
      prevEstados.current = Object.fromEntries(data.map(p => [p.id_pedido, p.estado]))
      setPedidos(data)
    } catch { /* silencioso en polling */ }
  }

  useEffect(() => {
    (async () => {
      await Promise.all([loadProductos(), loadPedidos(false)])
      setLoading(false)
    })()
    const t = setInterval(() => { loadPedidos(true) }, 8000)  // polling
    return () => clearInterval(t)
  }, [])

  const setCantidad = (id, val) => {
    const n = parseInt(val, 10)
    setCant(c => {
      const next = { ...c }
      if (isNaN(n) || n <= 0) delete next[id]
      else next[id] = n
      return next
    })
  }

  const itemsSeleccionados = Object.entries(cant)
  const totalUnidades = itemsSeleccionados.reduce((s, [, q]) => s + q, 0)
  const precioPorId = Object.fromEntries(productos.map(p => [String(p.id_producto), Number(p.precio) || 0]))
  const totalImporte = itemsSeleccionados.reduce((s, [id, q]) => s + q * (precioPorId[id] || 0), 0)

  const abrirConfirmar = () => {
    if (itemsSeleccionados.length === 0) return toast.error('Agregá al menos un producto.')
    setNombrePedido('')
    setShowModal(true)
  }

  const enviarPedido = async () => {
    if (!nombrePedido.trim()) return toast.error('Ingresá un nombre para el pedido.')
    setSaving(true)
    try {
      const items = itemsSeleccionados.map(([id_producto, cantidad]) => ({ id_producto, cantidad }))
      const res = await crearPedido(nombrePedido.trim(), items)
      toast.success(res.message)
      setCant({})
      setShowModal(false)
      await loadPedidos(false)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <PanelLayout nav={NAV} brandSub="mozo">
      <ToastContainer toasts={toasts} />

      <div style={styles.header}>
        <h1 style={styles.title}>Nuevo pedido</h1>
        <p style={styles.sub}>Elegí los productos y las cantidades</p>
      </div>

      {loading ? (
        <div style={styles.loading}><span className="spinner" /> Cargando…</div>
      ) : (
        <>
          {productos.length === 0 ? (
            <div className="empty-state"><div className="icon">▦</div><h3>No hay productos en el stock</h3></div>
          ) : (
            <div style={styles.gridProd}>
              {productos.map(p => {
                const sel = cant[p.id_producto]
                return (
                  <div key={p.id_producto} style={{ ...styles.prodCard, ...(sel ? styles.prodCardActive : {}) }}>
                    <div style={styles.prodNombre}>{p.nombre}</div>
                    <div style={styles.prodStock}>stock: {p.stock} · {fmtMoney(p.precio)}</div>
                    <input
                      type="number" min="0" placeholder="0"
                      value={sel ?? ''}
                      onChange={e => setCantidad(p.id_producto, e.target.value)}
                      style={styles.prodInput}
                    />
                  </div>
                )
              })}
            </div>
          )}

          {/* Barra de resumen */}
          {itemsSeleccionados.length > 0 && (
            <div style={styles.resumen}>
              <span style={styles.resumenTxt}>
                {itemsSeleccionados.length} producto(s) · {totalUnidades} u. · {fmtMoney(totalImporte)}
              </span>
              <button className="btn btn-primary" onClick={abrirConfirmar}>Confirmar pedido</button>
            </div>
          )}

          {/* Mis pedidos */}
          <h2 style={{ ...styles.sectionTitle, marginTop: 40 }}>Mis pedidos</h2>
          {pedidos.length === 0 ? (
            <p style={styles.sub}>Todavía no hiciste ningún pedido.</p>
          ) : (
            <div style={styles.pedidoList}>
              {pedidos.map(p => (
                <div key={p.id_pedido} className="card" style={styles.pedidoCard}>
                  <div style={styles.pedidoTop}>
                    <strong style={{ color: '#f0ede8' }}>{p.nombre}</strong>
                    <span className={`badge ${ESTADO_BADGE[p.estado]}`}>{p.estado}</span>
                  </div>
                  <div style={styles.pedidoItems}>
                    {p.items.map((it, i) => (
                      <span key={i} style={styles.chip}>
                        {it.producto} ×{it.cantidad} · {fmtMoney(it.subtotal)}
                      </span>
                    ))}
                  </div>
                  <div style={styles.pedidoTotal}>
                    <span style={styles.pedidoTotalLabel}>Total</span>
                    <span style={styles.pedidoTotalValue}>{fmtMoney(p.total)}</span>
                  </div>
                  {p.estado === 'rechazado' && p.motivo_rechazo && (
                    <div style={styles.motivo}>Motivo: {p.motivo_rechazo}</div>
                  )}
                  <div style={styles.fecha}>{fmtFecha(p.created_at)}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal nombre del pedido */}
      {showModal && (
        <div style={styles.overlay} onClick={() => !saving && setShowModal(false)}>
          <div className="card" style={styles.modal} onClick={e => e.stopPropagation()}>
            <h3 style={styles.modalTitle}>Nombre del pedido</h3>
            <p style={styles.sub}>Para identificarlo al entregarlo (ej. "Mesa 5", "Juan")</p>
            <input
              type="text" autoFocus value={nombrePedido}
              onChange={e => setNombrePedido(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && enviarPedido()}
              placeholder="Ej. Mesa 5"
              style={{ marginTop: 12, marginBottom: 16 }}
              disabled={saving}
            />
            <div style={styles.modalBtns}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={enviarPedido} disabled={saving}>
                {saving ? <span className="spinner" /> : 'Enviar pedido'}
              </button>
            </div>
          </div>
        </div>
      )}
    </PanelLayout>
  )
}

const styles = {
  header:    { marginBottom: 20 },
  title:     { fontSize: 22, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  sub:       { fontSize: 13, color: '#5a5754' },
  loading:   { display: 'flex', alignItems: 'center', gap: 10, color: '#5a5754', fontSize: 13, padding: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#f0ede8', marginBottom: 12 },
  gridProd:  { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 12 },
  prodCard:  { background: '#141414', border: '1px solid #2e2e2e', borderRadius: 10, padding: 14 },
  prodCardActive: { borderColor: '#e8c547', background: '#1a160c' },
  prodNombre:{ fontSize: 14, fontWeight: 500, color: '#f0ede8', marginBottom: 2 },
  prodStock: { fontSize: 11, color: '#5a5754', fontFamily: "'DM Mono', monospace", marginBottom: 10 },
  prodInput: { width: '100%' },
  resumen:   { position: 'sticky', bottom: 16, marginTop: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, background: '#1a160c', border: '1px solid #3d2e10', borderRadius: 10, padding: '12px 16px' },
  resumenTxt:{ fontSize: 13, color: '#e8c547', fontFamily: "'DM Mono', monospace" },
  pedidoList:{ display: 'flex', flexDirection: 'column', gap: 12 },
  pedidoCard:{ display: 'flex', flexDirection: 'column', gap: 8 },
  pedidoTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  pedidoItems:{ display: 'flex', flexWrap: 'wrap', gap: 6 },
  chip:      { fontSize: 12, color: '#9a9690', background: '#181818', border: '1px solid #2e2e2e', borderRadius: 6, padding: '3px 8px' },
  pedidoTotal: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid #2e2e2e', paddingTop: 8 },
  pedidoTotalLabel: { fontSize: 11, color: '#9a9690', textTransform: 'uppercase', letterSpacing: '.06em', fontFamily: "'DM Mono', monospace" },
  pedidoTotalValue: { fontSize: 15, fontWeight: 600, color: '#e8c547', fontFamily: "'DM Mono', monospace" },
  motivo:    { fontSize: 12, color: '#d57b7b', background: '#1e1010', border: '1px solid #3a1a1a', borderRadius: 6, padding: '6px 10px' },
  fecha:     { fontSize: 11, color: '#5a5754' },
  overlay:   { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 20 },
  modal:     { width: '100%', maxWidth: 380 },
  modalTitle:{ fontSize: 16, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  modalBtns: { display: 'flex', justifyContent: 'flex-end', gap: 10 },
}