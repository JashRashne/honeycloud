import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTopIPs } from '../api/clients'
import type { TopIP } from '../types'

const SEV_COL: Record<string, string> = { CRITICAL: 'var(--crit)', HIGH: 'var(--high)', MEDIUM: 'var(--med)', LOW: 'var(--low)' }
const SEV_CLS: Record<string, string> = { CRITICAL: 'chip chip-critical', HIGH: 'chip chip-high', MEDIUM: 'chip chip-medium', LOW: 'chip chip-low' }
const SEV_BG: Record<string, string> = { CRITICAL: 'var(--crit-bg)', HIGH: 'var(--high-bg)', MEDIUM: 'var(--med-bg)', LOW: 'var(--low-bg)' }

function toSev(s: number | null): string { if (!s) return 'LOW'; if (s >= .80) return 'CRITICAL'; if (s >= .60) return 'HIGH'; if (s >= .40) return 'MEDIUM'; return 'LOW' }
function timeAgo(ts: string) {
  const d = Math.floor((Date.now() - new Date(ts).getTime()) / 1000)
  if (d < 60) return `${d}s`; if (d < 3600) return `${Math.floor(d / 60)}m`; if (d < 86400) return `${Math.floor(d / 3600)}h`; return `${Math.floor(d / 86400)}d`
}

export function TopIPs({ refreshTrigger }: { refreshTrigger?: number }) {
  const [ips, setIPs] = useState<TopIP[]>([])
  const [loading, setL] = useState(true)
  const [expanded, setExp] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const load = () => getTopIPs(10).then(r => { setIPs(r.top_ips); setL(false) }).catch(() => setL(false))
    load(); const t = setInterval(load, 30_000); return () => clearInterval(t)
  }, [refreshTrigger])

  const maxEv = Math.max(...ips.map(ip => ip.total_events), 1)

  return (
    <div className="panel au">
      <div className="panel-hd">
        <span className="label">Top Attacking IPs</span>
        <span className="label" style={{ color: 'var(--char6)' }}>{ips.length} sources</span>
      </div>

      {/* Headers */}
      <div style={{ display: 'grid', gridTemplateColumns: '28px 2fr 1fr 1fr 90px 60px', gap: 12, padding: '6px 20px', background: 'var(--surf2)', borderBottom: '1px solid var(--bdr)' }}>
        {['#', 'IP Address', 'Events', 'Logins', 'Attack Type', 'Last seen'].map(h => (
          <span key={h} className="label" style={{ fontSize: 8, color: 'var(--char6)' }}>{h}</span>
        ))}
      </div>

      {loading && (
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 44 }} />)}
        </div>
      )}

      {!loading && ips.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 80 }}>
          <span className="label" style={{ color: 'var(--char6)' }}>No data yet</span>
        </div>
      )}

      {ips.map((ip, idx) => {
        const sev = toSev(ip.max_anomaly_score)
        const col = SEV_COL[sev]
        const isExp = expanded === ip.src_ip
        return (
          <div key={ip.src_ip}>
            <div
              className="row-hover"
              onClick={() => setExp(isExp ? null : ip.src_ip)}
              style={{ display: 'grid', gridTemplateColumns: '28px 2fr 1fr 1fr 90px 60px', gap: 12, padding: '11px 20px', alignItems: 'center', borderBottom: isExp ? 'none' : '1px solid var(--bdr)', cursor: 'pointer', background: isExp ? SEV_BG[sev] : undefined, borderLeft: `3px solid ${isExp ? col : 'transparent'}`, transition: 'all .15s' }}
            >
              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--char6)' }}>{idx + 1}</span>

              {/* IP + score */}
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <span
                    style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--char2)', cursor: 'pointer', transition: 'color .15s' }}
                    onClick={e => { e.stopPropagation(); navigate(`/ip/${ip.src_ip}`) }}
                    onMouseEnter={e => (e.target as HTMLElement).style.color = 'var(--amber)'}
                    onMouseLeave={e => (e.target as HTMLElement).style.color = 'var(--char2)'}
                  >{ip.src_ip}</span>
                  <span className={SEV_CLS[sev]}>{sev}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <div className="bar-track" style={{ flex: 1, height: 3, maxWidth: 100 }}>
                    <div className="bar-fill" style={{ width: `${((ip.max_anomaly_score ?? 0) * 100).toFixed(0)}%`, background: col }} />
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--char6)' }}>
                    {ip.max_anomaly_score !== null ? `${(ip.max_anomaly_score * 100).toFixed(0)}% risk` : '—'}
                  </span>
                </div>
              </div>

              {/* Events */}
              <div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--char)', marginBottom: 3 }}>{ip.total_events.toLocaleString()}</div>
                <div className="bar-track" style={{ height: 2 }}><div className="bar-fill" style={{ width: `${(ip.total_events / maxEv) * 100}%`, background: 'var(--amber)' }} /></div>
              </div>

              {/* Logins */}
              <div style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>
                <span style={{ color: 'var(--crit)' }}>{ip.failed_logins}</span>
                <span style={{ color: 'var(--char6)', margin: '0 3px' }}>·</span>
                <span style={{ color: 'var(--low)' }}>{ip.successful_logins}</span>
                <div style={{ fontSize: 9, color: 'var(--char6)', marginTop: 2 }}>{ip.commands} cmds run</div>
              </div>

              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char4)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {ip.top_attack_type?.replace(/_/g, ' ') ?? '—'}
              </div>
              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char6)' }}>{timeAgo(ip.last_seen)}</div>
            </div>

            {/* Expanded row */}
            {isExp && (
              <div style={{ padding: '12px 20px 16px 64px', background: SEV_BG[sev], borderBottom: '1px solid var(--bdr)', borderLeft: `3px solid ${col}` }}>
                <div style={{ display: 'flex', gap: 40, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Total events', val: ip.total_events.toLocaleString() },
                    { label: 'Failed logins', val: ip.failed_logins.toString() },
                    { label: 'Successful logins', val: ip.successful_logins.toString() },
                    { label: 'Commands run', val: ip.commands.toString() },
                  ].map(s => (
                    <div key={s.label}>
                      <div className="label" style={{ fontSize: 7, marginBottom: 3 }}>{s.label}</div>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--char)', letterSpacing: '-.01em' }}>{s.val}</div>
                    </div>
                  ))}
                  <button onClick={() => navigate(`/ip/${ip.src_ip}`)} className="btn-primary" style={{ alignSelf: 'center', padding: '8px 18px', fontSize: 12, marginLeft: 'auto' }}>
                    Full Dossier →
                  </button>
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}