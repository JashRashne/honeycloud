import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { getTopIPs } from '../api/clients'
import type { TopIP } from '../types'

const SEV_COLOR: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-700 border-red-200',
  HIGH:     'bg-orange-100 text-orange-700 border-orange-200',
  MEDIUM:   'bg-amber-100 text-amber-700 border-amber-200',
  LOW:      'bg-stone-100 text-stone-500 border-stone-200',
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
  if (diff < 60)   return `${diff}s ago`
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export function TopIPs() {
  const [ips, setIPs] = useState<TopIP[]>([])
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

  useEffect(() => {
    const load = () => getTopIPs(10).then(r => { setIPs(r.top_ips); setLoading(false) }).catch(() => setLoading(false))
    load()
    const t = setInterval(load, 30_000)
    return () => clearInterval(t)
  }, [])

  const maxEvents = Math.max(...ips.map(ip => ip.total_events), 1)

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Top Attacking IPs</h2>
        <span className="text-xs text-stone-400 font-mono">{ips.length} sources</span>
      </div>

      {/* Column headers */}
      <div className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-2 border-b border-stone-50 text-[10px] font-semibold text-stone-400 uppercase tracking-widest">
        <span>IP Address</span>
        <span>Events</span>
        <span>Logins</span>
        <span>Attack Type</span>
        <span>Last Seen</span>
      </div>

      <div className="divide-y divide-stone-50">
        {loading && (
          <div className="flex items-center justify-center h-24 text-stone-300 text-xs font-mono">
            loading...
          </div>
        )}
        {!loading && ips.length === 0 && (
          <div className="flex items-center justify-center h-24 text-stone-300 text-xs font-mono">
            no data yet
          </div>
        )}
        {ips.map((ip, idx) => {
          const sev = scoreToSeverity(ip.max_anomaly_score)
          return (
            <div key={ip.src_ip} className="grid grid-cols-[2fr_1fr_1fr_1fr_auto] gap-3 px-4 py-3 items-center hover:bg-stone-50 transition-colors">

              {/* IP + rank + score bar */}
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] text-stone-300 font-mono w-4">{idx + 1}</span>
                  <span className="font-mono text-xs text-stone-800 truncate cursor-pointer hover:text-blue-600 hover:underline" onClick={() => navigate(`/ip/${ip.src_ip}`)}>{ip.src_ip}</span>
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${SEV_COLOR[sev]}`}>
                    {sev}
                  </span>
                </div>
                {/* Anomaly score bar */}
                <div className="flex items-center gap-2 pl-6">
                  <div className="flex-1 bg-stone-100 rounded-full h-1">
                    <div
                      className="h-1 rounded-full transition-all duration-500"
                      style={{
                        width: `${((ip.max_anomaly_score ?? 0) * 100).toFixed(0)}%`,
                        background: sev === 'CRITICAL' ? '#dc2626' : sev === 'HIGH' ? '#ea580c' : sev === 'MEDIUM' ? '#d97706' : '#a8a29e'
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-stone-400 font-mono w-8 text-right">
                    {ip.max_anomaly_score !== null ? (ip.max_anomaly_score * 100).toFixed(0) + '%' : '—'}
                  </span>
                </div>
              </div>

              {/* Events with bar */}
              <div>
                <div className="text-xs font-mono text-stone-700 tabular-nums">{ip.total_events.toLocaleString()}</div>
                <div className="mt-1 w-full bg-stone-100 rounded-full h-1">
                  <div
                    className="h-1 rounded-full bg-blue-400"
                    style={{ width: `${(ip.total_events / maxEvents) * 100}%` }}
                  />
                </div>
              </div>

              {/* Login stats */}
              <div className="text-xs font-mono">
                <span className="text-red-500">{ip.failed_logins}</span>
                <span className="text-stone-300 mx-1">/</span>
                <span className="text-emerald-600">{ip.successful_logins}</span>
                <div className="text-[10px] text-stone-400 mt-0.5">{ip.commands} cmds</div>
              </div>

              {/* Attack type */}
              <div className="text-xs font-mono text-stone-500 truncate">
                {ip.top_attack_type?.replace(/_/g, ' ') ?? '—'}
              </div>

              {/* Last seen */}
              <div className="text-[10px] text-stone-400 font-mono whitespace-nowrap">
                {timeAgo(ip.last_seen)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}