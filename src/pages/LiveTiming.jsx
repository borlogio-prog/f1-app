import { useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { openf1 } from '../services/openf1'
import { usePolling } from '../hooks/usePolling'
import Weather from '../components/Weather'

// ─── Costanti stilistiche ──────────────────────────────────────────────
const SECTOR_STYLES = {
  purple: { bg: '#200a35', color: '#c084fc', border: '#4a1a70' },
  green:  { bg: '#001e0a', color: '#4ade80', border: '#004018' },
  yellow: { bg: '#1e1500', color: '#fbbf24', border: '#3a2a00' },
}

const COMPOUND_STYLE = {
  SOFT:         { bg: '#3a0808', color: '#f87171', letter: 'S' },
  MEDIUM:       { bg: '#2a1e00', color: '#fbbf24', letter: 'M' },
  HARD:         { bg: '#1c1c22', color: '#d4d4d8', letter: 'H' },
  INTERMEDIATE: { bg: '#082a14', color: '#4ade80', letter: 'I' },
  WET:          { bg: '#08142a', color: '#60a5fa', letter: 'W' },
}

const POS_COLOR = ['#f4c430', '#b4b4b4', '#cd7f32']

const SESSION_LABELS = {
  Practice: 'Prove Libere', Qualifying: 'Qualifiche',
  Race: 'Gara', 'Sprint Qualifying': 'Sprint Qual.', Sprint: 'Sprint',
}

const eps = 0.0005

// ─── Utility ──────────────────────────────────────────────────────────
function fmtTime(sec) {
  if (!sec) return '—'
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec % 60)
  const ms = Math.round((sec % 1) * 1000)
  return `${m > 0 ? m + ':' : ''}${String(s).padStart(m > 0 ? 2 : 1, '0')}.${String(ms).padStart(3, '0')}`
}

function sectorColor(time, sessionBest, driverBest) {
  if (!time || !isFinite(sessionBest)) return null
  if (time <= sessionBest + eps) return 'purple'
  if (isFinite(driverBest) && time <= driverBest + eps) return 'green'
  return 'yellow'
}

// ─── Cella settore ────────────────────────────────────────────────────
function SectorCell({ time, sessionBest, driverBest, active }) {
  if (active && !time) {
    return (
      <td className="py-3.5 px-2 text-center w-20">
        <span className="mono text-xs tracking-widest animate-pulse" style={{ color: '#fbbf24' }}>···</span>
      </td>
    )
  }
  if (!time) {
    return (
      <td className="py-3.5 px-2 text-center w-20">
        <span className="mono text-xs" style={{ color: '#222230' }}>—</span>
      </td>
    )
  }
  const col = sectorColor(time, sessionBest, driverBest)
  const st = SECTOR_STYLES[col]
  return (
    <td className="py-3.5 px-2 text-center w-20">
      {st ? (
        <span className="mono text-xs px-1.5 py-1 rounded-md" style={{ background: st.bg, color: st.color, border: `1px solid ${st.border}` }}>
          {time.toFixed(3)}
        </span>
      ) : (
        <span className="mono text-xs" style={{ color: '#484858' }}>{time.toFixed(3)}</span>
      )}
    </td>
  )
}

