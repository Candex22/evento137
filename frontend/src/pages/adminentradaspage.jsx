import { useEffect, useState } from 'react'
import AdminLayout from '../components/layout/AdminLayout'
import { getEstado, getLista } from '../api/entradas'
import { countPendientes } from '../api/admin'
import { useToast, ToastContainer } from '../hooks/useToast'

function fmtHora(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
}

export default function AdminEntradasPage() {
  const [estado, setEstado] = useState(null)
  const [ingresadas, setIngresadas] = useState([])
  const [loading, setLoading] = useState(true)
  const [pendingCount, setPendingCount] = useState(0)
  const { toasts, toast } = useToast()

  const load = async (primera = false) => {
    try {
      const [est, lista] = await Promise.all([getEstado(), getLista()])
      setEstado(est)
      setIngresadas(lista.filter(e => e.ingresada).sort((a, b) =>
        new Date(b.ingresada_at) - new Date(a.ingresada_at)))
      if (primera) {
        const c = await countPendientes()
        setPendingCount(c.total)
      }
    } catch {
      if (primera) toast.error('No se pudieron cargar los datos.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(true)
    const t = setInterval(() => load(false), 8000)  // tiempo real
    return () => clearInterval(t)
  }, [])

  return (
    <AdminLayout pendingCount={pendingCount}>
      <ToastContainer toasts={toasts} />

      <div style={{ marginBottom: 24 }}>
        <h1 style={styles.title}>Entradas</h1>
        <p style={styles.sub}>Gente en el evento en tiempo real</p>
      </div>

      {loading || !estado ? (
        <div style={styles.loading}><span className="spinner" /> Cargando…</div>
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
              <div style={styles.statNum}>{estado.extra}</div>
            </div>
            <div style={styles.statSmall}>
              <div style={styles.statLabel}>Disponibles</div>
              <div style={styles.statNum}>{estado.disponibles}</div>
            </div>
          </div>

          <h2 style={styles.sectionTitle}>Entradas que ingresaron</h2>
          {ingresadas.length === 0 ? (
            <p style={styles.sub}>Todavía no ingresó ninguna.</p>
          ) : (
            <div className="card" style={{ padding: 0 }}>
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Nº de entrada</th><th>Hora de ingreso</th></tr></thead>
                  <tbody>
                    {ingresadas.map(e => (
                      <tr key={e.numero}>
                        <td><span style={styles.mono}>#{e.numero}</span></td>
                        <td><span style={styles.fecha}>{fmtHora(e.ingresada_at)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </AdminLayout>
  )
}

const styles = {
  title:    { fontSize: 22, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  sub:      { fontSize: 13, color: '#5a5754' },
  loading:  { display: 'flex', alignItems: 'center', gap: 10, color: '#5a5754', fontSize: 13, padding: 24 },
  stats:    { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 16, marginBottom: 28 },
  statBig:  { background: '#1a160c', border: '1px solid #3d2e10', borderRadius: 12, padding: '20px 22px' },
  statSmall:{ background: '#141414', border: '1px solid #2e2e2e', borderRadius: 12, padding: '20px 22px' },
  statLabel:{ fontSize: 12, color: '#9a9690', fontFamily: "'DM Mono', monospace", marginBottom: 8 },
  statBigNum:{ fontSize: 44, fontWeight: 700, color: '#e89547', lineHeight: 1, fontFamily: "'DM Mono', monospace" },
  statNum:  { fontSize: 26, fontWeight: 600, color: '#f0ede8', fontFamily: "'DM Mono', monospace" },
  statOf:   { fontSize: 14, color: '#5a5754' },
  sectionTitle: { fontSize: 14, fontWeight: 600, color: '#f0ede8', marginBottom: 12 },
  mono:     { fontFamily: "'DM Mono', monospace", fontSize: 14, color: '#e89547' },
  fecha:    { fontSize: 12, color: '#9a9690' },
}