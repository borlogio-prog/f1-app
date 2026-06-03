import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { openf1 } from '../services/openf1'
import { usePolling } from '../hooks/usePolling'

const SVG_W = 900
const SVG_H = 560
const PAD = 40

function computeNorm(points) {
  const xs = points.map(p => p.x)
  const ys = points.map(p => p.y)
  const minX = Math.min(...xs), maxX = Math.max(...xs)
  const minY = Math.min(...ys), maxY = Math.max(...ys)
  const rangeX = maxX - minX || 1
  const rangeY = maxY - minY || 1
  const scale = Math.min((SVG_W - PAD * 2) / rangeX, (SVG_H - PAD * 2) / rangeY)
  const offX = PAD + ((SVG_W - PAD * 2) - rangeX * scale) / 2
  const offY = PAD + ((SVG_H - PAD * 2) - rangeY * scale) / 2
  return { minX, maxY, scale, offX, offY }
}

function toSVG(p, n) {
  return [
    +(n.offX + (p.x - n.minX) * n.scale).toFixed(1),
    +(n.offY + (n.maxY - p.y) * n.scale).toFixed(1),
  ]
}

const SESSION_LABELS = {
  Practice: 'Prove Libere', Qualifying: 'Qualifiche',
  Race: 'Gara', 'Sprint Qualifying': 'Sprint Qual.', Sprint: 'Sprint',
}

