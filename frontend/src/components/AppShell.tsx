import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getHealth } from '../api/clients'
import type { HealthStatus } from '../types'

const NAV = [
        { path: '/dashboard', emoji: '⚡', label: 'Live Dashboard', sub: 'Real-time feed' },
        { path: '/intel', emoji: '🧠', label: 'Threat Intel', sub: 'Deep analysis' },
        { path: '/ip', emoji: '🔍', label: 'IP Inspector', sub: 'Lookup any IP' },
]

interface Props {
        children: React.ReactNode
        connected?: boolean
        totalAttacks?: number
        newCount?: number
}

export function AppShell({ children, connected = false, totalAttacks = 0, newCount = 0 }: Props) {
        const navigate = useNavigate()
        const location = useLocation()
        const [health, setHealth] = useState<HealthStatus | null>(null)
        const [now, setNow] = useState(new Date())
        const [collapsed, setColl] = useState(false)

        useEffect(() => {
                getHealth().then(setHealth).catch(() => { })
                const t = setInterval(() => getHealth().then(setHealth).catch(() => { }), 30_000)
                return () => clearInterval(t)
        }, [])
        useEffect(() => {
                const t = setInterval(() => setNow(new Date()), 1000)
                return () => clearInterval(t)
        }, [])

        const dbOk = health?.database.connected ?? false
        const mlOk = health?.ml_models.loaded ?? false

        return (
                <div className="app-shell" style={{ position: 'relative', zIndex: 1 }}>

                        {/* ── Topbar ── */}
                        <header className="topbar">
                                <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                                        <img src="/honeycloud.png" style={{ width: 34, height: 34, objectFit: 'contain' }} alt="HoneyCloud Logo" />
                                        <div style={{ textAlign: 'left' }}>
                                                <div style={{ fontFamily: 'var(--serif)', fontSize: 18, color: 'var(--char)', lineHeight: 1.1, fontWeight: 600 }}>HoneyCloud</div>
                                                <div className="label" style={{ fontSize: 7, marginTop: 1 }}>Threat Intelligence</div>
                                        </div>
                                </button>

                                {/* Centre — live counter */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                        {newCount > 0 && (
                                                <span style={{ fontFamily: 'var(--mono)', fontSize: 10, padding: '3px 10px', background: 'var(--crit-bg)', border: '1px solid var(--crit-b)', borderRadius: 20, color: 'var(--crit)', animation: 'pulse-s 1s ease-in-out infinite' }}>
                                                        +{newCount} new
                                                </span>
                                        )}
                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--char5)' }}>
                                                {totalAttacks.toLocaleString()} events captured
                                        </span>
                                </div>

                                {/* Right */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
                                        {[
                                                { label: 'DB', on: dbOk },
                                                { label: 'ML', on: mlOk },
                                                { label: connected ? 'LIVE' : 'OFFLINE', on: connected },
                                        ].map(s => (
                                                <div key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.on ? (s.label === (connected ? 'LIVE' : 'OFFLINE') ? 'var(--amber)' : 'var(--low)') : 'var(--crit)', display: 'inline-block', animation: s.on && s.label === (connected ? 'LIVE' : 'OFFLINE') ? 'ring-p 2s ease-in-out infinite' : 'none' }} />
                                                        <span className="label" style={{ fontSize: 8 }}>{s.label}</span>
                                                </div>
                                        ))}
                                        <div style={{ width: 1, height: 16, background: 'var(--bdr)' }} />
                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--char5)' }}>
                                                {now.toUTCString().slice(17, 25)} UTC
                                        </span>
                                </div>
                        </header>

                        {/* ── Sidebar ── */}
                        <aside className="sidebar">
                                <div className="nav-section-label">Navigation</div>

                                <nav style={{ flex: 1 }}>
                                        {NAV.map(item => {
                                                const active = location.pathname === item.path || (item.path === '/ip' && location.pathname.startsWith('/ip'))
                                                return (
                                                        <button key={item.path} onClick={() => navigate(item.path)} className={`nav-item${active ? ' active' : ''}`}>
                                                                <div className="nav-icon">{item.emoji}</div>
                                                                <div style={{ minWidth: 0 }}>
                                                                        <div style={{ fontSize: 13 }}>{item.label}</div>
                                                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: active ? 'var(--amber)' : 'var(--char6)', marginTop: 1, letterSpacing: '.06em' }}>{item.sub}</div>
                                                                </div>
                                                                {active && <div className="live-dot amber" style={{ marginLeft: 'auto', width: 5, height: 5 }} />}
                                                        </button>
                                                )
                                        })}
                                </nav>

                                {/* System status card */}
                                <div style={{ margin: '0 12px 16px', padding: 16, background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 10 }}>
                                        <div className="label" style={{ marginBottom: 12, fontSize: 8 }}>System Status</div>
                                        {[
                                                { label: 'Cowrie SSH Honeypot', on: true },
                                                { label: 'Isolation Forest', on: mlOk },
                                                { label: 'Bi-LSTM Model', on: mlOk },
                                                { label: 'PostgreSQL DB', on: dbOk },
                                        ].map(s => (
                                                <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char4)' }}>{s.label}</span>
                                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 8, padding: '1px 6px', borderRadius: 3, background: s.on ? 'var(--low-bg)' : 'var(--cream-3)', color: s.on ? 'var(--low)' : 'var(--char6)', border: `1px solid ${s.on ? 'var(--low-b)' : 'var(--bdr)'}` }}>
                                                                {s.on ? 'ONLINE' : 'OFFLINE'}
                                                        </span>
                                                </div>
                                        ))}
                                </div>
                        </aside>

                        {/* ── Main ── */}
                        <main className="main-content">
                                {children}
                        </main>
                </div>
        )
}