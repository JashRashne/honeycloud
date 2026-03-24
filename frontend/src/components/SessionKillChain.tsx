import { useEffect, useState } from 'react'
import { getSessions, getSessionDetail } from '../api/clients'
import type { Session, SessionDetail } from '../types'

const KILL_CHAIN = [
  { stage: 'connect', label: 'Initial Access', tactic: 'Reconnaissance', color: '#60a5fa' },
  { stage: 'login_failed', label: 'Brute Force', tactic: 'Credential Access', color: '#FBC64C' },
  { stage: 'login_success', label: 'Credential Access', tactic: 'Initial Access', color: '#FF8800' },
  { stage: 'command', label: 'Execution', tactic: 'Execution', color: '#FF3B3B' },
  { stage: 'disconnect', label: 'Complete', tactic: 'Exfiltration', color: '#B28742' },
]

const STAGE_BADGE: Record<string, { bg: string; color: string; border: string }> = {
  connect: { bg: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: 'rgba(96,165,250,0.3)' },
  login_failed: { bg: 'rgba(251,198,76,0.1)', color: '#FBC64C', border: 'rgba(251,198,76,0.3)' },
  login_success: { bg: 'rgba(255,136,0,0.1)', color: '#FF8800', border: 'rgba(255,136,0,0.3)' },
  command: { bg: 'rgba(255,59,59,0.1)', color: '#FF3B3B', border: 'rgba(255,59,59,0.3)' },
  disconnect: { bg: 'rgba(178,135,66,0.1)', color: '#B28742', border: 'rgba(178,135,66,0.3)' },
}

function fmt(ts: string) { return new Date(ts).toUTCString().slice(17, 25) }

function duration(sec: number | null) {
  if (!sec) return '—'
  if (sec < 60) return `${sec.toFixed(0)}s`
  return `${(sec / 60).toFixed(1)}m`
}

function asArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[]
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value)
      if (Array.isArray(parsed)) return parsed as T[]
    } catch {
      return []
    }
  }
  return []
}

