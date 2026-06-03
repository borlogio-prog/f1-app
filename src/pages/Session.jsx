import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
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

function fmtSector(ms) {
  if (!ms) return '--.-'
  return (ms / 1000).toFixed(3)
}

function gap(a, b) {
  if (!a || !b) return ''
  const diff = a - b
  return diff > 0 ? `+${(diff / 1000).toFixed(3)}` : ''
}

const SESSION_LABELS = {
  Practice: 'Prove Libere', Qualifying: 'Qualifiche',
  Race: 'Gara', 'Sprint Qualifying': 'Sprint Qual.', Sprint: 'Sprint',
}

const TABS = ['times', 'laps', 'weather', 'racecontrol']
const TAB_LABELS = { times: 'Classifica', laps: 'Giri per pilota', weather: 'Meteo', racecontrol: 'Race Control' }

export default function Session() {
  const { sessionKey } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [laps, setLaps] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedDriver, setSelectedDriver] = useState(null)
  const [tab, setTab] = useState('times')

  useEffect(() => {
    Promise.all([
      openf1.drivers(sessionKey),
      fetch(`https://api.openf1.org/v1/sessions?session_key=${sessionKey}`).then(r => r.json()),
    ]).then(([drv, sessionData]) => {
      setDrivers(drv)
      setSession(sessionData[0])
    }).catch(console.error)
  }, [sessionKey])

  const fetchLaps = useCallback(async () => {
    try {
      const data = await openf1.allLaps(sessionKey)
      setLaps(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [sessionKey])

  const isLive = session && new Date(session.date_end) > new Date()
  usePolling(fetchLaps, 5000, true)

  const driverMap = Object.fromEntries(drivers.map(d => [d.driver_number, d]))

  const bestPerDriver = drivers.map(d => {
    const dLaps = laps.filter(l => l.driver_number === d.driver_number && l.lap_duration)
    const best = dLaps.reduce((b, l) => (!b || l.lap_duration < b.lap_duration ? l : b), null)
    return { driver: d, best, lapCount: dLaps.length }
  }).filter(x => x.best).sort((a, b) => a.best.lap_duration - b.best.lap_duration)

  const overallBest = bestPerDriver[0]?.best?.lap_duration

  const driverLaps = selectedDriver
    ? laps.filter(l => l.driver_number === selectedDriver).sort((a, b) => a.lap_number - b.lap_number)
    : []

  return (
    <div className="max-w-5xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="text-zinc-400 hover:text-white transition-colors">← Indietro</button>
        {session && (
          <div className="flex-1 flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-white">
                {session.meeting_name} · <span className="text-red-400">{SESSION_LABELS[session.session_type] ?? session.session_type}</span>
              </h1>
              <div className="text-sm text-zinc-400 flex items-center gap-2">
                {session.country_name}
                {isLive && <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">LIVE</span>}
              </div>
            </div>
            <Link
              to={`/session/${sessionKey}/map`}
              className="flex items-center gap-1.5 text-sm bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 hover:border-zinc-600 text-zinc-300 hover:text-white px-3 py-1.5 rounded-lg transition-colors"
            >
              🗺 Mappa Pista
            </Link>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 flex-wrap">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t ? 'bg-red-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
            {TAB_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Tab: Classifica */}
      {tab === 'times' && (
        loading ? (
          <div className="text-zinc-400 text-center py-16">Caricamento tempi...</div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase">
                  <th className="py-3 px-4 text-left w-8">Pos</th>
                  <th className="py-3 px-4 text-left">Pilota</th>
                  <th className="py-3 px-4 text-right">Miglior Giro</th>
                  <th className="py-3 px-4 text-right hidden sm:table-cell">Gap</th>
                  <th className="py-3 px-4 text-right hidden md:table-cell">S1</th>
                  <th className="py-3 px-4 text-right hidden md:table-cell">S2</th>
                  <th className="py-3 px-4 text-right hidden md:table-cell">S3</th>
                  <th className="py-3 px-4 text-right hidden sm:table-cell">Giri</th>
                  <th className="py-3 px-4"></th>
                </tr>
              </thead>
              <tbody>
                {bestPerDriver.map(({ driver, best, lapCount }, i) => (
                  <tr key={driver.driver_number}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors cursor-pointer"
                    onClick={() => { setSelectedDriver(driver.driver_number); setTab('laps') }}>
                    <td className="py-3 px-4 text-zinc-400 font-mono">{i + 1}</td>
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        <div className="w-1 h-8 rounded-full shrink-0"
                          style={{ backgroundColor: driver.team_colour ? `#${driver.team_colour}` : '#666' }} />
                        <div>
                          <div className="text-white font-semibold">{driver.name_acronym}</div>
                          <div className="text-zinc-500 text-xs">{driver.team_name}</div>
                        </div>
                      </div>
                    </td>
                    <td className={`py-3 px-4 text-right font-mono font-semibold ${i === 0 ? 'text-purple-400' : 'text-white'}`}>
                      {fmt(best?.lap_duration * 1000)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-400 hidden sm:table-cell text-xs">
                      {i === 0 ? '' : gap(best?.lap_duration * 1000, overallBest * 1000)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-400 text-xs hidden md:table-cell">{fmtSector(best?.duration_sector_1 * 1000)}</td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-400 text-xs hidden md:table-cell">{fmtSector(best?.duration_sector_2 * 1000)}</td>
                    <td className="py-3 px-4 text-right font-mono text-zinc-400 text-xs hidden md:table-cell">{fmtSector(best?.duration_sector_3 * 1000)}</td>
                    <td className="py-3 px-4 text-right text-zinc-500 text-xs hidden sm:table-cell">{lapCount}</td>
                    <td className="py-3 px-4 text-right">
                      <Link to={`/session/${sessionKey}/telemetry/${driver.driver_number}`}
                        onClick={e => e.stopPropagation()}
                        className="text-xs text-red-400 hover:text-red-300 transition-colors">
                        Telemetria →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Tab: Giri per pilota */}
      {tab === 'laps' && (
        <div>
          <div className="flex flex-wrap gap-2 mb-4">
            {drivers.map(d => (
              <button key={d.driver_number}
                onClick={() => setSelectedDriver(d.driver_number)}
                className={`px-3 py-1.5 rounded-lg text-sm transition-colors border ${selectedDriver === d.driver_number
                  ? 'border-red-500 bg-red-900/30 text-white'
                  : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-white'}`}
                style={selectedDriver === d.driver_number && d.team_colour ? { borderColor: `#${d.team_colour}` } : {}}>
                {d.name_acronym}
              </button>
            ))}
          </div>

          {selectedDriver && driverLaps.length > 0 ? (
            <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <div className="p-4 border-b border-zinc-800 flex items-center justify-between">
                <div>
                  <span className="text-white font-semibold">{driverMap[selectedDriver]?.full_name}</span>
                  <span className="text-zinc-400 text-sm ml-2">{driverMap[selectedDriver]?.team_name}</span>
                </div>
                <Link to={`/session/${sessionKey}/telemetry/${selectedDriver}`}
                  className="text-sm text-red-400 hover:text-red-300">Telemetria →</Link>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-zinc-400 text-xs uppercase">
                    <th className="py-2 px-4 text-left">Giro</th>
                    <th className="py-2 px-4 text-right">Tempo</th>
                    <th className="py-2 px-4 text-right hidden sm:table-cell">S1</th>
                    <th className="py-2 px-4 text-right hidden sm:table-cell">S2</th>
                    <th className="py-2 px-4 text-right hidden sm:table-cell">S3</th>
                    <th className="py-2 px-4 text-right">Stint</th>
                    <th className="py-2 px-4 text-right">Mescola</th>
                  </tr>
                </thead>
                <tbody>
                  {driverLaps.map(lap => {
                    const isBest = lap.lap_duration && lap.lap_duration === Math.min(...driverLaps.map(l => l.lap_duration).filter(Boolean))
                    return (
                      <tr key={lap.lap_number} className={`border-b border-zinc-800/30 hover:bg-zinc-800/40 ${isBest ? 'bg-purple-900/10' : ''}`}>
                        <td className="py-2 px-4 text-zinc-400 font-mono">{lap.lap_number}</td>
                        <td className={`py-2 px-4 text-right font-mono font-semibold ${isBest ? 'text-purple-400' : 'text-white'}`}>
                          {lap.lap_duration ? fmt(lap.lap_duration * 1000) : <span className="text-zinc-600">pit/sc</span>}
                        </td>
                        <td className="py-2 px-4 text-right font-mono text-zinc-400 text-xs hidden sm:table-cell">{fmtSector(lap.duration_sector_1 * 1000)}</td>
                        <td className="py-2 px-4 text-right font-mono text-zinc-400 text-xs hidden sm:table-cell">{fmtSector(lap.duration_sector_2 * 1000)}</td>
                        <td className="py-2 px-4 text-right font-mono text-zinc-400 text-xs hidden sm:table-cell">{fmtSector(lap.duration_sector_3 * 1000)}</td>
                        <td className="py-2 px-4 text-right text-zinc-500 text-xs">{lap.stint_number}</td>
                        <td className="py-2 px-4 text-right">
                          {lap.compound && (
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium
                              ${lap.compound === 'SOFT' ? 'bg-red-900/50 text-red-300' :
                                lap.compound === 'MEDIUM' ? 'bg-yellow-900/50 text-yellow-300' :
                                  lap.compound === 'HARD' ? 'bg-zinc-600 text-white' :
                                    'bg-blue-900/50 text-blue-300'}`}>
                              {lap.compound[0]}
                            </span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : selectedDriver ? (
            <div className="text-zinc-500 text-center py-8">Nessun giro disponibile</div>
          ) : (
            <div className="text-zinc-500 text-center py-8">Seleziona un pilota</div>
          )}
        </div>
      )}

      {/* Tab: Meteo */}
      {tab === 'weather' && (
        <div>
          <Weather sessionKey={sessionKey} isLive={isLive} />
          <p className="text-zinc-500 text-sm text-center mt-4">
            Dati meteo in pista · Aggiornato ogni 30s durante sessioni live
          </p>
        </div>
      )}

      {/* Tab: Race Control */}
      {tab === 'racecontrol' && (
        <RaceControl sessionKey={sessionKey} isLive={isLive} maxHeight={600} />
      )}
    </div>
  )
}
