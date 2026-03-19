import { useEffect, useState } from 'react'
import { getSessions, getSessionDetail } from '../api/clients'
import type { Session, SessionDetail } from '../types'

const MITRE_STAGES = [
  'connect', 'login_failed', 'login_success', 'command', 'disconnect'
]

const STAGE_LABEL: Record<string, string> = {
  connect:       'Initial Access',
  login_failed:  'Brute Force',
  login_success: 'Credential Access',
  command:       'Execution',
  disconnect:    'Complete',
}

const STAGE_COLOR: Record<string, string> = {
  connect:       'bg-blue-100 text-blue-700 border-blue-200',
  login_failed:  'bg-amber-100 text-amber-700 border-amber-200',
  login_success: 'bg-orange-100 text-orange-700 border-orange-200',
  command:       'bg-red-100 text-red-700 border-red-200',
  disconnect:    'bg-stone-100 text-stone-500 border-stone-200',
}

const STAGE_DOT: Record<string, string> = {
  connect:       'bg-blue-400',
  login_failed:  'bg-amber-400',
  login_success: 'bg-orange-500',
  command:       'bg-red-500',
  disconnect:    'bg-stone-300',
}

function fmt(ts: string) {
  return new Date(ts).toUTCString().slice(17, 25)
}

function duration(sec: number | null) {
  if (!sec) return '—'
  if (sec < 60) return `${sec.toFixed(0)}s`
  return `${(sec / 60).toFixed(1)}m`
}

export function SessionKillChain() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [detail, setDetail] = useState<SessionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)

  useEffect(() => {
    getSessions(10).then(r => {
      setSessions(r.sessions)
      if (r.sessions.length > 0) setSelected(r.sessions[0].session_id)
      setLoading(false)
    }).catch(() => setLoading(false))

    const t = setInterval(() =>
      getSessions(10).then(r => setSessions(r.sessions)).catch(() => {}),
    30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    if (!selected) return
    setDetailLoading(true)
    setDetail(null)
    getSessionDetail(selected)
      .then(setDetail)
      .catch(() => {})
      .finally(() => setDetailLoading(false))
  }, [selected])

  // Which stages appeared in this session
  const stagesHit = new Set(detail?.events.map(e => e.event_type) ?? [])

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Session Kill Chain</h2>
        <span className="text-xs text-stone-400 font-mono">{sessions.length} sessions</span>
      </div>

      {loading && (
        <div className="flex items-center justify-center h-32 text-stone-300 text-xs font-mono">loading...</div>
      )}

      {!loading && sessions.length === 0 && (
        <div className="flex items-center justify-center h-32 text-stone-300 text-xs font-mono">no sessions yet</div>
      )}

      {!loading && sessions.length > 0 && (
        <div className="grid grid-cols-[280px_1fr] divide-x divide-stone-100" style={{ minHeight: 320 }}>

          {/* Session list */}
          <div className="overflow-y-auto divide-y divide-stone-50" style={{ maxHeight: 480 }}>
            {sessions.map(s => (
              <div
                key={s.session_id}
                onClick={() => setSelected(s.session_id)}
                className={`px-4 py-3 cursor-pointer transition-colors ${
                  s.session_id === selected ? 'bg-stone-900 text-white' : 'hover:bg-stone-50'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`font-mono text-xs font-semibold ${s.session_id === selected ? 'text-white' : 'text-stone-800'}`}>
                    {s.src_ip}
                  </span>
                  <span className={`text-[10px] font-mono ${s.session_id === selected ? 'text-stone-300' : 'text-stone-400'}`}>
                    {duration(s.duration_sec)}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-mono ${s.session_id === selected ? 'text-stone-300' : 'text-stone-400'}`}>
                    {s.login_attempts} attempts · {s.commands_run} cmds
                  </span>
                </div>
                <div className={`text-[10px] font-mono mt-0.5 ${s.session_id === selected ? 'text-stone-400' : 'text-stone-300'}`}>
                  {s.session_id.slice(0, 12)}
                </div>
              </div>
            ))}
          </div>

          {/* Kill chain detail */}
          <div className="p-5">
            {detailLoading && (
              <div className="flex items-center justify-center h-full text-stone-300 text-xs font-mono">
                loading session...
              </div>
            )}

            {!detailLoading && detail && (
              <div className="space-y-5">

                {/* Kill chain progress bar */}
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold mb-3">
                    Attack Progression
                  </p>
                  <div className="flex items-center gap-0">
                    {MITRE_STAGES.map((stage, i) => {
                      const hit = stagesHit.has(stage)
                      return (
                        <div key={stage} className="flex items-center flex-1">
                          <div className="flex flex-col items-center flex-1">
                            <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center mb-1 transition-all ${
                              hit
                                ? `${STAGE_DOT[stage]} border-transparent`
                                : 'bg-stone-100 border-stone-200'
                            }`}>
                              {hit && <span className="w-3 h-3 rounded-full bg-white opacity-80" />}
                            </div>
                            <span className="text-[9px] text-stone-400 text-center leading-tight font-mono">
                              {STAGE_LABEL[stage]}
                            </span>
                          </div>
                          {i < MITRE_STAGES.length - 1 && (
                            <div className={`h-0.5 flex-1 -mt-4 ${
                              stagesHit.has(MITRE_STAGES[i + 1]) ? 'bg-stone-400' : 'bg-stone-200'
                            }`} />
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Session stats */}
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Duration',    value: duration(detail.session.duration_sec) },
                    { label: 'Login Tries', value: detail.session.login_attempts },
                    { label: 'Successes',   value: detail.session.login_successes },
                    { label: 'Commands',    value: detail.session.commands_run },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-stone-50 rounded-lg p-3 text-center">
                      <div className="text-lg font-bold text-stone-900 tabular-nums">{value}</div>
                      <div className="text-[10px] text-stone-400 uppercase tracking-widest mt-0.5">{label}</div>
                    </div>
                  ))}
                </div>

                {/* Credentials captured */}
                {detail.session.credentials.length > 0 && (
                  <div>
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold mb-2">
                      Credentials Attempted
                    </p>
                    <div className="space-y-1 max-h-28 overflow-y-auto">
                      {detail.session.credentials.slice(0, 8).map((c, i) => (
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
                {detail.session.commands.length > 0 && (
                  <div>
                    <p className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold mb-2">
                      Commands Executed
                    </p>
                    <div className="bg-stone-900 rounded-lg p-3 max-h-32 overflow-y-auto">
                      {detail.session.commands.map((cmd, i) => (
                        <div key={i} className="text-[11px] font-mono text-emerald-400 leading-5">
                          <span className="text-stone-500 mr-2">$</span>{cmd}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Event timeline */}
                <div>
                  <p className="text-[10px] text-stone-400 uppercase tracking-widest font-semibold mb-2">
                    Event Timeline
                  </p>
                  <div className="space-y-1 max-h-40 overflow-y-auto">
                    {detail.events.map(e => (
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