import { useEffect, useState, useRef } from 'react'
import { getSessions, getSessionDetail } from '../api/clients'
import type { Session, SessionDetail } from '../types'

const CHAIN = [
  { stage: 'connect', label: 'First Contact', tactic: 'Recon', color: '#2563EB', emoji: '🔌' },
  { stage: 'login_failed', label: 'Trying Passwords', tactic: 'Brute Force', color: '#D97706', emoji: '🚫' },
  { stage: 'login_success', label: 'Got In', tactic: 'Cred Access', color: '#DC2626', emoji: '🔓' },
  { stage: 'command', label: 'Running Commands', tactic: 'Execution', color: '#991B1B', emoji: '💻' },
  { stage: 'disconnect', label: 'Left', tactic: 'Exfiltration', color: '#6B7280', emoji: '👋' },
]

const BADGE_CLS: Record<string, string> = { connect: 'chip chip-low', login_failed: 'chip chip-medium', login_success: 'chip chip-high', command: 'chip chip-critical', disconnect: 'chip' }

function fmt(ts: string) { return new Date(ts).toUTCString().slice(17, 25) }
function dur(s: number | null) { if (!s) return '—'; return s < 60 ? `${s.toFixed(0)}s` : `${(s / 60).toFixed(1)}m` }
function asArr<T>(v: unknown): T[] { if (Array.isArray(v)) return v as T[]; if (typeof v === 'string') { try { const p = JSON.parse(v); if (Array.isArray(p)) return p as T[] } catch { } } return [] }

