import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const { pathname } = useLocation()
  const isActive = (path) => pathname === path

  return (
    <header style={{ background: '#08080c', borderBottom: '1px solid #151520' }}>
      <div className="max-w-6xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div style={{ background: '#e10600', borderRadius: 4 }} className="w-7 h-7 flex items-center justify-center">
            <span className="text-white font-black text-xs tracking-tighter">F1</span>
          </div>
          <span className="font-semibold text-white text-sm tracking-wide">Live Tracker</span>
        </Link>

        <nav className="flex items-center gap-1">
          {[
            { to: '/', label: 'Calendario' },
            { to: '/live', label: '● Live' },
            { to: '/timing', label: 'Timing' },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all"
              style={{
                background: isActive(to) ? '#1a1a24' : 'transparent',
                color: isActive(to) ? '#fff' : '#666',
                ...(to === '/live' && isActive(to) ? { color: '#e10600' } : {}),
              }}
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  )
}
