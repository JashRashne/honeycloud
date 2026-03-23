import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Header } from '../components/Header'
import { scoreIP } from '../api/clients'
import type { ScoreResult } from '../types'

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#FF3B3B',
  HIGH: '#FF8800',
  MEDIUM: '#FBC64C',
  LOW: '#3DDB7A',
}

const SEV_BG: Record<string, string> = {
  CRITICAL: 'rgba(255,59,59,0.07)',
  HIGH: 'rgba(255,136,0,0.07)',
  MEDIUM: 'rgba(251,198,76,0.07)',
  LOW: 'rgba(61,219,122,0.07)',
}

function ScoreBar({ value, color, height = 5 }: { value: number; color: string; height?: number }) {
  return (
    <div style={{ background: 'var(--void-4)', borderRadius: 1, height, overflow: 'hidden' }}>
      <div style={{
        width: `${Math.min(value * 100, 100).toFixed(1)}%`,
        height, background: color,
        boxShadow: `0 0 8px ${color}55`,
        transition: 'width 0.8s cubic-bezier(0.4,0,0.2,1)',
        position: 'relative',
      }}>
        <div style={{
          position: 'absolute', right: 0, top: 0, bottom: 0,
          width: 16,
          background: `linear-gradient(90deg, transparent, ${color})`,
          filter: 'blur(1px)',
        }} />
      </div>
    </div>
  )
}

function FeatureRow({ label, value }: { label: string; value: number | string }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 0',
      borderBottom: '1px solid rgba(30,24,16,0.7)',
    }}>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bronze-3)' }}>
        {label.replace(/_/g, ' ')}
      </span>
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--antiquity-2)', letterSpacing: '0.02em' }}>
        {typeof value === 'number' ? value.toFixed(4) : value}
      </span>
    </div>
  )
}

