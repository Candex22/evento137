import { useEffect, useState } from 'react'
import AdminLayout from '../components/layout/adminlayout'
import {
  getProductosAdmin, actualizarPrecio,
  getCombos, crearCombo, actualizarCombo, eliminarCombo, countPendientes,
} from '../api/admin'
import { useToast, ToastContainer } from '../hooks/usetoast'

const comboVacio = { nombre: '', precio: '', activo: true, items: {} } // items: { [id_producto]: cantidad }

export default function AdminCatalogoPage() {
  const [productos, setProductos] = useState([])
  const [combos, setCombos] = useState([])
  const [precios, setPrecios] = useState({})   // edición local de precios
  const [pendingCount, setPendingCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState(comboVacio)
  const [editId, setEditId] = useState(null)
  const { toasts, toast } = useToast()

  const load = async () => {
    try {
      const [prods, cbs, count] = await Promise.all([getProductosAdmin(), getCombos(), countPendientes()])
      setProductos(prods)
      setCombos(cbs)
      setPrecios(Object.fromEntries(prods.map(p => [p.id_producto, p.precio])))
      setPendingCount(count.total)
    } catch { toast.error('No se pudo cargar el catálogo.') }
    finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const guardarPrecio = async (id) => {
    try { const res = await actualizarPrecio(id, Number(precios[id]) || 0); toast.success(res.message); await load() }
    catch (err) { toast.error(err.message) }
  }

  const setItemCant = (idProd, val) => {
    const n = parseInt(val, 10)
    setForm(f => {
      const items = { ...f.items }
      if (isNaN(n) || n <= 0) delete items[idProd]; else items[idProd] = n
      return { ...f, items }
    })
  }

  const editarCombo = (c) => {
    setEditId(c.id_combo)
    setForm({
      nombre: c.nombre, precio: c.precio, activo: c.activo,
      items: Object.fromEntries(c.componentes.map(x => [x.id_producto, x.cantidad])),
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }
  const cancelar = () => { setEditId(null); setForm(comboVacio) }

  const guardarCombo = async () => {
    const items = Object.entries(form.items).map(([id_producto, cantidad]) => ({ id_producto, cantidad }))
    if (!form.nombre.trim()) return toast.error('Poné un nombre al combo.')
    if (items.length === 0) return toast.error('Elegí al menos un producto.')
    const payload = { nombre: form.nombre.trim(), precio: Number(form.precio) || 0, activo: form.activo, items }
    try {
      const res = editId ? await actualizarCombo(editId, payload) : await crearCombo(payload)
      toast.success(res.message)
      cancelar(); await load()
    } catch (err) { toast.error(err.message) }
  }

  const borrar = async (id) => {
    try { const res = await eliminarCombo(id); toast.success(res.message); if (editId === id) cancelar(); await load() }
    catch (err) { toast.error(err.message) }
  }

  return (
    <AdminLayout pendingCount={pendingCount}>
      <ToastContainer toasts={toasts} />
      <div style={{ marginBottom: 28 }}>
        <h1 style={styles.title}>Catálogo</h1>
        <p style={styles.sub}>Precios de productos y combos</p>
      </div>

      {loading ? <div style={styles.loading}><span className="spinner" /> Cargando…</div> : (
        <>
          {/* PRECIOS */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={styles.sectionTitle}>Precios</h2>
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Producto</th><th>Stock</th><th>Precio</th><th></th></tr></thead>
                  <tbody>
                    {productos.map(p => (
                      <tr key={p.id_producto}>
                        <td><strong>{p.nombre}</strong></td>
                        <td><span style={styles.mono}>{p.stock}</span></td>
                        <td>
                          <input type="number" min="0" style={{ width: 100 }}
                            value={precios[p.id_producto] ?? ''}
                            onChange={e => setPrecios(pr => ({ ...pr, [p.id_producto]: e.target.value }))} />
                        </td>
                        <td><button className="btn btn-sm" onClick={() => guardarPrecio(p.id_producto)}>Guardar</button></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* ARMAR / EDITAR COMBO */}
          <section style={{ marginBottom: 36 }}>
            <h2 style={styles.sectionTitle}>{editId ? 'Editar combo' : 'Nuevo combo'}</h2>
            <div className="card">
              <div style={styles.comboForm}>
                <div style={{ flex: '1 1 200px' }}>
                  <label style={styles.label}>Nombre</label>
                  <input value={form.nombre} onChange={e => setForm({ ...form, nombre: e.target.value })} placeholder="Ej. Combo clásico" />
                </div>
                <div style={{ width: 120 }}>
                  <label style={styles.label}>Precio</label>
                  <input type="number" min="0" value={form.precio} onChange={e => setForm({ ...form, precio: e.target.value })} placeholder="0" />
                </div>
                {editId && (
                  <label style={styles.check}>
                    <input type="checkbox" checked={form.activo} onChange={e => setForm({ ...form, activo: e.target.checked })} /> Activo
                  </label>
                )}
              </div>

              <label style={{ ...styles.label, marginTop: 16 }}>Productos del combo (cantidad por combo)</label>
              <div style={styles.prodGrid}>
                {productos.map(p => (
                  <div key={p.id_producto} style={{ ...styles.prodPick, ...(form.items[p.id_producto] ? styles.prodPickOn : {}) }}>
                    <span style={styles.prodPickName}>{p.nombre}{p.tiene_gustos ? ' ◆' : ''}</span>
                    <input type="number" min="0" style={{ width: 56 }} placeholder="0"
                      value={form.items[p.id_producto] ?? ''} onChange={e => setItemCant(p.id_producto, e.target.value)} />
                  </div>
                ))}
              </div>
              <p style={styles.hint}>◆ = tiene gustos; el mozo los elige al pedir el combo.</p>

              <div style={styles.formBtns}>
                {editId && <button className="btn btn-ghost" onClick={cancelar}>Cancelar</button>}
                <button className="btn btn-primary" onClick={guardarCombo}>{editId ? 'Guardar cambios' : 'Crear combo'}</button>
              </div>
            </div>
          </section>

          {/* LISTA DE COMBOS */}
          <section>
            <h2 style={styles.sectionTitle}>Combos</h2>
            {combos.length === 0 ? <p style={styles.sub}>Todavía no hay combos.</p> : (
              <div style={styles.comboList}>
                {combos.map(c => (
                  <div key={c.id_combo} className="card" style={styles.comboCard}>
                    <div style={styles.comboTop}>
                      <div>
                        <span style={styles.comboNombre}>{c.nombre}</span>
                        {!c.activo && <span className="badge badge-inactive" style={{ marginLeft: 8 }}>inactivo</span>}
                      </div>
                      <span style={styles.comboPrecio}>${c.precio}</span>
                    </div>
                    <div style={styles.comboComps}>
                      {c.componentes.map((x, i) => (
                        <span key={i} style={styles.comboChip}>{x.cantidad}× {x.producto}{x.tiene_gustos ? ' ◆' : ''}</span>
                      ))}
                    </div>
                    <div style={styles.comboBtns}>
                      <button className="btn btn-ghost btn-sm" onClick={() => editarCombo(c)}>Editar</button>
                      <button className="btn btn-ghost btn-sm" style={{ color: '#d57b7b' }} onClick={() => borrar(c.id_combo)}>Eliminar</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </AdminLayout>
  )
}

const styles = {
  title: { fontSize: 22, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  sub: { fontSize: 13, color: '#5a5754' },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#f0ede8', marginBottom: 12 },
  loading: { display: 'flex', alignItems: 'center', gap: 10, color: '#5a5754', fontSize: 13, padding: 24 },
  mono: { fontFamily: "'DM Mono', monospace", color: '#9a9690' },
  label: { display: 'block', fontSize: 12, color: '#9a9690', fontFamily: "'DM Mono', monospace", marginBottom: 6 },
  hint: { fontSize: 11, color: '#5a5754', marginTop: 8 },
  comboForm: { display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' },
  check: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#f0ede8', paddingBottom: 8 },
  prodGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 8, marginTop: 8 },
  prodPick: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 10px', background: '#141414', border: '1px solid #2e2e2e', borderRadius: 8 },
  prodPickOn: { borderColor: '#e8c547', background: '#1a160c' },
  prodPickName: { fontSize: 13, color: '#f0ede8' },
  formBtns: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  comboList: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 },
  comboCard: { display: 'flex', flexDirection: 'column', gap: 10 },
  comboTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  comboNombre: { fontSize: 15, fontWeight: 600, color: '#f0ede8' },
  comboPrecio: { fontSize: 18, fontWeight: 600, color: '#e8c547', fontFamily: "'DM Mono', monospace" },
  comboComps: { display: 'flex', flexWrap: 'wrap', gap: 6 },
  comboChip: { fontSize: 12, color: '#9a9690', background: '#181818', border: '1px solid #2e2e2e', borderRadius: 6, padding: '3px 8px' },
  comboBtns: { display: 'flex', gap: 8, borderTop: '1px solid #2e2e2e', paddingTop: 10 },
}