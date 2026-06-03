import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { openf1 } from '../services/openf1'

const SESSION_LABELS = {
  Practice: 'Prove Libere',
  Qualifying: 'Qualifiche',
  Race: 'Gara',
  'Sprint Qualifying': 'Sprint Qual.',
  Sprint: 'Sprint',
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
        const sorted = [...data].sort((a, b) => new Date(b.date_start) - new Date(a.date_start))
        setMeetings(sorted)
        if (sorted.length > 0) setExpanded(sorted[0].meeting_key)
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

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' })

  const isPast = (iso) => new Date(iso) < new Date()

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-zinc-400">
      Caricamento calendario...
    </div>
  )

  return (
    <div className="max-w-4xl mx-auto p-4">
      <h1 className="text-2xl font-bold text-white mb-6">
        Stagione F1 <span className="text-red-500">{year}</span>
      </h1>

      <div className="space-y-3">
        {meetings.map((m) => {
          const past = isPast(m.date_end ?? m.date_start)
          const isOpen = expanded === m.meeting_key
          const mSessions = sessions[m.meeting_key] ?? []

          return (
            <div key={m.meeting_key} className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden">
              <button
                className="w-full flex items-center justify-between p-4 hover:bg-zinc-800 transition-colors text-left"
                onClick={() => setExpanded(isOpen ? null : m.meeting_key)}
              >
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 text-sm w-6 text-center font-mono">{m.meeting_key}</span>
                  <div>
                    <div className="font-semibold text-white">{m.meeting_name}</div>
                    <div className="text-sm text-zinc-400">{m.country_name} · {formatDate(m.date_start)}</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {!past && <span className="text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">In arrivo</span>}
                  <span className="text-zinc-500">{isOpen ? '▲' : '▼'}</span>
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-zinc-800 p-4 grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {mSessions.length === 0 ? (
                    <span className="text-zinc-500 text-sm col-span-3">Sessioni non ancora disponibili</span>
                  ) : (
                    mSessions.map(s => (
                      <button
                        key={s.session_key}
                        onClick={() => navigate(`/session/${s.session_key}`)}
                        className="flex flex-col p-3 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors text-left border border-zinc-700 hover:border-red-500"
                      >
                        <span className="text-xs text-red-400 font-medium">{SESSION_LABELS[s.session_type] ?? s.session_type}</span>
                        <span className="text-white text-sm font-semibold mt-1">{s.session_name}</span>
                        <span className="text-zinc-400 text-xs mt-1">{formatDate(s.date_start)}</span>
                      </button>
                    ))
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
