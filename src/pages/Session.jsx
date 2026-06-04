import { useState, useEffect, useCallback } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
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

const fmtS = (ms) => (!ms ? '—' : (ms / 1000).toFixed(3))

const gap = (a, b) => {
  if (!a || !b || a === b) return ''
  return `+${((a - b) / 1000).toFixed(3)}`
}

const POS_COLOR = ['#f4c430', '#b0b0b0', '#cd7f32']

const SESSION_LABELS = {
  Practice: 'Prove Libere', Qualifying: 'Qualifiche',
  Race: 'Gara', 'Sprint Qualifying': 'Sprint Qual.', Sprint: 'Sprint',
}

const TABS = [
  { id: 'times', label: 'Classifica' },
  { id: 'laps', label: 'Giri' },
  { id: 'weather', label: 'Meteo' },
  { id: 'rc', label: 'Direzione Gara' },
]

const COMPOUND_STYLE = {
  SOFT: { bg: '#3a0a0a', color: '#ef4444', letter: 'S' },
  MEDIUM: { bg: '#2a2000', color: '#f59e0b', letter: 'M' },
  HARD: { bg: '#1e1e26', color: '#d4d4d8', letter: 'H' },
  INTERMEDIATE: { bg: '#0a2a1a', color: '#22c55e', letter: 'I' },
  WET: { bg: '#0a1a2a', color: '#60a5fa', letter: 'W' },
}