export function SessionKillChain({ refreshTrigger }: { refreshTrigger?: number }) {
  const [sessions, setS] = useState<Session[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [detail, setD] = useState<SessionDetail | null>(null)
  const [loading, setL] = useState(true)
  const [dloading, setDL] = useState(false)
  const lastSel = useRef<string | null>(null)

  useEffect(() => {
    const fetchS = () => getSessions(15).then(r => { 
      setS(r.sessions); 
      if (r.sessions.length > 0 && !sel) setSel(r.sessions[0].session_id); 
      setL(false) 
    }).catch(() => setL(false))
    
    fetchS()
    const t = setInterval(fetchS, 30_000)
    return () => clearInterval(t)
  }, [refreshTrigger])

  useEffect(() => {
    if (!sel) return
    const isNew = sel !== lastSel.current
    if (isNew) {
      setDL(true)
      setD(null)
      lastSel.current = sel
    }
    getSessionDetail(sel).then(setD).catch(() => { }).finally(() => {
      if (isNew) setDL(false)
    })
  }, [sel, refreshTrigger])

  const events = asArr<SessionDetail['events'][number]>(detail?.events)
  const creds = asArr<{ username: string; password: string }>(detail?.session?.credentials)
  const commands = asArr<string>(detail?.session?.commands).filter((c): c is string => typeof c === 'string')
  const hit = new Set(events.map(e => e.event_type))

  return (
    <div className="panel au">
      <div className="panel-hd">
        <span className="label">Attack Sessions — Step by Step</span>
        <span className="label" style={{ color: 'var(--char6)' }}>{sessions.length} recorded</span>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, gap: 10 }}>
          <div className="spinner" style={{ width: 20, height: 20, borderWidth: 2 }} />
          <span className="label" style={{ color: 'var(--char6)' }}>Loading sessions…</span>
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100 }}>
          <span className="label" style={{ color: 'var(--char6)' }}>No sessions recorded yet</span>
        </div>
      )}

      {!loading && sessions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '240px 1fr' }}>

          {/* Session list */}
          <div style={{ borderRight: '1px solid var(--bdr)', overflowY: 'auto', maxHeight: 560 }}>
            {sessions.map(s => {
              const act = s.session_id === sel
              return (
                <div key={s.session_id} onClick={() => setSel(s.session_id)} style={{ padding: '12px 16px', cursor: 'pointer', borderBottom: '1px solid var(--bdr)', borderLeft: `3px solid ${act ? 'var(--amber)' : 'transparent'}`, background: act ? 'var(--amber-p2)' : 'transparent', transition: 'all .15s' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: act ? 'var(--amber)' : 'var(--char2)', fontWeight: act ? 600 : 400 }}>{s.src_ip}</span>
                    <span className="label" style={{ fontSize: 8 }}>{dur(s.duration_sec)}</span>
                  </div>
                  <div className="label" style={{ fontSize: 8, color: 'var(--char6)' }}>{s.login_attempts} attempts · {s.commands_run} commands run</div>
                  <div className="label" style={{ fontSize: 7, color: 'var(--char6)', marginTop: 2, opacity: .5 }}>{s.session_id.slice(0, 12)}</div>
                </div>
              )
            })}
          </div>

          {/* Detail */}
          <div style={{ padding: 24, overflowY: 'auto', maxHeight: 560 }}>
            {dloading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {Array.from({ length: 4 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 32 }} />)}
              </div>
            )}

            {!dloading && detail && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

                {/* Kill chain — icons row */}
                <div>
                  <div className="label" style={{ marginBottom: 16, fontSize: 8 }}>Attack progression</div>
                  <div style={{ display: 'flex', alignItems: 'flex-start' }}>
                    {CHAIN.map((kc, i) => {
                      const active = hit.has(kc.stage)
                      return (
                        <div key={kc.stage} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                            <div className={`kc-node${active ? ' hit' : ''}`} style={{ background: active ? kc.color : 'var(--cream-2)', color: active ? kc.color : 'var(--char6)', border: `2px solid ${active ? kc.color : 'var(--bdr2)'}`, boxShadow: active ? `0 0 0 4px ${kc.color}22` : 'none' }}>
                              {active && <div style={{ width: 11, height: 11, borderRadius: '50%', background: 'rgba(255,255,255,.75)' }} />}
                            </div>
                            <div style={{ fontFamily: 'var(--sans)', fontSize: 9, color: active ? kc.color : 'var(--char6)', textAlign: 'center', lineHeight: 1.3, marginTop: 6, fontWeight: active ? 600 : 400 }}>{kc.label}</div>
                            <div className="label" style={{ fontSize: 6, color: 'var(--char6)', marginTop: 2, opacity: .6 }}>{kc.tactic}</div>
                          </div>
                          {i < CHAIN.length - 1 && (
                            <div style={{ height: 2, flex: 1, marginBottom: 28, background: hit.has(CHAIN[i + 1].stage) ? 'linear-gradient(90deg,var(--amber),var(--amber-l))' : 'var(--bdr)', transition: 'background .3s' }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Stats */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 10 }}>
                  {[
                    { label: 'Duration', val: dur(detail.session.duration_sec) },
                    { label: 'Password tries', val: detail.session.login_attempts },
                    { label: 'Broke in', val: detail.session.login_successes },
                    { label: 'Commands run', val: detail.session.commands_run },
                  ].map(s => (
                    <div key={s.label} style={{ background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 8, padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ fontFamily: 'var(--serif)', fontSize: 24, color: 'var(--char)', lineHeight: 1, letterSpacing: '-.01em' }}>{s.val}</div>
                      <div className="label" style={{ fontSize: 7, marginTop: 5 }}>{s.label}</div>
                    </div>
                  ))}
                </div>

                {/* Creds */}
                {creds.length > 0 && (
                  <div>
                    <div className="label" style={{ marginBottom: 8, fontSize: 8 }}>Passwords they tried</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 96, overflowY: 'auto' }}>
                      {creds.slice(0, 8).map((c, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, background: 'var(--surf2)', border: '1px solid var(--bdr)', padding: '2px 6px', borderRadius: 4, color: 'var(--char3)' }}>{c.username}</span>
                          <span style={{ color: 'var(--char6)' }}>/</span>
                          <span style={{ fontFamily: 'var(--mono)', fontSize: 10, background: 'var(--crit-bg)', border: '1px solid var(--crit-b)', padding: '2px 6px', borderRadius: 4, color: 'var(--crit)' }}>{c.password}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Commands */}
                {commands.length > 0 && (
                  <div>
                    <div className="label" style={{ marginBottom: 8, fontSize: 8 }}>Commands they ran</div>
                    <div style={{ background: 'var(--char)', borderRadius: 8, padding: '12px 16px', maxHeight: 120, overflowY: 'auto' }}>
                      {commands.map((cmd, i) => (
                        <div key={i} style={{ fontFamily: 'var(--mono)', fontSize: 11, color: '#4ade80', lineHeight: 1.9 }}>
                          <span style={{ color: 'rgba(255,255,255,.2)', marginRight: 8 }}>$</span>{cmd}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Event timeline */}
                <div>
                  <div className="label" style={{ marginBottom: 10, fontSize: 8 }}>Full event log</div>
                  <div className="vtl" style={{ maxHeight: 180, overflowY: 'auto' }}>
                    {events.map((e, i) => {
                      const kc = CHAIN.find(k => k.stage === e.event_type)
                      return (
                        <div key={e.id} className="vtl-item">
                          <div className="vtl-dot" style={{ background: kc?.color ?? 'var(--char6)' }} />
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char6)', minWidth: 52, flexShrink: 0 }}>{fmt(e.timestamp)}</span>
                            <span className={BADGE_CLS[e.event_type] ?? 'chip'} style={{ flexShrink: 0 }}>{e.event_type.replace(/_/g, ' ')}</span>
                            {e.command && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char5)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.command}</span>}
                            {e.username && !e.command && <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char5)' }}>{e.username}</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}