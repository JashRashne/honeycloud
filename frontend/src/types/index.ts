export type Severity = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'

export interface Attack {
  id: number
  src_ip: string
  event_type: string
  username: string | null
  timestamp: string
  session_id: string
  anomaly_score: number | null
  severity: Severity | null
  attack_type: string | null
}

export interface Session {
  id: number
  session_id: string
  src_ip: string
  start_time: string
  end_time: string | null
  duration_sec: number | null
  login_attempts: number
  login_successes: number
  commands_run: number
  hassh: string | null
  honeypot: string
}

export interface SessionDetail {
  session: Session & {
    credentials: { username: string; password: string }[]
    commands: string[]
  }
  events: (Attack & { command: string | null; password: string | null })[]
}

export interface SessionStep extends Attack {
  password: string | null
  command: string | null
}

export interface IPSession extends Session {
  created_at: string
  steps: SessionStep[]
  step_count: number
}

export interface IPSessionsResponse {
  ip: string
  count: number
  sessions: IPSession[]
}

export interface TopIP {
  src_ip: string
  total_events: number
  failed_logins: number
  successful_logins: number
  commands: number
  last_seen: string
  max_anomaly_score: number | null
  top_attack_type: string | null
}

export interface Stats {
  by_event_type: { event_type: string; count: number }[]
  by_attack_type: { attack_type: string; count: number }[]
  by_severity: { severity: string; count: number }[]
  hourly_24h: { hour: string; count: number }[]
}

export interface ScoreResult {
  ip: string
  anomaly_score: number
  threat_level: Severity
  attack_type: string
  confidence: number
  next_moves: { attack_type: string; probability: number }[]
  mitre: { technique_id: string; technique_name: string }[]
  intel_match: { country: string; note: string } | null
  features: Record<string, number>
}

export interface HealthStatus {
  status: 'ok' | 'degraded'
  timestamp: string
  database: { connected: boolean; error: string | null }
  ml_models: { loaded: boolean; error: string | null }
}

export interface WSMessage {
  type: 'history' | 'new_attacks'
  attacks: Attack[]
}