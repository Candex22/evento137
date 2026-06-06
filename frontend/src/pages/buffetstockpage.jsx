import { useEffect, useState } from 'react'
import PanelLayout from '../components/layout/panellayout'
import {
  getProductos, crearProducto, agregarGusto, cargarStock, ajustarProducto, ajustarGusto,
} from '../api/buffet'
import { useToast, ToastContainer } from '../hooks/usetoast'

const NAV = [{ to: '/buffet', label: 'Stock', icon: '▦', end: true }]

export default function BuffetStockPage() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading] = useState(true)
  const [np, setNp] = useState({ nombre: '', precio: '', tiene_gustos: false })
  const [cargas, setCargas] = useState({})      // { 'p3': '10', 'g5': '20' }
  const [gustoForm, setGustoForm] = useState({}) // { [id_producto]: { nombre, stock } }
  const { toasts, toast } = useToast()

  const load = async () => {
    try { setProductos(await getProductos()) }
    catch { toast.error('No se pudo cargar el stock.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const onCrear = async () => {
    if (!np.nombre.trim()) return toast.error('Poné un nombre.')
    try {
      const res = await crearProducto(np.nombre.trim(), Number(np.precio) || 0, np.tiene_gustos)
      toast.success(res.message)
      setNp({ nombre: '', precio: '', tiene_gustos: false })
      await load()
    } catch (err) { toast.error(err.message) }
  }

  const onCargar = async (payload, key) => {
    const cantidad = parseInt(cargas[key], 10)
    if (isNaN(cantidad) || cantidad <= 0) return toast.error('Cantidad inválida.')
    try {
      const res = await cargarStock({ ...payload, cantidad })
      toast.success(res.message)
      setCargas(c => ({ ...c, [key]: '' }))
      await load()
    } catch (err) { toast.error(err.message) }
  }

  const onAgregarGusto = async (idProd) => {
    const f = gustoForm[idProd] || {}
    if (!f.nombre?.trim()) return toast.error('Poné el nombre del gusto.')
    try {
      const res = await agregarGusto(idProd, f.nombre.trim(), parseInt(f.stock, 10) || 0)
      toast.success(res.message)
      setGustoForm(g => ({ ...g, [idProd]: { nombre: '', stock: '' } }))
      await load()
    } catch (err) { toast.error(err.message) }
  }

  const onAjustar = async (fn, id, delta) => {
    try { await fn(id, delta); await load() }
    catch (err) { toast.error(err.message) }
  }

  return (
    <PanelLayout nav={NAV} brandSub="buffet">
      <ToastContainer toasts={toasts} />

      <div style={styles.header}>
        <h1 style={styles.title}>Stock</h1>
        <p style={styles.sub}>Creá productos y cargá su stock</p>
      </div>

      {/* Nuevo producto */}
      <div className="card" style={{ marginBottom: 28 }}>
        <h2 style={styles.sectionTitle}>Nuevo producto</h2>
        <div style={styles.formRow}>
          <div style={{ flex: '1 1 200px' }}>
            <label style={styles.label}>Nombre</label>
            <input value={np.nombre} onChange={e => setNp({ ...np, nombre: e.target.value })} placeholder="Ej. Empanada" />
          </div>
          <div style={{ width: 120 }}>
            <label style={styles.label}>Precio</label>
            <input type="number" min="0" value={np.precio} onChange={e => setNp({ ...np, precio: e.target.value })} placeholder="0" />
          </div>
          <label style={styles.check}>
            <input type="checkbox" checked={np.tiene_gustos} onChange={e => setNp({ ...np, tiene_gustos: e.target.checked })} />
            Tiene gustos
          </label>
          <button className="btn btn-primary" onClick={onCrear} style={{ alignSelf: 'flex-end' }}>Crear</button>
        </div>
        <p style={styles.hint}>Si tiene gustos, después le agregás los gustos abajo y el stock se carga por gusto.</p>
      </div>

      {loading ? (
        <div style={styles.loading}><span className="spinner" /> Cargando…</div>
      ) : productos.length === 0 ? (
        <div className="empty-state"><div className="icon">▦</div><h3>Sin productos</h3><p>Creá el primero arriba.</p></div>
      ) : (
        <div style={styles.list}>
          {productos.map(p => (
            <div key={p.id_producto} className="card" style={styles.prodCard}>
              <div style={styles.prodHead}>
                <div>
                  <span style={styles.prodNombre}>{p.nombre}</span>
                  <span style={styles.prodPrecio}>${p.precio}</span>
                </div>
                <span style={styles.prodStock}>{p.stock} <span style={styles.u}>en stock</span></span>
              </div>

              {p.tiene_gustos ? (
                <div style={styles.gustos}>
                  {p.gustos.map(g => (
                    <div key={g.id_gusto} style={styles.gustoRow}>
                      <span style={styles.gustoNombre}>{g.nombre}</span>
                      <div style={styles.gustoCtrl}>
                        <button className="btn btn-ghost btn-sm" onClick={() => onAjustar(ajustarGusto, g.id_gusto, -1)}>−</button>
                        <span style={styles.gustoStock}>{g.stock}</span>
                        <button className="btn btn-ghost btn-sm" onClick={() => onAjustar(ajustarGusto, g.id_gusto, 1)}>+</button>
                        <input style={styles.miniInput} type="number" min="1" placeholder="cant."
                          value={cargas[`g${g.id_gusto}`] ?? ''}
                          onChange={e => setCargas(c => ({ ...c, [`g${g.id_gusto}`]: e.target.value }))} />
                        <button className="btn btn-sm" onClick={() => onCargar({ id_gusto: g.id_gusto }, `g${g.id_gusto}`)}>Cargar</button>
                      </div>
                    </div>
                  ))}
                  {/* Agregar gusto */}
                  <div style={styles.addGusto}>
                    <input style={{ flex: 1 }} placeholder="Nuevo gusto (ej. Carne)"
                      value={gustoForm[p.id_producto]?.nombre ?? ''}
                      onChange={e => setGustoForm(g => ({ ...g, [p.id_producto]: { ...g[p.id_producto], nombre: e.target.value } }))} />
                    <input style={styles.miniInput} type="number" min="0" placeholder="stock"
                      value={gustoForm[p.id_producto]?.stock ?? ''}
                      onChange={e => setGustoForm(g => ({ ...g, [p.id_producto]: { ...g[p.id_producto], stock: e.target.value } }))} />
                    <button className="btn btn-sm" onClick={() => onAgregarGusto(p.id_producto)}>+ Gusto</button>
                  </div>
                </div>
              ) : (
                <div style={styles.sinGusto}>
                  <button className="btn btn-ghost btn-sm" onClick={() => onAjustar(ajustarProducto, p.id_producto, -1)}>−</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => onAjustar(ajustarProducto, p.id_producto, 1)}>+</button>
                  <input style={styles.miniInput} type="number" min="1" placeholder="cant."
                    value={cargas[`p${p.id_producto}`] ?? ''}
                    onChange={e => setCargas(c => ({ ...c, [`p${p.id_producto}`]: e.target.value }))} />
                  <button className="btn btn-sm" onClick={() => onCargar({ id_producto: p.id_producto }, `p${p.id_producto}`)}>Cargar</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </PanelLayout>
  )
}

const styles = {
  header: { marginBottom: 24 },
  title: { fontSize: 22, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  sub: { fontSize: 13, color: '#5a5754' },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#f0ede8', marginBottom: 14 },
  formRow: { display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' },
  label: { display: 'block', fontSize: 12, color: '#9a9690', fontFamily: "'DM Mono', monospace", marginBottom: 6 },
  check: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#f0ede8', alignSelf: 'flex-end', paddingBottom: 8 },
  hint: { fontSize: 12, color: '#5a5754', marginTop: 12 },
  loading: { display: 'flex', alignItems: 'center', gap: 10, color: '#5a5754', fontSize: 13, padding: 24 },
  list: { display: 'flex', flexDirection: 'column', gap: 14 },
  prodCard: { display: 'flex', flexDirection: 'column', gap: 12 },
  prodHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  prodNombre: { fontSize: 15, fontWeight: 600, color: '#f0ede8' },
  prodPrecio: { fontSize: 13, color: '#9a9690', marginLeft: 10, fontFamily: "'DM Mono', monospace" },
  prodStock: { fontSize: 18, fontWeight: 600, color: '#e8c547', fontFamily: "'DM Mono', monospace" },
  u: { fontSize: 11, color: '#5a5754', fontWeight: 400 },
  gustos: { display: 'flex', flexDirection: 'column', gap: 8, borderTop: '1px solid #2e2e2e', paddingTop: 12 },
  gustoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  gustoNombre: { fontSize: 13, color: '#f0ede8' },
  gustoCtrl: { display: 'flex', alignItems: 'center', gap: 6 },
  gustoStock: { minWidth: 28, textAlign: 'center', fontFamily: "'DM Mono', monospace", fontSize: 13, color: '#e8c547' },
  miniInput: { width: 64 },
  addGusto: { display: 'flex', gap: 8, alignItems: 'center', marginTop: 4 },
  sinGusto: { display: 'flex', gap: 6, alignItems: 'center', borderTop: '1px solid #2e2e2e', paddingTop: 12 },
}