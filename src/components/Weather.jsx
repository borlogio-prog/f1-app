import { useState, useEffect, useCallback } from 'react'
import { openf1 } from '../services/openf1'
import { usePolling } from '../hooks/usePolling'

const WIND_DIRS = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW']
const windDir = (deg) => deg != null ? WIND_DIRS[Math.round(deg / 22.5) % 16] : ''

export default function Weather({ sessionKey, isLive }) {
  const [data, setData] = useState(null)

  const fetchWeather = useCallback(async () => {
    try {
      const res = await openf1.weather(sessionKey)
      if (res.length > 0) setData(res[res.length - 1])
    } catch (e) {}
  }, [sessionKey])

  useEffect(() => { fetchWeather() }, [sessionKey])
  usePolling(fetchWeather, 30000, !!isLive)

  if (!data) return null

  const raining = data.rainfall > 0

  const items = [
    { icon: '🌡', label: 'Aria', value: data.air_temperature != null ? `${data.air_temperature.toFixed(1)}°C` : '--' },
    { icon: '🛣', label: 'Pista', value: data.track_temperature != null ? `${data.track_temperature.toFixed(1)}°C` : '--' },
    { icon: '💨', label: 'Vento', value: data.wind_speed != null ? `${data.wind_speed.toFixed(1)} m/s ${windDir(data.wind_direction)}` : '--' },
    { icon: '💧', label: 'Umidità', value: data.humidity != null ? `${data.humidity.toFixed(0)}%` : '--' },
    { icon: '🌧', label: 'Pioggia', value: raining ? `${data.rainfall} mm` : 'Asciutto' },
    { icon: '📊', label: 'Pressione', value: data.pressure != null ? `${data.pressure.toFixed(0)} hPa` : '--' },
  ]

  return (
    <div className={`border rounded-xl p-4 mb-4 transition-colors ${raining ? 'bg-blue-950/40 border-blue-800/50' : 'bg-zinc-900 border-zinc-800'}`}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xs text-zinc-500 uppercase tracking-wider">Meteo in pista</span>
        {raining && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Pioggia</span>}
      </div>
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {items.map(({ icon, label, value }) => (
          <div key={label} className="flex items-center gap-1.5">
            <span className="text-base leading-none">{icon}</span>
            <div>
              <div className="text-zinc-500 text-xs">{label}</div>
              <div className="text-white text-sm font-semibold">{value}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
