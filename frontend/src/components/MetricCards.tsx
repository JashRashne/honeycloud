import { useEffect, useRef } from 'react'
import type { Stats, Attack } from '../types'

interface CardProps {
  label: string; value: string; sub?: string; delta?: string; deltaUp?: boolean
  accent: string; icon: string; idx: number; spark?: number[]
}

function Card({ label, value, sub, delta, deltaUp, accent, icon, idx, spark }: CardProps) {
  const cardRef = useRef<HTMLDivElement>(null)
  const prevRef = useRef(value)

  useEffect(() => {
    if (prevRef.current !== value && cardRef.current) {
      cardRef.current.style.outline = `2px solid ${accent}`
      cardRef.current.style.outlineOffset = '-2px'
      setTimeout(() => { if (cardRef.current) { cardRef.current.style.outline = ''; cardRef.current.style.outlineOffset = '' } }, 700)
    }
    prevRef.current = value
  }, [value, accent])

  const maxSpark = spark ? Math.max(...spark, 1) : 1

  return (
    <div ref={cardRef} className="mc au" style={{ animationDelay: `${idx * .07}s`, transition: 'outline .15s' }}>
      <div className="mc-bar" style={{ background: accent }} />
      {/* Bg glow */}
      <div style={{ position: 'absolute', top: -20, right: -20, width: 100, height: 100, borderRadius: '50%', background: `${accent}14`, pointerEvents: 'none' }} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div className="label">{label}</div>
        <span style={{ fontSize: 18, opacity: .55 }}>{icon}</span>
      </div>

      <div className="mc-val" key={value}>{value}</div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <div>
          {sub && <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--char5)', marginTop: 2 }}>{sub}</div>}
          {delta && (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 6, fontFamily: 'var(--mono)', fontSize: 9, padding: '2px 7px', borderRadius: 99, background: deltaUp ? 'var(--low-bg)' : 'var(--crit-bg)', color: deltaUp ? 'var(--low)' : 'var(--crit)', border: `1px solid ${deltaUp ? 'var(--low-b)' : 'var(--crit-b)'}` }}>
              {deltaUp ? '↑' : '↓'} {delta}
            </div>
          )}
        </div>

        {/* Mini sparkline */}
        {spark && spark.length > 0 && (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 28 }}>
            {spark.map((v, i) => (
              <div key={i} style={{ width: 4, height: `${Math.max(8, (v / maxSpark) * 28)}px`, background: accent, borderRadius: '1px 1px 0 0', opacity: .5 + i / spark.length * .5 }} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function MetricCards({ stats, attacks }: { stats: Stats | null; attacks: Attack[] }) {
  const totalEvents = stats?.by_event_type.reduce((s, r) => s + r.count, 0) ?? 0
  const criticalCount = stats?.by_severity.find(r => r.severity === 'CRITICAL')?.count ?? 0
  const highCount = stats?.by_severity.find(r => r.severity === 'HIGH')?.count ?? 0
  const uniqueIPs = new Set(attacks.map(a => a.src_ip)).size
  const loginFailed = stats?.by_event_type.find(r => r.event_type === 'login_failed')?.count ?? 0
  const loginSuccess = stats?.by_event_type.find(r => r.event_type === 'login_success')?.count ?? 0
  const successRate = loginFailed + loginSuccess > 0 ? ((loginSuccess / (loginFailed + loginSuccess)) * 100).toFixed(1) : '0.0'
  const topType = stats?.by_attack_type[0]?.attack_type?.replace(/_/g, ' ') ?? '—'

  // Mini spark data from hourly
  const spark = (stats?.hourly_24h ?? []).slice(-8).map(r => r.count)

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
      <Card label="Total Events" value={totalEvents.toLocaleString()} sub={`${stats?.by_event_type.length ?? 0} attack types seen`} accent="var(--amber)" icon="⚡" idx={0} spark={spark} />
      <Card label="Critical / High" value={`${criticalCount} / ${highCount}`} sub="by severity level" accent="var(--crit)" icon="🚨" idx={1} delta={criticalCount > 0 ? `${criticalCount} critical` : undefined} deltaUp={false} />
      <Card label="Unique Attackers" value={uniqueIPs.toLocaleString()} sub={`${successRate}% broke in successfully`} accent="var(--high)" icon="👤" idx={2} />
      <Card label="Top Attack" value={topType} sub={`${stats?.by_attack_type[0]?.count ?? 0} attempts`} accent="var(--low)" icon="🎯" idx={3} />
    </div>
  )
}