import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { openf1 } from '../services/openf1'
import { usePolling } from '../hooks/usePolling'
import Weather from '../components/Weather'
import RaceControl from '../components/RaceControl'

const fmt = (ms) => {
  if (!ms) return '—'
  const m = Math.floor(ms / 60000)
  const s = Math.floor((ms % 60000) / 1000)
  const t = Math.round(ms % 1000)
  return `${m > 0 ? m + ':' : ''}${String(s).padStart(m > 0 ? 2 : 1, '0')}.${String(t).padStart(3, '0')}`
}

const POS_COLOR = ['#f4c430', '#b0b0b0', '#cd7f32']

const SESSION_LABELS = {
  Practice: 'Prove Libere', Qualifying: 'Qualifiche',
  Race: 'Gara', 'Sprint Qualifying': 'Sprint Qual.', Sprint: 'Sprint',
}

export default function Live() {
  const [session, setSession] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [laps, setLaps] = useState([])
  const [intervals, setIntervals] = useState([])
  const [positions, setPositions] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)

  const fetchAll = useCallback(async () => {
    try {
      const [sessionData] = await openf1.latestSession()
      setSession(sessionData)
      const sk = sessionData.session_key
      const [drv, lapData, intData, posData] = await Promise.all([
        openf1.drivers(sk),
        openf1.allLaps(sk),
        openf1.intervals(sk).catch(() => []),
        openf1.position(sk).catch(() => []),
      ])
      setDrivers(drv)
      setLaps(lapData)
      setIntervals(intData)
      setPositions(posData)
      setLastUpdate(new Date())
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  usePolling(fetchAll, 3000, true)

  const isLive = session && new Date(session.date_end) > new Date()
  const driverMap = Object.fromEntries(drivers.map(d => [d.driver_number, d]))

  const latestPosition = {}
  positions.forEach(p => {
    if (!latestPosition[p.driver_number] || new Date(p.date) > new Date(latestPosition[p.driver_number].date))
      latestPosition[p.driver_number] = p
  })

  const latestInterval = {}
  intervals.forEach(i => {
    if (!latestInterval[i.driver_number] || new Date(i.date) > new Date(latestInterval[i.driver_number].date))
      latestInterval[i.driver_number] = i
  })

  const bestLap = {}, lastLap = {}
  laps.forEach(l => {
    if (l.lap_duration && (!bestLap[l.driver_number] || l.lap_duration < bestLap[l.driver_number].lap_duration))
      bestLap[l.driver_number] = l
    if (!lastLap[l.driver_number] || l.lap_number > lastLap[l.driver_number].lap_number)
      lastLap[l.driver_number] = l
  })

  let sorted = Object.values(latestPosition)
    .sort((a, b) => a.position - b.position)
    .map(p => ({ pos: p, driver: driverMap[p.driver_number] }))
    .filter(x => x.driver)

  if (!sorted.length && !loading)
    sorted = drivers.map(d => ({ pos: null, driver: d }))

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">Sessione Attuale</h1>
            {isLive
              ? <span className="text-[10px] font-bold px-2 py-0.5 rounded animate-pulse" style={{ background: '#e10600', color: '#fff' }}>LIVE</span>
              : session && <span className="text-[10px] font-medium px-2 py-0.5 rounded" style={{ background: '#1a1a24', color: '#555' }}>Terminata</span>
            }
          </div>
          {session && (
            <p className="text-sm mt-1" style={{ color: '#555' }}>
              {session.meeting_name}
              <span style={{ color: '#e10600' }}> · {SESSION_LABELS[session.session_type] ?? session.session_type}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          {session && (
            <Link to={`/session/${session.session_key}/map`}
              className="text-xs px-3 py-1.5 rounded-lg transition-all hover:brightness-125"
              style={{ background: '#1a1a24', color: '#888', border: '1px solid #252530' }}>
              🗺 Mappa
            </Link>
          )}
          {lastUpdate && (
            <span className="mono text-xs" style={{ color: '#333' }}>
              {lastUpdate.toLocaleTimeString('it-IT')}
            </span>
          )}
        </div>
      </div>

      {/* Meteo */}
      {session && <Weather sessionKey={session.session_key} isLive={isLive} />}

      {loading ? (
        <div className="text-center py-20" style={{ color: '#444' }}>
          <div className="text-4xl mb-3">📡</div>
          <p>Connessione alla sessione...</p>
        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4">

          {/* Timing Tower */}
          <div className="flex-1 min-w-0">
            {session && (
              <div className="flex justify-end mb-2">
                <Link to={`/session/${session.session_key}`}
                  className="text-xs" style={{ color: '#444' }}>
                  Dettaglio sessione →
                </Link>
              </div>
            )}
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a24' }}>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #1a1a24', background: '#0c0c14' }}>
                    {['P', 'Pilota', 'Gap', 'Int.', 'Ultimo', 'Miglior', 'G', ''].map((h, i) => (
                      <th key={i}
                        className={`py-3 px-3 text-left text-[10px] font-semibold uppercase tracking-widest
                          ${i === 3 ? 'hidden sm:table-cell' : ''}
                          ${i === 5 ? 'hidden md:table-cell' : ''}
                          ${i === 6 ? 'hidden lg:table-cell' : ''}`}
                        style={{ color: '#383848' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(({ pos, driver }, i) => {
                    const gap = latestInterval[driver.driver_number]
                    const bl = bestLap[driver.driver_number]
                    const ll = lastLap[driver.driver_number]
                    const tc = driver.team_colour ? `#${driver.team_colour}` : '#444'

                    return (
                      <tr key={driver.driver_number}
                        style={{ borderBottom: '1px solid #111118' }}
                        onMouseEnter={e => e.currentTarget.style.background = '#0f0f18'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>

                        <td className="py-3 pl-4 w-10">
                          <span className="font-black text-base mono" style={{ color: POS_COLOR[i] ?? '#383848' }}>
                            {pos?.position ?? i + 1}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-[3px] h-7 rounded-full shrink-0" style={{ background: tc }} />
                            <div>
                              <div className="font-bold text-sm text-white">{driver.name_acronym}</div>
                              <div className="text-[10px] mt-0.5" style={{ color: '#484858' }}>{driver.team_name}</div>
                            </div>
                          </div>
                        </td>

                        <td className="py-3 px-3">
                          <span className="mono text-xs" style={{ color: i === 0 ? '#888' : '#484858' }}>
                            {i === 0 ? 'Leader' : (gap?.gap_to_leader ?? '—')}
                          </span>
                        </td>

                        <td className="py-3 px-3 hidden sm:table-cell">
                          <span className="mono text-xs" style={{ color: '#383848' }}>
                            {gap?.interval ?? '—'}
                          </span>
                        </td>

                        <td className="py-3 px-3">
                          <span className="mono font-semibold text-sm text-white">
                            {ll?.lap_duration ? fmt(ll.lap_duration * 1000) : '—'}
                          </span>
                        </td>

                        <td className="py-3 px-3 hidden md:table-cell">
                          <span className="mono text-sm" style={{ color: '#a855f7' }}>
                            {bl?.lap_duration ? fmt(bl.lap_duration * 1000) : '—'}
                          </span>
                        </td>

                        <td className="py-3 px-3 hidden lg:table-cell">
                          <span className="mono text-xs" style={{ color: '#383848' }}>
                            {ll?.lap_number ?? '—'}
                          </span>
                        </td>

                        <td className="py-3 pr-4 text-right">
                          {session && (
                            <Link to={`/session/${session.session_key}/telemetry/${driver.driver_number}`}
                              className="text-[11px] px-2.5 py-1 rounded transition-all hover:brightness-125"
                              style={{ background: '#1a1a24', color: '#666', border: '1px solid #252530' }}>
                              Tel →
                            </Link>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Race Control */}
          {session && (
            <div className="w-full lg:w-72 shrink-0">
              <RaceControl sessionKey={session.session_key} isLive={isLive} maxHeight={520} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
