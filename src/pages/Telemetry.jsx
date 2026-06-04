import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import { openf1 } from '../services/openf1'
import { usePolling } from '../hooks/usePolling'

function fmt(ms) {
  if (!ms) return '--'
  const mins = Math.floor(ms / 60000)
  const secs = Math.floor((ms % 60000) / 1000)
  const mils = Math.round(ms % 1000)
  return `${mins > 0 ? mins + ':' : ''}${String(secs).padStart(mins > 0 ? 2 : 1, '0')}.${String(mils).padStart(3, '0')}`
}

const CHANNELS = [
  { key: 'speed', label: 'Velocità', unit: 'km/h', domain: [0, 360], color: '#e10600' },
  { key: 'throttle', label: 'Gas', unit: '%', domain: [0, 100], color: '#22c55e' },
  { key: 'brake', label: 'Freno', unit: '', domain: [0, 1], color: '#f97316' },
  { key: 'n_gear', label: 'Marcia', unit: '', domain: [0, 8], color: '#a78bfa' },
  { key: 'rpm', label: 'RPM', unit: '', domain: [0, 15000], color: '#60a5fa' },
  { key: 'drs', label: 'DRS', unit: '', domain: [0, 14], color: '#facc15' },
]

function sampleData(arr, n = 250) {
  if (!arr.length) return []
  const step = Math.max(1, Math.floor(arr.length / n))
  return arr.filter((_, i) => i % step === 0).slice(0, n)
}

function buildSingleData(data) {
  return sampleData(data).map((p, i) => ({
    i, t: p.t,
    speed: p.speed, throttle: p.throttle, brake: p.brake,
    n_gear: p.n_gear, rpm: p.rpm, drs: p.drs,
  }))
}

function buildCompareData(data1, data2) {
  const s1 = sampleData(data1)
  const s2 = sampleData(data2)
  const len = Math.min(s1.length, s2.length)
  return Array.from({ length: len }, (_, i) => ({
    i,
    speed_1: s1[i]?.speed, speed_2: s2[i]?.speed,
    throttle_1: s1[i]?.throttle, throttle_2: s2[i]?.throttle,
    brake_1: s1[i]?.brake, brake_2: s2[i]?.brake,
    n_gear_1: s1[i]?.n_gear, n_gear_2: s2[i]?.n_gear,
    rpm_1: s1[i]?.rpm, rpm_2: s2[i]?.rpm,
    drs_1: s1[i]?.drs, drs_2: s2[i]?.drs,
  }))
}

const CHAN_COLORS = {
  speed: '#e10600', throttle: '#22c55e', brake: '#f97316',
  n_gear: '#a78bfa', rpm: '#60a5fa', drs: '#facc15',
}
const COMPARE_COLOR = '#f472b6'

