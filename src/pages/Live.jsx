import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { openf1 } from '../services/openf1'
import { usePolling } from '../hooks/usePolling'
import Weather from '../components/Weather'
import RaceControl from '../components/RaceControl'

function fmt(ms) {
  if (!ms) return '--:--.---'
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  const mils = Math.round(ms % 1000)
  return `${mins > 0 ? mins + ':' : ''}${String(secs).padStart(mins > 0 ? 2 : 1, '0')}.${String(mils).padStart(3, '0')}`
}

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

  const bestLap = {}
  laps.forEach(l => {
    if (l.lap_duration && (!bestLap[l.driver_number] || l.lap_duration < bestLap[l.driver_number].lap_duration))
      bestLap[l.driver_number] = l
  })

  const lastLap = {}
  laps.forEach(l => {
    if (!lastLap[l.driver_number] || l.lap_number > lastLap[l.driver_number].lap_number)
      lastLap[l.driver_number] = l
  })

  const sorted = Object.values(latestPosition)
    .sort((a, b) => a.position - b.position)
    .map(p => ({ pos: p, driver: driverMap[p.driver_number] }))
    .filter(x => x.driver)

  if (sorted.length === 0 && !loading) {
    sorted.push(...drivers.map(d => ({ pos: null, driver: d })))
  }

  return (
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            Sessione Live
            {isLive && <span className="text-sm bg-red-600 text-white px-2 py-0.5 rounded-full animate-pulse">LIVE</span>}
            {session && !isLive && <span className="text-sm bg-zinc-700 text-zinc-300 px-2 py-0.5 rounded-full">Terminata</span>}
          </h1>
          {session && (
            <p className="text-zinc-400 text-sm mt-1">
              {session.meeting_name} · <span className="text-red-400">{SESSION_LABELS[session.session_type] ?? session.session_type}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {session && (
            <Link to={`/session/${session.session_key}/map`}
              className="text-sm bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white border border-zinc-700 px-3 py-1.5 rounded-lg transition-colors">
              🗺 Mappa
            </Link>
          )}
          {lastUpdate && (
            <div className="text-zinc-500 text-xs font-mono">{lastUpdate.toLocaleTimeString('it-IT')}</div>
          )}
        </div>
      </div>

      {/* Weather */}
      {session && <Weather sessionKey={session.session_key} isLive={isLive} />}

      {loading ? (
        <div className="text-zinc-400 text-center py-16">Connessione alla sessione...</div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-4">
          {/* Timing Tower */}
          <div className="flex-1 min-w-0">
            {session && (
              <div className="flex justify-end mb-2">
                <Link to={`/session/${session.session_key}`} className="text-sm text-red-400 hover:text-red-300">
                  Tutti i tempi →
                </Link>
              </div>
            )}
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase">
                    <th className="py-3 px-3 text-left w-8">P</th>
                    <th className="py-3 px-3 text-left">Pilota</th>
                    <th className="py-3 px-3 text-right">Gap</th>
                    <th className="py-3 px-3 text-right hidden sm:table-cell">Int.</th>
                    <th className="py-3 px-3 text-right">Ultimo</th>
                    <th className="py-3 px-3 text-right hidden sm:table-cell">Miglior</th>
                    <th className="py-3 px-3 text-right hidden md:table-cell">Giri</th>
                    <th className="py-3 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(({ pos, driver }, i) => {
                    const gap = latestInterval[driver.driver_number]
                    const bl = bestLap[driver.driver_number]
                    const ll = lastLap[driver.driver_number]
                    const teamColor = driver.team_colour ? `#${driver.team_colour}` : '#666'
                    return (
                      <tr key={driver.driver_number} className="border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors">
                        <td className="py-2.5 px-3 text-zinc-300 font-bold font-mono">{pos?.position ?? i + 1}</td>
                        <td className="py-2.5 px-3">
                          <div className="flex items-center gap-2">
                            <div className="w-1 h-8 rounded-full shrink-0" style={{ backgroundColor: teamColor }} />
                            <div>
                              <div className="text-white font-semibold">{driver.name_acronym}</div>
                              <div className="text-zinc-500 text-xs">{driver.team_name}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-zinc-300 text-xs">
                          {gap?.gap_to_leader ?? (i === 0 ? 'Leader' : '--')}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-zinc-400 text-xs hidden sm:table-cell">
                          {gap?.interval ?? '--'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-white text-xs">
                          {ll?.lap_duration ? fmt(ll.lap_duration * 1000) : '--'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-purple-400 text-xs hidden sm:table-cell">
                          {bl?.lap_duration ? fmt(bl.lap_duration * 1000) : '--'}
                        </td>
                        <td className="py-2.5 px-3 text-right text-zinc-500 text-xs hidden md:table-cell">
                          {ll?.lap_number ?? '--'}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          {session && (
                            <Link to={`/session/${session.session_key}/telemetry/${driver.driver_number}`}
                              className="text-xs text-red-400 hover:text-red-300 transition-colors">
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

          {/* Race Control sidebar */}
          {session && (
            <div className="w-full lg:w-80 shrink-0">
              <RaceControl sessionKey={session.session_key} isLive={isLive} maxHeight={500} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
