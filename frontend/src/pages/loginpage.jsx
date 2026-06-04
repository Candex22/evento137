import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { login as apiLogin } from '../api/auth'
import { useAuth } from '../context/authcontext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [form, setForm]     = useState({ correo_electronico: '', contrasena: '' })
  const [error, setError]   = useState('')
  const [loading, setLoading] = useState(false)

  const handleChange = e =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const data = await apiLogin(form.correo_electronico, form.contrasena)
      login(data.usuario)
      const rol = data.usuario.rol
      const rutas = { administrador: '/admin', buffet: '/buffet', mozo: '/mozo', cajero: '/cajero', entradas: '/entradas' }      
      navigate(rutas[rol] || '/dashboard', { replace: true })
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.page}>
      <div style={styles.box}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>⬡</span>
          <span style={styles.logoText}>EVENTO</span>
        </div>

        <h1 style={styles.heading}>Iniciar sesión</h1>
        <p style={styles.sub}>Sistema de gestión de herramientas</p>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Correo electrónico</label>
            <input
              type="email"
              name="correo_electronico"
              value={form.correo_electronico}
              onChange={handleChange}
              placeholder="usuario@ejemplo.com"
              required
              autoFocus
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Contraseña</label>
            <input
              type="password"
              name="contrasena"
              value={form.contrasena}
              onChange={handleChange}
              placeholder="••••••••"
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 8 }}
          >
            {loading ? <><span className="spinner" /> Verificando…</> : 'Ingresar'}
          </button>
        </form>

        <p style={styles.footer}>
          ¿No tenés cuenta?{' '}
          <Link to="/register">Registrarse</Link>
        </p>
      </div>

      <div style={styles.grid} aria-hidden="true" />
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#0f0f0f',
    padding: 24,
    position: 'relative',
    overflow: 'hidden',
  },
  grid: {
    position: 'absolute', inset: 0,
    backgroundImage: 'linear-gradient(rgba(255,255,255,.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.025) 1px, transparent 1px)',
    backgroundSize: '48px 48px',
    pointerEvents: 'none',
  },
  box: {
    position: 'relative',
    width: '100%',
    maxWidth: 400,
    background: '#181818',
    border: '1px solid #2e2e2e',
    borderRadius: 12,
    padding: '36px 32px',
    zIndex: 1,
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    marginBottom: 28,
  },
  logoIcon: {
    fontSize: 22,
    color: '#e89547',
    lineHeight: 1,
  },
  logoText: {
    fontFamily: "'DM Mono', monospace",
    fontSize: 15,
    fontWeight: 500,
    letterSpacing: '.18em',
    color: '#f0ede8',
  },
  heading: {
    fontSize: 22,
    fontWeight: 600,
    color: '#f0ede8',
    marginBottom: 6,
  },
  sub: {
    fontSize: 13,
    color: '#5a5754',
    marginBottom: 28,
  },
  errorBox: {
    background: '#1e1010',
    border: '1px solid #3a1a1a',
    color: '#e05252',
    borderRadius: 6,
    padding: '10px 14px',
    fontSize: 13,
    marginBottom: 18,
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  label: {
    fontSize: 12,
    fontWeight: 500,
    color: '#9a9690',
    textTransform: 'uppercase',
    letterSpacing: '.06em',
    fontFamily: "'DM Mono', monospace",
  },
  footer: {
    marginTop: 24,
    fontSize: 13,
    color: '#5a5754',
    textAlign: 'center',
  },
}