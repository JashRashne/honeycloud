import type { Stats, Attack } from '../types'

const SEVERITY_ORDER = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const

interface Props {
  stats: Stats | null
  attacks: Attack[]
}

function Card({
  label,
  value,
  sub,
  accent,
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'red' | 'amber' | 'emerald' | 'stone'
}) {
  const ring: Record<string, string> = {
    red:     'border-l-red-500',
    amber:   'border-l-amber-400',
    emerald: 'border-l-emerald-500',
    stone:   'border-l-stone-300',
  }
  return (
    <div className={`bg-white border border-stone-200 rounded-lg p-5 border-l-4 ${ring[accent ?? 'stone']}`}>
      <p className="text-xs text-stone-400 uppercase tracking-widest font-semibold mb-2">{label}</p>
      <p className="text-3xl font-bold text-stone-900 tabular-nums leading-none">{value}</p>
      {sub && <p className="text-xs text-stone-400 mt-1.5 font-mono">{sub}</p>}
    </div>
  )
}

export function MetricCards({ stats, attacks }: Props) {
  const totalEvents = stats?.by_event_type.reduce((s, r) => s + r.count, 0) ?? 0

  const criticalCount = stats?.by_severity.find(r => r.severity === 'CRITICAL')?.count ?? 0
  const highCount     = stats?.by_severity.find(r => r.severity === 'HIGH')?.count ?? 0

  const uniqueIPs = new Set(attacks.map(a => a.src_ip)).size

  const loginFailed  = stats?.by_event_type.find(r => r.event_type === 'login_failed')?.count ?? 0
  const loginSuccess = stats?.by_event_type.find(r => r.event_type === 'login_success')?.count ?? 0
  const successRate  = loginFailed + loginSuccess > 0
    ? ((loginSuccess / (loginFailed + loginSuccess)) * 100).toFixed(1)
    : '0.0'

  // Top attack type
  const topType = stats?.by_attack_type[0]?.attack_type ?? '—'

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <Card
        label="Total Events"
        value={totalEvents.toLocaleString()}
        sub={`${stats?.by_event_type.length ?? 0} event types`}
        accent="stone"
      />
      <Card
        label="Critical / High"
        value={`${criticalCount.toLocaleString()} / ${highCount.toLocaleString()}`}
        sub="severity distribution"
        accent="red"
      />
      <Card
        label="Unique Source IPs"
        value={uniqueIPs.toLocaleString()}
        sub={`${successRate}% login success rate`}
        accent="amber"
      />
      <Card
        label="Top Attack Type"
        value={topType.replace(/_/g, ' ')}
        sub={`${stats?.by_attack_type[0]?.count ?? 0} events`}
        accent="emerald"
      />
    </div>
  )
}