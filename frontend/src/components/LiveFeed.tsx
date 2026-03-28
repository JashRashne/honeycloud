import { useEffect, useRef, useState, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { Link as LinkIcon, ShieldOff, Unlock, Terminal } from 'lucide-react'
import type { Attack, Severity } from '../types'
import { getGeoInfo, isPrivateIP } from '../utils/geo';

const SEV_CLS: Record<Severity, string> = {
  CRITICAL: 'chip chip-critical',
  HIGH: 'chip chip-high',
  MEDIUM: 'chip chip-medium',
  LOW: 'chip chip-low',
}

const EVENT_ICON: Record<string, React.ReactNode> = {
  connect: <LinkIcon size={14} />,
  login_failed: <ShieldOff size={14} />,
  login_success: <Unlock size={14} />,
  command: <Terminal size={14} />,
  disconnect: <LinkIcon size={14} />,
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
  const [locations, setLocations] = useState<Record<string, string>>({})

  // Limit to latest 50 attacks for performance (you can adjust)
  const displayedAttacks = useMemo(() => {
    return [...attacks].slice(0, 50) // Keep only the most recent 50 in memory
  }, [attacks])

  // Fetch locations for new public IPs
  useEffect(() => {
    const uniqueIPs = [...new Set(displayedAttacks.map(a => a.src_ip))]

    getGeoInfo(uniqueIPs).then(({ locations: newLocs }) => {
      if (Object.keys(newLocs).length > 0) {
        setLocations(prev => ({ ...prev, ...newLocs }))
      }
    })
  }, [displayedAttacks])

  // Highlight newest attack
  useEffect(() => {
    if (attacks.length > prevLen.current && listRef.current) {
      const first = listRef.current.firstElementChild as HTMLElement | null
      if (first) {
        first.classList.add('feed-new')
        setTimeout(() => first.classList.remove('feed-new'), 1200)
      }
    }
    prevLen.current = attacks.length
  }, [attacks])

  return (
    <div className="panel" style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100%'
    }}>
      <div className="panel-hd">
        <span className="label">LIVE ATTACK FEED</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="live-dot" />
          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--low)', letterSpacing: '.08em' }}>
            streaming • {attacks.length} total
          </span>
        </div>
      </div>

      {/* Sticky Headers */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '28px 2.4fr 1.5fr 1.1fr 72px',
          gap: '12px',
          padding: '8px 20px',
          background: 'var(--surf2)',
          borderBottom: '1px solid var(--bdr)',
          fontSize: '8px',
          color: 'var(--char6)',
          fontWeight: 600,
          letterSpacing: '.06em',
          textTransform: 'uppercase',
          position: 'sticky',
          top: 0,
          zIndex: 10,
        }}
      >
        <div></div>
        <div>ATTACKER IP + LOCATION</div>
        <div>WHAT THEY DID</div>
        <div>ATTACK TYPE</div>
        <div>WHEN</div>
      </div>

      {/* Scrollable List - FIXED HEIGHT + SCROLL */}
      <div
        ref={listRef}
        style={{
          flex: 1,
          overflowY: 'auto',
          background: 'var(--surf1)',
          minHeight: 0,                    // Important for flex scrolling
          maxHeight: 'calc(10 * 52px)',    // ≈ 10 rows (adjust if your row height changes)
        }}
        className="custom-scroll"
      >
        {displayedAttacks.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            height: '200px',
            gap: 12
          }}>
            <div className="spinner" />
            <span className="label" style={{ color: 'var(--char6)' }}>Waiting for attacks…</span>
          </div>
        ) : (
          displayedAttacks.map((a, index) => {
            const sev = (a.severity ?? 'LOW') as Severity
            const isLocal = isPrivateIP(a.src_ip)
            const location = isLocal ? 'Local Network' : (locations[a.src_ip] || 'Resolving…')

            return (
              <div
                key={a.id || index} // fallback to index if id is missing
                className="row-hover feed-row"
                style={{
                  display: 'grid',
                  gridTemplateColumns: '28px 2.4fr 1.5fr 1.1fr 72px',
                  gap: '12px',
                  padding: '11px 20px',
                  alignItems: 'center',
                  borderBottom: '1px solid var(--bdr)',
                  minHeight: '52px',           // Consistent row height
                }}
              >
                {/* Icon */}
                <div style={{ color: 'var(--char5)', display: 'flex', justifyContent: 'center' }}>
                  {EVENT_ICON[a.event_type] ?? '·'}
                </div>

                {/* IP + Location */}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: '11.5px',
                      color: 'var(--char2)',
                      cursor: 'pointer',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => navigate(`/ip/${a.src_ip}`)}
                    onMouseEnter={e => (e.currentTarget.style.color = 'var(--amber)')}
                    onMouseLeave={e => (e.currentTarget.style.color = 'var(--char2)')}
                  >
                    {a.src_ip}
                  </div>
                  <div
                    style={{
                      fontSize: '9px',
                      color: isLocal ? 'var(--char5)' : 'var(--char6)',
                      fontFamily: 'var(--mono)',
                      marginTop: '1px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {location}
                  </div>
                </div>

                {/* What they did */}
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '9.5px',
                    color: 'var(--char5)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {a.event_type.replace(/_/g, ' ')}
                </div>

                {/* Attack type */}
                <div className={SEV_CLS[sev]}>
                  {a.attack_type?.replace(/_/g, ' ') ?? '—'}
                </div>

                {/* Time */}
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: '9px',
                    color: 'var(--char6)',
                    whiteSpace: 'nowrap',
                    textAlign: 'right',
                  }}
                >
                  {timeAgo(a.timestamp)}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}