import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTopIPs } from '../api/clients'
import type { TopIP } from '../types'

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#FF3B3B',
  HIGH: '#FF8800',
  MEDIUM: '#FBC64C',
  LOW: '#3DDB7A',
}

function scoreToSeverity(score: number | null): string {
  if (score === null) return 'LOW'
  if (score >= 0.80) return 'CRITICAL'
  if (score >= 0.60) return 'HIGH'
  if (score >= 0.40) return 'MEDIUM'
  return 'LOW'
}

function timeAgo(ts: string) {
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (diff < 60) return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function TopIPs({ refreshTrigger }: { refreshTrigger?: number }) {
  const [ips, setIPs] = useState<TopIP[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const load = () =>
      getTopIPs(10)
        .then(r => { setIPs(r.top_ips); setLoading(false) })
        .catch(() => setLoading(false))
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [refreshTrigger])

  const maxEvents = Math.max(...ips.map(ip => ip.total_events), 1)

  return (
    <div style={{ background: 'var(--void-2)', border: '1px solid var(--void-4)', borderRadius: 2, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid var(--void-4)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(251,198,76,0.02)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', letterSpacing: '0.18em' }}>
          TOP THREAT ACTORS
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)' }}>
          {ips.length} sources
        </span>
      </div>

      {/* Column headers */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
        gap: 12, padding: '5px 18px',
        borderBottom: '1px solid rgba(30,24,16,0.9)',
        background: 'rgba(0,0,0,0.15)',
      }}>
        {['IP / SCORE', 'EVENTS', 'LOGINS', 'ATTACK TYPE', 'LAST SEEN'].map(h => (
          <span key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.14em' }}>{h}</span>
        ))}
      </div>

      <div>
        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bronze-3)' }}>
            loading...
          </div>
        )}
        {!loading && ips.length === 0 && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bronze-3)' }}>
            no data yet
          </div>
        )}
        {ips.map((ip, idx) => {
          const sev = scoreToSeverity(ip.max_anomaly_score)
          const color = SEV_COLOR[sev]
          return (
            <div
              key={ip.src_ip}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr auto',
                gap: 12, padding: '10px 18px',
                alignItems: 'center',
                borderBottom: '1px solid rgba(20,16,10,0.8)',
                transition: 'background 0.15s',
              }}
              className="row-hover"
            >
              {/* IP + rank + score bar */}
              <div style={{ minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', width: 14, flexShrink: 0 }}>
                    {idx + 1}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)', fontSize: 11,
                      color: 'var(--antiquity-2)',
                      cursor: 'pointer',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      transition: 'color 0.15s',
                    }}
                    onClick={() => navigate(`/ip/${ip.src_ip}`)}
                    onMouseEnter={e => (e.target as HTMLElement).style.color = 'var(--amber)'}
                    onMouseLeave={e => (e.target as HTMLElement).style.color = 'var(--antiquity-2)'}
                  >
                    {ip.src_ip}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 8,
                    padding: '1px 5px', borderRadius: 1,
                    background: `${color}10`, color, border: `1px solid ${color}30`,
                    flexShrink: 0,
                  }}>
                    {sev}
                  </span>
                </div>
                {/* Anomaly score bar */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, paddingLeft: 22 }}>
                  <div style={{ flex: 1, background: 'var(--void-4)', borderRadius: 1, height: 2 }}>
                    <div style={{
                      width: `${((ip.max_anomaly_score ?? 0) * 100).toFixed(0)}%`,
                      height: 2, background: color, borderRadius: 1,
                      boxShadow: `0 0 4px ${color}55`,
                      transition: 'width 0.6s ease',
                    }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', minWidth: 26, textAlign: 'right' }}>
                    {ip.max_anomaly_score !== null ? `${(ip.max_anomaly_score * 100).toFixed(0)}%` : '—'}
                  </span>
                </div>
              </div>

              {/* Events */}
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--antiquity)', marginBottom: 3 }}>
                  {ip.total_events.toLocaleString()}
                </div>
                <div style={{ background: 'var(--void-4)', borderRadius: 1, height: 2 }}>
                  <div style={{
                    width: `${(ip.total_events / maxEvents) * 100}%`,
                    height: 2, background: 'var(--bronze)', borderRadius: 1,
                  }} />
                </div>
              </div>

              {/* Login stats */}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                <span style={{ color: 'var(--critical)' }}>{ip.failed_logins}</span>
                <span style={{ color: 'var(--bronze-3)', margin: '0 3px' }}>/</span>
                <span style={{ color: 'var(--low)' }}>{ip.successful_logins}</span>
                <div style={{ fontSize: 9, color: 'var(--bronze-3)', marginTop: 2 }}>{ip.commands} cmds</div>
              </div>

              {/* Attack type */}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ip.top_attack_type?.replace(/_/g, ' ') ?? '—'}
              </div>

              {/* Last seen */}
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', whiteSpace: 'nowrap' }}>
                {timeAgo(ip.last_seen)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}