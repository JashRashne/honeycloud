import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { MetricCards } from '../components/MetricCards'
import { LiveFeed } from '../components/LiveFeed'
import { AttackTypeDonut } from '../components/AttackTypeDonut'
import { HourlyTimeline } from '../components/HourlyTimeline'
import { TopIPs } from '../components/TopIPs'
import { BiLSTMForecast } from '../components/BiLSTMForecast'
import { AttackMap } from '../components/AttackMap'
// import { SessionKillChain } from '../components/SessionKillChain'
import { useWebSocket } from '../hooks/useWebSocket'
import { getStats } from '../api/clients'
import type { Stats } from '../types'

export function Dashboard() {
  const { attacks, connected, newCount } = useWebSocket()
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    getStats().then(setStats).catch(() => { })
    const t = setInterval(() => getStats().then(setStats).catch(() => { }), 30_000)
    return () => clearInterval(t)
  }, [newCount])

  const totalAttacks = stats?.by_event_type.reduce((s, r) => s + r.count, 0) ?? 0

  return (
    <AppShell connected={connected} totalAttacks={totalAttacks} newCount={newCount}>
      <div className="page-body">

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 4, borderBottom: '1px solid var(--bdr)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div className="live-dot amber" />
            <div>
              <h1 style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--char)', letterSpacing: '-.01em', lineHeight: 1 }}>Live Dashboard</h1>
              <div className="label" style={{ fontSize: 8, marginTop: 3, color: 'var(--char6)' }}>Real-time attack monitoring</div>
            </div>
          </div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--char5)' }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
          </div>
        </div>

        {/* Metric cards */}
        <MetricCards stats={stats} attacks={attacks} />

        {/* Map + Feed */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 18 }}>
          <AttackMap />
          <LiveFeed attacks={attacks} />
        </div>

        {/* Donut + Hourly */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 18 }}>
          <AttackTypeDonut stats={stats} />
          <HourlyTimeline stats={stats} />
        </div>

        {/* Top IPs + BiLSTM */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 18 }}>
          <TopIPs refreshTrigger={newCount} />
          <BiLSTMForecast refreshTrigger={newCount} />
        </div>

      </div>
    </AppShell>
  )
}