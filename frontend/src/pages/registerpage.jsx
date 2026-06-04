import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { register as apiRegister } from '../api/auth'

export default function RegisterPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name_user: '', nombre: '', apellido: '',
    correo_electronico: '', contrasena: '', confirmar: '',
  })
  const [error, setError]     = useState('')
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleChange = e =>
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))

  const handleSubmit = async e => {
    e.preventDefault()
    setError('')

    if (form.contrasena !== form.confirmar) {
      return setError('Las contraseñas no coinciden.')
    }
    if (form.contrasena.length < 6) {
      return setError('La contraseña debe tener al menos 6 caracteres.')
    }

    setLoading(true)
    try {
      const { name_user, nombre, apellido, correo_electronico, contrasena } = form
      await apiRegister({ name_user, nombre, apellido, correo_electronico, contrasena })
      setSuccess(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div style={styles.page}>
        <div style={styles.grid} aria-hidden="true" />
        <div style={{ ...styles.box, textAlign: 'center', padding: '48px 32px' }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>✓</div>
          <h2 style={{ color: '#4caf7d', fontWeight: 600, marginBottom: 8 }}>Registro exitoso</h2>
          <p style={{ color: '#9a9690', fontSize: 14, marginBottom: 24 }}>
            Tu cuenta está pendiente de aprobación por un administrador.<br />
            Recibirás acceso una vez que sea aprobada.
          </p>
          <button
            className="btn btn-ghost"
            onClick={() => navigate('/login')}
          >
            Volver al inicio de sesión
          </button>
        </div>
      </div>
    )
  }

  return (
    <div style={styles.page}>
      <div style={styles.grid} aria-hidden="true" />
      <div style={styles.box}>
        <div style={styles.logo}>
          <span style={{ fontSize: 22, color: '#e89547' }}>⬡</span>
          <span style={styles.logoText}>EVENTO</span>
        </div>

        <h1 style={styles.heading}>Crear cuenta</h1>
        <p style={styles.sub}>Tu registro quedará pendiente de aprobación</p>

        {error && <div style={styles.errorBox}>{error}</div>}

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Nombre</label>
              <input name="nombre" value={form.nombre} onChange={handleChange} placeholder="Juan" required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Apellido</label>
              <input name="apellido" value={form.apellido} onChange={handleChange} placeholder="Pérez" required />
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Nombre de usuario</label>
            <input name="name_user" value={form.name_user} onChange={handleChange} placeholder="juanp" required />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Correo electrónico</label>
            <input type="email" name="correo_electronico" value={form.correo_electronico} onChange={handleChange} placeholder="juan@ejemplo.com" required />
          </div>

          <div style={styles.row}>
            <div style={styles.field}>
              <label style={styles.label}>Contraseña</label>
              <input type="password" name="contrasena" value={form.contrasena} onChange={handleChange} placeholder="••••••••" required />
            </div>
            <div style={styles.field}>
              <label style={styles.label}>Confirmar</label>
              <input type="password" name="confirmar" value={form.confirmar} onChange={handleChange} placeholder="••••••••" required />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
          >
            {loading ? <><span className="spinner" /> Registrando…</> : 'Crear cuenta'}
          </button>
        </form>

        <p style={styles.footer}>
          ¿Ya tenés cuenta?{' '}
          <Link to="/login">Iniciar sesión</Link>
        </p>
      </div>
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
    maxWidth: 480,
    background: '#181818',
    border: '1px solid #2e2e2e',
    borderRadius: 12,
    padding: '36px 32px',
    zIndex: 1,
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
  row: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 12,
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