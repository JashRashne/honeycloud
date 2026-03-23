import { useEffect, useState } from 'react'
import { Header } from '../components/Header'
import { MetricCards } from '../components/MetricCards'
import { LiveFeed } from '../components/LiveFeed'
import { AttackTypeDonut } from '../components/AttackTypeDonut'
import { HourlyTimeline } from '../components/HourlyTimeline'
import { TopIPs } from '../components/TopIPs'
import { BiLSTMForecast } from '../components/BiLSTMForecast'
import { AttackMap } from '../components/AttackMap'
import { SessionKillChain } from '../components/SessionKillChain'
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
    <div style={{ minHeight: '100vh', background: 'var(--void)', fontFamily: 'var(--font-display)' }}>
      <Header connected={connected} totalAttacks={totalAttacks} newCount={newCount} />

      <main style={{ maxWidth: 1600, margin: '0 auto', padding: '20px 28px 48px', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Section label */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, paddingBottom: 4 }}>
          <div className="pulse-dot" style={{ width: 5, height: 5 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.2em' }}>
            COMMAND CENTER · REAL-TIME OVERVIEW
          </span>
        </div>

        {/* Row 1 — metric cards */}
        <MetricCards stats={stats} attacks={attacks} />

        {/* Row 2 — map (3fr) + live feed (2fr) */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14 }}>
          <AttackMap />
          <LiveFeed attacks={attacks} />
        </div>

        {/* Row 3 — donut + hourly timeline */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 3fr', gap: 14 }}>
          <AttackTypeDonut stats={stats} />
          <HourlyTimeline stats={stats} />
        </div>

        {/* Row 4 — top IPs (3fr) + Bi-LSTM (2fr) */}
        <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14 }}>
          <TopIPs refreshTrigger={newCount} />
          <BiLSTMForecast refreshTrigger={newCount} />
        </div>

        {/* Row 5 — session kill chain full width */}
        <SessionKillChain refreshTrigger={newCount} />
      </main>
    </div>
  )
}