// ─── Componente principale ────────────────────────────────────────────
export default function LiveTiming() {
  const [session, setSession] = useState(null)
  const [drivers, setDrivers] = useState([])
  const [laps, setLaps] = useState([])
  const [positions, setPositions] = useState([])
  const [intervals, setIntervals] = useState([])
  const [stints, setStints] = useState([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [tick, setTick] = useState(0)

  const fetchAll = useCallback(async () => {
    try {
      const [sessionData] = await openf1.latestSession()
      setSession(sessionData)
      const sk = sessionData.session_key
      const [drv, lapData, posData, intData, stintData] = await Promise.all([
        openf1.drivers(sk),
        openf1.allLaps(sk),
        openf1.position(sk).catch(() => []),
        openf1.intervals(sk).catch(() => []),
        openf1.stints(sk).catch(() => []),
      ])
      setDrivers(drv)
      setLaps(lapData)
      setPositions(posData)
      setIntervals(intData)
      setStints(stintData)
      setLastUpdate(new Date())
      setTick(t => t + 1)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  usePolling(fetchAll, 2500, true)

  const isLive = session && new Date(session.date_end) > new Date()
  const driverMap = Object.fromEntries(drivers.map(d => [d.driver_number, d]))

  // ── Elaborazione dati ──────────────────────────────────────────────
  const sessionBests = { s1: Infinity, s2: Infinity, s3: Infinity }
  const driverBests  = {}
  const lapsByDriver = {}
  const bestLapByDriver = {}

  laps.forEach(lap => {
    const dn = lap.driver_number
    if (lap.duration_sector_1 && lap.duration_sector_1 < sessionBests.s1) sessionBests.s1 = lap.duration_sector_1
    if (lap.duration_sector_2 && lap.duration_sector_2 < sessionBests.s2) sessionBests.s2 = lap.duration_sector_2
    if (lap.duration_sector_3 && lap.duration_sector_3 < sessionBests.s3) sessionBests.s3 = lap.duration_sector_3

    if (!driverBests[dn]) driverBests[dn] = { s1: Infinity, s2: Infinity, s3: Infinity }
    const db = driverBests[dn]
    if (lap.duration_sector_1 && lap.duration_sector_1 < db.s1) db.s1 = lap.duration_sector_1
    if (lap.duration_sector_2 && lap.duration_sector_2 < db.s2) db.s2 = lap.duration_sector_2
    if (lap.duration_sector_3 && lap.duration_sector_3 < db.s3) db.s3 = lap.duration_sector_3

    if (!lapsByDriver[dn]) lapsByDriver[dn] = []
    lapsByDriver[dn].push(lap)

    if (lap.lap_duration && (!bestLapByDriver[dn] || lap.lap_duration < bestLapByDriver[dn].lap_duration))
      bestLapByDriver[dn] = lap
  })

  // Per ogni pilota: giro attuale (il più recente, anche parziale)
  const currentLapByDriver = {}
  Object.entries(lapsByDriver).forEach(([dn, dl]) => {
    currentLapByDriver[dn] = dl.reduce((best, l) => l.lap_number > best.lap_number ? l : best)
  })

  const latestPos = {}, latestInt = {}, currentStint = {}
  positions.forEach(p => {
    if (!latestPos[p.driver_number] || new Date(p.date) > new Date(latestPos[p.driver_number].date))
      latestPos[p.driver_number] = p
  })
  intervals.forEach(i => {
    if (!latestInt[i.driver_number] || new Date(i.date) > new Date(latestInt[i.driver_number].date))
      latestInt[i.driver_number] = i
  })
  stints.forEach(s => {
    if (!currentStint[s.driver_number] || s.stint_number > currentStint[s.driver_number].stint_number)
      currentStint[s.driver_number] = s
  })

  // Giro massimo in sessione (riferimento per il conteggio)
  const maxLap = Object.values(currentLapByDriver).reduce((m, l) => Math.max(m, l.lap_number), 0)

  // Ordine: prima per posizione GPS, poi per numero pilota
  let sorted = Object.values(latestPos)
    .sort((a, b) => a.position - b.position)
    .map(p => ({ posData: p, driver: driverMap[p.driver_number] }))
    .filter(x => x.driver)

  if (!sorted.length && !loading)
    sorted = drivers.map(d => ({ posData: null, driver: d }))

  return (
    <div className="px-4 py-6" style={{ maxWidth: 1400, margin: '0 auto' }}>

      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-white">Timing in Diretta</h1>
            {isLive
              ? <span className="text-[10px] font-bold px-2 py-0.5 rounded animate-pulse" style={{ background: '#e10600', color: '#fff' }}>LIVE</span>
              : session && <span className="text-[10px] px-2 py-0.5 rounded" style={{ background: '#1a1a24', color: '#555' }}>Terminata</span>
            }
          </div>
          {session && (
            <p className="text-sm mt-1" style={{ color: '#555' }}>
              {session.meeting_name}
              <span style={{ color: '#e10600' }}> · {SESSION_LABELS[session.session_type] ?? session.session_type}</span>
              {maxLap > 0 && <span style={{ color: '#2a2a35' }}> · Giro {maxLap}</span>}
            </p>
          )}
        </div>
        <div className="flex items-center gap-3">
          {session && (
            <Link to={`/session/${session.session_key}`} className="text-xs px-3 py-1.5 rounded-lg"
              style={{ background: '#1a1a24', color: '#666', border: '1px solid #252530' }}>
              Sessione →
            </Link>
          )}
          {lastUpdate && (
            <span className="mono text-xs" style={{ color: '#2a2a35' }}>
              ↻ {lastUpdate.toLocaleTimeString('it-IT')}
            </span>
          )}
        </div>
      </div>

      {/* ── Legenda ── */}
      <div className="flex flex-wrap items-center gap-5 mb-4 px-1">
        {[
          { key: 'purple', label: 'Miglior assoluto sessione' },
          { key: 'green',  label: 'Record personale' },
          { key: 'yellow', label: 'Fuori record personale' },
        ].map(({ key, label }) => {
          const s = SECTOR_STYLES[key]
          return (
            <div key={key} className="flex items-center gap-1.5">
              <span className="inline-flex items-center px-1.5 py-0.5 rounded mono text-[10px]"
                style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                00.000
              </span>
              <span className="text-[10px]" style={{ color: '#484858' }}>{label}</span>
            </div>
          )
        })}
        <div className="flex items-center gap-1.5">
          <span className="mono text-[10px] animate-pulse tracking-widest" style={{ color: '#fbbf24' }}>···</span>
          <span className="text-[10px]" style={{ color: '#484858' }}>Settore in corso</span>
        </div>
      </div>

      {/* ── Meteo ── */}
      {session && <Weather sessionKey={session.session_key} isLive={isLive} />}

      {/* ── Tabella ── */}
      {loading ? (
        <div className="text-center py-24" style={{ color: '#444' }}>
          <div className="text-4xl mb-3">📡</div>
          <p className="text-sm">Connessione al timing...</p>
        </div>
      ) : (
        <div className="rounded-xl overflow-x-auto" style={{ border: '1px solid #1a1a24' }}>
          <table className="w-full" style={{ minWidth: 940 }}>
            <thead>
              <tr style={{ background: '#0c0c14', borderBottom: '2px solid #1a1a24' }}>
                {[
                  { h: 'P',       w: 'w-10 pl-4' },
                  { h: 'Pilota',  w: 'px-3 min-w-[130px]' },
                  { h: 'Giro',    w: 'px-2 text-center w-14' },
                  { h: 'Gap',     w: 'px-2 text-right w-24' },
                  { h: 'Int.',    w: 'px-2 text-right w-20' },
                  { h: 'Settore 1', w: 'px-2 text-center w-24', accent: true },
                  { h: 'Settore 2', w: 'px-2 text-center w-24', accent: true },
                  { h: 'Settore 3', w: 'px-2 text-center w-24', accent: true },
                  { h: 'Ultimo giro',  w: 'px-3 text-right w-28' },
                  { h: 'Miglior giro', w: 'px-3 text-right w-28' },
                  { h: 'Vel. (km/h)', w: 'px-2 text-right w-20' },
                  { h: 'Cmp', w: 'px-3 text-center w-14' },
                ].map(({ h, w, accent }) => (
                  <th key={h} className={`py-3 text-[10px] font-semibold uppercase tracking-widest ${w}`}
                    style={{ color: accent ? '#4a2a6a' : '#2a2a3a' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map(({ posData, driver }, i) => {
                const dn = driver.driver_number
                const tc = driver.team_colour ? `#${driver.team_colour}` : '#444'
                const interval = latestInt[dn]
                const currLap  = currentLapByDriver[dn]
                const bestLap  = bestLapByDriver[dn]
                const db       = driverBests[dn] ?? { s1: Infinity, s2: Infinity, s3: Infinity }
                const stint    = currentStint[dn]
                const compound = currLap?.compound ?? stint?.compound
                const cmpStyle = COMPOUND_STYLE[compound]

                // Stato settori del giro attuale
                const hasS1   = !!currLap?.duration_sector_1
                const hasS2   = !!currLap?.duration_sector_2
                const lapDone = !!currLap?.lap_duration

                // Settore attivo in questo momento
                const s1Active = !hasS1 && !lapDone && !!currLap
                const s2Active = hasS1 && !hasS2 && !lapDone
                const s3Active = hasS1 && hasS2 && !lapDone

                const s1 = currLap?.duration_sector_1
                const s2 = currLap?.duration_sector_2
                const s3 = currLap?.duration_sector_3

                // Speed trap dall'ultimo giro completato con dato velocità
                const lapWithSpd = (lapsByDriver[dn] ?? []).filter(l => l.st_speed).slice(-1)[0]
                const spd = lapWithSpd?.st_speed

                const isPitOut = currLap?.is_pit_out_lap

                // Evidenzia riga se settore in corso
                const rowActive = s1Active || s2Active || s3Active

                return (
                  <tr key={dn}
                    style={{ borderBottom: '1px solid #0f0f18', background: rowActive ? '#0c0a14' : 'transparent', transition: 'background 0.2s' }}
                    onMouseEnter={e => { if (!rowActive) e.currentTarget.style.background = '#0d0d18' }}
                    onMouseLeave={e => { if (!rowActive) e.currentTarget.style.background = 'transparent' }}>

                    {/* Posizione */}
                    <td className="py-3.5 pl-4 w-10">
                      <span className="mono font-black text-lg" style={{ color: POS_COLOR[i] ?? '#2a2a38' }}>
                        {posData?.position ?? i + 1}
                      </span>
                    </td>

                    {/* Pilota */}
                    <td className="py-3.5 px-3">
                      <div className="flex items-center gap-2">
                        <div className="w-[3px] h-7 rounded-full shrink-0" style={{ background: tc }} />
                        <div>
                          <div className="font-bold text-sm text-white tracking-wide leading-none">{driver.name_acronym}</div>
                          <div className="text-[9px] mt-0.5" style={{ color: '#2a2a38' }}>{driver.team_name}</div>
                        </div>
                        {isPitOut && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded ml-1"
                            style={{ background: '#1e1000', color: '#f97316', border: '1px solid #3a2000' }}>
                            PIT
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Giro attuale */}
                    <td className="py-3.5 px-2 text-center">
                      <span className="mono text-xs" style={{ color: '#383848' }}>
                        {currLap?.lap_number ?? '—'}
                      </span>
                    </td>

                    {/* Gap al leader */}
                    <td className="py-3.5 px-2 text-right">
                      <span className="mono text-xs font-medium" style={{ color: i === 0 ? '#484858' : '#383848' }}>
                        {i === 0 ? 'LEADER' : (interval?.gap_to_leader ?? '—')}
                      </span>
                    </td>

                    {/* Intervallo al precedente */}
                    <td className="py-3.5 px-2 text-right">
                      <span className="mono text-xs" style={{ color: '#2a2a38' }}>
                        {i === 0 ? '—' : (interval?.interval ?? '—')}
                      </span>
                    </td>

                    {/* Settore 1 */}
                    <SectorCell time={s1} sessionBest={sessionBests.s1} driverBest={db.s1} active={s1Active} />

                    {/* Settore 2 */}
                    <SectorCell time={s2} sessionBest={sessionBests.s2} driverBest={db.s2} active={s2Active} />

                    {/* Settore 3 */}
                    <SectorCell time={s3} sessionBest={sessionBests.s3} driverBest={db.s3} active={s3Active} />

                    {/* Ultimo giro */}
                    <td className="py-3.5 px-3 text-right">
                      <span className="mono font-semibold text-sm text-white">
                        {lapDone ? fmtTime(currLap.lap_duration) : (bestLap ? fmtTime(bestLap.lap_duration) : '—')}
                      </span>
                    </td>

                    {/* Miglior giro */}
                    <td className="py-3.5 px-3 text-right">
                      <span className="mono text-sm" style={{ color: '#a855f7' }}>
                        {bestLap ? fmtTime(bestLap.lap_duration) : '—'}
                      </span>
                    </td>

                    {/* Velocità speed trap */}
                    <td className="py-3.5 px-2 text-right">
                      <span className="mono text-xs" style={{ color: '#383848' }}>
                        {spd ? spd : '—'}
                      </span>
                    </td>

                    {/* Mescola */}
                    <td className="py-3.5 px-3 text-center">
                      {cmpStyle ? (
                        <span className="mono text-[11px] font-black w-6 h-6 rounded inline-flex items-center justify-center"
                          style={{ background: cmpStyle.bg, color: cmpStyle.color }}>
                          {cmpStyle.letter}
                        </span>
                      ) : <span style={{ color: '#1e1e28' }}>—</span>}
                    </td>

                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Nota footer ── */}
      {!loading && (
        <p className="text-center mt-4 text-[10px]" style={{ color: '#1e1e28' }}>
          Dati OpenF1 · Aggiornamento ogni 2.5s · Settori del giro in corso colorati in tempo reale
        </p>
      )}
    </div>
  )
}
