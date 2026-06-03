import { useState, useEffect, useCallback, useRef } from 'react'
import { openf1 } from '../services/openf1'
import { usePolling } from '../hooks/usePolling'

const FLAG_STYLES = {
  YELLOW: 'bg-yellow-500/20 border-yellow-500/50 text-yellow-300',
  RED: 'bg-red-500/20 border-red-500/50 text-red-300',
  GREEN: 'bg-green-500/20 border-green-500/50 text-green-300',
  BLUE: 'bg-blue-500/20 border-blue-500/50 text-blue-300',
  CHEQUERED: 'bg-zinc-600/30 border-zinc-500/50 text-zinc-300',
  CLEAR: 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400',
}

const CAT_STYLES = {
  SafetyCar: 'bg-orange-500/20 border-orange-500/50 text-orange-300',
  Drs: 'bg-emerald-500/20 border-emerald-500/50 text-emerald-300',
  Message: 'bg-zinc-800/50 border-zinc-700/50 text-zinc-400',
}

const CAT_ICONS = {
  Flag: '🚩',
  SafetyCar: '🚗',
  Drs: '📡',
  Message: '📢',
}

function msgStyle(msg) {
  if (msg.category === 'Flag' && msg.flag) return FLAG_STYLES[msg.flag] ?? FLAG_STYLES.CLEAR
  return CAT_STYLES[msg.category] ?? CAT_STYLES.Message
}

function formatTime(iso) {
  return new Date(iso).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

export default function RaceControl({ sessionKey, isLive, maxHeight = 400 }) {
  const [messages, setMessages] = useState([])
  const bottomRef = useRef(null)

  const fetchMessages = useCallback(async () => {
    try {
      const data = await openf1.raceControl(sessionKey)
      setMessages(data.sort((a, b) => new Date(a.date) - new Date(b.date)))
    } catch (e) {}
  }, [sessionKey])

  useEffect(() => { fetchMessages() }, [sessionKey])
  usePolling(fetchMessages, 5000, !!isLive)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (messages.length === 0) return null

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-xl overflow-hidden flex flex-col">
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between shrink-0">
        <span className="text-sm font-medium text-zinc-300">Race Control</span>
        <span className="text-xs text-zinc-500">{messages.length} messaggi</span>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight }}>
        <div className="p-3 space-y-2">
          {messages.map((msg, i) => (
            <div key={i} className={`border rounded-lg px-3 py-2 text-xs ${msgStyle(msg)}`}>
              <div className="flex items-center justify-between gap-2 mb-0.5">
                <div className="flex items-center gap-1.5">
                  <span>{CAT_ICONS[msg.category] ?? '📢'}</span>
                  <span className="font-semibold uppercase text-[10px] tracking-wide opacity-70">
                    {msg.category}{msg.flag ? ` ${msg.flag}` : ''}
                  </span>
                  {msg.lap_number && <span className="opacity-50">Giro {msg.lap_number}</span>}
                </div>
                <span className="opacity-50 shrink-0 font-mono">{formatTime(msg.date)}</span>
              </div>
              <p className="leading-snug opacity-90">{msg.message}</p>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
