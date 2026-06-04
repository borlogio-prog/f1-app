import { useState, useEffect, useCallback, useRef } from 'react'
import { openf1 } from '../services/openf1'
import { usePolling } from '../hooks/usePolling'

const FLAG_STYLE = {
  YELLOW: { bg: '#1a1400', border: '#3a2e00', color: '#f59e0b', dot: '#f59e0b' },
  RED: { bg: '#1a0500', border: '#3a0e00', color: '#ef4444', dot: '#ef4444' },
  GREEN: { bg: '#001a08', border: '#003a12', color: '#22c55e', dot: '#22c55e' },
  BLUE: { bg: '#00081a', border: '#00163a', color: '#60a5fa', dot: '#60a5fa' },
  CHEQUERED: { bg: '#111118', border: '#1e1e2a', color: '#d4d4d8', dot: '#d4d4d8' },
  CLEAR: { bg: '#0c0c14', border: '#1a1a24', color: '#888', dot: '#555' },
}

const CAT_STYLE = {
  SafetyCar: { bg: '#1a0e00', border: '#3a2000', color: '#f97316', dot: '#f97316' },
  Drs: { bg: '#001a0e', border: '#003a1e', color: '#34d399', dot: '#34d399' },
  Message: { bg: '#0c0c14', border: '#1a1a24', color: '#888', dot: '#484858' },
}

const CAT_IT = { Flag: 'Bandiera', SafetyCar: 'Safety Car', Drs: 'DRS', Message: 'Messaggio' }
const FLAG_IT = {
  YELLOW: 'Gialla', RED: 'Rossa', GREEN: 'Verde', BLUE: 'Blu',
  CHEQUERED: 'a Scacchi', CLEAR: 'Pista Libera', BLACK: 'Nera',
  'BLACK AND WHITE': 'Bianca e Nera',
}

const TRANSLATIONS = [
  [/DRS ENABLED/gi, 'DRS Abilitato'],
  [/DRS DISABLED/gi, 'DRS Disabilitato'],
  [/SAFETY CAR DEPLOYED/gi, 'Safety Car in pista'],
  [/SAFETY CAR IN THIS LAP/gi, 'Safety Car rientra in questo giro'],
  [/SAFETY CAR PERIOD ENDED/gi, 'Fine periodo Safety Car'],
  [/VIRTUAL SAFETY CAR DEPLOYED/gi, 'Virtual Safety Car in pista'],
  [/VIRTUAL SAFETY CAR ENDING/gi, 'Virtual Safety Car in chiusura'],
  [/VIRTUAL SAFETY CAR PERIOD ENDED/gi, 'Fine periodo Virtual Safety Car'],
  [/TRACK CLEAR/gi, 'Pista libera'],
  [/RED FLAG/gi, 'Bandiera rossa'],
  [/CHEQUERED FLAG/gi, 'Bandiera a scacchi'],
  [/GREEN FLAG/gi, 'Via libera'],
  [/YELLOW FLAG/gi, 'Bandiera gialla'],
  [/BLUE FLAG/gi, 'Bandiera blu'],
  [/BLACK AND WHITE FLAG/gi, 'Bandiera bianca e nera'],
  [/BLACK FLAG/gi, 'Bandiera nera'],
  [/(\d+) SECOND TIME PENALTY/gi, 'Penalità $1 secondi'],
  [/DRIVE[ -]THROUGH PENALTY/gi, 'Penalità Drive Through'],
  [/STOP AND GO PENALTY/gi, 'Penalità Stop and Go'],
  [/UNDER INVESTIGATION/gi, 'Sotto investigazione'],
  [/NO FURTHER INVESTIGATION(?: IS NECESSARY)?/gi, 'Nessuna ulteriore indagine'],
  [/INCIDENT NOTED/gi, 'Incidente segnalato'],
  [/REPRIMAND(ED)?/gi, 'Ammonizione'],
  [/RETIREMENT/gi, 'Ritiro'],
  [/RACE DIRECTOR (NOTE|INFORMATION)/gi, 'Nota Direttore di Gara'],
  [/STEWARDS? DECISION/gi, 'Decisione Commissari'],
  [/CAR (\d+)/gi, 'Auto $1'],
  [/LAP (\d+)/gi, 'Giro $1'],
  [/SECTOR (\d+)/gi, 'Settore $1'],
  [/PIT LANE/gi, 'Corsia box'],
  [/FORMATION LAP/gi, 'Giro di formazione'],
  [/RACE SUSPENDED/gi, 'Gara sospesa'],
  [/RACE RESTART/gi, 'Ripartenza gara'],
  [/RACE RESUMED/gi, 'Gara ripresa'],
  [/RACE ABANDONED/gi, 'Gara annullata'],
  [/WARNING/gi, 'Avvertimento'],
  [/INFRINGEMENT/gi, 'Infrazione'],
  [/COLLISION/gi, 'Collisione'],
  [/UNSAFE RELEASE/gi, 'Rilascio non sicuro'],
  [/SPEEDING IN THE PIT LANE/gi, 'Eccesso velocità in corsia box'],
  [/START DELAYED/gi, 'Partenza ritardata'],
]

function translate(text) {
  if (!text) return text
  let r = text
  for (const [p, t] of TRANSLATIONS) r = r.replace(p, t)
  return r
}

function getStyle(msg) {
  if (msg.category === 'Flag' && msg.flag) return FLAG_STYLE[msg.flag] ?? FLAG_STYLE.CLEAR
  return CAT_STYLE[msg.category] ?? CAT_STYLE.Message
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
    } catch {}
  }, [sessionKey])

  useEffect(() => { fetchMessages() }, [sessionKey])
  usePolling(fetchMessages, 5000, !!isLive)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  if (!messages.length) return null

  return (
    <div className="rounded-xl overflow-hidden flex flex-col" style={{ border: '1px solid #1a1a24' }}>
      <div className="px-4 py-3 flex items-center justify-between shrink-0" style={{ background: '#0c0c14', borderBottom: '1px solid #1a1a24' }}>
        <span className="text-sm font-semibold text-white">Direzione Gara</span>
        <span className="mono text-xs" style={{ color: '#383848' }}>{messages.length}</span>
      </div>

      <div className="overflow-y-auto" style={{ maxHeight }}>
        <div className="p-2.5 space-y-1.5">
          {messages.map((msg, i) => {
            const s = getStyle(msg)
            const catLabel = CAT_IT[msg.category] ?? msg.category
            const flagLabel = msg.flag ? ` ${FLAG_IT[msg.flag] ?? msg.flag}` : ''

            return (
              <div key={i}
                className="rounded-lg px-3 py-2.5"
                style={{ background: s.bg, border: `1px solid ${s.border}` }}>
                <div className="flex items-center justify-between gap-2 mb-1">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: s.dot }} />
                    <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: s.color }}>
                      {catLabel}{flagLabel}
                    </span>
                    {msg.lap_number && (
                      <span className="text-[10px]" style={{ color: '#383848' }}>· Giro {msg.lap_number}</span>
                    )}
                  </div>
                  <span className="mono text-[10px] shrink-0" style={{ color: '#383848' }}>
                    {formatTime(msg.date)}
                  </span>
                </div>
                <p className="text-xs leading-relaxed" style={{ color: s.color === '#888' ? '#666' : `${s.color}cc` }}>
                  {translate(msg.message)}
                </p>
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>
      </div>
    </div>
  )
}
