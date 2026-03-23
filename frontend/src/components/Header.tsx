import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { getHealth } from '../api/clients'
import type { HealthStatus } from '../types'

interface Props {
  connected?: boolean
  totalAttacks?: number
  newCount?: number
}

export function Header({ connected = false, totalAttacks = 0, newCount = 0 }: Props) {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [now, setNow] = useState(new Date())
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    getHealth().then(setHealth).catch(() => { })
    const t = setInterval(() => getHealth().then(setHealth).catch(() => { }), 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const navItems = [
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'Threat Intel', path: '/intel' },
    { label: 'IP Lookup', path: '/ip' },
  ]

  return (
    <header style={{
      background: 'rgba(0,0,0,0.95)',
      borderBottom: '1px solid var(--void-4)',
      backdropFilter: 'blur(16px)',
      position: 'sticky',
      top: 0,
      zIndex: 100,
    }}>
      <div style={{
        maxWidth: 1600, margin: '0 auto',
        padding: '0 28px', height: 58,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 24,
      }}>

        {/* Logo + Nav */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
          {/* Wordmark */}
          <button
            onClick={() => navigate('/')}
            style={{ display: 'flex', alignItems: 'center', gap: 12, background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}
          >
            <div style={{
              width: 32, height: 32,
              background: 'linear-gradient(135deg, var(--amber) 0%, var(--amber-3) 100%)',
              borderRadius: 3,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 0 18px rgba(251,198,76,0.3)',
              flexShrink: 0,
            }}>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, color: '#000' }}>HC</span>
            </div>
            <div style={{ lineHeight: 1 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, color: 'var(--antiquity)', letterSpacing: '0.04em' }}>
                HoneyCloud
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.18em', marginTop: 2 }}>
                THREAT INTELLIGENCE
              </div>
            </div>
          </button>

          {/* Divider */}
          <div style={{ width: 1, height: 26, background: 'var(--void-4)' }} />

          {/* Nav */}
          <nav style={{ display: 'flex', gap: 2 }}>
            {navItems.map(item => {
              const active = location.pathname === item.path
              return (
                <button
                  key={item.path}
                  onClick={() => navigate(item.path)}
                  style={{
                    background: active ? 'rgba(251,198,76,0.07)' : 'none',
                    border: active ? '1px solid rgba(251,198,76,0.18)' : '1px solid transparent',
                    borderRadius: 2,
                    padding: '5px 14px',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-display)',
                    fontWeight: active ? 600 : 500,
                    fontSize: 12,
                    color: active ? 'var(--amber)' : 'var(--bronze-3)',
                    transition: 'all 0.15s',
                    letterSpacing: '0.04em',
                  }}
                  onMouseEnter={e => { if (!active) (e.target as HTMLElement).style.color = 'var(--antiquity-3)' }}
                  onMouseLeave={e => { if (!active) (e.target as HTMLElement).style.color = 'var(--bronze-3)' }}
                >
                  {item.label}
                </button>
              )
            })}
          </nav>
        </div>

        {/* Centre — live counter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {newCount > 0 && (
            <span style={{
              fontFamily: 'var(--font-mono)', fontSize: 10,
              padding: '3px 9px',
              background: 'rgba(255,59,59,0.1)',
              border: '1px solid rgba(255,59,59,0.25)',
              borderRadius: 1,
              color: 'var(--critical)',
              animation: 'amber-pulse 1s ease-in-out infinite',
            }}>
              +{newCount} new
            </span>
          )}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bronze-3)' }}>
            {totalAttacks.toLocaleString()} events
          </span>
        </div>

        {/* Right — status indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexShrink: 0 }}>
          <StatusDot label="DB" active={health?.database.connected ?? false} ok />
          <StatusDot label="ML" active={health?.ml_models.loaded ?? false} ok={health?.ml_models.loaded ?? false} />
          <StatusDot label={connected ? 'LIVE' : 'RECONNECT'} active={connected} ok pulse={connected} />

          {/* Divider */}
          <div style={{ width: 1, height: 20, background: 'var(--void-4)' }} />

          {/* Clock */}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bronze-3)', letterSpacing: '0.05em' }}>
            {now.toUTCString().slice(17, 25)}{' '}
            <span style={{ opacity: 0.5 }}>UTC</span>
          </span>
        </div>
      </div>

      {/* Thin amber accent line at bottom */}
      {connected && (
        <div style={{
          height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(251,198,76,0.3), transparent)',
        }} />
      )}
    </header>
  )
}

function StatusDot({ label, active, ok, pulse }: {
  label: string
  active: boolean
  ok?: boolean
  pulse?: boolean
}) {
  const color = active
    ? (ok !== false ? 'var(--low)' : 'var(--medium)')
    : 'var(--critical)'

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{
        width: 5, height: 5, borderRadius: '50%',
        background: color,
        boxShadow: active && pulse ? `0 0 8px ${color}` : 'none',
        animation: active && pulse ? 'amber-pulse 2s ease-in-out infinite' : 'none',
        flexShrink: 0,
      }} />
      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', letterSpacing: '0.1em' }}>
        {label}
      </span>
    </div>
  )
}