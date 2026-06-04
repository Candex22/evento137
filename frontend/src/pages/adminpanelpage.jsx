import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import AdminLayout from '../components/layout/AdminLayout'
import { countPendientes } from '../api/admin'
import { useAuth } from '../context/AuthContext'

export default function AdminPanelPage() {
  const { user } = useAuth()
  const [pendingCount, setPendingCount] = useState(0)

  useEffect(() => {
    countPendientes()
      .then(d => setPendingCount(d.total))
      .catch(() => {})
  }, [])

  const cards = [
    {
      to: '/admin/pending',
      icon: '◷',
      title: 'Usuarios pendientes',
      desc: 'Aprobar o rechazar solicitudes de registro.',
      badge: pendingCount || null,
      color: '#e89547',
    },
    {
      to: '/admin/users',
      icon: '◈',
      title: 'Gestión de usuarios',
      desc: 'Ver, activar o desactivar usuarios del sistema.',
      color: '#5b9bd5',
    },
    {
      to: '/admin/roles',
      icon: '◉',
      title: 'Roles de administrador',
      desc: 'Otorgar o revocar permisos de administrador.',
      color: '#4caf7d',
    },
  ]

  return (
    <AdminLayout pendingCount={pendingCount}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Panel de administración</h1>
          <p style={styles.sub}>Bienvenido, <strong style={{ color: '#f0ede8' }}>{user?.name_user}</strong></p>
        </div>
      </div>

      <div style={styles.grid}>
        {cards.map(card => (
          <Link key={card.to} to={card.to} style={styles.card}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <span style={{ ...styles.cardIcon, color: card.color }}>{card.icon}</span>
              {card.badge && (
                <span style={{ ...styles.badge, background: card.color, color: '#111' }}>
                  {card.badge}
                </span>
              )}
            </div>
            <h3 style={styles.cardTitle}>{card.title}</h3>
            <p style={styles.cardDesc}>{card.desc}</p>
            <span style={{ ...styles.cardArrow, color: card.color }}>→</span>
          </Link>
        ))}
      </div>
    </AdminLayout>
  )
}

const styles = {
  header: { marginBottom: 32 },
  title: { fontSize: 24, fontWeight: 600, color: '#f0ede8', marginBottom: 4 },
  sub:   { fontSize: 14, color: '#5a5754' },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
    gap: 16,
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    background: '#181818',
    border: '1px solid #2e2e2e',
    borderRadius: 10,
    padding: 24,
    textDecoration: 'none',
    transition: 'border-color .15s, background .15s',
    cursor: 'pointer',
  },
  cardIcon: { fontSize: 24 },
  cardTitle: { fontSize: 15, fontWeight: 600, color: '#f0ede8' },
  cardDesc:  { fontSize: 13, color: '#9a9690', lineHeight: 1.5, flex: 1 },
  cardArrow: { fontSize: 16, fontWeight: 600, alignSelf: 'flex-end' },
  badge: {
    fontSize: 11,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 20,
    fontFamily: "'DM Mono', monospace",
  },
}