export default function Map() {
  const { sessionKey } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [norm, setNorm] = useState(null)
  const [trackPath, setTrackPath] = useState('')
  const [driverPos, setDriverPos] = useState({})
  const [loading, setLoading] = useState(true)
  const [posLoading, setPosLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch(`https://api.openf1.org/v1/sessions?session_key=${sessionKey}`).then(r => r.json()),
      openf1.drivers(sessionKey),
    ]).then(async ([sessionData, drv]) => {
      const sess = sessionData[0]
      setSession(sess)
      setDrivers(drv)
      setLoading(false)
      if (!drv.length) return

      const refDriver = drv[0].driver_number
      let locs = []
      for (const lap of [2, 3, 4, 1]) {
        try {
          const d = await openf1.location(sessionKey, refDriver, lap)
          if (d.length > 50) { locs = d; break }
        } catch {}
      }

      if (locs.length > 10) {
        const sorted = [...locs].sort((a, b) => new Date(a.date) - new Date(b.date))
        const n = computeNorm(sorted)
        setNorm(n)
        const pts = sorted.map(p => toSVG(p, n))
        // Close the circuit
        const pathPts = [...pts, pts[0]]
        setTrackPath('M ' + pathPts.map(([x, y]) => `${x},${y}`).join(' L '))
      }
    }).catch(e => { console.error(e); setLoading(false) })
  }, [sessionKey])

  const fetchPositions = useCallback(async () => {
    if (!norm || !session) return
    try {
      const isLiveSession = new Date(session.date_end) > new Date()
      const refTime = isLiveSession
        ? new Date(Date.now() - 5000).toISOString()
        : new Date(new Date(session.date_end).getTime() - 30000).toISOString()

      const locs = await openf1.recentLocations(sessionKey, refTime)
      const latest = {}
      locs.forEach(p => {
        if (!latest[p.driver_number] || new Date(p.date) > new Date(latest[p.driver_number].date)) {
          latest[p.driver_number] = p
        }
      })
      const svgPos = {}
      Object.entries(latest).forEach(([dn, p]) => { svgPos[dn] = toSVG(p, norm) })
      setDriverPos(svgPos)
    } catch (e) { console.error(e) } finally { setPosLoading(false) }
  }, [sessionKey, norm, session])

  const isLive = session && new Date(session.date_end) > new Date()
  usePolling(fetchPositions, isLive ? 2000 : 60000, !!norm && !!session)

  const driverMap = Object.fromEntries(drivers.map(d => [String(d.driver_number), d]))

  return (
    <div className="max-w-6xl mx-auto p-4">
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="text-zinc-400 hover:text-white transition-colors">← Indietro</button>
        {session && (
          <div className="flex items-center gap-3">
            <div>
              <h1 className="text-xl font-bold text-white">
                {session.meeting_name} · <span className="text-red-400">Mappa Pista</span>
              </h1>
              <div className="text-sm text-zinc-400 flex items-center gap-2">
                {SESSION_LABELS[session.session_type] ?? session.session_type}
                {isLive && <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">LIVE</span>}
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        {loading ? (
          <div className="h-96 flex items-center justify-center text-zinc-400">Caricamento mappa...</div>
        ) : !trackPath ? (
          <div className="h-96 flex items-center justify-center text-zinc-500 text-center px-8">
            <div>
              <div className="text-4xl mb-3">🗺</div>
              <div>Dati posizione non disponibili per questa sessione.</div>
              <div className="text-sm mt-1 text-zinc-600">La mappa è disponibile quando la sessione ha dati di posizione GPS.</div>
            </div>
          </div>
        ) : (
          <svg viewBox={`0 0 ${SVG_W} ${SVG_H}`} className="w-full" style={{ background: '#050505' }}>
            {/* Track shadow/outline */}
            <path d={trackPath} fill="none" stroke="#27272a" strokeWidth={18} strokeLinecap="round" strokeLinejoin="round" />
            {/* Track surface */}
            <path d={trackPath} fill="none" stroke="#52525b" strokeWidth={10} strokeLinecap="round" strokeLinejoin="round" />
            {/* Track center line */}
            <path d={trackPath} fill="none" stroke="#71717a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" strokeDasharray="8 6" opacity={0.4} />

            {/* Driver positions */}
            {Object.entries(driverPos).map(([dn, [x, y]]) => {
              const driver = driverMap[dn]
              if (!driver) return null
              const color = driver.team_colour ? `#${driver.team_colour}` : '#ef4444'
              return (
                <g key={dn}>
                  {/* Glow effect */}
                  <circle cx={x} cy={y} r={12} fill={color} opacity={0.2} />
                  {/* Car dot */}
                  <circle cx={x} cy={y} r={7} fill={color} stroke="#050505" strokeWidth={2} />
                  {/* Driver label */}
                  <text
                    x={x} y={y - 13}
                    textAnchor="middle"
                    fill="white"
                    fontSize={9}
                    fontWeight="700"
                    fontFamily="system-ui, sans-serif"
                    style={{ paintOrder: 'stroke', stroke: '#050505', strokeWidth: 3 }}
                  >
                    {driver.name_acronym}
                  </text>
                </g>
              )
            })}

            {/* Loading indicator overlay */}
            {posLoading && (
              <text x={SVG_W / 2} y={SVG_H - 16} textAnchor="middle" fill="#52525b" fontSize={11}>
                Caricamento posizioni...
              </text>
            )}
          </svg>
        )}
      </div>

      {/* Legend */}
      {drivers.length > 0 && (
        <div className="mt-4">
          <div className="text-xs text-zinc-500 uppercase mb-2">Piloti</div>
          <div className="flex flex-wrap gap-2">
            {drivers.map(d => {
              const color = d.team_colour ? `#${d.team_colour}` : '#666'
              const hasPos = !!driverPos[String(d.driver_number)]
              return (
                <div
                  key={d.driver_number}
                  className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 border transition-opacity ${hasPos ? 'opacity-100' : 'opacity-40'}`}
                  style={{ backgroundColor: `${color}18`, borderColor: `${color}40` }}
                >
                  <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
                  <span className="text-xs font-bold" style={{ color }}>{d.name_acronym}</span>
                  <span className="text-xs text-zinc-500">{d.team_name}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {!isLive && session && (
        <p className="text-zinc-600 text-xs mt-3 text-center">
          Sessione terminata — posizioni al termine della sessione
        </p>
      )}
    </div>
  )
}