export function IPLookup() {
  const { ip: routeIP } = useParams<{ ip?: string }>()
  const navigate = useNavigate()
  const [input, setInput] = useState(routeIP ?? '')
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const lookup = async (ipToScore = input.trim()) => {
    if (!ipToScore) return
    setLoading(true); setError(null); setResult(null)
    try {
      const r = await scoreIP(ipToScore)
      setResult(r)
      navigate(`/ip/${ipToScore}`, { replace: true })
    } catch (e: any) {
      setError(e?.response?.data?.detail ?? 'Scoring failed — check IP format')
    } finally { setLoading(false) }
  }

  useState(() => { if (routeIP) lookup(routeIP) })

  const sColor = result ? SEV_COLOR[result.threat_level] : 'var(--amber)'
  const sBg = result ? SEV_BG[result.threat_level] : 'transparent'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--void)', fontFamily: 'var(--font-display)' }}>
      <Header />

      <main style={{ maxWidth: 960, margin: '0 auto', padding: '40px 28px 64px' }}>

        {/* Page header */}
        <div style={{ marginBottom: 32, animation: 'fade-in-up 0.4s ease both' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.2em', marginBottom: 12 }}>
            ANALYST WORKSTATION / IP DOSSIER
          </div>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: 36, color: 'var(--antiquity)', margin: '0 0 8px', letterSpacing: '-0.02em',
          }}>
            Subject Dossier
          </h1>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bronze-3)', margin: 0 }}>
            Isolation Forest · XGBoost+RF Ensemble · Bi-LSTM Sequence · MITRE ATT&CK
          </p>
        </div>

        {/* ── Search terminal ── */}
        <div style={{
          background: 'var(--void-2)',
          border: '1px solid var(--void-4)',
          borderRadius: 2,
          padding: 20, marginBottom: 22,
          animation: 'fade-in-up 0.4s ease 0.06s both',
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.18em', marginBottom: 12 }}>
            SUBJECT QUERY
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{
                position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)',
                fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--amber)', opacity: 0.6,
              }}>$</span>
              <input
                className="hc-input"
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && lookup()}
                placeholder="score 45.33.32.156"
                style={{ paddingLeft: 30 }}
              />
            </div>
            <button
              className="btn-primary"
              onClick={() => lookup()}
              disabled={loading || !input.trim()}
              style={{ whiteSpace: 'nowrap', minWidth: 120 }}
            >
              {loading ? 'Scoring...' : 'Score IP →'}
            </button>
          </div>
          {error && (
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--critical)',
              marginTop: 10, display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>⚠</span>{error}
            </div>
          )}
        </div>

        {/* ── Loading state ── */}
        {loading && (
          <div style={{
            background: 'var(--void-2)', border: '1px solid var(--void-4)',
            borderRadius: 2, padding: 32,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.18em', marginBottom: 20 }}>
              ML PIPELINE RUNNING
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                { label: 'LAYER 1', msg: 'Isolation Forest — anomaly detection...' },
                { label: 'LAYER 2', msg: 'XGBoost + Random Forest ensemble...' },
                { label: 'LAYER 3', msg: 'Bi-LSTM sequence prediction...' },
              ].map((step, i) => (
                <div key={step.msg} style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 8,
                    padding: '2px 7px',
                    background: 'rgba(251,198,76,0.07)',
                    border: '1px solid rgba(251,198,76,0.2)',
                    color: 'var(--amber)',
                    letterSpacing: '0.1em',
                  }}>
                    {step.label}
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 11,
                    color: 'var(--bronze-3)',
                    opacity: 0.4 + i * 0.25,
                  }}>
                    <span style={{ color: 'var(--amber)', marginRight: 6 }}>›</span>
                    {step.msg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Dossier results ── */}
        {result && !loading && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, animation: 'fade-in-up 0.4s ease both' }}>

            {/* ── Hero card — Subject header ── */}
            <div style={{
              background: sBg,
              border: `1px solid ${sColor}30`,
              borderLeft: `3px solid ${sColor}`,
              borderRadius: 2,
              padding: '24px 28px',
              boxShadow: `0 0 40px ${sColor}08`,
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Bg glow */}
              <div style={{
                position: 'absolute', top: -40, right: -40,
                width: 200, height: 200,
                background: `radial-gradient(circle, ${sColor}12, transparent 65%)`,
                pointerEvents: 'none',
              }} />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.18em', marginBottom: 8 }}>
                    SUBJECT · IP ADDRESS
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-mono)', fontWeight: 600, fontSize: 32,
                    color: 'var(--antiquity)', letterSpacing: '0.04em', lineHeight: 1,
                  }}>
                    {result.ip}
                  </div>
                  {result.intel_match && (
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      fontFamily: 'var(--font-mono)', fontSize: 11,
                      color: 'var(--critical)', marginTop: 8,
                    }}>
                      <span>⚠</span>
                      {result.intel_match.note} [{result.intel_match.country}]
                    </div>
                  )}
                </div>

                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.18em', marginBottom: 8 }}>
                    THREAT LEVEL
                  </div>
                  <div style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 40,
                    color: sColor, lineHeight: 1, letterSpacing: '-0.02em',
                    textShadow: `0 0 30px ${sColor}44`,
                  }}>
                    {result.threat_level}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bronze-3)', marginTop: 5 }}>
                    {(result.anomaly_score * 100).toFixed(2)}% anomaly
                  </div>
                </div>
              </div>

              {/* Score meter */}
              <ScoreBar value={result.anomaly_score} color={sColor} height={7} />
            </div>

            {/* ── Two columns — classification + forecast ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>

              {/* Attack classification */}
              <div style={{ background: 'var(--void-2)', border: '1px solid var(--void-4)', borderRadius: 2, padding: 22 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.18em', marginBottom: 18 }}>
                  ATTACK CLASSIFICATION
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 20, color: 'var(--antiquity)' }}>
                    {result.attack_type.replace(/_/g, ' ')}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)' }}>
                    {(result.confidence * 100).toFixed(0)}% confidence
                  </span>
                </div>
                <ScoreBar value={result.confidence} color="#60a5fa" height={4} />

                {/* MITRE */}
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.18em', marginTop: 20, marginBottom: 12 }}>
                  MITRE ATT&CK MAPPING
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {result.mitre.map(m => (
                    <div key={m.technique_id} style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
                      <span className="mitre-badge">{m.technique_id}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', lineHeight: 1.5 }}>
                        {m.technique_name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bi-LSTM forecast */}
              <div style={{ background: 'var(--void-2)', border: '1px solid var(--void-4)', borderRadius: 2, padding: 22 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.18em', marginBottom: 18 }}>
                  BI-LSTM NEXT MOVE FORECAST
                </div>

                {result.next_moves.length === 0 ? (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bronze-3)' }}>
                    model unavailable
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                    {result.next_moves.map((m, i) => (
                      <div key={m.attack_type}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)' }}>#{i + 1}</span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--antiquity-2)' }}>
                              {m.attack_type.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze)' }}>
                            {(m.probability * 100).toFixed(1)}%
                          </span>
                        </div>
                        <div style={{ background: 'var(--void-4)', borderRadius: 1, height: 4, overflow: 'hidden' }}>
                          <div style={{
                            width: `${(m.probability * 100).toFixed(0)}%`,
                            height: 4,
                            background: 'linear-gradient(90deg, var(--bronze-3), var(--amber))',
                            boxShadow: '0 0 6px rgba(251,198,76,0.3)',
                            transition: 'width 0.7s ease',
                          }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Flow feature breakdown ── */}
            <div style={{ background: 'var(--void-2)', border: '1px solid var(--void-4)', borderRadius: 2, padding: 22 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.18em', marginBottom: 18 }}>
                FLOW FEATURE BREAKDOWN — FORENSIC DATA
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 48px' }}>
                {Object.entries(result.features).map(([key, val]) => (
                  <FeatureRow key={key} label={key} value={val} />
                ))}
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  )
}