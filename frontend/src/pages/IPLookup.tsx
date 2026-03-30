import { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { AlertCircle, ArrowRight, Search } from 'lucide-react'
import { AppShell } from '../components/AppShell'
import { getSessionsByIP, scoreIP } from '../api/clients'
import type { IPSessionsResponse, Severity, ScoreResult } from '../types'

const SEV_COL: Record<string, string> = { CRITICAL: 'var(--crit)', HIGH: 'var(--high)', MEDIUM: 'var(--med)', LOW: 'var(--low)' }
const SEV_BG: Record<string, string> = { CRITICAL: 'var(--crit-bg)', HIGH: 'var(--high-bg)', MEDIUM: 'var(--med-bg)', LOW: 'var(--low-bg)' }
const SEV_B: Record<string, string> = { CRITICAL: 'var(--crit-b)', HIGH: 'var(--high-b)', MEDIUM: 'var(--med-b)', LOW: 'var(--low-b)' }
// const SEV_CLS: Record<string, string> = { CRITICAL: 'chip chip-critical', HIGH: 'chip chip-high', MEDIUM: 'chip chip-medium', LOW: 'chip chip-low' }

function Bar({ value, color, h = 6 }: { value: number; color: string; h?: number }) {
  return (
    <div className="bar-track" style={{ height: h }}>
      <div className="bar-fill" style={{ width: `${Math.min(value * 100, 100).toFixed(0)}%`, background: color }} />
    </div>
  )
}

const STEPS = ['Checking for anomalies…', 'Classifying attack type…', 'Predicting next moves…']

function fmtWhen(ts: string | null | undefined) {
  if (!ts) return 'N/A'
  const d = new Date(ts)
  if (Number.isNaN(d.getTime())) return ts
  return d.toLocaleString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
}

function fmtDur(sec: number | null | undefined) {
  if (sec == null) return 'N/A'
  return `${sec.toFixed(1)}s`
}

function sevClass(sev: string | null | undefined) {
  if (!sev) return 'chip chip-low'
  const key = sev.toUpperCase() as Severity
  if (key === 'CRITICAL') return 'chip chip-critical'
  if (key === 'HIGH') return 'chip chip-high'
  if (key === 'MEDIUM') return 'chip chip-medium'
  return 'chip chip-low'
}

function splitCommand(cmd: string) {
  return cmd
    .split(';')
    .map((p) => p.trim())
    .filter(Boolean)
}

export function IPLookup() {
  const { ip: routeIP } = useParams<{ ip?: string }>()
  const navigate = useNavigate()
  const [input, setInput] = useState(routeIP ?? '')
  const [result, setResult] = useState<ScoreResult | null>(null)
  const [sessionsData, setSessionsData] = useState<IPSessionsResponse | null>(null)
  const [sessionsErr, setSessionsErr] = useState<string | null>(null)
  const [openSessions, setOpenSessions] = useState<Record<string, boolean>>({})
  const [sessionsPage, setSessionsPage] = useState(1)
  const [loading, setL] = useState(false)
  const [error, setErr] = useState<string | null>(null)
  const [step, setStep] = useState(0)
  const SESSIONS_PER_PAGE = 5

  const lookup = async (ip = input.trim()) => {
    if (!ip) return
    setL(true)
    setErr(null)
    setSessionsErr(null)
    setResult(null)
    setSessionsData(null)
    setOpenSessions({})
    setSessionsPage(1)
    setStep(0)
    const sid = setInterval(() => setStep(s => Math.min(s + 1, 2)), 850)
    try {
      const [scoreRes, sessionsRes] = await Promise.allSettled([
        scoreIP(ip),
        getSessionsByIP(ip, 200),
      ])

      if (scoreRes.status === 'fulfilled') {
        setResult(scoreRes.value)
      } else {
        const e: any = scoreRes.reason
        setErr(e?.response?.data?.detail ?? 'Could not score that IP — check the format and try again')
      }

      if (sessionsRes.status === 'fulfilled') {
        setSessionsData(sessionsRes.value)
        const initiallyOpen: Record<string, boolean> = {}
        for (const s of sessionsRes.value.sessions.slice(0, 3)) {
          initiallyOpen[s.session_id] = true
        }
        setOpenSessions(initiallyOpen)
      } else {
        const e: any = sessionsRes.reason
        setSessionsErr(e?.response?.data?.detail ?? 'Could not load session timelines for this IP')
      }

      navigate(`/ip/${ip}`, { replace: true })
    } catch {
      setErr('Request failed unexpectedly')
    }
    finally { clearInterval(sid); setL(false); setStep(0) }
  }

  useEffect(() => { if (routeIP) lookup(routeIP) }, [routeIP])

  const sColor = result ? SEV_COL[result.threat_level] : 'var(--amber)'
  const sBg = result ? SEV_BG[result.threat_level] : 'transparent'
  const sB = result ? SEV_B[result.threat_level] : 'transparent'
  const totalSessions = sessionsData?.sessions.length ?? 0
  const totalPages = Math.max(1, Math.ceil(totalSessions / SESSIONS_PER_PAGE))
  const pageStart = (sessionsPage - 1) * SESSIONS_PER_PAGE
  const pageEnd = pageStart + SESSIONS_PER_PAGE
  const pagedSessions = sessionsData?.sessions.slice(pageStart, pageEnd) ?? []

  return (
    <AppShell>
      <div className="page-body">

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
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={14} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--char6)' }} />
              <input
                className="hc-input"
                style={{ paddingLeft: 38 }}
                type="text" value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && lookup()}
                placeholder="e.g. 45.33.32.156"
              />
            </div>
            <button className="btn-amber" onClick={() => lookup()} disabled={loading || !input.trim()} style={{ whiteSpace: 'nowrap', minWidth: 130, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
              {loading ? 'Analysing…' : <>{'Investigate'} <ArrowRight size={14} /></>}
            </button>
          </div>
          {error && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--crit)', marginTop: 10, display: 'flex', alignItems: 'center', gap: 6 }}>
              <AlertCircle size={12} /> {error}
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
        {!loading && (result || sessionsData) && (
          <div className="au" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {result && (
              <>
                {/* Hero */}
                <div style={{ background: sBg, border: `1px solid ${sB}`, borderLeft: `4px solid ${sColor}`, borderRadius: 10, padding: '24px 28px', boxShadow: `0 4px 24px ${sColor}12` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
                    <div>
                      <div className="label" style={{ marginBottom: 8, fontSize: 8 }}>IP Address Being Investigated</div>
                      <div style={{ fontFamily: 'var(--mono)', fontSize: 30, fontWeight: 500, color: 'var(--char)', letterSpacing: '.02em', lineHeight: 1 }}>{result.ip}</div>
                      {result.intel_match && (
                        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--crit)', marginTop: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                          <AlertCircle size={12} /> {result.intel_match.note} [{result.intel_match.country}]
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
              </>
            )}

            {/* Session timelines */}
            <div className="panel" style={{ padding: 22 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div>
                  <div className="label" style={{ marginBottom: 6, fontSize: 8 }}>Session Intelligence</div>
                  <div style={{ fontFamily: 'var(--serif)', fontSize: 26, color: 'var(--char)', letterSpacing: '-.02em' }}>
                    Full session timeline by IP
                  </div>
                </div>
                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--char5)' }}>
                  {(sessionsData?.count ?? 0)} sessions
                </div>
              </div>

              {sessionsErr && (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--crit)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={12} /> {sessionsErr}
                </div>
              )}

              {!sessionsData || sessionsData.sessions.length === 0 ? (
                <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--char6)', padding: '10px 0' }}>
                  No sessions found for this IP.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {pagedSessions.map((session) => {
                    const isOpen = !!openSessions[session.session_id]
                    return (
                      <div key={session.session_id} style={{ border: '1px solid var(--bdr)', borderRadius: 10, overflow: 'hidden', background: 'var(--surf2)' }}>
                        <button
                          onClick={() => setOpenSessions((prev) => ({ ...prev, [session.session_id]: !isOpen }))}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            width: '100%',
                            textAlign: 'left',
                            cursor: 'pointer',
                            padding: '14px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: 10,
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--char2)' }}>{session.session_id}</span>
                              <span className="chip chip-low">{session.honeypot}</span>
                              <span className="chip chip-medium">{session.step_count} steps</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char6)', letterSpacing: '.06em' }}>START</span>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--char4)' }}>{fmtWhen(session.start_time)}</span>
                              <span style={{ color: 'var(--cream-4)' }}>•</span>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char6)', letterSpacing: '.06em' }}>END</span>
                              <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--char4)' }}>{fmtWhen(session.end_time)}</span>
                            </div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--char5)' }}>
                              <span>duration: {fmtDur(session.duration_sec)}</span>
                              <span>attempts: {session.login_attempts}</span>
                              <span>success: {session.login_successes}</span>
                              <span>commands: {session.commands_run}</span>
                            </div>
                            {session.hassh && (
                              <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char6)' }}>
                                hassh: {session.hassh}
                              </div>
                            )}
                          </div>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--char4)', flexShrink: 0 }}>{isOpen ? 'Hide' : 'Show'} steps</span>
                        </button>

                        {isOpen && (
                          <div style={{ padding: '2px 14px 14px', borderTop: '1px solid var(--bdr)' }}>
                            <div className="vtl" style={{ marginTop: 10 }}>
                              {session.steps.map((stepEvent) => (
                                <div key={stepEvent.id} className="vtl-item">
                                  <div className="vtl-dot" style={{ background: SEV_COL[stepEvent.severity ?? 'LOW'] ?? 'var(--char6)' }} />
                                  <div style={{ border: '1px solid var(--bdr)', background: 'var(--surf)', borderRadius: 8, padding: 12 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', marginBottom: 8 }}>
                                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--char2)' }}>{stepEvent.event_type}</span>
                                        <span className={sevClass(stepEvent.severity)}>{stepEvent.severity ?? 'LOW'}</span>
                                        {stepEvent.attack_type && (
                                          <span className="chip chip-medium">{stepEvent.attack_type}</span>
                                        )}
                                      </div>
                                      <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char5)' }}>{fmtWhen(stepEvent.timestamp)}</span>
                                    </div>

                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char5)' }}>
                                      <span>event id: {stepEvent.id}</span>
                                      <span>score: {(stepEvent.anomaly_score ?? 0).toFixed(4)}</span>
                                      <span>user: {stepEvent.username ?? 'N/A'}</span>
                                      <span>pass: {stepEvent.password ?? 'N/A'}</span>
                                    </div>

                                    {stepEvent.command && (
                                      <details style={{ marginTop: 10 }}>
                                        <summary style={{ cursor: 'pointer', fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char4)' }}>
                                          Show command
                                        </summary>
                                        <div style={{ marginTop: 8, background: 'var(--char)', borderRadius: 8, padding: '12px 14px', maxHeight: 220, overflowY: 'auto' }}>
                                          <div style={{ marginBottom: 6, fontFamily: 'var(--mono)', fontSize: 8, color: 'rgba(255,255,255,.45)', letterSpacing: '.08em', textTransform: 'uppercase' }}>
                                            Terminal
                                          </div>
                                          {splitCommand(stepEvent.command).map((line, idx) => (
                                            <div key={`${stepEvent.id}-${idx}`} style={{ fontFamily: 'var(--mono)', fontSize: 10, color: '#4ade80', lineHeight: 1.75, overflowWrap: 'anywhere' }}>
                                              <span style={{ color: 'rgba(255,255,255,.25)', marginRight: 8 }}>$</span>
                                              {line}
                                            </div>
                                          ))}
                                        </div>
                                      </details>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}

                  <div style={{ marginTop: 6, borderTop: '1px solid var(--bdr)', paddingTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                    <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--char5)' }}>
                      Showing {pageStart + 1}-{Math.min(pageEnd, totalSessions)} of {totalSessions}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button
                        className="btn-primary"
                        onClick={() => setSessionsPage((p) => Math.max(1, p - 1))}
                        disabled={sessionsPage <= 1}
                        style={{ padding: '6px 12px', fontSize: 11 }}
                      >
                        Prev
                      </button>

                      <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--char4)', minWidth: 84, textAlign: 'center' }}>
                        Page {sessionsPage} / {totalPages}
                      </span>

                      <button
                        className="btn-primary"
                        onClick={() => setSessionsPage((p) => Math.min(totalPages, p + 1))}
                        disabled={sessionsPage >= totalPages}
                        style={{ padding: '6px 12px', fontSize: 11 }}
                      >
                        Next
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </AppShell>
  )
}