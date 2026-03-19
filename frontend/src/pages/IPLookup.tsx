import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { scoreIP } from '../api/clients'
import type { ScoreResult } from '../types'

const SEV_COLOR: Record<string, string> = {
  CRITICAL: 'text-red-600',
  HIGH:     'text-orange-500',
  MEDIUM:   'text-amber-500',
  LOW:      'text-emerald-600',
}
const SEV_BG: Record<string, string> = {
  CRITICAL: 'bg-red-50 border-red-200',
  HIGH:     'bg-orange-50 border-orange-200',
  MEDIUM:   'bg-amber-50 border-amber-200',
  LOW:      'bg-emerald-50 border-emerald-200',
}
const SEV_BAR: Record<string, string> = {
  CRITICAL: 'bg-red-500',
  HIGH:     'bg-orange-400',
  MEDIUM:   'bg-amber-400',
  LOW:      'bg-emerald-400',
}

function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="w-full bg-stone-100 rounded-full h-2">
      <div
        className={`h-2 rounded-full transition-all duration-700 ${color}`}
        style={{ width: `${(value * 100).toFixed(0)}%` }}
      />
    </div>
  )
}

export function IPLookup() {
  const { ip: routeIP } = useParams<{ ip?: string }>()
  const navigate = useNavigate()

  const [input, setInput]   = useState(routeIP ?? '')
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)

  const lookup = async (ipToScore = input.trim()) => {
    if (!ipToScore) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const r = await scoreIP(ipToScore)
      setResult(r)
      navigate(`/ip/${ipToScore}`, { replace: true })
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Scoring failed')
    } finally {
      setLoading(false)
    }
  }

  // Auto-run if IP came from route
  useState(() => { if (routeIP) lookup(routeIP) })

  return (
    <div className="min-h-screen bg-stone-50 font-sans">
      {/* Mini header */}
      <header className="border-b border-stone-200 bg-white sticky top-0 z-50">
        <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center gap-4">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 text-stone-400 hover:text-stone-700 transition-colors text-sm"
          >
            ← Dashboard
          </button>
          <span className="text-stone-200">|</span>
          <div className="w-5 h-5 bg-red-600 rounded flex items-center justify-center">
            <span className="text-white text-[10px] font-bold">HC</span>
          </div>
          <span className="font-semibold text-stone-900 text-sm tracking-tight">IP Lookup</span>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-10 space-y-8">

        {/* Search bar */}
        <div>
          <h1 className="text-2xl font-bold text-stone-900 mb-1">Threat Intelligence Lookup</h1>
          <p className="text-sm text-stone-400 mb-6">Run the full ML pipeline on any IP — Isolation Forest · XGBoost+RF · Bi-LSTM</p>
          <div className="flex gap-3">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              placeholder="e.g. 45.33.32.156"
              className="flex-1 border border-stone-200 rounded-lg px-4 py-2.5 text-sm font-mono focus:outline-none focus:border-stone-400 bg-white"
            />
            <button
              onClick={() => lookup()}
              disabled={loading || !input.trim()}
              className="px-6 py-2.5 bg-stone-900 text-white text-sm rounded-lg hover:bg-stone-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {loading ? 'Scoring...' : 'Score IP'}
            </button>
          </div>
          {error && (
            <p className="mt-2 text-sm text-red-500 font-mono">{error}</p>
          )}
        </div>

        {/* Loading state */}
        {loading && (
          <div className="bg-white border border-stone-200 rounded-lg p-8 text-center space-y-3">
            <div className="text-stone-400 text-sm font-mono space-y-1">
              <div className="animate-pulse">Running Isolation Forest...</div>
              <div className="animate-pulse" style={{ animationDelay: '0.3s' }}>XGBoost + Random Forest ensemble...</div>
              <div className="animate-pulse" style={{ animationDelay: '0.6s' }}>Bi-LSTM sequence prediction...</div>
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-5">

            {/* Hero card */}
            <div className={`border rounded-lg p-6 ${SEV_BG[result.threat_level]}`}>
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs text-stone-400 uppercase tracking-widest font-semibold mb-1">IP Address</p>
                  <p className="text-2xl font-bold text-stone-900 font-mono">{result.ip}</p>
                  {result.intel_match && (
                    <p className="text-sm text-red-600 mt-1 font-mono">
                      ⚠ {result.intel_match.note} [{result.intel_match.country}]
                    </p>
                  )}
                </div>
                <div className="text-right">
                  <p className={`text-3xl font-bold ${SEV_COLOR[result.threat_level]}`}>
                    {result.threat_level}
                  </p>
                  <p className="text-sm text-stone-400 font-mono mt-1">
                    {(result.anomaly_score * 100).toFixed(1)}% anomaly score
                  </p>
                </div>
              </div>
              <ScoreBar value={result.anomaly_score} color={SEV_BAR[result.threat_level]} />
            </div>

            {/* Two column */}
            <div className="grid grid-cols-2 gap-5">

              {/* Attack classification */}
              <div className="bg-white border border-stone-200 rounded-lg p-5">
                <p className="text-xs text-stone-400 uppercase tracking-widest font-semibold mb-4">
                  Attack Classification
                </p>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-lg font-bold text-stone-900 font-mono">
                    {result.attack_type.replace(/_/g, ' ')}
                  </span>
                  <span className="text-sm text-stone-400 font-mono">
                    {(result.confidence * 100).toFixed(0)}% confidence
                  </span>
                </div>
                <ScoreBar value={result.confidence} color="bg-blue-400" />
                <p className="text-xs text-stone-400 mt-4 mb-2 uppercase tracking-widest font-semibold">
                  MITRE ATT&CK
                </p>
                <div className="space-y-2">
                  {result.mitre.map(m => (
                    <div key={m.technique_id} className="flex items-start gap-2">
                      <span className="text-[10px] font-mono bg-stone-100 text-stone-600 px-1.5 py-0.5 rounded whitespace-nowrap">
                        {m.technique_id}
                      </span>
                      <span className="text-xs text-stone-500">{m.technique_name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bi-LSTM forecast */}
              <div className="bg-white border border-stone-200 rounded-lg p-5">
                <p className="text-xs text-stone-400 uppercase tracking-widest font-semibold mb-4">
                  Bi-LSTM Next Move Forecast
                </p>
                {result.next_moves.length === 0 ? (
                  <p className="text-sm text-stone-300 font-mono">model unavailable</p>
                ) : (
                  <div className="space-y-4">
                    {result.next_moves.map((m, i) => (
                      <div key={m.attack_type}>
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs text-stone-400 font-mono">#{i + 1}</span>
                            <span className="text-sm font-mono text-stone-800">
                              {m.attack_type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span className="text-xs text-stone-400 font-mono">
                            {(m.probability * 100).toFixed(1)}%
                          </span>
                        </div>
                        <ScoreBar value={m.probability} color="bg-violet-500" />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Flow features */}
            <div className="bg-white border border-stone-200 rounded-lg p-5">
              <p className="text-xs text-stone-400 uppercase tracking-widest font-semibold mb-4">
                Flow Feature Breakdown
              </p>
              <div className="grid grid-cols-2 gap-x-8 gap-y-2">
                {Object.entries(result.features).map(([key, val]) => (
                  <div key={key} className="flex items-center justify-between py-1.5 border-b border-stone-50">
                    <span className="text-xs text-stone-400 font-mono">
                      {key.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs text-stone-700 font-mono tabular-nums">
                      {typeof val === 'number' ? val.toFixed(3) : val}
                    </span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  )
}