export default function Telemetry() {
  const { sessionKey, driverNumber } = useParams()
  const navigate = useNavigate()

  const [session, setSession] = useState(null)
  const [allDrivers, setAllDrivers] = useState([])
  const [driver, setDriver] = useState(null)
  const [laps, setLaps] = useState([])
  const [selectedLap, setSelectedLap] = useState(null)
  const [carData, setCarData] = useState([])
  const [loadingCar, setLoadingCar] = useState(false)

  const [compareNum, setCompareNum] = useState(null)
  const [compareDriver, setCompareDriver] = useState(null)
  const [compareLaps, setCompareLaps] = useState([])
  const [compareLap, setCompareLap] = useState(null)
  const [compareData, setCompareData] = useState([])
  const [loadingCompare, setLoadingCompare] = useState(false)

  const [activeChannels, setActiveChannels] = useState(['speed', 'throttle', 'brake'])

  useEffect(() => {
    Promise.all([
      openf1.drivers(sessionKey),
      openf1.allLaps(sessionKey),
      fetch(`https://api.openf1.org/v1/sessions?session_key=${sessionKey}`).then(r => r.json()),
    ]).then(([drivers, lapData, sessionData]) => {
      setAllDrivers(drivers)
      const d = drivers.find(d => String(d.driver_number) === String(driverNumber))
      setDriver(d)
      setSession(sessionData[0])
      const dLaps = lapData
        .filter(l => String(l.driver_number) === String(driverNumber) && l.lap_duration)
        .sort((a, b) => a.lap_number - b.lap_number)
      setLaps(dLaps)
      if (dLaps.length > 0) {
        const best = dLaps.reduce((b, l) => l.lap_duration < b.lap_duration ? l : b)
        setSelectedLap(best.lap_number)
      }
    }).catch(console.error)
  }, [sessionKey, driverNumber])

  const fetchCar = useCallback(async () => {
    if (!selectedLap) return
    setLoadingCar(true)
    try {
      const data = await openf1.carData(sessionKey, driverNumber, selectedLap)
      const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date))
      const t0 = sorted[0] ? new Date(sorted[0].date).getTime() : 0
      setCarData(sorted.map(p => ({ ...p, t: +((new Date(p.date).getTime() - t0) / 1000).toFixed(2) })))
    } catch (e) { console.error(e) }
    finally { setLoadingCar(false) }
  }, [sessionKey, driverNumber, selectedLap])

  const isLive = session && new Date(session.date_end) > new Date()
  usePolling(fetchCar, 3000, !!isLive)
  useEffect(() => { fetchCar() }, [selectedLap])

  // Load compare driver laps when compareNum changes
  useEffect(() => {
    if (!compareNum) { setCompareLaps([]); setCompareLap(null); setCompareData([]); return }
    const cd = allDrivers.find(d => String(d.driver_number) === String(compareNum))
    setCompareDriver(cd)
    openf1.laps(sessionKey, compareNum)
      .then(data => {
        const valid = data.filter(l => l.lap_duration).sort((a, b) => a.lap_number - b.lap_number)
        setCompareLaps(valid)
        if (valid.length > 0) {
          const best = valid.reduce((b, l) => l.lap_duration < b.lap_duration ? l : b)
          setCompareLap(best.lap_number)
        }
      }).catch(console.error)
  }, [compareNum, sessionKey, allDrivers])

  // Fetch compare car data when compareLap changes
  useEffect(() => {
    if (!compareNum || !compareLap) return
    setLoadingCompare(true)
    openf1.carData(sessionKey, compareNum, compareLap)
      .then(data => {
        const sorted = [...data].sort((a, b) => new Date(a.date) - new Date(b.date))
        const t0 = sorted[0] ? new Date(sorted[0].date).getTime() : 0
        setCompareData(sorted.map(p => ({ ...p, t: +((new Date(p.date).getTime() - t0) / 1000).toFixed(2) })))
      }).catch(console.error)
      .finally(() => setLoadingCompare(false))
  }, [compareNum, compareLap, sessionKey])

  const comparing = !!compareNum && compareData.length > 0
  const chartData = comparing ? buildCompareData(carData, compareData) : buildSingleData(carData)

  const selectedLapData = laps.find(l => l.lap_number === selectedLap)
  const compareLapData = compareLaps.find(l => l.lap_number === compareLap)
  const teamColor = driver?.team_colour ? `#${driver.team_colour}` : '#ef4444'
  const compareColor = compareDriver?.team_colour ? `#${compareDriver.team_colour}` : COMPARE_COLOR

  const toggleChannel = (key) =>
    setActiveChannels(prev => prev.includes(key) ? prev.filter(k => k !== key) : [...prev, key])

  const otherDrivers = allDrivers.filter(d => String(d.driver_number) !== String(driverNumber))

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <button onClick={() => navigate(-1)} className="text-xs transition-colors hover:text-white" style={{ color: '#555' }}>← Indietro</button>
        {driver && (
          <div className="flex items-center gap-3">
            <div className="w-[3px] h-9 rounded-full" style={{ background: teamColor }} />
            <div>
              <div className="text-white font-bold text-base">{driver.full_name}</div>
              <div className="text-xs mt-0.5" style={{ color: '#484858' }}>{driver.team_name} · #{driver.driver_number}</div>
            </div>
            {isLive && <span className="text-[10px] font-bold px-2 py-0.5 rounded animate-pulse" style={{ background: '#e10600', color: '#fff' }}>LIVE</span>}
          </div>
        )}
      </div>

      {/* Confronto piloti */}
      <div className="rounded-xl p-4 mb-4" style={{ background: '#0c0c14', border: '1px solid #1a1a24' }}>
        <div className="flex flex-wrap gap-5 items-start">
          {/* Driver 1 */}
          <div className="flex-1 min-w-48">
            <div className="flex items-center gap-1.5 mb-2">
              <div className="w-2 h-2 rounded-full" style={{ background: teamColor }} />
              <span className="text-xs font-semibold" style={{ color: teamColor }}>{driver?.name_acronym}</span>
              {selectedLapData && <span className="mono text-xs ml-auto" style={{ color: '#888' }}>{fmt(selectedLapData.lap_duration * 1000)}</span>}
            </div>
            <div className="flex flex-wrap gap-1">
              {laps.map(lap => {
                const isBest = lap.lap_duration === Math.min(...laps.map(l => l.lap_duration))
                const isSelected = selectedLap === lap.lap_number
                return (
                  <button key={lap.lap_number}
                    onClick={() => setSelectedLap(lap.lap_number)}
                    className="px-2 py-1 rounded mono text-xs transition-all"
                    style={{
                      background: isSelected ? '#1e1224' : isBest ? '#150a20' : '#131318',
                      border: `1px solid ${isSelected ? teamColor : isBest ? '#4a1a6a' : '#1e1e28'}`,
                      color: isSelected ? '#fff' : isBest ? '#a855f7' : '#555',
                    }}>
                    {lap.lap_number}{isBest ? '★' : ''}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="self-center text-xs font-bold" style={{ color: '#2a2a35' }}>VS</div>

          {/* Driver 2 */}
          <div className="flex-1 min-w-48">
            <div className="text-xs mb-2" style={{ color: '#484858' }}>Confronta con</div>
            <select
              value={compareNum ?? ''}
              onChange={e => setCompareNum(e.target.value || null)}
              className="w-full rounded-lg px-3 py-1.5 text-sm focus:outline-none"
              style={{ background: '#131318', border: '1px solid #1e1e28', color: '#ccc' }}
            >
              <option value="">— Nessuno —</option>
              {otherDrivers.map(d => (
                <option key={d.driver_number} value={d.driver_number}>{d.name_acronym} · {d.team_name}</option>
              ))}
            </select>

            {compareNum && compareLaps.length > 0 && (
              <div className="mt-2">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: compareColor }} />
                  <span className="text-xs font-semibold" style={{ color: compareColor }}>{compareDriver?.name_acronym}</span>
                  {compareLapData && <span className="mono text-xs ml-auto" style={{ color: compareColor }}>{fmt(compareLapData.lap_duration * 1000)}</span>}
                  {selectedLapData && compareLapData && (() => {
                    const diff = (compareLapData.lap_duration - selectedLapData.lap_duration) * 1000
                    return <span className="mono text-xs" style={{ color: diff > 0 ? '#ef4444' : '#22c55e' }}>{diff > 0 ? '+' : ''}{fmt(Math.abs(diff))}</span>
                  })()}
                </div>
                <div className="flex flex-wrap gap-1">
                  {compareLaps.map(lap => {
                    const isBest = lap.lap_duration === Math.min(...compareLaps.map(l => l.lap_duration))
                    const isSelected = compareLap === lap.lap_number
                    return (
                      <button key={lap.lap_number}
                        onClick={() => setCompareLap(lap.lap_number)}
                        className="px-2 py-1 rounded mono text-xs transition-all"
                        style={{
                          background: isSelected ? '#1a0e1a' : isBest ? '#150a20' : '#131318',
                          border: `1px solid ${isSelected ? compareColor : isBest ? '#4a1a6a' : '#1e1e28'}`,
                          color: isSelected ? '#fff' : isBest ? '#a855f7' : '#555',
                        }}>
                        {lap.lap_number}{isBest ? '★' : ''}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      {selectedLapData && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
          {[
            { label: 'Tempo', value: fmt(selectedLapData.lap_duration * 1000) },
            { label: 'S1', value: selectedLapData.duration_sector_1 ? selectedLapData.duration_sector_1.toFixed(3) : '—' },
            { label: 'S2', value: selectedLapData.duration_sector_2 ? selectedLapData.duration_sector_2.toFixed(3) : '—' },
            { label: 'S3', value: selectedLapData.duration_sector_3 ? selectedLapData.duration_sector_3.toFixed(3) : '—' },
            { label: 'Mescola', value: selectedLapData.compound ?? '—' },
            { label: 'Stint', value: selectedLapData.stint_number ?? '—' },
          ].map(({ label, value }) => (
            <div key={label} className="rounded-lg p-3 text-center" style={{ background: '#0c0c14', border: '1px solid #1a1a24' }}>
              <div className="text-[10px] uppercase tracking-wider mb-1" style={{ color: '#383848' }}>{label}</div>
              <div className="mono font-bold text-sm text-white">{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Channel toggles */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {CHANNELS.map(ch => {
          const active = activeChannels.includes(ch.key)
          return (
            <button key={ch.key}
              onClick={() => toggleChannel(ch.key)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: active ? `${ch.color}18` : '#0c0c14',
                border: `1px solid ${active ? ch.color : '#1a1a24'}`,
                color: active ? ch.color : '#484858',
              }}>
              {ch.label}
            </button>
          )
        })}
      </div>

      {/* Charts */}
      {loadingCar && chartData.length === 0 ? (
        <div className="text-center py-16 text-sm" style={{ color: '#444' }}>Caricamento telemetria...</div>
      ) : chartData.length === 0 ? (
        <div className="text-center py-16 text-sm" style={{ color: '#444' }}>Nessun dato disponibile per questo giro</div>
      ) : (
        <div className="space-y-2">
          {CHANNELS.filter(ch => activeChannels.includes(ch.key)).map(ch => {
            const color1 = ch.color
            return (
              <div key={ch.key} className="rounded-xl p-4" style={{ background: '#0c0c14', border: '1px solid #1a1a24' }}>
                <div className="flex items-center gap-3 mb-3">
                  <span className="text-xs font-bold uppercase tracking-wider" style={{ color: color1 }}>{ch.label}</span>
                  {ch.unit && <span className="text-[10px]" style={{ color: '#383848' }}>{ch.unit}</span>}
                  {comparing && (
                    <div className="flex items-center gap-3 ml-auto">
                      <span className="flex items-center gap-1.5 text-[11px]">
                        <span className="w-5 h-[2px] inline-block rounded" style={{ background: color1 }} />
                        <span style={{ color: color1 }}>{driver?.name_acronym} G{selectedLap}</span>
                      </span>
                      <span className="flex items-center gap-1.5 text-[11px]">
                        <span className="w-5 h-[2px] inline-block rounded opacity-60" style={{ background: compareColor }} />
                        <span style={{ color: compareColor }}>{compareDriver?.name_acronym} G{compareLap}</span>
                      </span>
                    </div>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={100}>
                  <LineChart data={chartData} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#151520" />
                    <XAxis dataKey="i" tick={false} axisLine={false} />
                    <YAxis domain={ch.domain} tick={{ fill: '#383848', fontSize: 9 }} axisLine={false} tickLine={false} />
                    <Tooltip
                      contentStyle={{ background: '#0e0e16', border: '1px solid #1e1e2a', borderRadius: 8, fontSize: 11 }}
                      labelStyle={{ color: '#484858' }}
                      itemStyle={{ fontSize: 11 }}
                      formatter={(v, name) => {
                        const isComp = name.endsWith('_2')
                        const label = isComp ? `${compareDriver?.name_acronym ?? 'P2'} G${compareLap}` : `${driver?.name_acronym ?? 'P1'} G${selectedLap}`
                        return [`${v ?? '—'}${ch.unit}`, label]
                      }}
                    />
                    {comparing ? (
                      <>
                        <Line type="monotone" dataKey={`${ch.key}_1`} stroke={color1} strokeWidth={2} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey={`${ch.key}_2`} stroke={compareColor} strokeWidth={2} strokeDasharray="5 3" dot={false} isAnimationActive={false} />
                      </>
                    ) : (
                      <Line type="monotone" dataKey={ch.key} stroke={color1} strokeWidth={2} dot={false} isAnimationActive={false} />
                    )}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
