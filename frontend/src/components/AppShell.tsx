import React from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { Zap, Brain, Search, Activity, ShieldCheck, Database, Cpu } from 'lucide-react'
import { getHealth } from '../api/clients'
import type { HealthStatus } from '../types'

const NAV = [
        { path: '/dashboard', icon: <Zap size={16} />, label: 'Live Dashboard', sub: 'Real-time feed' },
        { path: '/intel', icon: <Brain size={16} />, label: 'Threat Intel', sub: 'Deep analysis' },
        { path: '/ip', icon: <Search size={16} />, label: 'IP Inspector', sub: 'Lookup any IP' },
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
                <div className="app-shell">

                        {/* ── Topbar ── */}
                        <header className="topbar">
                                <button onClick={() => navigate('/')} style={{ display: 'flex', alignItems: 'center', gap: 14, background: 'none', border: 'none', cursor: 'pointer', padding: 0, flexShrink: 0 }}>
                                        <img src="/honeycloud.png" style={{ width: 34, height: 34, objectFit: 'contain' }} alt="HC" />
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
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                <Activity size={12} style={{ color: 'var(--char6)' }} />
                                                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--char5)', letterSpacing: '0.02em' }}>
                                                        {totalAttacks.toLocaleString()} <span style={{ opacity: 0.6 }}>events captured</span>
                                                </span>
                                        </div>
                                </div>

                                {/* Right */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
                                        <div style={{ display: 'flex', gap: 12 }}>
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
                                        </div>
                                        <div style={{ width: 1, height: 16, background: 'var(--bdr)' }} />
                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--char5)', fontWeight: 500 }}>
                                                {now.toUTCString().slice(17, 25)} <span style={{ opacity: 0.6 }}>UTC</span>
                                        </span>
                                </div>
                        </header>

                        {/* ── Sidebar ── */}
                        <aside className="sidebar">
                                <div style={{ flex: 1 }}>
                                        <div className="nav-section-label">Main Navigation</div>
                                        <nav style={{ padding: '0 8px' }}>
                                                {NAV.map(item => {
                                                        const active = location.pathname === item.path || (item.path === '/ip' && location.pathname.startsWith('/ip'))
                                                        return (
                                                                <button
                                                                        key={item.path}
                                                                        onClick={() => navigate(item.path)}
                                                                        className={`nav-item ${active ? 'active' : ''}`}
                                                                        style={{ borderRadius: 8, marginBottom: 4 }}
                                                                >
                                                                        <div className="nav-icon" style={{
                                                                                color: active ? 'var(--amber)' : 'var(--char5)',
                                                                                background: active ? 'var(--amber-p)' : 'var(--cream-2)',
                                                                                borderRadius: 8
                                                                        }}>
                                                                                {item.icon}
                                                                        </div>
                                                                        <div style={{ minWidth: 0 }}>
                                                                                <div style={{ fontSize: 13, fontWeight: active ? 600 : 500 }}>{item.label}</div>
                                                                                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: active ? 'var(--amber)' : 'var(--char6)', marginTop: 1, letterSpacing: '.06em', textTransform: 'uppercase' }}>{item.sub}</div>
                                                                        </div>
                                                                        {active && <div className="live-dot amber" style={{ marginLeft: 'auto', width: 4, height: 4 }} />}
                                                                </button>
                                                        )
                                                })}
                                        </nav>
                                </div>

                                {/* System status card */}
                                <div style={{ padding: '20px 16px' }}>
                                        <div style={{ padding: '16px', background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
                                                        <ShieldCheck size={14} style={{ color: 'var(--amber)' }} />
                                                        <span className="label" style={{ fontSize: 8, letterSpacing: '0.1em' }}>System Health</span>
                                                </div>

                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                        {[
                                                                { label: 'Honeypots', on: true, icon: <Activity size={10} /> },
                                                                { label: 'AI Models', on: mlOk, icon: <Cpu size={10} /> },
                                                                { label: 'Database', on: dbOk, icon: <Database size={10} /> },
                                                        ].map(s => (
                                                                <div key={s.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                                <span style={{ color: 'var(--char6)' }}>{s.icon}</span>
                                                                                <span style={{ fontFamily: 'var(--sans)', fontSize: 11, fontWeight: 500, color: 'var(--char4)' }}>{s.label}</span>
                                                                        </div>
                                                                        <span style={{
                                                                                fontFamily: 'var(--mono)',
                                                                                fontSize: 7,
                                                                                padding: '1px 5px',
                                                                                borderRadius: 4,
                                                                                background: s.on ? 'var(--low-bg)' : 'var(--crit-bg)',
                                                                                color: s.on ? 'var(--low)' : 'var(--crit)',
                                                                                border: `1px solid ${s.on ? 'var(--low-b)' : 'var(--crit-b)'}`,
                                                                                fontWeight: 600
                                                                        }}>
                                                                                {s.on ? 'ONLINE' : 'OFFLINE'}
                                                                        </span>
                                                                </div>
                                                        ))}
                                                </div>

                                                <div style={{ marginTop: 14, paddingTop: 10, borderTop: '1px dashed var(--bdr)', display: 'flex', alignItems: 'center', gap: 6 }}>
                                                        <div style={{ width: 4, height: 4, borderRadius: '50%', background: connected ? 'var(--low)' : 'var(--crit)' }} />
                                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--char6)' }}>
                                                                Honeynet Connection: {connected ? 'Encrypted' : 'Lost'}
                                                        </span>
                                                </div>
                                        </div>
                                </div>
                        </aside>

                        {/* ── Main ── */}
                        <main className="main-content">
                                {children}
                        </main>
                </div>
        )
}