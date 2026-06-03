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
  { key: 'speed', label: 'Velocità', unit: 'km/h', domain: [0, 360] },
  { key: 'throttle', label: 'Gas', unit: '%', domain: [0, 100] },
  { key: 'brake', label: 'Freno', unit: '', domain: [0, 1] },
  { key: 'n_gear', label: 'Marcia', unit: '', domain: [0, 8] },
  { key: 'rpm', label: 'RPM', unit: '', domain: [0, 15000] },
  { key: 'drs', label: 'DRS', unit: '', domain: [0, 14] },
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
  speed: '#ef4444', throttle: '#22c55e', brake: '#f97316',
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
    <div className="max-w-6xl mx-auto p-4">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate(-1)} className="text-zinc-400 hover:text-white transition-colors">← Indietro</button>
        {driver && (
          <div className="flex items-center gap-3">
            <div className="w-2 h-10 rounded-full" style={{ backgroundColor: teamColor }} />
            <div>
              <div className="text-white font-bold text-lg">{driver.full_name}</div>
              <div className="text-zinc-400 text-sm">{driver.team_name} · #{driver.driver_number}</div>
            </div>
            {isLive && <span className="bg-red-600 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">LIVE</span>}
          </div>
        )}
      </div>

      {/* Two-driver comparison bar */}
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 mb-4">
        <div className="flex flex-wrap gap-4 items-start">
          {/* Driver 1 */}
          <div className="flex-1 min-w-40">
            <div className="text-xs text-zinc-500 uppercase mb-2 flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: teamColor }} />
              {driver?.name_acronym}
            </div>
            <div className="flex flex-wrap gap-1">
              {laps.map(lap => {
                const isBest = lap.lap_duration === Math.min(...laps.map(l => l.lap_duration))
                return (
                  <button key={lap.lap_number}
                    onClick={() => setSelectedLap(lap.lap_number)}
                    className={`px-2 py-1 rounded text-xs font-mono transition-colors border
                      ${selectedLap === lap.lap_number ? 'border-red-500 bg-red-900/30 text-white'
                        : isBest ? 'border-purple-500/60 bg-purple-900/20 text-purple-300'
                          : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-white'}`}>
                    G{lap.lap_number}{isBest ? '★' : ''}
                  </button>
                )
              })}
            </div>
            {selectedLapData && (
              <div className="mt-2 text-xs text-zinc-400 font-mono">
                {fmt(selectedLapData.lap_duration * 1000)}
              </div>
            )}
          </div>

          <div className="flex items-center self-center text-zinc-600 font-bold text-lg">VS</div>

          {/* Driver 2 selector */}
          <div className="flex-1 min-w-40">
            <div className="text-xs text-zinc-500 uppercase mb-2">Confronta con</div>
            <select
              value={compareNum ?? ''}
              onChange={e => setCompareNum(e.target.value || null)}
              className="bg-zinc-800 border border-zinc-700 text-white rounded-lg px-3 py-1.5 text-sm w-full focus:outline-none focus:border-red-500"
            >
              <option value="">— Nessuno —</option>
              {otherDrivers.map(d => (
                <option key={d.driver_number} value={d.driver_number}>
                  {d.name_acronym} · {d.team_name}
                </option>
              ))}
            </select>

            {compareNum && compareLaps.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {compareLaps.map(lap => {
                  const isBest = lap.lap_duration === Math.min(...compareLaps.map(l => l.lap_duration))
                  return (
                    <button key={lap.lap_number}
                      onClick={() => setCompareLap(lap.lap_number)}
                      className={`px-2 py-1 rounded text-xs font-mono transition-colors border
                        ${compareLap === lap.lap_number ? 'border-pink-500 bg-pink-900/30 text-white'
                          : isBest ? 'border-purple-500/60 bg-purple-900/20 text-purple-300'
                            : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:text-white'}`}>
                      G{lap.lap_number}{isBest ? '★' : ''}
                    </button>
                  )
                })}
                {compareLapData && (
                  <div className="w-full mt-1 text-xs font-mono" style={{ color: compareColor }}>
                    {fmt(compareLapData.lap_duration * 1000)}
                    {selectedLapData && compareLapData && (
                      <span className="text-zinc-500 ml-2">
                        {(() => {
                          const diff = (compareLapData.lap_duration - selectedLapData.lap_duration) * 1000
                          return diff > 0 ? `+${fmt(diff)}` : `-${fmt(Math.abs(diff))}`
                        })()}
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stat cards */}
      {selectedLapData && (
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
          {[
            { label: 'Tempo', value: fmt(selectedLapData.lap_duration * 1000), color: teamColor },
            { label: 'S1', value: selectedLapData.duration_sector_1 ? selectedLapData.duration_sector_1.toFixed(3) + 's' : '--', color: teamColor },
            { label: 'S2', value: selectedLapData.duration_sector_2 ? selectedLapData.duration_sector_2.toFixed(3) + 's' : '--', color: teamColor },
            { label: 'S3', value: selectedLapData.duration_sector_3 ? selectedLapData.duration_sector_3.toFixed(3) + 's' : '--', color: teamColor },
            { label: 'Mescola', value: selectedLapData.compound ?? '--', color: teamColor },
            { label: 'Stint', value: selectedLapData.stint_number ?? '--', color: teamColor },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-center">
              <div className="text-zinc-500 text-xs">{label}</div>
              <div className="font-mono font-semibold mt-1 text-sm" style={{ color }}>{value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Channel toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {CHANNELS.map(ch => (
          <button key={ch.key}
            onClick={() => toggleChannel(ch.key)}
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors
              ${activeChannels.includes(ch.key) ? 'text-white' : 'border-zinc-700 bg-zinc-900 text-zinc-500'}`}
            style={activeChannels.includes(ch.key) ? {
              borderColor: CHAN_COLORS[ch.key],
              backgroundColor: `${CHAN_COLORS[ch.key]}22`,
              color: CHAN_COLORS[ch.key],
            } : {}}>
            {ch.label}
          </button>
        ))}
      </div>

      {/* Charts */}
      {loadingCar && chartData.length === 0 ? (
        <div className="text-zinc-400 text-center py-16">Caricamento telemetria...</div>
      ) : chartData.length === 0 ? (
        <div className="text-zinc-500 text-center py-16">Nessun dato disponibile per questo giro</div>
      ) : (
        <div className="space-y-3">
          {CHANNELS.filter(ch => activeChannels.includes(ch.key)).map(ch => {
            const color1 = CHAN_COLORS[ch.key]
            return (
              <div key={ch.key} className="bg-zinc-900 border border-zinc-800 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm font-medium" style={{ color: color1 }}>{ch.label}</span>
                  {ch.unit && <span className="text-xs text-zinc-500">{ch.unit}</span>}
                  {comparing && (
                    <div className="flex items-center gap-3 ml-auto text-xs">
                      <span className="flex items-center gap-1">
                        <span className="w-4 h-0.5 inline-block rounded" style={{ backgroundColor: color1 }} />
                        <span style={{ color: color1 }}>{driver?.name_acronym} G{selectedLap}</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="w-4 h-0.5 inline-block rounded border-dashed border-t-2" style={{ borderColor: compareColor }} />
                        <span style={{ color: compareColor }}>{compareDriver?.name_acronym} G{compareLap}</span>
                      </span>
                    </div>
                  )}
                </div>
                <ResponsiveContainer width="100%" height={110}>
                  <LineChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" />
                    <XAxis dataKey="i" tick={false} />
                    <YAxis domain={ch.domain} tick={{ fill: '#71717a', fontSize: 10 }} />
                    <Tooltip
                      contentStyle={{ backgroundColor: '#18181b', border: '1px solid #3f3f46', borderRadius: 8 }}
                      labelStyle={{ color: '#a1a1aa', fontSize: 11 }}
                      itemStyle={{ fontSize: 12 }}
                      formatter={(v, name) => {
                        const isComp = name.endsWith('_2')
                        const label = isComp
                          ? `${compareDriver?.name_acronym ?? 'P2'} G${compareLap}`
                          : `${driver?.name_acronym ?? 'P1'} G${selectedLap}`
                        return [`${v ?? '--'}${ch.unit}`, label]
                      }}
                    />
                    {comparing ? (
                      <>
                        <Line type="monotone" dataKey={`${ch.key}_1`} stroke={color1} strokeWidth={1.5} dot={false} isAnimationActive={false} />
                        <Line type="monotone" dataKey={`${ch.key}_2`} stroke={compareColor} strokeWidth={1.5} strokeDasharray="4 2" dot={false} isAnimationActive={false} />
                      </>
                    ) : (
                      <Line type="monotone" dataKey={ch.key} stroke={color1} strokeWidth={1.5} dot={false} isAnimationActive={false} />
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
