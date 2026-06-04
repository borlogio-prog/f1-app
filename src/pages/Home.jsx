import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { openf1 } from '../services/openf1'

const SESSION_LABELS = {
  Practice: 'PL', Qualifying: 'Q', Race: 'Gara',
  'Sprint Qualifying': 'SQ', Sprint: 'Sprint',
}
const SESSION_COLORS = {
  Practice: '#2a2a3a', Qualifying: '#2a1f00', Race: '#2a0000',
  'Sprint Qualifying': '#1a1a2a', Sprint: '#1a0a2a',
}
const SESSION_TEXT = {
  Practice: '#888', Qualifying: '#f59e0b', Race: '#e10600',
  'Sprint Qualifying': '#a78bfa', Sprint: '#c084fc',
}

const FLAGS = {
  'Australia': '🇦🇺', 'Bahrain': '🇧🇭', 'Saudi Arabia': '🇸🇦',
  'Japan': '🇯🇵', 'China': '🇨🇳', 'United States': '🇺🇸',
  'Italy': '🇮🇹', 'Monaco': '🇲🇨', 'Spain': '🇪🇸', 'Canada': '🇨🇦',
  'Austria': '🇦🇹', 'Great Britain': '🇬🇧', 'United Kingdom': '🇬🇧',
  'Hungary': '🇭🇺', 'Belgium': '🇧🇪', 'Netherlands': '🇳🇱',
  'Azerbaijan': '🇦🇿', 'Singapore': '🇸🇬', 'Mexico': '🇲🇽',
  'Brazil': '🇧🇷', 'Qatar': '🇶🇦', 'UAE': '🇦🇪', 'Abu Dhabi': '🇦🇪',
}

function getFlag(country) {
  if (!country) return '🏁'
  for (const [k, v] of Object.entries(FLAGS)) {
    if (country.toLowerCase().includes(k.toLowerCase())) return v
  }
  return '🏁'
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' })
}

export default function Home() {
  const [meetings, setMeetings] = useState([])
  const [sessions, setSessions] = useState({})
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(null)
  const navigate = useNavigate()
  const year = new Date().getFullYear()

  useEffect(() => {
    openf1.meetings(year)
      .then(data => {
        const sorted = [...data].sort((a, b) => new Date(a.date_start) - new Date(b.date_start))
        setMeetings(sorted)
        // Auto-apri il prossimo GP o l'ultimo passato
        const next = sorted.find(m => new Date(m.date_end ?? m.date_start) > new Date())
        const last = sorted.filter(m => new Date(m.date_end ?? m.date_start) <= new Date()).pop()
        if (next) setExpanded(next.meeting_key)
        else if (last) setExpanded(last.meeting_key)
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [year])

  useEffect(() => {
    if (!expanded || sessions[expanded]) return
    openf1.sessions(expanded)
      .then(data => setSessions(prev => ({ ...prev, [expanded]: data })))
      .catch(console.error)
  }, [expanded])

  if (loading) return (
    <div className="flex items-center justify-center h-64" style={{ color: '#444' }}>
      <div className="text-center">
        <div className="text-4xl mb-3">⏱</div>
        <p>Caricamento calendario...</p>
      </div>
    </div>
  )

  const now = new Date()

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      <div className="flex items-baseline gap-3 mb-8">
        <h1 className="text-2xl font-bold text-white">Stagione</h1>
        <span className="text-2xl font-bold" style={{ color: '#e10600' }}>{year}</span>
        <span className="text-sm ml-auto" style={{ color: '#444' }}>{meetings.length} gran premi</span>
      </div>

      <div className="space-y-2">
        {meetings.map((m, idx) => {
          const isPast = new Date(m.date_end ?? m.date_start) < now
          const isNext = !isPast && meetings.filter(x => new Date(x.date_end ?? x.date_start) >= now)[0]?.meeting_key === m.meeting_key
          const isOpen = expanded === m.meeting_key
          const mSessions = sessions[m.meeting_key] ?? []

          return (
            <div key={m.meeting_key}>
              <button
                className="w-full text-left transition-all"
                onClick={() => setExpanded(isOpen ? null : m.meeting_key)}
                style={{
                  background: isOpen ? '#12121a' : isNext ? '#12101a' : 'transparent',
                  border: `1px solid ${isNext ? '#2a1a3a' : isOpen ? '#1e1e2a' : 'transparent'}`,
                  borderRadius: isOpen ? '12px 12px 0 0' : 12,
                  padding: '12px 16px',
                }}
              >
                <div className="flex items-center gap-4">
                  <span className="text-lg w-6 text-center" style={{ opacity: isPast ? 0.4 : 1 }}>
                    {getFlag(m.country_name)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span
                        className="font-semibold text-sm"
                        style={{ color: isPast ? '#555' : isNext ? '#fff' : '#ccc' }}
                      >
                        {m.meeting_name}
                      </span>
                      {isNext && (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded" style={{ background: '#e10600', color: '#fff' }}>
                          PROSSIMO
                        </span>
                      )}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#444' }}>
                      {m.country_name} · {formatDate(m.date_start)}
                      {m.date_end && m.date_end !== m.date_start ? ` – ${formatDate(m.date_end)}` : ''}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono" style={{ color: '#333' }}>R{idx + 1}</span>
                    <span style={{ color: '#333', fontSize: 10 }}>{isOpen ? '▲' : '▼'}</span>
                  </div>
                </div>
              </button>

              {isOpen && (
                <div
                  style={{
                    background: '#12121a',
                    border: '1px solid #1e1e2a',
                    borderTop: 'none',
                    borderRadius: '0 0 12px 12px',
                    padding: '12px 16px 16px',
                  }}
                >
                  {mSessions.length === 0 ? (
                    <p className="text-xs" style={{ color: '#444' }}>Sessioni non ancora disponibili</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {mSessions.map(s => {
                        const sType = s.session_type
                        return (
                          <button
                            key={s.session_key}
                            onClick={() => navigate(`/session/${s.session_key}`)}
                            className="flex flex-col items-start px-3 py-2 rounded-lg transition-all hover:brightness-125"
                            style={{
                              background: SESSION_COLORS[sType] ?? '#1a1a24',
                              border: `1px solid ${SESSION_TEXT[sType] ?? '#333'}22`,
                              minWidth: 80,
                            }}
                          >
                            <span className="font-bold text-xs" style={{ color: SESSION_TEXT[sType] ?? '#888' }}>
                              {SESSION_LABELS[sType] ?? sType}
                            </span>
                            <span className="text-[10px] mt-0.5" style={{ color: '#555' }}>
                              {formatDate(s.date_start)}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
