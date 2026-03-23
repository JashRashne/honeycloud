import { useEffect, useRef } from 'react'
import type { Stats, Attack } from '../types'

interface CardProps {
  label: string
  value: string | number
  sub?: string
  accent: string
  index: number
  mono?: boolean
}

function TacCard({ label, value, sub, accent, index, mono }: CardProps) {
  const prevValRef = useRef<string | number>(value)
  const flashRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prevValRef.current !== value && flashRef.current) {
      flashRef.current.style.animation = 'none'
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      flashRef.current.offsetHeight // reflow
      flashRef.current.style.animation = 'panel-wake 0.5s ease forwards'
    }
    prevValRef.current = value
  }, [value])

  return (
    <div
      ref={flashRef}
      style={{
        background: 'var(--void-2)',
        border: '1px solid var(--void-4)',
        borderTop: `2px solid ${accent}`,
        borderRadius: 2,
        padding: '22px 24px',
        position: 'relative',
        overflow: 'hidden',
        animation: `fade-in-up 0.4s ease ${index * 0.07}s both`,
      }}
    >
      {/* Bg radial */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 120, height: 120,
        background: `radial-gradient(circle, ${accent}12 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.18em', marginBottom: 14 }}>
        {label}
      </div>
      <div style={{
        fontFamily: mono ? 'var(--font-mono)' : 'var(--font-display)',
        fontWeight: 800,
        fontSize: mono ? 24 : 34,
        color: 'var(--antiquity)',
        lineHeight: 1,
        letterSpacing: mono ? '0.01em' : '-0.02em',
        marginBottom: 10,
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bronze-3)' }}>
          {sub}
        </div>
      )}

      {/* Tiny accent line bottom-left */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0,
        width: 40, height: 1,
        background: accent, opacity: 0.4,
      }} />
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
  const successRate = loginFailed + loginSuccess > 0
    ? ((loginSuccess / (loginFailed + loginSuccess)) * 100).toFixed(1) : '0.0'
  const topType = stats?.by_attack_type[0]?.attack_type ?? '—'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
      <TacCard
        label="TOTAL EVENTS"
        value={totalEvents.toLocaleString()}
        sub={`${stats?.by_event_type.length ?? 0} event types active`}
        accent="var(--amber)"
        index={0}
      />
      <TacCard
        label="CRITICAL / HIGH"
        value={`${criticalCount} / ${highCount}`}
        sub="severity distribution"
        accent="var(--critical)"
        index={1}
        mono
      />
      <TacCard
        label="UNIQUE SOURCE IPs"
        value={uniqueIPs.toLocaleString()}
        sub={`${successRate}% login success rate`}
        accent="var(--high)"
        index={2}
      />
      <TacCard
        label="TOP ATTACK TYPE"
        value={topType.replace(/_/g, ' ')}
        sub={`${stats?.by_attack_type[0]?.count ?? 0} events captured`}
        accent="var(--low)"
        index={3}
        mono={topType.length > 10}
      />
    </div>
  )
}