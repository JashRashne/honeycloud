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
    getStats().then(setStats).catch(() => {})
    const t = setInterval(() => getStats().then(setStats).catch(() => {}), 30_000)
    return () => clearInterval(t)
  }, [])

  const totalAttacks = stats?.by_event_type.reduce((s, r) => s + r.count, 0) ?? 0

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      <Header connected={connected} totalAttacks={totalAttacks} newCount={newCount} />

      <main className="max-w-screen-2xl mx-auto px-6 py-6 space-y-6">

        {/* Row 1 — metric cards */}
        <MetricCards stats={stats} attacks={attacks} />

        {/* Row 2 — map + live feed */}
        <div className="grid grid-cols-5 gap-6 items-start">
          <div className="col-span-3"><AttackMap /></div>
          <div className="col-span-2"><LiveFeed attacks={attacks} /></div>
        </div>

        {/* Row 3 — donut + hourly timeline */}
        <div className="grid grid-cols-5 gap-6 items-start">
          <div className="col-span-2"><AttackTypeDonut stats={stats} /></div>
          <div className="col-span-3"><HourlyTimeline stats={stats} /></div>
        </div>

        {/* Row 4 — top IPs + Bi-LSTM */}
        <div className="grid grid-cols-5 gap-6 items-start">
          <div className="col-span-3"><TopIPs /></div>
          <div className="col-span-2"><BiLSTMForecast /></div>
        </div>

        {/* Row 5 — session kill chain */}
        <SessionKillChain />

      </main>
    </div>
  )
}