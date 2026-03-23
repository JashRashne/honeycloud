import { useEffect, useState } from 'react'
import { getTopIPs, scoreIP } from '../api/clients'
import type { ScoreResult } from '../types'

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#FF3B3B',
  HIGH: '#FF8800',
  MEDIUM: '#FBC64C',
  LOW: '#3DDB7A',
}

export function BiLSTMForecast({ refreshTrigger }: { refreshTrigger?: number }) {
  const [results, setResults] = useState<ScoreResult[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedIP, setSelectedIP] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { top_ips } = await getTopIPs(3)
        const scores = await Promise.all(top_ips.map(ip => scoreIP(ip.src_ip)))
        setResults(scores)
        if (scores.length > 0 && !selectedIP) setSelectedIP(scores[0].ip)
      } catch { /* ignore */ }
      finally { setLoading(false) }
    }
    load()
    const t = setInterval(load, 60_000)
    return () => clearInterval(t)
  }, [refreshTrigger])

  const selected = results.find(r => r.ip === selectedIP)

  return (
    <div style={{ background: 'var(--void-2)', border: '1px solid var(--void-4)', borderRadius: 2, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid var(--void-4)',
        background: 'rgba(251,198,76,0.02)',
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', letterSpacing: '0.18em' }}>
          BI-LSTM PREDICTION ENGINE
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', marginTop: 3, opacity: 0.5 }}>
          Forecasted attacker behaviour · top 3 IPs
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: 180 }}>
          <div className="pulse-dot" style={{ width: 6, height: 6 }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bronze-3)' }}>running inference...</span>
        </div>
      )}

      {!loading && results.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bronze-3)' }}>
          no data yet
        </div>
      )}

      {!loading && results.length > 0 && (
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* IP selector tabs */}
          <div style={{ display: 'flex', gap: 4 }}>
            {results.map(r => {
              const active = r.ip === selectedIP
              return (
                <button
                  key={r.ip}
                  onClick={() => setSelectedIP(r.ip)}
                  style={{
                    fontFamily: 'var(--font-mono)', fontSize: 10,
                    padding: '4px 10px', borderRadius: 1, cursor: 'pointer',
                    background: active ? 'rgba(251,198,76,0.1)' : 'transparent',
                    border: active ? '1px solid rgba(251,198,76,0.3)' : '1px solid var(--void-4)',
                    color: active ? 'var(--amber)' : 'var(--bronze-3)',
                    transition: 'all 0.15s',
                  }}
                >
                  {r.ip}
                </button>
              )
            })}
          </div>

          {selected && (
            <>
              {/* Anomaly score */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.14em' }}>
                    ANOMALY SCORE
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
                    color: SEV_COLOR[selected.threat_level],
                  }}>
                    {selected.threat_level} — {(selected.anomaly_score * 100).toFixed(1)}%
                  </span>
                </div>
                <div style={{ background: 'var(--void-4)', borderRadius: 1, height: 5 }}>
                  <div style={{
                    width: `${(selected.anomaly_score * 100).toFixed(0)}%`,
                    height: 5, borderRadius: 1,
                    background: SEV_COLOR[selected.threat_level],
                    boxShadow: `0 0 8px ${SEV_COLOR[selected.threat_level]}66`,
                    transition: 'width 0.7s ease',
                  }} />
                </div>
              </div>

              {/* Current type */}
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '8px 0', borderTop: '1px solid var(--void-4)', borderBottom: '1px solid var(--void-4)',
              }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.14em' }}>
                  CURRENT ATTACK
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--antiquity-2)' }}>
                  {selected.attack_type.replace(/_/g, ' ')}
                  <span style={{ color: 'var(--bronze-3)', marginLeft: 5 }}>
                    ({(selected.confidence * 100).toFixed(0)}%)
                  </span>
                </span>
              </div>

              {/* Predicted next moves */}
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.14em', marginBottom: 10 }}>
                  PREDICTED NEXT MOVE
                </div>
                {selected.next_moves.length === 0 && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bronze-3)' }}>
                    model unavailable
                  </div>
                )}
                {selected.next_moves.map((m, i) => (
                  <div key={m.attack_type} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)' }}>#{i + 1}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--antiquity-2)' }}>
                          {m.attack_type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze)' }}>
                        {(m.probability * 100).toFixed(1)}%
                      </span>
                    </div>
                    <div style={{ background: 'var(--void-4)', borderRadius: 1, height: 4 }}>
                      <div style={{
                        width: `${(m.probability * 100).toFixed(0)}%`,
                        height: 4, borderRadius: 1,
                        background: 'linear-gradient(90deg, var(--bronze), var(--amber))',
                        boxShadow: '0 0 6px rgba(251,198,76,0.3)',
                        transition: 'width 0.7s ease',
                      }} />
                    </div>
                  </div>
                ))}
              </div>

              {/* MITRE */}
              {selected.mitre.length > 0 && (
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.14em', marginBottom: 8 }}>
                    MITRE ATT&CK
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {selected.mitre.map(m => (
                      <div key={m.technique_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span className="mitre-badge">{m.technique_id}</span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', lineHeight: 1.5 }}>
                          {m.technique_name}
                        </span>
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