import { useState, useEffect, useCallback } from 'react'
import { openf1 } from '../services/openf1'
import { usePolling } from '../hooks/usePolling'

const DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
const windDir = (deg) => deg != null ? DIRS[Math.round(deg / 22.5) % 16] : ''

export default function Weather({ sessionKey, isLive }) {
  const [data, setData] = useState(null)

  const fetch = useCallback(async () => {
    try {
      const res = await openf1.weather(sessionKey)
      if (res.length) setData(res[res.length - 1])
    } catch {}
  }, [sessionKey])

  useEffect(() => { fetch() }, [sessionKey])
  usePolling(fetch, 30000, !!isLive)

  if (!data) return null

  const raining = data.rainfall > 0

  const items = [
    { label: 'Aria', value: data.air_temperature != null ? `${data.air_temperature.toFixed(1)}°` : '—', unit: 'C' },
    { label: 'Pista', value: data.track_temperature != null ? `${data.track_temperature.toFixed(1)}°` : '—', unit: 'C' },
    { label: 'Vento', value: data.wind_speed != null ? `${data.wind_speed.toFixed(1)}` : '—', unit: `m/s ${windDir(data.wind_direction)}` },
    { label: 'Umidità', value: data.humidity != null ? `${data.humidity.toFixed(0)}` : '—', unit: '%' },
    { label: 'Pressione', value: data.pressure != null ? `${data.pressure.toFixed(0)}` : '—', unit: 'hPa' },
    { label: 'Pioggia', value: raining ? data.rainfall.toFixed(1) : '—', unit: raining ? 'mm' : 'Asciutto' },
  ]

  return (
    <div
      className="rounded-xl px-4 py-3 mb-4 flex flex-wrap gap-x-6 gap-y-3 items-center"
      style={{
        background: raining ? '#060d14' : '#0c0c14',
        border: `1px solid ${raining ? '#0e2035' : '#1a1a24'}`,
      }}
    >
      {raining && (
        <div className="flex items-center gap-1.5 mr-2">
          <span className="text-base">🌧</span>
          <span className="text-xs font-semibold" style={{ color: '#60a5fa' }}>Pioggia in pista</span>
        </div>
      )}
      {items.map(({ label, value, unit }) => (
        <div key={label} className="flex items-baseline gap-1">
          <span className="text-xs" style={{ color: '#383848' }}>{label}</span>
          <span className="mono font-bold text-sm text-white">{value}</span>
          <span className="text-[10px]" style={{ color: '#484858' }}>{unit}</span>
        </div>
      ))}
    </div>
  )
}
