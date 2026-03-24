import { useEffect, useState } from 'react'
import { AppShell } from '../components/AppShell'
import { TopIPs } from '../components/TopIPs'
import { SessionKillChain } from '../components/SessionKillChain'
import { BiLSTMForecast } from '../components/BiLSTMForecast'
import { getStats } from '../api/clients'
import type { Stats } from '../types'

const MITRE = [
        { id: 'T1110', name: 'Brute Force', tactic: 'Credential Access', color: 'var(--crit)', desc: 'Repeatedly trying passwords to break in' },
        { id: 'T1190', name: 'Exploit Public-Facing Application', tactic: 'Initial Access', color: 'var(--high)', desc: 'Attacking web services exposed to the internet' },
        { id: 'T1595', name: 'Active Scanning', tactic: 'Reconnaissance', color: 'var(--med)', desc: 'Mapping out what services are running' },
        { id: 'T1078', name: 'Valid Accounts', tactic: 'Defense Evasion', color: '#7C3AED', desc: 'Using legitimate credentials to stay hidden' },
        { id: 'T1059', name: 'Command & Script Interpreter', tactic: 'Execution', color: '#BE185D', desc: 'Running system commands after gaining access' },
        { id: 'T1021', name: 'Remote Services', tactic: 'Lateral Movement', color: '#1D4ED8', desc: 'Moving to other machines in the network' },
        { id: 'T1046', name: 'Network Service Discovery', tactic: 'Discovery', color: 'var(--low)', desc: 'Scanning for open ports and services' },
        { id: 'T1040', name: 'Network Sniffing', tactic: 'Credential Access', color: 'var(--crit)', desc: 'Intercepting network traffic to steal passwords' },
]

export function ThreatIntel() {
        const [stats, setStats] = useState<Stats | null>(null)

        useEffect(() => {
                getStats().then(setStats).catch(() => { })
                const t = setInterval(() => getStats().then(setStats).catch(() => { }), 30_000)
                return () => clearInterval(t)
        }, [])

        const byType = stats?.by_attack_type ?? []
        const totalEv = byType.reduce((s, r) => s + r.count, 0) || 1
        const maxCount = Math.max(...MITRE.map((_, i) => byType[i % Math.max(byType.length, 1)]?.count ?? 0), 1)
        const PAL = ['var(--amber)', 'var(--crit)', 'var(--high)', 'var(--low)', '#1D4ED8', '#7C3AED', '#BE185D', '#0F766E']

        return (
                <AppShell>
                        <div className="page-body">

                                {/* Page header */}
                                <div style={{ borderBottom: '1px solid var(--bdr)', paddingBottom: 16 }}>
                                        <div className="label" style={{ color: 'var(--char6)', marginBottom: 8 }}>Deep Analysis</div>
                                        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 28, color: 'var(--char)', letterSpacing: '-.02em', marginBottom: 4 }}>Threat Intelligence</h1>
                                        <div className="label" style={{ color: 'var(--char6)', fontSize: 8 }}>AI-powered attacker analysis · MITRE ATT&CK framework mapping</div>
                                </div>

                                {/* MITRE heatmap + BiLSTM */}
                                <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: 18 }}>

                                        {/* MITRE matrix — readable version */}
                                        <div className="panel au">
                                                <div className="panel-hd">
                                                        <div>
                                                                <div className="label">Attack Techniques Observed</div>
                                                                <div style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--char6)', marginTop: 2 }}>How attackers are targeting your systems</div>
                                                        </div>
                                                        <span className="label" style={{ color: 'var(--char6)' }}>{MITRE.length} techniques</span>
                                                </div>
                                                <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                                                        {MITRE.map((t, i) => {
                                                                const cnt = byType[i % (byType.length || 1)]?.count ?? 0
                                                                const pct = (cnt / maxCount) * 100
                                                                return (
                                                                        <div key={t.id} style={{ display: 'grid', gridTemplateColumns: '72px 1fr 80px', gap: 14, alignItems: 'center', padding: '10px 14px', background: 'var(--surf2)', border: '1px solid var(--bdr)', borderRadius: 8, borderLeft: `3px solid ${t.color}` }}>
                                                                                <div>
                                                                                        <div className="mitre-badge" style={{ display: 'inline-block' }}>{t.id}</div>
                                                                                </div>
                                                                                <div>
                                                                                        <div style={{ fontFamily: 'var(--sans)', fontSize: 12, color: 'var(--char2)', fontWeight: 500, marginBottom: 2 }}>{t.name}</div>
                                                                                        <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--char6)', marginBottom: 6, fontWeight: 400 }}>{t.desc}</div>
                                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                                                                                <div className="label" style={{ fontSize: 7, color: 'var(--char6)', whiteSpace: 'nowrap' }}>{t.tactic}</div>
                                                                                                <div className="bar-track" style={{ flex: 1, height: 4 }}>
                                                                                                        <div className="bar-fill" style={{ width: `${pct}%`, background: t.color }} />
                                                                                                </div>
                                                                                        </div>
                                                                                </div>
                                                                                <div style={{ textAlign: 'right' }}>
                                                                                        <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--char)', letterSpacing: '-.01em' }}>{cnt}</div>
                                                                                        <div className="label" style={{ fontSize: 7 }}>events</div>
                                                                                </div>
                                                                        </div>
                                                                )
                                                        })}
                                                </div>
                                        </div>

                                        <BiLSTMForecast />
                                </div>

                                {/* Attack type story cards */}
                                <div className="panel au d2">
                                        <div className="panel-hd"><span className="label">Attack type breakdown</span></div>
                                        <div style={{ padding: '18px 20px', display: 'flex', flexWrap: 'wrap', gap: 14 }}>
                                                {byType.length === 0 && <span className="label" style={{ color: 'var(--char6)' }}>No data yet</span>}
                                                {byType.map((a, i) => {
                                                        const col = PAL[i % PAL.length]
                                                        const pct = ((a.count / totalEv) * 100).toFixed(1)
                                                        return (
                                                                <div key={a.attack_type} style={{ background: 'var(--surf)', border: '1px solid var(--bdr)', borderTop: `3px solid ${col}`, borderRadius: 8, padding: '16px 18px', minWidth: 140, flex: '1 1 140px', transition: 'box-shadow .2s' }}
                                                                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 20px rgba(0,0,0,.07)'}
                                                                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = 'none'}
                                                                >
                                                                        <div style={{ fontFamily: 'var(--serif)', fontSize: 28, lineHeight: 1, letterSpacing: '-.02em', color: col, marginBottom: 8 }}>{a.count}</div>
                                                                        <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--char3)', fontWeight: 500, marginBottom: 4 }}>{a.attack_type.replace(/_/g, ' ')}</div>
                                                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: col, fontWeight: 600 }}>{pct}% of total</div>
                                                                </div>
                                                        )
                                                })}
                                        </div>
                                </div>

                                {/* Top IPs */}
                                <TopIPs />

                                {/* Kill chain */}
                                <SessionKillChain />

                        </div>
                </AppShell>
        )
}