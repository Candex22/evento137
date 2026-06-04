import { useEffect, useState, useRef } from 'react'
import PanelLayout from '../components/layout/panellayout'
import { getEstado, getLista, generar, tachar, ajustar } from '../api/entradas'
import { useToast, ToastContainer } from '../hooks/usetoast'

const NAV = [
  { to: '/entradas', label: 'Entradas', icon: '▦', end: true },
]

export default function EntradasPage() {
  const [estado, setEstado]   = useState(null)
  const [lista, setLista]     = useState([])
  const [loading, setLoading] = useState(true)
  const [numero, setNumero]   = useState('')
  const [desde, setDesde]     = useState('')
  const [hasta, setHasta]     = useState('')
  const [busy, setBusy]       = useState(false)
  const { toasts, toast }     = useToast()
  const inputRef = useRef(null)

  const loadEstado = async () => {
    try { setEstado(await getEstado()) } catch { /* polling silencioso */ }
  }
  const loadLista = async () => {
    try { setLista(await getLista()) } catch { toast.error('No se pudo cargar la lista.') }
  }

  useEffect(() => {
    (async () => { await Promise.all([loadEstado(), loadLista()]); setLoading(false) })()
    const t = setInterval(loadEstado, 8000)
    return () => clearInterval(t)
  }, [])

  const onGenerar = async () => {
    const d = parseInt(desde, 10), h = parseInt(hasta, 10)
    if (isNaN(d) || isNaN(h) || d < 1 || h < d) return toast.error('Ingresá un rango válido.')
    setBusy(true)
    try {
      const res = await generar(d, h)
      toast.success(res.message)
      setDesde(''); setHasta('')
      await Promise.all([loadEstado(), loadLista()])
    } catch (err) { toast.error(err.message) } finally { setBusy(false) }
  }

  const onTachar = async (n) => {
    const num = parseInt(n, 10)
    if (isNaN(num)) return toast.error('Ingresá un número.')
    try {
      const res = await tachar(num)
      toast.success(res.message)
      setNumero('')
      setLista(l => l.map(e => e.numero === num ? { ...e, ingresada: true } : e))
      loadEstado()
    } catch (err) { toast.error(err.message) }
    inputRef.current?.focus()
  }

  const onAjustar = async (delta) => {
    try {
      const res = await ajustar(delta)
      setEstado(s => ({ ...s, extra: res.extra, total_personas: s.ingresadas + res.extra }))
    } catch (err) { toast.error(err.message) }
  }

  const hayEntradas = estado && estado.total_entradas > 0

  return (
    <PanelLayout nav={NAV} brandSub="entradas">
      <ToastContainer toasts={toasts} />

      {loading ? (
        <div style={styles.loading}><span className="spinner" /> Cargando…</div>
      ) : !hayEntradas ? (
        <div className="card" style={{ maxWidth: 420 }}>
          <h1 style={styles.title}>Cargar entradas</h1>
          <p style={styles.sub}>Definí el rango de números de las entradas a controlar.</p>
          <div style={styles.rango}>
            <div style={styles.field}>
              <label style={styles.label}>Desde</label>
              <input type="number" min="1" value={desde} onChange={e => setDesde(e.target.value)} placeholder="1" />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Hasta</label>
              <input type="number" min="1" value={hasta} onChange={e => setHasta(e.target.value)} placeholder="500" />
            </div>
            <button className="btn btn-primary" onClick={onGenerar} disabled={busy} style={{ alignSelf: 'flex-end' }}>
              {busy ? <span className="spinner" /> : 'Generar'}
            </button>
          </div>
        </div>
      ) : (
        <>
          <div style={styles.stats}>
            <div style={styles.statBig}>
              <div style={styles.statLabel}>Gente en el evento</div>
              <div style={styles.statBigNum}>{estado.total_personas}</div>
            </div>
            <div style={styles.statSmall}>
              <div style={styles.statLabel}>Entradas ingresadas</div>
              <div style={styles.statNum}>{estado.ingresadas} <span style={styles.statOf}>/ {estado.total_entradas}</span></div>
            </div>
            <div style={styles.statSmall}>
              <div style={styles.statLabel}>Ajuste manual</div>
              <div style={styles.manualRow}>
                <button className="btn btn-ghost btn-sm" onClick={() => onAjustar(-1)}>−</button>
                <span style={styles.statNum}>{estado.extra}</span>
                <button className="btn btn-ghost btn-sm" onClick={() => onAjustar(1)}>+</button>
              </div>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 24 }}>
            <label style={styles.label}>Registrar entrada por número</label>
            <div style={styles.tacharRow}>
              <input
                ref={inputRef} type="number" min="1" value={numero} autoFocus
                onChange={e => setNumero(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && onTachar(numero)}
                placeholder="Nº de entrada"
              />
              <button className="btn btn-primary" onClick={() => onTachar(numero)}>Tachar</button>
            </div>
          </div>

          <h2 style={styles.sectionTitle}>Entradas</h2>
          <div style={styles.grid}>
            {lista.map(e => (
              <button
                key={e.numero}
                onClick={() => !e.ingresada && onTachar(e.numero)}
                disabled={e.ingresada}
                style={{ ...styles.chip, ...(e.ingresada ? styles.chipDone : {}) }}
                title={e.ingresada ? 'Ya ingresó' : 'Tachar'}
              >
                {e.numero}
              </button>
            ))}
          </div>
        </>
      )}
    </PanelLayout>
  )
}

const styles = {
  loading:  { display: 'flex', alignItems: 'center', gap: 10, color: '#5a5754', fontSize: 13, padding: 24 },
  title:    { fontSize: 20, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  sub:      { fontSize: 13, color: '#5a5754', marginBottom: 16 },
  rango:    { display: 'flex', gap: 12, alignItems: 'flex-end' },
  field:    { display: 'flex', flexDirection: 'column', gap: 6, flex: 1 },
  label:    { fontSize: 12, color: '#9a9690', fontFamily: "'DM Mono', monospace" },
  stats:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 24 },
  statBig:  { background: '#1a160c', border: '1px solid #3d2e10', borderRadius: 12, padding: '20px 22px' },
  statSmall:{ background: '#141414', border: '1px solid #2e2e2e', borderRadius: 12, padding: '20px 22px' },
  statLabel:{ fontSize: 12, color: '#9a9690', fontFamily: "'DM Mono', monospace", marginBottom: 8 },
  statBigNum:{ fontSize: 44, fontWeight: 700, color: '#e89547', lineHeight: 1, fontFamily: "'DM Mono', monospace" },
  statNum:  { fontSize: 26, fontWeight: 600, color: '#f0ede8', fontFamily: "'DM Mono', monospace" },
  statOf:   { fontSize: 14, color: '#5a5754' },
  manualRow:{ display: 'flex', alignItems: 'center', gap: 12 },
  tacharRow:{ display: 'flex', gap: 10, marginTop: 8 },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#f0ede8', marginBottom: 12 },
  grid:     { display: 'flex', flexWrap: 'wrap', gap: 6, maxHeight: 360, overflowY: 'auto', padding: 4 },
  chip: {
    minWidth: 44, padding: '6px 8px', borderRadius: 6, cursor: 'pointer',
    background: '#181818', border: '1px solid #2e2e2e', color: '#f0ede8',
    fontFamily: "'DM Mono', monospace", fontSize: 12,
  },
  chipDone: {
    background: '#0e2119', borderColor: '#1a3d2b', color: '#4caf7d',
    textDecoration: 'line-through', cursor: 'default', opacity: .7,
  },
}