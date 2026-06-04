import { useState, useEffect } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'

export default function PanelLayout({ children, nav = [], brandSub = '' }) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const handleNavClick = () => {
    if (isMobile) setOpen(false)
  }

  const handleLogout = async () => {
    await logout()
    navigate('/login', { replace: true })
  }

  return (
    <div style={styles.shell}>
      <aside style={{
        ...styles.sidebar,
        ...(isMobile ? styles.sidebarMobile : {}),
        ...(isMobile && open ? styles.sidebarMobileOpen : {}),
      }}>
        <div style={styles.brand}>
          <span style={styles.brandIcon}>⬡</span>
          <span style={styles.brandText}>EVENTO</span>
          {brandSub && <span style={styles.brandSub}>{brandSub}</span>}
        </div>

        <nav style={styles.nav}>
          {nav.map(({ to, label, icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              onClick={handleNavClick}
              style={({ isActive }) => ({
                ...styles.navLink,
                ...(isActive ? styles.navLinkActive : {}),
              })}
            >
              <span style={styles.navIcon}>{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        <div style={styles.sidebarFooter}>
          <div style={styles.userInfo}>
            <span style={styles.userAvatar}>
              {user?.name_user?.[0]?.toUpperCase() ?? '?'}
            </span>
            <div>
              <div style={styles.userName}>{user?.name_user}</div>
              <div style={styles.userRole}>{user?.rol}</div>
            </div>
          </div>
          <button
            className="btn btn-ghost btn-sm"
            onClick={handleLogout}
            style={{ width: '100%', justifyContent: 'center', marginTop: 12 }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      {isMobile && open && (
        <div style={styles.overlay} onClick={() => setOpen(false)} aria-hidden="true" />
      )}

      <div style={styles.main}>
        {isMobile && (
          <header style={styles.header}>
            <button style={styles.menuBtn} onClick={() => setOpen(o => !o)} aria-label="Menú">☰</button>
            <div style={styles.headerBrand}>
              <span style={{ color: '#e8c547' }}>⬡</span>
              <span style={styles.headerBrandText}>EVENTO</span>
              {brandSub && <span style={styles.headerBrandSub}>{brandSub}</span>}
            </div>
          </header>
        )}
        <main style={{ ...styles.content, ...(isMobile ? styles.contentMobile : {}) }}>
          {children}
        </main>
      </div>
    </div>
  )
}

const styles = {
  shell:    { display: 'flex', minHeight: '100vh', background: '#0f0f0f' },
  sidebar:  {
    width: 220, flexShrink: 0, background: '#111',
    borderRight: '1px solid #2e2e2e', display: 'flex',
    flexDirection: 'column', position: 'sticky', top: 0,
    height: '100vh', overflowY: 'auto',
  },
  sidebarMobile: {
    position: 'fixed', top: 0, left: 0, height: '100vh',
    zIndex: 20, transform: 'translateX(-100%)',
    transition: 'transform .25s ease', width: 240,
  },
  sidebarMobileOpen: {
    transform: 'translateX(0)',
  },
  brand:    { display: 'flex', alignItems: 'center', gap: 8, padding: '22px 20px 16px', borderBottom: '1px solid #2e2e2e' },
  brandIcon:{ fontSize: 18, color: '#e8c547' },
  brandText:{ fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 500, letterSpacing: '.16em', color: '#f0ede8' },
  brandSub: { fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#5a5754', letterSpacing: '.1em', marginLeft: 2 },
  nav:      { flex: 1, display: 'flex', flexDirection: 'column', gap: 2, padding: '16px 10px' },
  navLink:  { display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 6, fontSize: 13, color: '#9a9690', textDecoration: 'none', transition: 'background .12s, color .12s' },
  navLinkActive: { background: '#1e1a0e', color: '#e8c547' },
  navIcon:  { fontSize: 14, width: 16, textAlign: 'center', flexShrink: 0 },
  sidebarFooter: { padding: '16px 16px 20px', borderTop: '1px solid #2e2e2e' },
  userInfo: { display: 'flex', alignItems: 'center', gap: 10 },
  userAvatar: { width: 32, height: 32, background: '#2a1f0a', border: '1px solid #3d2e10', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#e8c547', flexShrink: 0 },
  userName: { fontSize: 13, color: '#f0ede8', fontWeight: 500 },
  userRole: { fontSize: 11, color: '#5a5754', fontFamily: "'DM Mono', monospace" },
  overlay:  { position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', zIndex: 10 },
  main:     { flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 },
  header:   {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '12px 16px', borderBottom: '1px solid #2e2e2e',
    background: '#111', position: 'sticky', top: 0, zIndex: 5,
  },
  headerBrand: { display: 'flex', alignItems: 'center', gap: 6 },
  headerBrandText: { fontFamily: "'DM Mono', monospace", fontSize: 13, fontWeight: 500, letterSpacing: '.16em', color: '#f0ede8' },
  headerBrandSub: { fontFamily: "'DM Mono', monospace", fontSize: 10, color: '#5a5754', letterSpacing: '.1em' },
  menuBtn:  { background: 'none', border: 'none', color: '#9a9690', fontSize: 20, cursor: 'pointer', padding: '4px 6px', lineHeight: 1 },
  content:  { flex: 1, padding: '32px 36px', maxWidth: 1100 },
  contentMobile: { padding: '20px 16px', maxWidth: '100%' },
}
