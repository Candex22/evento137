import { useEffect, useState, useRef } from 'react'
import PanelLayout from '../components/layout/PanelLayout'
import { getProductos, crearIngreso } from '../api/buffet'
import { useToast, ToastContainer } from '../hooks/useToast'

const NAV = [
  { to: '/buffet', label: 'Stock', icon: '▦', end: true },
]

export default function BuffetStockPage() {
  const [productos, setProductos] = useState([])
  const [loading, setLoading]     = useState(true)
  const [nombre, setNombre]       = useState('')
  const [cantidad, setCantidad]   = useState('')
  const [saving, setSaving]       = useState(false)
  const [showSug, setShowSug]     = useState(false)
  const { toasts, toast }         = useToast()
  const boxRef = useRef(null)

  const load = async () => {
    try {
      setProductos(await getProductos())
    } catch {
      toast.error('No se pudieron cargar los datos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Cierra el desplegable al hacer click afuera
  useEffect(() => {
    const onClick = (e) => {
      if (boxRef.current && !boxRef.current.contains(e.target)) setShowSug(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  // Coincidencias segun lo que se escribe (sin importar mayusculas)
  const q = nombre.trim().toLowerCase()
  const sugerencias = q
    ? productos.filter(p => p.nombre.toLowerCase().includes(q)).slice(0, 6)
    : []

  const elegir = (p) => {
    setNombre(p.nombre)
    setShowSug(false)
  }

  const onSubmit = async (e) => {
    e.preventDefault()
    const cant = parseInt(cantidad, 10)
    if (!nombre.trim()) return toast.error('Ingresá el nombre del producto.')
    if (isNaN(cant) || cant <= 0) return toast.error('La cantidad debe ser mayor a 0.')

    setSaving(true)
    try {
      const res = await crearIngreso(nombre.trim(), cant)
      toast.success(res.message)
      setNombre('')
      setCantidad('')
      await load()
    } catch (err) {
      toast.error(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <PanelLayout nav={NAV} brandSub="buffet">
      <ToastContainer toasts={toasts} />

      <div style={styles.header}>
        <h1 style={styles.title}>Stock</h1>
        <p style={styles.sub}>Cargá ingresos de productos al inventario</p>
      </div>

      {/* Formulario de carga */}
      <div className="card" style={{ marginBottom: 28 }}>
        <form onSubmit={onSubmit} style={styles.form}>
          <div style={styles.fieldGrow} ref={boxRef}>
            <label style={styles.label}>Producto</label>
            <input
              type="text"
              value={nombre}
              onChange={e => { setNombre(e.target.value); setShowSug(true) }}
              onFocus={() => setShowSug(true)}
              placeholder="Ej. Hamburguesa"
              disabled={saving}
              autoComplete="off"
            />
            {showSug && sugerencias.length > 0 && (
              <ul style={styles.sugList}>
                {sugerencias.map(p => (
                  <li
                    key={p.id_producto}
                    onClick={() => elegir(p)}
                    style={styles.sugItem}
                    onMouseDown={e => e.preventDefault()}
                  >
                    <span>{p.nombre}</span>
                    <span style={styles.sugStock}>{p.stock}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div style={styles.fieldQty}>
            <label style={styles.label}>Cantidad</label>
            <input
              type="number"
              min="1"
              value={cantidad}
              onChange={e => setCantidad(e.target.value)}
              placeholder="0"
              disabled={saving}
            />
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving} style={{ alignSelf: 'flex-end' }}>
            {saving ? <span className="spinner" /> : 'Cargar ingreso'}
          </button>
        </form>
        <p style={styles.hint}>Si el producto ya existe, se suma a su stock actual.</p>
      </div>

      {loading ? (
        <div style={styles.loading}><span className="spinner" /> Cargando…</div>
      ) : productos.length === 0 ? (
        <div className="empty-state"><div className="icon">▦</div><h3>Sin productos</h3><p>Cargá tu primer ingreso arriba.</p></div>
      ) : (
        <section>
          <h2 style={styles.sectionTitle}>Stock actual</h2>
          <div className="card" style={{ padding: 0 }}>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Producto</th><th style={{ textAlign: 'right' }}>Stock</th></tr></thead>
                <tbody>
                  {productos.map(p => (
                    <tr key={p.id_producto}>
                      <td><strong>{p.nombre}</strong></td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={styles.stockNum}>{p.stock}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}
    </PanelLayout>
  )
}

const styles = {
  header:    { marginBottom: 24 },
  title:     { fontSize: 22, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  sub:       { fontSize: 13, color: '#5a5754' },
  form:      { display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end' },
  fieldGrow: { display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 220px', position: 'relative' },
  fieldQty:  { display: 'flex', flexDirection: 'column', gap: 6, width: 120 },
  label:     { fontSize: 12, color: '#9a9690', fontFamily: "'DM Mono', monospace" },
  hint:      { fontSize: 12, color: '#5a5754', marginTop: 12 },
  loading:   { display: 'flex', alignItems: 'center', gap: 10, color: '#5a5754', fontSize: 13, padding: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#f0ede8', marginBottom: 12 },
  stockNum:  { fontFamily: "'DM Mono', monospace", fontSize: 15, fontWeight: 600, color: '#e89547' },
  sugList: {
    position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 20,
    marginTop: 4, padding: 4, listStyle: 'none',
    background: '#181818', border: '1px solid #2e2e2e', borderRadius: 8,
    maxHeight: 220, overflowY: 'auto',
    boxShadow: '0 8px 24px rgba(0,0,0,.4)',
  },
  sugItem: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '8px 10px', borderRadius: 6, cursor: 'pointer', fontSize: 13, color: '#f0ede8',
  },
  sugStock: { fontFamily: "'DM Mono', monospace", fontSize: 12, color: '#e89547' },
}