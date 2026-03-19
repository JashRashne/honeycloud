import { useEffect, useRef } from 'react'
import type { Attack, Severity } from '../types'
import { useNavigate } from 'react-router-dom'

const SEVERITY_COLOR: Record<Severity, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH:     'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM:   'bg-amber-100 text-amber-700 border-amber-200',
  LOW:      'bg-stone-100 text-stone-500 border-stone-200',
}

const SEVERITY_DOT: Record<Severity, string> = {
  CRITICAL: 'bg-red-500',
  HIGH:     'bg-orange-400',
  MEDIUM:   'bg-amber-400',
  LOW:      'bg-stone-300',
}

const EVENT_ICON: Record<string, string> = {
  connect:       '⟶',
  login_failed:  '✕',
  login_success: '✓',
  command:       '$',
  disconnect:    '⟵',
}

function timeAgo(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60)  return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  return `${Math.floor(diff / 3600)}h ago`
}

interface Props {
  attacks: Attack[]
}

export function LiveFeed({ attacks }: Props) {
  const navigate = useNavigate()
  const listRef = useRef<HTMLDivElement>(null)
  const prevLen  = useRef(0)

  // Flash newest row on update
  useEffect(() => {
    if (attacks.length > prevLen.current && listRef.current) {
      const first = listRef.current.firstElementChild as HTMLElement | null
      if (first) {
        first.style.transition = 'none'
        first.style.background = '#fef9c3'
        requestAnimationFrame(() => {
          first.style.transition = 'background 1.2s ease'
          first.style.background = ''
        })
      }
    }
    prevLen.current = attacks.length
  }, [attacks])

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden flex flex-col h-full">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Live Feed</h2>
        <span className="flex items-center gap-1.5 text-xs text-emerald-600 font-mono">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
          streaming
        </span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2 border-b border-stone-50 text-[10px] font-semibold text-stone-400 uppercase tracking-widest">
        <span>Source IP</span>
        <span>Event</span>
        <span>Type</span>
        <span>Time</span>
      </div>

      {/* Rows */}
      <div ref={listRef} className="overflow-y-auto flex-1 divide-y divide-stone-50" style={{ maxHeight: 420 }}>
        {attacks.length === 0 && (
          <div className="flex items-center justify-center h-24 text-stone-300 text-xs font-mono">
            waiting for events...
          </div>
        )}
        {attacks.map((a) => {
          const sev = (a.severity ?? 'LOW') as Severity
          return (
            <div
              key={a.id}
              className="grid grid-cols-[1fr_auto_auto_auto] gap-2 px-4 py-2.5 items-center hover:bg-stone-50 transition-colors"
            >
              {/* IP + dot */}
              <div className="flex items-center gap-2 min-w-0">
                <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${SEVERITY_DOT[sev]}`} />
                <span className="font-mono text-xs text-stone-700 truncate cursor-pointer hover:text-blue-600 hover:underline" onClick={() => navigate(`/ip/${a.src_ip}`)}>{a.src_ip}</span>
              </div>

              {/* Event type */}
              <div className="flex items-center gap-1">
                <span className="text-stone-400 font-mono text-xs w-4 text-center">
                  {EVENT_ICON[a.event_type] ?? '·'}
                </span>
                <span className="text-xs text-stone-500 font-mono whitespace-nowrap">
                  {a.event_type.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Attack type badge */}
              <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border whitespace-nowrap ${SEVERITY_COLOR[sev]}`}>
                {a.attack_type?.replace(/_/g, ' ') ?? '—'}
              </span>

              {/* Time */}
              <span className="text-[10px] text-stone-400 font-mono whitespace-nowrap">
                {timeAgo(a.timestamp)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}