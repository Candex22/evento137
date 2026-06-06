import { useEffect, useState, useRef } from 'react'
import PanelLayout from '../components/layout/panellayout'
import { getProductos, getCombos, crearPedido, misPedidos } from '../api/mozo'
import { useToast, ToastContainer } from '../hooks/usetoast'

const NAV = [{ to: '/mozo', label: 'Pedidos', icon: '▦', end: true }]

function fmtFecha(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) + ' ' +
    d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export default function MozoPedidosPage() {
  const [productos, setProductos] = useState([])
  const [combos, setCombos] = useState([])
  const [sel, setSel] = useState({})          // productos sueltos: { [id]: {cantidad, gustos, nombre, precio} }
  const [selCombo, setSelCombo] = useState({}) // combos: { [id_combo]: {cantidad, gustos:{[idProd]:{[idGusto]:cant}}, nombre, precio} }
  const [abierto, setAbierto] = useState({})   // qué producto/combo tiene los gustos desplegados
  const [pedidos, setPedidos] = useState([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [nombrePedido, setNombrePedido] = useState('')
  const [metodo, setMetodo] = useState('efectivo')
  const [recibido, setRecibido] = useState('')
  const [saving, setSaving] = useState(false)
  const { toasts, toast } = useToast()
  const prevPago = useRef({})

  const loadCatalogo = async () => {
    try {
      const [prods, cbs] = await Promise.all([getProductos(), getCombos()])
      setProductos(prods); setCombos(cbs)
    } catch { toast.error('No se pudo cargar el catálogo.') }
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
    (async () => { await Promise.all([loadCatalogo(), loadPedidos(false)]); setLoading(false) })()
    const t = setInterval(() => loadPedidos(true), 8000)
    return () => clearInterval(t)
  }, [])

  const toggle = (key) => setAbierto(a => ({ ...a, [key]: !a[key] }))

  // --- productos sueltos ---
  const setCantSimple = (id, val) => {
    const n = parseInt(val, 10)
    const P = productos.find(p => p.id_producto === id)
    setSel(s => { const next = { ...s }; if (isNaN(n) || n <= 0) delete next[id]; else next[id] = { cantidad: n, gustos: {}, nombre: P?.nombre, precio: P?.precio }; return next })
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

  // --- combos ---
  const setCantCombo = (c, val) => {
    const n = parseInt(val, 10)
    setSelCombo(s => {
      const next = { ...s }
      if (isNaN(n) || n <= 0) delete next[c.id_combo]
      else next[c.id_combo] = { ...(next[c.id_combo] || { gustos: {} }), cantidad: n, nombre: c.nombre, precio: c.precio }
      return next
    })
  }
  const setComboGusto = (idCombo, idProd, idGusto, val) => {
    const n = parseInt(val, 10)
    setSelCombo(s => {
      const c = s[idCombo]; if (!c) return s
      const gustos = { ...c.gustos }
      const porProd = { ...(gustos[idProd] || {}) }
      if (isNaN(n) || n <= 0) delete porProd[idGusto]; else porProd[idGusto] = n
      gustos[idProd] = porProd
      return { ...s, [idCombo]: { ...c, gustos } }
    })
  }

  const items = Object.entries(sel)
  const combosSel = Object.entries(selCombo)
  const totalPlata =
    items.reduce((a, [, v]) => a + v.cantidad * Number(v.precio || 0), 0) +
    combosSel.reduce((a, [, v]) => a + v.cantidad * Number(v.precio || 0), 0)
  const hayAlgo = items.length > 0 || combosSel.length > 0
  const vuelto = metodo === 'efectivo' ? (Number(recibido) || 0) - totalPlata : 0
  const faltaPlata = metodo === 'efectivo' && recibido !== '' && Number(recibido) < totalPlata

  const abrir = () => {
    if (!hayAlgo) return toast.error('Agregá al menos un producto o combo.')
    setNombrePedido(''); setMetodo('efectivo'); setRecibido(''); setShowModal(true)
  }

  const enviar = async () => {
    if (!nombrePedido.trim()) return toast.error('Poné un nombre al pedido.')
    if (metodo === 'efectivo' && (recibido === '' || Number(recibido) < totalPlata)) {
      return toast.error('Lo recibido no puede ser menor al total.')
    }
    setSaving(true)
    try {
      const payloadProd = items.map(([id_producto, v]) => ({
        id_producto, cantidad: v.cantidad,
        gustos: Object.entries(v.gustos).map(([id_gusto, cantidad]) => ({ id_gusto, cantidad })),
      }))
      const payloadCombo = combosSel.map(([id_combo, v]) => ({
        id_combo, cantidad: v.cantidad,
        gustos_por_componente: Object.fromEntries(
          Object.entries(v.gustos).map(([idProd, gs]) => [idProd, Object.entries(gs).map(([id_gusto, cantidad]) => ({ id_gusto, cantidad }))])
        ),
      }))
      const rec = metodo === 'efectivo' ? Number(recibido) : null
      const res = await crearPedido(nombrePedido.trim(), [...payloadProd, ...payloadCombo], metodo, rec)
      toast.success(res.message)
      setSel({}); setSelCombo({}); setAbierto({}); setShowModal(false)
      await Promise.all([loadCatalogo(), loadPedidos(false)])
    } catch (err) { toast.error(err.message) } finally { setSaving(false) }
  }

  return (
    <PanelLayout nav={NAV} brandSub="mozo">
      <ToastContainer toasts={toasts} />
      <div style={styles.header}>
        <h1 style={styles.title}>Nuevo pedido</h1>
        <p style={styles.sub}>Elegí productos, combos y cantidades</p>
      </div>

      {loading ? (
        <div style={styles.loading}><span className="spinner" /> Cargando…</div>
      ) : (
        <>
          {/* COMBOS */}
          {combos.length > 0 && (
            <>
              <h2 style={styles.sectionTitle}>Combos</h2>
              <div style={styles.grid}>
                {combos.map(c => {
                  const cur = selCombo[c.id_combo]
                  const key = `c${c.id_combo}`
                  const conGustos = c.componentes.filter(x => x.tiene_gustos)
                  return (
                    <div key={c.id_combo} style={{ ...styles.prodCard, ...(cur ? styles.prodActive : {}) }}>
                      <div style={styles.prodTop}>
                        <span style={styles.prodNombre}>{c.nombre}</span>
                        <span style={styles.prodStock}>${c.precio}</span>
                      </div>
                      <div style={styles.comboComps}>{c.componentes.map((x, i) => <span key={i} style={styles.gStock}>{x.cantidad}× {x.producto}</span>)}</div>
                      <div style={styles.gustoRow}>
                        <span style={styles.gustoN}>Cantidad</span>
                        <input style={styles.mini} type="number" min="0" placeholder="0"
                          value={cur?.cantidad ?? ''} onChange={e => setCantCombo(c, e.target.value)} />
                      </div>
                      {/* gustos del combo: se despliegan al tocar, y solo si hay cantidad */}
                      {cur && conGustos.length > 0 && (
                        <>
                          <button className="btn btn-ghost btn-sm" onClick={() => toggle(key)}>
                            {abierto[key] ? 'Ocultar gustos ▲' : 'Elegir gustos ▼'}
                          </button>
                          {abierto[key] && conGustos.map(x => {
                            const necesita = x.cantidad * (cur.cantidad || 0)
                            const elegido = Object.values(cur.gustos?.[x.id_producto] || {}).reduce((a, b) => a + b, 0)
                            return (
                              <div key={x.id_producto} style={styles.compBox}>
                                <div style={styles.compHead}>{x.producto} <span style={styles.gStock}>({elegido}/{necesita})</span></div>
                                {x.gustos.map(g => (
                                  <div key={g.id_gusto} style={styles.gustoRow}>
                                    <span style={styles.gustoN}>{g.nombre} <span style={styles.gStock}>({g.stock})</span></span>
                                    <input style={styles.mini} type="number" min="0" placeholder="0"
                                      value={cur.gustos?.[x.id_producto]?.[g.id_gusto] ?? ''}
                                      onChange={e => setComboGusto(c.id_combo, x.id_producto, g.id_gusto, e.target.value)} />
                                  </div>
                                ))}
                              </div>
                            )
                          })}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </>
          )}

          {/* PRODUCTOS */}
          <h2 style={{ ...styles.sectionTitle, marginTop: combos.length ? 28 : 0 }}>Productos</h2>
          <div style={styles.grid}>
            {productos.map(p => {
              const cur = sel[p.id_producto]
              const key = `p${p.id_producto}`
              return (
                <div key={p.id_producto} style={{ ...styles.prodCard, ...(cur ? styles.prodActive : {}) }}>
                  <div style={styles.prodTop}>
                    <span style={styles.prodNombre}>{p.nombre}</span>
                    <span style={styles.prodStock}>${p.precio} · stock {p.stock}</span>
                  </div>
                  {p.tiene_gustos ? (
                    <>
                      <button className="btn btn-ghost btn-sm" onClick={() => toggle(key)}>
                        {abierto[key] ? 'Ocultar gustos ▲' : (cur ? `Elegidos: ${cur.cantidad} ▼` : 'Elegir gustos ▼')}
                      </button>
                      {abierto[key] && (
                        <div style={styles.gustos}>
                          {p.gustos.map(g => (
                            <div key={g.id_gusto} style={styles.gustoRow}>
                              <span style={styles.gustoN}>{g.nombre} <span style={styles.gStock}>({g.stock})</span></span>
                              <input style={styles.mini} type="number" min="0" placeholder="0"
                                value={cur?.gustos?.[g.id_gusto] ?? ''}
                                onChange={e => setCantGusto(p.id_producto, g.id_gusto, e.target.value)} />
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : (
                    <input style={{ width: '100%' }} type="number" min="0" placeholder="0"
                      value={cur?.cantidad ?? ''} onChange={e => setCantSimple(p.id_producto, e.target.value)} />
                  )}
                </div>
              )
            })}
          </div>

          {hayAlgo && (
            <div style={styles.resumen}>
              <span style={styles.resumenTxt}>{items.length + combosSel.length} ítem(s) · ${totalPlata}</span>
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
                    {p.items.map((it, i) => <span key={i} style={styles.chip}>{it.es_combo ? '◆ ' : ''}{it.producto}{it.gusto ? ` ${it.gusto}` : ''} ×{it.cantidad}</span>)}
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
                <div key={id} style={styles.resRow}><span>{v.nombre} ×{v.cantidad}</span><span style={styles.mono}>${v.cantidad * Number(v.precio || 0)}</span></div>
              ))}
              {combosSel.map(([id, v]) => (
                <div key={`c${id}`} style={styles.resRow}><span>◆ {v.nombre} ×{v.cantidad}</span><span style={styles.mono}>${v.cantidad * Number(v.precio || 0)}</span></div>
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
                {recibido !== '' && (faltaPlata
                  ? <div style={styles.warn}>Falta plata: el total es ${totalPlata}</div>
                  : <div style={styles.vuelto}>Vuelto: ${vuelto}</div>)}
              </div>
            )}

            <div style={styles.modalBtns}>
              <button className="btn btn-ghost" onClick={() => setShowModal(false)} disabled={saving}>Cancelar</button>
              <button className="btn btn-primary" onClick={enviar} disabled={saving || faltaPlata}>{saving ? <span className="spinner" /> : 'Confirmar'}</button>
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
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(190px, 1fr))', gap: 12 },
  prodCard: { background: '#141414', border: '1px solid #2e2e2e', borderRadius: 10, padding: 14, display: 'flex', flexDirection: 'column', gap: 10 },
  prodActive: { borderColor: '#e8c547', background: '#1a160c' },
  prodTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' },
  prodNombre: { fontSize: 14, fontWeight: 500, color: '#f0ede8' },
  prodStock: { fontSize: 11, color: '#5a5754', fontFamily: "'DM Mono', monospace" },
  comboComps: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  gustos: { display: 'flex', flexDirection: 'column', gap: 6 },
  gustoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  gustoN: { fontSize: 12, color: '#9a9690' },
  gStock: { color: '#5a5754', fontSize: 11 },
  mini: { width: 56 },
  compBox: { background: '#181818', border: '1px solid #2e2e2e', borderRadius: 8, padding: 8, display: 'flex', flexDirection: 'column', gap: 6 },
  compHead: { fontSize: 12, color: '#f0ede8', fontWeight: 500 },
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