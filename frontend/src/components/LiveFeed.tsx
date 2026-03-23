import { useEffect, useRef } from 'react'
import type { Attack, Severity } from '../types'
import { useNavigate } from 'react-router-dom'

const SEV_COLOR: Record<Severity, string> = {
  CRITICAL: 'var(--critical)',
  HIGH: 'var(--high)',
  MEDIUM: 'var(--amber)',
  LOW: 'var(--low)',
}

const EVENT_GLYPH: Record<string, string> = {
  connect: '→',
  login_failed: '✕',
  login_success: '✓',
  command: '$',
  disconnect: '←',
}

function timeAgo(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return `${diff}s`
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  return `${Math.floor(diff / 3600)}h`
}

interface Props { attacks: Attack[] }

export function LiveFeed({ attacks }: Props) {
  const navigate = useNavigate()
  const listRef = useRef<HTMLDivElement>(null)
  const prevLen = useRef(0)
  const topRowRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (attacks.length > prevLen.current) {
      // Flash the top new row
      const first = listRef.current?.firstElementChild as HTMLElement | null
      if (first) {
        first.style.background = 'rgba(251,198,76,0.07)'
        first.style.borderLeft = '2px solid var(--amber)'
        setTimeout(() => {
          if (first) {
            first.style.background = ''
            first.style.borderLeft = ''
          }
        }, 800)
      }
    }
    prevLen.current = attacks.length
  }, [attacks])

  return (
    <div style={{
      background: 'var(--void-2)',
      border: '1px solid var(--void-4)',
      borderRadius: 2,
      overflow: 'hidden',
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Header */}
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid var(--void-4)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(251,198,76,0.02)',
        flexShrink: 0,
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', letterSpacing: '0.18em' }}>
          FORENSIC LEDGER
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <div className="pulse-dot" style={{ width: 5, height: 5 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--amber)', letterSpacing: '0.1em' }}>
            STREAMING
          </span>
        </div>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '22px 1fr 60px 70px 32px',
        gap: 8,
        padding: '5px 18px',
        borderBottom: '1px solid rgba(30,24,16,0.9)',
        background: 'rgba(0,0,0,0.2)',
        flexShrink: 0,
      }}>
        {['', 'SOURCE IP', 'EVENT', 'TYPE', 'AGO'].map((h, i) => (
          <span key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.14em' }}>{h}</span>
        ))}
      </div>

      {/* Rows */}
      <div ref={listRef} style={{ overflowY: 'auto', flex: 1, maxHeight: 420 }}>
        {attacks.length === 0 && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            height: 80, gap: 8,
          }}>
            <div className="pulse-dot" style={{ width: 4, height: 4, background: 'var(--bronze-3)', animationName: 'none', opacity: 0.4 }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bronze-3)' }}>
              awaiting events...
            </span>
          </div>
        )}
        {attacks.map((a) => {
          const sev = (a.severity ?? 'LOW') as Severity
          const color = SEV_COLOR[sev]
          return (
            <div
              key={a.id}
              style={{
                display: 'grid',
                gridTemplateColumns: '22px 1fr 60px 70px 32px',
                gap: 8,
                padding: '7px 18px',
                alignItems: 'center',
                borderBottom: '1px solid rgba(20,16,10,0.7)',
                transition: 'background 0.3s, border-left 0.3s',
                borderLeft: '2px solid transparent',
              }}
              className="row-hover"
            >
              {/* Severity dot */}
              <div style={{
                width: 4, height: 4, borderRadius: '50%',
                background: color,
                boxShadow: `0 0 5px ${color}`,
              }} />

              {/* IP */}
              <div
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 11,
                  color: 'var(--antiquity-2)',
                  cursor: 'pointer', overflow: 'hidden',
                  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  transition: 'color 0.15s',
                }}
                onClick={() => navigate(`/ip/${a.src_ip}`)}
                onMouseEnter={e => (e.target as HTMLElement).style.color = 'var(--amber)'}
                onMouseLeave={e => (e.target as HTMLElement).style.color = 'var(--antiquity-2)'}
              >
                {a.src_ip}
              </div>

              {/* Event type */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bronze-3)', width: 10, textAlign: 'center' }}>
                  {EVENT_GLYPH[a.event_type] ?? '·'}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.event_type.replace(/_/g, ' ')}
                </span>
              </div>

              {/* Attack type badge */}
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 8,
                padding: '2px 5px', borderRadius: 1,
                background: `${color}10`, color, border: `1px solid ${color}30`,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {a.attack_type?.replace(/_/g, ' ') ?? '—'}
              </span>

              {/* Time ago */}
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', whiteSpace: 'nowrap', textAlign: 'right' }}>
                {timeAgo(a.timestamp)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}