function CompoundBadge({ compound }) {
  if (!compound) return null
  const s = COMPOUND_STYLE[compound] ?? { bg: '#1e1e26', color: '#888', letter: compound[0] }
  return (
    <span className="inline-flex items-center justify-center w-5 h-5 rounded font-bold text-[10px] mono"
      style={{ background: s.bg, color: s.color }}>
      {s.letter}
    </span>
  )
}

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
    ]).then(([drv, sd]) => {
      setDrivers(drv)
      setSession(sd[0])
    }).catch(console.error)
  }, [sessionKey])

  const fetchLaps = useCallback(async () => {
    try { setLaps(await openf1.allLaps(sessionKey)) }
    catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [sessionKey])

  const isLive = session && new Date(session.date_end) > new Date()
  usePolling(fetchLaps, 5000, true)

  const driverMap = Object.fromEntries(drivers.map(d => [d.driver_number, d]))

  const bestPerDriver = drivers.map(d => {
    const dl = laps.filter(l => l.driver_number === d.driver_number && l.lap_duration)
    const best = dl.reduce((b, l) => (!b || l.lap_duration < b.lap_duration ? l : b), null)
    return { driver: d, best, lapCount: dl.length }
  }).filter(x => x.best).sort((a, b) => a.best.lap_duration - b.best.lap_duration)

  const overallBest = bestPerDriver[0]?.best?.lap_duration
  const driverLaps = selectedDriver
    ? laps.filter(l => l.driver_number === selectedDriver).sort((a, b) => a.lap_number - b.lap_number)
    : []

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">

      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <button onClick={() => navigate(-1)} className="text-xs mb-2 flex items-center gap-1 transition-colors hover:text-white" style={{ color: '#555' }}>
            ← Indietro
          </button>
          {session && (
            <>
              <h1 className="text-xl font-bold text-white">{session.meeting_name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-sm" style={{ color: '#e10600' }}>{SESSION_LABELS[session.session_type] ?? session.session_type}</span>
                <span style={{ color: '#2a2a35' }}>·</span>
                <span className="text-sm" style={{ color: '#555' }}>{session.country_name}</span>
                {isLive && (
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded animate-pulse" style={{ background: '#e10600', color: '#fff' }}>
                    LIVE
                  </span>
                )}
              </div>
            </>
          )}
        </div>
        <Link
          to={`/session/${sessionKey}/map`}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg transition-all hover:brightness-125"
          style={{ background: '#1a1a24', color: '#888', border: '1px solid #252530' }}
        >
          🗺 Mappa
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 p-1 rounded-xl" style={{ background: '#0f0f16' }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className="flex-1 py-2 text-sm font-medium rounded-lg transition-all"
            style={{
              background: tab === t.id ? '#1e1e2a' : 'transparent',
              color: tab === t.id ? '#fff' : '#555',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Classifica */}
      {tab === 'times' && (
        loading ? (
          <div className="text-center py-16" style={{ color: '#444' }}>Caricamento tempi...</div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a24' }}>
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: '1px solid #1a1a24', background: '#0c0c14' }}>
                  {['P', 'Pilota', 'Miglior Giro', 'Gap', 'S1', 'S2', 'S3', 'Giri', ''].map((h, i) => (
                    <th key={i} className={`py-3 px-3 text-left text-[10px] font-semibold uppercase tracking-widest ${i > 3 && i < 7 ? 'hidden lg:table-cell' : ''} ${i === 7 ? 'hidden sm:table-cell' : ''}`} style={{ color: '#383848' }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bestPerDriver.map(({ driver, best, lapCount }, i) => {
                  const tc = driver.team_colour ? `#${driver.team_colour}` : '#444'
                  return (
                    <tr
                      key={driver.driver_number}
                      className="cursor-pointer transition-all"
                      style={{ borderBottom: '1px solid #111118' }}
                      onMouseEnter={e => e.currentTarget.style.background = '#0f0f18'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      onClick={() => { setSelectedDriver(driver.driver_number); setTab('laps') }}
                    >
                      {/* Posizione */}
                      <td className="py-3.5 pl-4 w-10">
                        <span className="font-black text-base mono" style={{ color: POS_COLOR[i] ?? '#383848' }}>
                          {i + 1}
                        </span>
                      </td>

                      {/* Pilota */}
                      <td className="py-3.5 px-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-[3px] h-7 rounded-full shrink-0" style={{ background: tc }} />
                          <div>
                            <div className="font-bold text-sm text-white">{driver.name_acronym}</div>
                            <div className="text-[10px] mt-0.5" style={{ color: '#484858' }}>{driver.team_name}</div>
                          </div>
                        </div>
                      </td>

                      {/* Miglior giro */}
                      <td className="py-3.5 px-3">
                        <span className="mono font-bold text-sm" style={{ color: i === 0 ? '#a855f7' : '#e8e8f0' }}>
                          {fmt(best?.lap_duration * 1000)}
                        </span>
                      </td>

                      {/* Gap */}
                      <td className="py-3.5 px-3">
                        <span className="mono text-xs" style={{ color: '#484858' }}>
                          {i === 0 ? '—' : gap(best?.lap_duration * 1000, overallBest * 1000)}
                        </span>
                      </td>

                      {/* Settori */}
                      <td className="py-3.5 px-3 hidden lg:table-cell">
                        <span className="mono text-xs" style={{ color: '#484858' }}>{fmtS(best?.duration_sector_1 * 1000)}</span>
                      </td>
                      <td className="py-3.5 px-3 hidden lg:table-cell">
                        <span className="mono text-xs" style={{ color: '#484858' }}>{fmtS(best?.duration_sector_2 * 1000)}</span>
                      </td>
                      <td className="py-3.5 px-3 hidden lg:table-cell">
                        <span className="mono text-xs" style={{ color: '#484858' }}>{fmtS(best?.duration_sector_3 * 1000)}</span>
                      </td>

                      {/* Giri */}
                      <td className="py-3.5 px-3 hidden sm:table-cell">
                        <span className="text-xs" style={{ color: '#383848' }}>{lapCount}</span>
                      </td>

                      {/* Telemetria */}
                      <td className="py-3.5 pr-4 text-right">
                        <Link
                          to={`/session/${sessionKey}/telemetry/${driver.driver_number}`}
                          onClick={e => e.stopPropagation()}
                          className="text-[11px] px-2.5 py-1 rounded transition-all hover:brightness-125"
                          style={{ background: '#1a1a24', color: '#666', border: '1px solid #252530' }}
                        >
                          Tel →
                        </Link>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )
      )}

      {/* Giri per pilota */}
      {tab === 'laps' && (
        <div>
          <div className="flex flex-wrap gap-1.5 mb-5">
            {drivers.map(d => {
              const tc = d.team_colour ? `#${d.team_colour}` : '#444'
              const active = selectedDriver === d.driver_number
              return (
                <button key={d.driver_number}
                  onClick={() => setSelectedDriver(d.driver_number)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
                  style={{
                    background: active ? `${tc}22` : '#0f0f16',
                    border: `1px solid ${active ? tc : '#1a1a24'}`,
                    color: active ? '#fff' : '#555',
                  }}>
                  <div className="w-1.5 h-1.5 rounded-full" style={{ background: active ? tc : '#333' }} />
                  {d.name_acronym}
                </button>
              )
            })}
          </div>

          {selectedDriver && driverLaps.length > 0 ? (
            <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a24' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ background: '#0c0c14', borderBottom: '1px solid #1a1a24' }}>
                <div className="flex items-center gap-2">
                  <div className="w-[3px] h-5 rounded-full" style={{ background: driverMap[selectedDriver]?.team_colour ? `#${driverMap[selectedDriver].team_colour}` : '#444' }} />
                  <span className="font-bold text-white text-sm">{driverMap[selectedDriver]?.full_name}</span>
                  <span className="text-xs" style={{ color: '#484858' }}>{driverMap[selectedDriver]?.team_name}</span>
                </div>
                <Link to={`/session/${sessionKey}/telemetry/${selectedDriver}`}
                  className="text-xs px-2.5 py-1 rounded" style={{ background: '#1a1a24', color: '#e10600', border: '1px solid #2a1a1a' }}>
                  Telemetria →
                </Link>
              </div>
              <table className="w-full">
                <thead>
                  <tr style={{ borderBottom: '1px solid #111118', background: '#0c0c14' }}>
                    {['Giro', 'Tempo', 'S1', 'S2', 'S3', 'Stint', 'Mescola'].map((h, i) => (
                      <th key={i} className={`py-2.5 px-3 text-left text-[10px] font-semibold uppercase tracking-widest ${i > 1 && i < 5 ? 'hidden sm:table-cell' : ''}`} style={{ color: '#383848' }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {driverLaps.map(lap => {
                    const isBest = lap.lap_duration && lap.lap_duration === Math.min(...driverLaps.map(l => l.lap_duration).filter(Boolean))
                    return (
                      <tr key={lap.lap_number}
                        style={{ borderBottom: '1px solid #111118', background: isBest ? '#140a20' : 'transparent' }}
                        onMouseEnter={e => !isBest && (e.currentTarget.style.background = '#0f0f18')}
                        onMouseLeave={e => e.currentTarget.style.background = isBest ? '#140a20' : 'transparent'}>
                        <td className="py-2.5 px-3 mono text-xs" style={{ color: '#484858' }}>{lap.lap_number}</td>
                        <td className="py-2.5 px-3">
                          <span className="mono font-bold text-sm" style={{ color: isBest ? '#a855f7' : lap.lap_duration ? '#e8e8f0' : '#383848' }}>
                            {lap.lap_duration ? fmt(lap.lap_duration * 1000) : 'pit'}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 mono text-xs hidden sm:table-cell" style={{ color: '#484858' }}>{fmtS(lap.duration_sector_1 * 1000)}</td>
                        <td className="py-2.5 px-3 mono text-xs hidden sm:table-cell" style={{ color: '#484858' }}>{fmtS(lap.duration_sector_2 * 1000)}</td>
                        <td className="py-2.5 px-3 mono text-xs hidden sm:table-cell" style={{ color: '#484858' }}>{fmtS(lap.duration_sector_3 * 1000)}</td>
                        <td className="py-2.5 px-3 text-xs" style={{ color: '#383848' }}>{lap.stint_number ?? '—'}</td>
                        <td className="py-2.5 px-3"><CompoundBadge compound={lap.compound} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-16 text-sm" style={{ color: '#444' }}>
              {selectedDriver ? 'Nessun giro disponibile' : 'Seleziona un pilota'}
            </div>
          )}
        </div>
      )}

      {/* Meteo */}
      {tab === 'weather' && <Weather sessionKey={sessionKey} isLive={isLive} />}

      {/* Race Control */}
      {tab === 'rc' && <RaceControl sessionKey={sessionKey} isLive={isLive} maxHeight={600} />}
    </div>
  )
}
