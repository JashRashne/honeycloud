import { useEffect, useState } from 'react'
import { getTopIPs, scoreIP } from '../api/clients'
import type { ScoreResult } from '../types'

const SEV_COLOR: Record<string, string> = {
  CRITICAL: 'text-red-600',
  HIGH:     'text-orange-500',
  MEDIUM:   'text-amber-500',
  LOW:      'text-emerald-600',
}

const SEV_BAR: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH:     'bg-orange-400',
  MEDIUM:   'bg-amber-400',
  LOW:      'bg-emerald-400',
}

export function BiLSTMForecast() {
  const [results, setResults] = useState<ScoreResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIP, setSelectedIP] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { top_ips } = await getTopIPs(3)
        const scores = await Promise.all(top_ips.map(ip => scoreIP(ip.src_ip)))
        setResults(scores)
        if (scores.length > 0) setSelectedIP(scores[0].ip)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [])

  const selected = results.find(r => r.ip === selectedIP)

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">
          Bi-LSTM Next Move Forecast
        </h2>
        <p className="text-[10px] text-stone-400 mt-0.5">Predicted attacker behaviour — top 3 IPs</p>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-48 text-stone-300 text-xs font-mono">
          running inference...
        </div>
      )}

      {!loading && results.length === 0 && (
        <div className="flex items-center justify-center h-48 text-stone-300 text-xs font-mono">
          no data yet
        </div>
      )}

      {!loading && results.length > 0 && (
        <div className="p-4 space-y-4">

          {/* IP selector tabs */}
          <div className="flex gap-1">
            {results.map(r => (
              <button
                key={r.ip}
                onClick={() => setSelectedIP(r.ip)}
                className={`text-[10px] font-mono px-2 py-1 rounded border transition-colors ${
                  r.ip === selectedIP
                    ? 'bg-stone-900 text-white border-stone-900'
                    : 'bg-white text-stone-500 border-stone-200 hover:border-stone-400'
                }`}
              >
                {r.ip}
              </button>
            ))}
          </div>

          {selected && (
            <>
              {/* Anomaly score */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold">Anomaly Score</span>
                  <span className={`text-xs font-bold font-mono ${SEV_COLOR[selected.threat_level]}`}>
                    {selected.threat_level}
                  </span>
                </div>
                <div className="w-full bg-stone-100 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-700 ${SEV_BAR[selected.threat_level]}`}
                    style={{ width: `${(selected.anomaly_score * 100).toFixed(0)}%` }}
                  />
                </div>
                <div className="text-right text-[10px] text-stone-400 font-mono mt-0.5">
                  {(selected.anomaly_score * 100).toFixed(1)}%
                </div>
              </div>

              {/* Current attack type */}
              <div className="flex items-center justify-between py-2 border-y border-stone-100">
                <span className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold">Current Type</span>
                <span className="text-xs font-mono text-stone-700">
                  {selected.attack_type.replace(/_/g, ' ')}
                  <span className="text-stone-400 ml-1">({(selected.confidence * 100).toFixed(0)}%)</span>
                </span>
              </div>

              {/* Next moves */}
              <div>
                <p className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold mb-2">
                  Predicted Next Move
                </p>
                {selected.next_moves.length === 0 && (
                  <p className="text-xs text-stone-300 font-mono">model unavailable</p>
                )}
                {selected.next_moves.map((m, i) => (
                  <div key={m.attack_type} className="mb-2">
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-stone-400 font-mono">#{i + 1}</span>
                        <span className="text-xs font-mono text-stone-700">
                          {m.attack_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span className="text-[10px] font-mono text-stone-500">
                        {(m.probability * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div className="w-full bg-stone-100 rounded-full h-1.5">
                      <div
                        className="h-1.5 rounded-full bg-violet-500 transition-all duration-700"
                        style={{ width: `${(m.probability * 100).toFixed(0)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* MITRE */}
              {selected.mitre.length > 0 && (
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold mb-1.5">
                    MITRE ATT&CK
                  </p>
                  <div className="space-y-1">
                    {selected.mitre.map(m => (
                      <div key={m.technique_id} className="flex items-start gap-2">
                        <span className="text-[10px] font-mono bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded whitespace-nowrap">
                          {m.technique_id}
                        </span>
                        <span className="text-[10px] text-stone-500 leading-4">{m.technique_name}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}