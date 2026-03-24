import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AppShell } from '../components/AppShell'
import { scoreIP } from '../api/clients'
import type { ScoreResult } from '../types'

const SEV_COL: Record<string, string> = { CRITICAL: 'var(--crit)', HIGH: 'var(--high)', MEDIUM: 'var(--med)', LOW: 'var(--low)' }
const SEV_BG: Record<string, string> = { CRITICAL: 'var(--crit-bg)', HIGH: 'var(--high-bg)', MEDIUM: 'var(--med-bg)', LOW: 'var(--low-bg)' }
const SEV_B: Record<string, string> = { CRITICAL: 'var(--crit-b)', HIGH: 'var(--high-b)', MEDIUM: 'var(--med-b)', LOW: 'var(--low-b)' }
const SEV_CLS: Record<string, string> = { CRITICAL: 'chip chip-critical', HIGH: 'chip chip-high', MEDIUM: 'chip chip-medium', LOW: 'chip chip-low' }

function Bar({ value, color, h = 6 }: { value: number; color: string; h?: number }) {
  return (
    <div className="bar-track" style={{ height: h }}>
      <div className="bar-fill" style={{ width: `${Math.min(value * 100, 100).toFixed(0)}%`, background: color }} />
    </div>
  )
}

const STEPS = ['Checking for anomalies…', 'Classifying attack type…', 'Predicting next moves…']

export function IPLookup() {
  const { ip: routeIP } = useParams<{ ip?: string }>()
  const navigate = useNavigate()
  const [input, setInput] = useState(routeIP ?? '')
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [loading, setL] = useState(false)
  const [error, setErr] = useState<string | null>(null)
  const [step, setStep] = useState(0)

  const lookup = async (ip = input.trim()) => {
    if (!ip) return
    setL(true); setErr(null); setResult(null); setStep(0)
    const sid = setInterval(() => setStep(s => Math.min(s + 1, 2)), 850)
    try {
      const r = await scoreIP(ip); setResult(r); navigate(`/ip/${ip}`, { replace: true })
    } catch (e: any) { setErr(e?.response?.data?.detail ?? 'Could not score that IP — check the format and try again') }
    finally { clearInterval(sid); setL(false); setStep(0) }
  }

  useState(() => { if (routeIP) lookup(routeIP) })

  const sColor = result ? SEV_COL[result.threat_level] : 'var(--amber)'
  const sBg = result ? SEV_BG[result.threat_level] : 'transparent'
  const sB = result ? SEV_B[result.threat_level] : 'transparent'

  return (
    <AppShell>
      <div className="page-body" style={{ maxWidth: 960 }}>

        {/* Page header */}
        <div style={{ borderBottom: '1px solid var(--bdr)', paddingBottom: 16 }}>
          <div className="label" style={{ color: 'var(--char6)', marginBottom: 8 }}>IP Inspector</div>
          <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, color: 'var(--char)', letterSpacing: '-.02em', marginBottom: 4 }}>
            Check any IP address
          </h1>
          <div className="label" style={{ color: 'var(--char6)', fontSize: 8 }}>
            Our AI scores risk, classifies the attack type, and predicts what they'll do next
          </div>
        </div>

        {/* Search */}
        <div className="panel au" style={{ padding: 22 }}>
          <div className="label" style={{ marginBottom: 10, fontSize: 8 }}>Enter an IP address to investigate</div>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              className="hc-input"
              type="text" value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && lookup()}
              placeholder="e.g. 45.33.32.156"
            />
            <button className="btn-primary" onClick={() => lookup()} disabled={loading || !input.trim()} style={{ whiteSpace: 'nowrap', minWidth: 130 }}>
              {loading ? 'Analysing…' : 'Investigate →'}
            </button>
          </div>
          {error && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--crit)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              ⚠ {error}
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && (
          <div className="panel au" style={{ padding: 40, textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
              <div className="spinner" style={{ width: 48, height: 48 }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {STEPS.map((s, i) => (
                <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'center' }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: step >= i ? 'var(--low)' : 'var(--cream-3)', transition: 'background .3s', flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: step >= i ? 'var(--char2)' : 'var(--char6)', transition: 'color .3s' }}>{s}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="au" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Hero */}
            <div style={{ background: sBg, border: `1px solid ${sB}`, borderLeft: `4px solid ${sColor}`, borderRadius: 10, padding: '24px 28px', boxShadow: `0 4px 24px ${sColor}12` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div className="label" style={{ marginBottom: 8, fontSize: 8 }}>IP Address Being Investigated</div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 30, fontWeight: 500, color: 'var(--char)', letterSpacing: '.02em', lineHeight: 1 }}>{result.ip}</div>
                  {result.intel_match && (
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--crit)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      ⚠ {result.intel_match.note} [{result.intel_match.country}]
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div className="label" style={{ marginBottom: 6, fontSize: 8 }}>Danger Level</div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 42, color: sColor, lineHeight: 1, letterSpacing: '-.02em' }}>
                    {result.threat_level}
                  </div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--char5)', marginTop: 4 }}>
                    {(result.anomaly_score * 100).toFixed(1)}% risk score
                  </div>
                </div>
              </div>
              <Bar value={result.anomaly_score} color={sColor} h={8} />
            </div>

            {/* Two columns */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

              {/* What they're doing */}
              <div className="panel" style={{ padding: 22 }}>
                <div className="label" style={{ marginBottom: 16, fontSize: 8 }}>What they're doing</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--char)', letterSpacing: '-.01em' }}>
                    {result.attack_type.replace(/_/g, ' ')}
                  </div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--char6)' }}>{(result.confidence * 100).toFixed(0)}% sure</span>
                </div>
                <Bar value={result.confidence} color="var(--amber)" h={5} />

                <div className="label" style={{ marginTop: 20, marginBottom: 12, fontSize: 8 }}>Matched attack techniques (MITRE)</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.mitre.map(m => (
                    <div key={m.technique_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span className="mitre-badge">{m.technique_id}</span>
                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char5)', lineHeight: 1.5 }}>{m.technique_name}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* What they'll do next */}
              <div className="panel" style={{ padding: 22 }}>
                <div className="label" style={{ marginBottom: 16, fontSize: 8 }}>What they'll try next (AI prediction)</div>
                {result.next_moves.length === 0 ? (
                  <span className="label" style={{ color: 'var(--char6)' }}>Model not available for this IP</span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {result.next_moves.map((m, i) => (
                      <div key={m.attack_type}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char6)', width: 16 }}>#{i + 1}</span>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--char2)' }}>{m.attack_type.replace(/_/g, ' ')}</span>
                          </div>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--amber)', fontWeight: 600 }}>{(m.probability * 100).toFixed(1)}%</span>
                        </div>
                        <Bar value={m.probability} color="var(--amber)" h={5} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Feature breakdown */}
            <div className="panel" style={{ padding: 22 }}>
              <div className="label" style={{ marginBottom: 16, fontSize: 8 }}>Detailed behaviour data</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 48px' }}>
                {Object.entries(result.features).map(([k, v]) => (
                  <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--bdr)' }}>
                    <span style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--char4)', fontWeight: 400 }}>{k.replace(/_/g, ' ')}</span>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--char2)', fontWeight: 500 }}>{typeof v === 'number' ? v.toFixed(3) : v}</span>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

      </div>
    </AppShell>
  )
}