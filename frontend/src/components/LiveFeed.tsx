import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import type { Attack, Severity } from '../types'

const SEV_COLOR: Record<Severity, string> = { CRITICAL: 'var(--crit)', HIGH: 'var(--high)', MEDIUM: 'var(--med)', LOW: 'var(--low)' }
const SEV_BG: Record<Severity, string> = { CRITICAL: 'var(--crit-bg)', HIGH: 'var(--high-bg)', MEDIUM: 'var(--med-bg)', LOW: 'var(--low-bg)' }
const SEV_CLS: Record<Severity, string> = { CRITICAL: 'chip chip-critical', HIGH: 'chip chip-high', MEDIUM: 'chip chip-medium', LOW: 'chip chip-low' }

const EVENT_EMOJI: Record<string, string> = {
  connect: '🔌', login_failed: '🚫', login_success: '🔓', command: '💻', disconnect: '🔌',
}

function timeAgo(ts: string) {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (d < 60) return `${d}s ago`
  if (d < 3600) return `${Math.floor(d / 60)}m ago`
  return `${Math.floor(d / 3600)}h ago`
}

export function LiveFeed({ attacks }: { attacks: Attack[] }) {
  const navigate = useNavigate()
  const listRef = useRef<HTMLDivElement>(null)
  const prevLen = useRef(0)

  useEffect(() => {
    if (attacks.length > prevLen.current) {
      const first = listRef.current?.firstElementChild as HTMLElement | null
      if (first) {
        first.classList.add('feed-new')
        setTimeout(() => first?.classList.remove('feed-new'), 1000)
      }
    }
    prevLen.current = attacks.length
  }, [attacks])

  return (
    <div className="panel" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="panel-hd">
        <span className="label">Live Attack Feed</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="live-dot" />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--low)', letterSpacing: '.08em' }}>streaming</span>
        </div>
      </div>

      {/* Column headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '24px 1fr 80px 68px 48px', gap: 10, padding: '6px 18px', background: 'var(--surf2)', borderBottom: '1px solid var(--bdr)' }}>
        {['', 'Attacker IP', 'What they did', 'Attack type', 'When'].map((h, i) => (
          <span key={i} className="label" style={{ fontSize: 8, color: 'var(--char6)' }}>{h}</span>
        ))}
      </div>

      <div ref={listRef} style={{ overflowY: 'auto', flex: 1, maxHeight: 460 }}>
        {attacks.length === 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 120, gap: 10 }}>
            <div className="spinner" />
            <span className="label" style={{ color: 'var(--char6)' }}>Waiting for attacks…</span>
          </div>
        )}
        {attacks.map(a => {
          const sev = (a.severity ?? 'LOW') as Severity
          return (
            <div key={a.id} className="row-hover" style={{ display: 'grid', gridTemplateColumns: '24px 1fr 80px 68px 48px', gap: 10, padding: '8px 18px', alignItems: 'center', borderBottom: '1px solid var(--bdr)', borderLeft: '3px solid transparent', transition: 'background .15s, border-left .2s' }}>
              <span style={{ fontSize: 13 }}>{EVENT_EMOJI[a.event_type] ?? '·'}</span>
              <span
                style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--char2)', cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', transition: 'color .15s' }}
                onClick={() => navigate(`/ip/${a.src_ip}`)}
                onMouseEnter={e => (e.target as HTMLElement).style.color = 'var(--amber)'}
                onMouseLeave={e => (e.target as HTMLElement).style.color = 'var(--char2)'}
              >
                {a.src_ip}
              </span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {a.event_type.replace(/_/g, ' ')}
              </span>
              <span className={SEV_CLS[sev]}>{a.attack_type?.replace(/_/g, ' ') ?? '—'}</span>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char6)', whiteSpace: 'nowrap' }}>{timeAgo(a.timestamp)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}