import { useEffect, useState } from 'react'
import { getTopIPs, scoreIP } from '../api/clients'
import type { ScoreResult } from '../types'

const SEV_COL: Record<string, string> = { CRITICAL: 'var(--crit)', HIGH: 'var(--high)', MEDIUM: 'var(--med)', LOW: 'var(--low)' }
const SEV_CLS: Record<string, string> = { CRITICAL: 'chip chip-critical', HIGH: 'chip chip-high', MEDIUM: 'chip chip-medium', LOW: 'chip chip-low' }

export function BiLSTMForecast({ refreshTrigger }: { refreshTrigger?: number }) {
  const [results, setR] = useState<ScoreResult[]>([])
  const [loading, setL] = useState(true)
  const [sel, setSel] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { top_ips } = await getTopIPs(3)
        const scores = await Promise.all(top_ips.map((ip: { src_ip: string }) => scoreIP(ip.src_ip)))
        setR(scores); if (scores.length > 0 && !sel) setSel(scores[0].ip)
      } catch { } finally { setL(false) }
    }
    load(); const t = setInterval(load, 60_000); return () => clearInterval(t)
  }, [refreshTrigger])

  const s = results.find(r => r.ip === sel)

  return (
    <div className="panel au d1">
      <div className="panel-hd">
        <div>
          <div className="label">AI Prediction Engine</div>
          <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--char6)', marginTop: 2 }}>What will the attacker try next?</div>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, height: 200 }}>
          <div className="spinner" /><span className="label" style={{ color: 'var(--char6)' }}>Running AI models…</span>
        </div>
      )}

      {!loading && results.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 180 }}>
          <span className="label" style={{ color: 'var(--char6)' }}>No data yet</span>
        </div>
      )}

      {!loading && results.length > 0 && (
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* IP tabs */}
          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
            {results.map(r => {
              const act = r.ip === sel
              return (
                <button key={r.ip} onClick={() => setSel(r.ip)} style={{ fontFamily: 'var(--mono)', fontSize: 9, padding: '4px 10px', borderRadius: 6, cursor: 'pointer', background: act ? 'var(--amber-p)' : 'transparent', border: `1px solid ${act ? 'var(--amber)' : 'var(--bdr)'}`, color: act ? 'var(--amber)' : 'var(--char5)', fontWeight: act ? 600 : 400, transition: 'all .15s' }}>
                  {r.ip}
                </button>
              )
            })}
          </div>

          {s && (
            <>
              {/* Risk score — big visual */}
              <div style={{ background: 'var(--surf2)', borderRadius: 8, padding: '16px', border: '1px solid var(--bdr)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span className="label" style={{ fontSize: 8 }}>Risk Score</span>
                  <span className={SEV_CLS[s.threat_level]}>{s.threat_level} — {(s.anomaly_score * 100).toFixed(1)}%</span>
                </div>
                <div className="bar-track" style={{ height: 10 }}>
                  <div className="bar-fill" style={{ width: `${(s.anomaly_score * 100).toFixed(0)}%`, background: SEV_COL[s.threat_level] }} />
                </div>
              </div>

              {/* Current vs predicted */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: '12px', background: 'var(--surf2)', borderRadius: 8, border: '1px solid var(--bdr)' }}>
                  <div className="label" style={{ fontSize: 8, marginBottom: 6 }}>Currently doing</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--char2)' }}>{s.attack_type.replace(/_/g, ' ')}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char6)', marginTop: 3 }}>{(s.confidence * 100).toFixed(0)}% confidence</div>
                </div>
                <div style={{ padding: '12px', background: 'var(--amber-p2)', borderRadius: 8, border: '1px solid rgba(232,150,12,.15)' }}>
                  <div className="label" style={{ fontSize: 8, marginBottom: 6, color: 'var(--amber)' }}>Most likely next</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--char2)' }}>{s.next_moves[0]?.attack_type.replace(/_/g, ' ') ?? 'Unknown'}</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char6)', marginTop: 3 }}>{((s.next_moves[0]?.probability ?? 0) * 100).toFixed(0)}% probability</div>
                </div>
              </div>

              {/* Probability bars */}
              {s.next_moves.length > 0 && (
                <div>
                  <div className="label" style={{ fontSize: 8, marginBottom: 10 }}>Predicted next moves</div>
                  {s.next_moves.map((m, i) => (
                    <div key={m.attack_type} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char6)', width: 16 }}>#{i + 1}</span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--char3)' }}>{m.attack_type.replace(/_/g, ' ')}</span>
                        </div>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--amber)', fontWeight: 600 }}>{(m.probability * 100).toFixed(1)}%</span>
                      </div>
                      <div className="bar-track" style={{ height: 5 }}>
                        <div className="bar-fill" style={{ width: `${(m.probability * 100).toFixed(0)}%`, background: `linear-gradient(90deg,var(--amber),var(--amber-l))` }} />
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* MITRE */}
              {s.mitre.length > 0 && (
                <div>
                  <div className="label" style={{ fontSize: 8, marginBottom: 8 }}>MITRE ATT&CK techniques</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                    {s.mitre.map(m => (
                      <div key={m.technique_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                        <span className="mitre-badge">{m.technique_id}</span>
                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char5)', lineHeight: 1.5 }}>{m.technique_name}</span>
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