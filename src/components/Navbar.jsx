import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const { pathname } = useLocation()

  return (
    <nav className="bg-zinc-900 border-b border-zinc-800 px-4 py-3 flex items-center gap-6">
      <Link to="/" className="flex items-center gap-2 font-bold text-white text-lg">
        <span className="text-red-500">F1</span>
        <span className="text-zinc-300 text-sm font-normal">Live Tracker</span>
      </Link>
      <div className="flex gap-4 ml-auto text-sm">
        <Link
          to="/"
          className={`px-3 py-1 rounded transition-colors ${pathname === '/' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          Calendario
        </Link>
        <Link
          to="/live"
          className={`px-3 py-1 rounded transition-colors ${pathname === '/live' ? 'bg-red-600 text-white' : 'text-zinc-400 hover:text-white'}`}
        >
          Live
        </Link>
      </div>
    </nav>
  )
}
