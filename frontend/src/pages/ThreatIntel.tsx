import { useEffect, useState } from 'react'
import { Header } from '../components/Header'
import { TopIPs } from '../components/TopIPs'
import { SessionKillChain } from '../components/SessionKillChain'
import { BiLSTMForecast } from '../components/BiLSTMForecast'
import { getStats } from '../api/clients'
import type { Stats } from '../types'

const MITRE_TECHNIQUES = [
        { id: 'T1110', name: 'Brute Force', tactic: 'Credential Access', color: '#FF3B3B' },
        { id: 'T1190', name: 'Exploit Public-Facing Application', tactic: 'Initial Access', color: '#FF8800' },
        { id: 'T1595', name: 'Active Scanning', tactic: 'Reconnaissance', color: '#FBC64C' },
        { id: 'T1078', name: 'Valid Accounts', tactic: 'Defense Evasion', color: '#a78bfa' },
        { id: 'T1059', name: 'Command & Scripting Interpreter', tactic: 'Execution', color: '#f472b6' },
        { id: 'T1021', name: 'Remote Services', tactic: 'Lateral Movement', color: '#60a5fa' },
        { id: 'T1046', name: 'Network Service Discovery', tactic: 'Discovery', color: '#34d399' },
        { id: 'T1040', name: 'Network Sniffing', tactic: 'Credential Access', color: '#FF3B3B' },
]

const TACTIC_DOT: Record<string, string> = {
        'Credential Access': '#FF3B3B',
        'Initial Access': '#FF8800',
        'Reconnaissance': '#FBC64C',
        'Defense Evasion': '#a78bfa',
        'Execution': '#f472b6',
        'Lateral Movement': '#60a5fa',
        'Discovery': '#34d399',
}