export function SessionKillChain({ refreshTrigger }: { refreshTrigger?: number }) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    getSessions(10).then(r => {
      setSessions(r.sessions)
      if (r.sessions.length > 0 && !selected) setSelected(r.sessions[0].session_id)
      setLoading(false)
    }).catch(() => setLoading(false))
    const t = setInterval(() =>
      getSessions(10).then(r => setSessions(r.sessions)).catch(() => { }), 30_000)
    return () => clearInterval(t)
  }, [refreshTrigger])

  useEffect(() => {
    if (!selected) return
    const isNew = !detail || detail.session.session_id !== selected
    if (isNew) { setDetailLoading(true); setDetail(null) }
    getSessionDetail(selected)
      .then(setDetail)
      .catch(() => { })
      .finally(() => setDetailLoading(false))
  }, [selected])

  const events = asArray<SessionDetail['events'][number]>(detail?.events)
  const credentials = asArray<{ username: string; password: string }>(detail?.session?.credentials)
  const commands = asArray<string>(detail?.session?.commands).filter((cmd): cmd is string => typeof cmd === 'string')

  // Which stages appeared in this session
  const stagesHit = new Set(events.map(e => e.event_type))

  return (
    <div style={{ background: 'var(--void-2)', border: '1px solid var(--void-4)', borderRadius: 2, overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid var(--void-4)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(251,198,76,0.02)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', letterSpacing: '0.18em' }}>
          INFECTION TIMELINE
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)' }}>
          {sessions.length} sessions
        </span>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bronze-3)' }}>
          loading...
        </div>
      )}

      {!loading && sessions.length === 0 && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 120, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bronze-3)' }}>
          no sessions yet
        </div>
      )}

      {!loading && sessions.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', borderTop: '1px solid var(--void-4)' }}>

          {/* Session list */}
          <div style={{ borderRight: '1px solid var(--void-4)', overflowY: 'auto', maxHeight: 500 }}>
            {sessions.map(s => {
              const active = s.session_id === selected
              return (
                <div
                  key={s.session_id}
                  onClick={() => setSelected(s.session_id)}
                  style={{
                    padding: '12px 16px',
                    cursor: 'pointer',
                    borderBottom: '1px solid rgba(20,16,10,0.8)',
                    background: active ? 'rgba(251,198,76,0.06)' : 'transparent',
                    borderLeft: active ? '2px solid var(--amber)' : '2px solid transparent',
                    transition: 'all 0.15s',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 11,
                      color: active ? 'var(--amber)' : 'var(--antiquity-2)',
                      fontWeight: active ? 600 : 400,
                    }}>
                      {s.src_ip}
                    </span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)' }}>
                      {duration(s.duration_sec)}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)' }}>
                    {s.login_attempts} attempts · {s.commands_run} cmds
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(107,90,62,0.35)', marginTop: 2 }}>
                    {s.session_id.slice(0, 12)}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Kill chain detail */}
          <div style={{ padding: 22, overflowY: 'auto', maxHeight: 500 }}>
            {detailLoading && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bronze-3)' }}>
                loading session...
              </div>
            )}

            {!detailLoading && detail && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>

                {/* ── Kill chain — horizontal progress ── */}
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.16em', marginBottom: 18 }}>
                    ATTACK PROGRESSION
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    {KILL_CHAIN.map((kc, i) => {
                      const hit = stagesHit.has(kc.stage)
                      return (
                        <div key={kc.stage} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1 }}>
                            {/* Node */}
                            <div style={{
                              width: 34, height: 34, borderRadius: '50%',
                              background: hit ? kc.color : 'var(--void-4)',
                              border: `2px solid ${hit ? kc.color : 'var(--void-4)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              boxShadow: hit ? `0 0 14px ${kc.color}55` : 'none',
                              marginBottom: 7,
                              transition: 'all 0.35s',
                              position: 'relative',
                              flexShrink: 0,
                            }}>
                              {hit && (
                                <>
                                  {/* Outer ring */}
                                  <div style={{
                                    position: 'absolute', inset: -8,
                                    borderRadius: '50%',
                                    border: `1px solid ${kc.color}30`,
                                    animation: 'glow-pulse 2s ease-in-out infinite',
                                  }} />
                                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(255,255,255,0.6)' }} />
                                </>
                              )}
                            </div>
                            {/* Labels */}
                            <span style={{
                              fontFamily: 'var(--font-mono)', fontSize: 7,
                              color: hit ? kc.color : 'var(--bronze-3)',
                              textAlign: 'center', lineHeight: 1.4,
                              letterSpacing: '0.04em',
                            }}>
                              {kc.label}
                            </span>
                            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 6, color: 'var(--bronze-3)', opacity: 0.5, textAlign: 'center', marginTop: 2 }}>
                              {kc.tactic}
                            </span>
                          </div>
                          {i < KILL_CHAIN.length - 1 && (
                            <div style={{
                              height: 1, flex: 1, marginBottom: 28,
                              background: stagesHit.has(KILL_CHAIN[i + 1].stage)
                                ? 'linear-gradient(90deg, var(--bronze), var(--amber))'
                                : 'var(--void-4)',
                              transition: 'background 0.3s',
                            }} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Stats grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8 }}>
                  {[
                    { label: 'DURATION', value: duration(detail.session.duration_sec) },
                    { label: 'LOGIN TRIES', value: detail.session.login_attempts },
                    { label: 'SUCCESSES', value: detail.session.login_successes },
                    { label: 'COMMANDS', value: detail.session.commands_run },
                  ].map(({ label, value }) => (
                    <div key={label} style={{
                      background: 'rgba(251,198,76,0.03)',
                      border: '1px solid var(--void-4)',
                      borderRadius: 2, padding: '10px 12px', textAlign: 'center',
                    }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--antiquity)', lineHeight: 1 }}>{value}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--bronze-3)', marginTop: 5, letterSpacing: '0.12em' }}>{label}</div>
                    </div>
                  ))}
                </div>

                {/* Credentials captured */}
                {credentials.length > 0 && (
                  <div>
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold mb-2">
                      Credentials Attempted
                    </p>
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {credentials.slice(0, 8).map((c, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px] font-mono">
                          <span className="text-stone-500 bg-stone-100 px-1.5 py-0.5 rounded">{c.username}</span>
                          <span className="text-stone-300">/</span>
                          <span className="text-red-500 bg-red-50 px-1.5 py-0.5 rounded">{c.password}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Commands run */}
                {commands.length > 0 && (
                  <div>
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold mb-2">
                      Commands Executed
                    </p>
                    <div className="bg-stone-900 rounded-lg p-3 max-h-32 overflow-y-auto">
                      {commands.map((cmd, i) => (
                        <div key={i} className="text-[11px] font-mono text-emerald-400 leading-5">
                          <span className="text-stone-500 mr-2">$</span>{cmd}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Event timeline — vertical */}
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold mb-2">
                    Event Timeline
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {events.map(e => (
                      <div key={e.id} className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-stone-300 w-16 flex-shrink-0">
                          {fmt(e.timestamp)}
                        </span>
                        <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${STAGE_COLOR[e.event_type] ?? 'bg-stone-100 text-stone-500 border-stone-200'}`}>
                          {e.event_type.replace(/_/g, ' ')}
                        </span>
                        {e.command && (
                          <span className="text-[10px] font-mono text-stone-500 truncate">{e.command}</span>
                        )}
                        {e.username && !e.command && (
                          <span className="text-[10px] font-mono text-stone-400">{e.username}</span>
                        )}
                      </div>
                    ))}
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