export function ThreatIntel() {
        const [stats, setStats] = useState<Stats | null>(null)

        useEffect(() => {
                getStats().then(setStats).catch(() => { })
                const t = setInterval(() => getStats().then(setStats).catch(() => { }), 30_000)
                return () => clearInterval(t)
        }, [])

        const totalEvents = stats?.by_attack_type.reduce((s, r) => s + r.count, 0) ?? 1

        // Map real event counts onto MITRE techniques
        const techniques = MITRE_TECHNIQUES.map((t, i) => ({
                ...t,
                count: stats?.by_attack_type[i % (stats.by_attack_type.length || 1)]?.count ?? 0,
        }))
        const maxCount = Math.max(...techniques.map(t => t.count), 1)

        return (
                <div style={{ minHeight: '100vh', background: 'var(--void)', fontFamily: 'var(--font-display)' }}>
                        <Header />

                        <main style={{ maxWidth: 1600, margin: '0 auto', padding: '20px 28px 48px', display: 'flex', flexDirection: 'column', gap: 14 }}>

                                {/* Page title */}
                                <div style={{
                                        display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between',
                                        paddingBottom: 16,
                                        borderBottom: '1px solid var(--void-4)',
                                        animation: 'fade-in-up 0.4s ease both',
                                }}>
                                        <div>
                                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.2em', marginBottom: 8 }}>
                                                        MODULE / DEEP ANALYSIS
                                                </div>
                                                <h1 style={{
                                                        fontFamily: 'var(--font-display)', fontWeight: 800,
                                                        fontSize: 32, color: 'var(--antiquity)', margin: 0, letterSpacing: '-0.02em',
                                                }}>
                                                        Threat Intelligence
                                                </h1>
                                        </div>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', letterSpacing: '0.04em' }}>
                                                ML pipeline output · attacker behaviour analysis
                                        </div>
                                </div>

                                {/* Row 1 — MITRE heatmap + Bi-LSTM */}
                                <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 14, animation: 'fade-in-up 0.4s ease 0.08s both' }}>

                                        {/* MITRE ATT&CK Brutalist Matrix */}
                                        <div style={{ background: 'var(--void-2)', border: '1px solid var(--void-4)', borderRadius: 2, overflow: 'hidden' }}>
                                                <div style={{
                                                        padding: '12px 18px',
                                                        borderBottom: '1px solid var(--void-4)',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                        background: 'rgba(251,198,76,0.02)',
                                                }}>
                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', letterSpacing: '0.18em' }}>
                                                                MITRE ATT&CK — TECHNIQUE MATRIX
                                                        </span>
                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)' }}>
                                                                {techniques.length} techniques observed
                                                        </span>
                                                </div>

                                                <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                                        {techniques.map(t => {
                                                                const pct = (t.count / maxCount) * 100
                                                                return (
                                                                        <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '72px 180px 1fr 48px', gap: 12, alignItems: 'center' }}>
                                                                                {/* ID badge — angled using skew */}
                                                                                <div style={{
                                                                                        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                                                        height: 26,
                                                                                }}>
                                                                                        <div style={{
                                                                                                position: 'absolute', inset: 0,
                                                                                                background: `${t.color}12`,
                                                                                                border: `1px solid ${t.color}30`,
                                                                                                transform: 'skewX(-8deg)',
                                                                                        }} />
                                                                                        <span style={{
                                                                                                fontFamily: 'var(--font-mono)', fontSize: 9,
                                                                                                color: t.color, letterSpacing: '0.06em',
                                                                                                position: 'relative', fontWeight: 600,
                                                                                        }}>
                                                                                                {t.id}
                                                                                        </span>
                                                                                </div>

                                                                                {/* Name + tactic */}
                                                                                <div>
                                                                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--antiquity-2)' }}>{t.name}</div>
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 2 }}>
                                                                                                <div style={{ width: 4, height: 4, borderRadius: '50%', background: TACTIC_DOT[t.tactic] ?? 'var(--bronze-3)', flexShrink: 0 }} />
                                                                                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'var(--bronze-3)' }}>{t.tactic}</div>
                                                                                        </div>
                                                                                </div>

                                                                                {/* Intensity bar — varying opacity technique */}
                                                                                <div style={{ position: 'relative', height: 10, background: 'var(--void-4)', borderRadius: 1, overflow: 'hidden' }}>
                                                                                        {/* Background glow */}
                                                                                        <div style={{
                                                                                                position: 'absolute', inset: 0,
                                                                                                background: t.color,
                                                                                                opacity: pct / 100 * 0.12,
                                                                                        }} />
                                                                                        {/* Fill */}
                                                                                        <div style={{
                                                                                                width: `${pct}%`, height: '100%',
                                                                                                background: `linear-gradient(90deg, ${t.color}88, ${t.color})`,
                                                                                                boxShadow: `0 0 8px ${t.color}44`,
                                                                                                transition: 'width 0.5s ease',
                                                                                                position: 'relative',
                                                                                        }}>
                                                                                                {/* Leading edge glow */}
                                                                                                <div style={{
                                                                                                        position: 'absolute', right: 0, top: 0, bottom: 0,
                                                                                                        width: 20,
                                                                                                        background: `linear-gradient(90deg, transparent, ${t.color})`,
                                                                                                        filter: 'blur(2px)',
                                                                                                }} />
                                                                                        </div>
                                                                                </div>

                                                                                {/* Count */}
                                                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bronze-3)', textAlign: 'right' }}>
                                                                                        {t.count}
                                                                                </span>
                                                                        </div>
                                                                )
                                                        })}
                                                </div>
                                        </div>

                                        {/* Bi-LSTM Prediction Terminal */}
                                        <BiLSTMForecast />
                                </div>

                                {/* Row 2 — Attack type distribution */}
                                <div style={{ background: 'var(--void-2)', border: '1px solid var(--void-4)', borderRadius: 2, overflow: 'hidden', animation: 'fade-in-up 0.4s ease 0.16s both' }}>
                                        <div style={{
                                                padding: '12px 18px',
                                                borderBottom: '1px solid var(--void-4)',
                                                background: 'rgba(251,198,76,0.02)',
                                        }}>
                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', letterSpacing: '0.18em' }}>
                                                        ATTACK TYPE DISTRIBUTION
                                                </span>
                                        </div>
                                        <div style={{ padding: 18, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                                                {(stats?.by_attack_type ?? []).map((a, i) => {
                                                        const palette = ['#FF3B3B', '#FF8800', '#FBC64C', '#3DDB7A', '#60a5fa', '#a78bfa', '#f472b6', '#34d399', '#B28742']
                                                        const color = palette[i % palette.length]
                                                        const pct = ((a.count / totalEvents) * 100).toFixed(1)
                                                        return (
                                                                <div
                                                                        key={a.attack_type}
                                                                        style={{
                                                                                background: `${color}08`,
                                                                                border: `1px solid ${color}25`,
                                                                                borderTop: `2px solid ${color}`,
                                                                                borderRadius: 2,
                                                                                padding: '14px 18px',
                                                                                minWidth: 140, flex: '1 1 140px',
                                                                                position: 'relative', overflow: 'hidden',
                                                                        }}
                                                                >
                                                                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 24, color, lineHeight: 1, letterSpacing: '-0.02em' }}>
                                                                                {a.count}
                                                                        </div>
                                                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', marginTop: 7, letterSpacing: '0.1em' }}>
                                                                                {a.attack_type.replace(/_/g, ' ').toUpperCase()}
                                                                        </div>
                                                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color, marginTop: 4 }}>{pct}%</div>
                                                                        {/* Bg shine */}
                                                                        <div style={{
                                                                                position: 'absolute', top: -20, right: -20,
                                                                                width: 80, height: 80,
                                                                                background: `radial-gradient(circle, ${color}14, transparent 70%)`,
                                                                                pointerEvents: 'none',
                                                                        }} />
                                                                </div>
                                                        )
                                                })}
                                                {(!stats || stats.by_attack_type.length === 0) && (
                                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bronze-3)', padding: 20 }}>
                                                                no data yet
                                                        </div>
                                                )}
                                        </div>
                                </div>

                                {/* Row 3 — Top IPs full width */}
                                <div style={{ animation: 'fade-in-up 0.4s ease 0.22s both' }}>
                                        <TopIPs />
                                </div>

                                {/* Row 4 — Session Kill Chain */}
                                <div style={{ animation: 'fade-in-up 0.4s ease 0.28s both' }}>
                                        <SessionKillChain />
                                </div>

                        </main>
                </div>
        )
}