import { useNavigate } from 'react-router-dom'
import { useEffect, useState, useRef } from 'react'

const TAGLINES = [
        'Decoy. Detect. Destroy.',
        'Every attacker leaves a trace.',
        'The trap is already set.',
        'Adaptive honeypots. Real intelligence.',
]

const FEATURES = [
        {
                id: '01',
                title: 'Adaptive Honeypots',
                desc: 'Deploy SSH, SMB, HTTP and Database decoys. Real-looking traps that evolve with attacker behaviour.',
                accent: '#FBC64C',
        },
        {
                id: '02',
                title: 'ML Threat Pipeline',
                desc: 'Isolation Forest detects anomalies. XGBoost + RF classifies attacks. Bi-LSTM predicts next moves.',
                accent: '#B28742',
        },
        {
                id: '03',
                title: 'MITRE ATT&CK Tags',
                desc: 'Every event mapped to a technique ID in real-time. Kill chain visualized from first probe to execution.',
                accent: '#FBC64C',
        },
        {
                id: '04',
                title: 'Live Threat Intel',
                desc: 'Cross-reference IPs against Shodan, Censys, Tor exit nodes. Export IOCs to MISP and AlienVault.',
                accent: '#B28742',
        },
]

const STATS = [
        { value: '451K+', label: 'Attack Events Captured' },
        { value: '20+', label: 'Honeypot Variants' },
        { value: '8', label: 'Global Sensor Nodes' },
        { value: '3×', label: 'ML Pipeline Layers' },
]

const FAKE_EVENTS = [
        { ip: '45.33.32.156', type: 'ssh_bruteforce', sev: 'CRITICAL', port: 22 },
        { ip: '94.102.49.190', type: 'web_scan', sev: 'HIGH', port: 80 },
        { ip: '185.220.101.3', type: 'db_probe', sev: 'HIGH', port: 3306 },
        { ip: '198.20.69.74', type: 'port_scan', sev: 'MEDIUM', port: 443 },
        { ip: '91.241.19.80', type: 'telnet_probe', sev: 'MEDIUM', port: 23 },
        { ip: '162.247.72.21', type: 'smb_exploit', sev: 'CRITICAL', port: 445 },
        { ip: '5.188.11.72', type: 'vnc_bruteforce', sev: 'HIGH', port: 5900 },
        { ip: '103.216.220.14', type: 'ftp_probe', sev: 'LOW', port: 21 },
]

const SEV_COLOR: Record<string, string> = {
        CRITICAL: '#FF3B3B',
        HIGH: '#FF8800',
        MEDIUM: '#FBC64C',
        LOW: '#3DDB7A',
}

// Digital Rain component
function DigitalRain() {
        const canvasRef = useRef<HTMLCanvasElement>(null)

        useEffect(() => {
                const canvas = canvasRef.current
                if (!canvas) return
                const ctx = canvas.getContext('2d')
                if (!ctx) return

                const resize = () => {
                        canvas.width = canvas.offsetWidth
                        canvas.height = canvas.offsetHeight
                }
                resize()
                window.addEventListener('resize', resize)

                const cols = Math.floor(canvas.width / 18)
                const drops: number[] = Array.from({ length: cols }, () => Math.random() * -50)
                const chars = '01ABCDEFアイウエオカキクケコ∞∂∑∏◈⬡◎█▓▒░'

                let frame = 0
                const draw = () => {
                        frame++
                        ctx.fillStyle = 'rgba(0,0,0,0.06)'
                        ctx.fillRect(0, 0, canvas.width, canvas.height)

                        for (let i = 0; i < cols; i++) {
                                const char = chars[Math.floor(Math.random() * chars.length)]
                                const x = i * 18
                                const y = drops[i] * 18

                                // Head char — bright amber
                                if (drops[i] > 0) {
                                        ctx.fillStyle = 'rgba(251,198,76,0.9)'
                                        ctx.font = '12px JetBrains Mono'
                                        ctx.fillText(char, x, y)
                                }

                                // Trail
                                const trailChar = chars[Math.floor(Math.random() * chars.length)]
                                if (drops[i] > 3) {
                                        const alpha = 0.15 + Math.random() * 0.1
                                        ctx.fillStyle = `rgba(178,135,66,${alpha})`
                                        ctx.font = '11px JetBrains Mono'
                                        ctx.fillText(trailChar, x, y - 18)
                                }

                                if (y > canvas.height && Math.random() > 0.975) {
                                        drops[i] = 0
                                }
                                drops[i] += 0.5
                        }
                }

                const id = setInterval(draw, 50)
                return () => {
                        clearInterval(id)
                        window.removeEventListener('resize', resize)
                }
        }, [])

        return (
                <canvas
                        ref={canvasRef}
                        style={{
                                position: 'absolute',
                                inset: 0,
                                width: '100%',
                                height: '100%',
                                opacity: 0.4,
                                pointerEvents: 'none',
                        }}
                />
        )
}

export function Landing() {
        const navigate = useNavigate()
        const [taglineIdx, setTaglineIdx] = useState(0)
        const [taglineVisible, setTaglineVisible] = useState(true)
        const [tick, setTick] = useState(0)
        const [eventFlash, setEventFlash] = useState<number | null>(null)

        useEffect(() => {
                const t = setInterval(() => {
                        setTaglineVisible(false)
                        setTimeout(() => { setTaglineIdx(i => (i + 1) % TAGLINES.length); setTaglineVisible(true) }, 350)
                }, 3200)
                return () => clearInterval(t)
        }, [])

        useEffect(() => {
                const t = setInterval(() => {
                        setTick(n => n + 1)
                        setEventFlash(0)
                        setTimeout(() => setEventFlash(null), 600)
                }, 1600)
                return () => clearInterval(t)
        }, [])

        const visibleEvents = Array.from({ length: 6 }, (_, i) => FAKE_EVENTS[(tick + i) % FAKE_EVENTS.length])
        const totalCaptured = 451000 + tick * 3

        return (
                <div style={{ minHeight: '100vh', background: 'var(--void)', overflowX: 'hidden', fontFamily: 'var(--font-display)' }}>

                        {/* ── Sticky Header ── */}
                        <header style={{
                                position: 'sticky', top: 0, zIndex: 100,
                                height: 60,
                                background: 'rgba(0,0,0,0.92)',
                                borderBottom: '1px solid var(--void-4)',
                                backdropFilter: 'blur(16px)',
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '0 48px',
                        }}>
                                {/* Logo */}
                                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                        <div style={{
                                                width: 34, height: 34,
                                                background: 'linear-gradient(135deg, var(--amber) 0%, var(--amber-3) 100%)',
                                                borderRadius: 3,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 0 20px rgba(251,198,76,0.35)',
                                                flexShrink: 0,
                                        }}>
                                                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 12, color: '#000', letterSpacing: '-0.5px' }}>HC</span>
                                        </div>
                                        <div>
                                                <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15, color: 'var(--antiquity)', letterSpacing: '0.04em', lineHeight: 1.1 }}>
                                                        HoneyCloud
                                                </div>
                                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.18em', marginTop: 1 }}>
                                                        THREAT INTELLIGENCE
                                                </div>
                                        </div>
                                </div>

                                {/* Centre nav */}
                                <nav style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                                        {[
                                                { label: 'Dashboard', path: '/dashboard' },
                                                { label: 'Threat Intel', path: '/intel' },
                                                { label: 'IP Lookup', path: '/ip' },
                                        ].map(item => (
                                                <button
                                                        key={item.path}
                                                        onClick={() => navigate(item.path)}
                                                        style={{
                                                                background: 'none', border: 'none',
                                                                padding: '6px 16px', cursor: 'pointer',
                                                                fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 12,
                                                                color: 'var(--bronze-3)', letterSpacing: '0.04em',
                                                                transition: 'color 0.2s',
                                                                borderRadius: 2,
                                                        }}
                                                        onMouseEnter={e => (e.currentTarget.style.color = 'var(--antiquity-2)')}
                                                        onMouseLeave={e => (e.currentTarget.style.color = 'var(--bronze-3)')}
                                                >
                                                        {item.label}
                                                </button>
                                        ))}
                                </nav>

                                {/* CTA */}
                                <div style={{ display: 'flex', gap: 8 }}>
                                        <button className="btn-ghost" onClick={() => navigate('/dashboard')} style={{ padding: '7px 18px', fontSize: 12 }}>
                                                Dashboard
                                        </button>
                                        <button className="btn-primary" onClick={() => navigate('/ip')} style={{ padding: '7px 18px', fontSize: 12 }}>
                                                Score an IP →
                                        </button>
                                </div>
                        </header>

                        {/* ── Hero ── */}
                        <section style={{
                                position: 'relative',
                                minHeight: '88vh',
                                display: 'flex', alignItems: 'center',
                                overflow: 'hidden',
                        }}>
                                {/* Digital rain background */}
                                <div style={{ position: 'absolute', inset: 0, background: 'var(--void)' }}>
                                        <DigitalRain />
                                </div>

                                {/* Radial amber gradient */}
                                <div style={{
                                        position: 'absolute',
                                        top: '20%', left: '30%',
                                        width: 700, height: 700,
                                        background: 'radial-gradient(circle, rgba(251,198,76,0.07) 0%, transparent 65%)',
                                        pointerEvents: 'none',
                                }} />

                                {/* Grid lines */}
                                <div style={{
                                        position: 'absolute', inset: 0,
                                        backgroundImage: `linear-gradient(rgba(178,135,66,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(178,135,66,0.04) 1px, transparent 1px)`,
                                        backgroundSize: '64px 64px',
                                        pointerEvents: 'none',
                                }} />

                                {/* Content */}
                                <div style={{
                                        position: 'relative', zIndex: 2,
                                        maxWidth: 1440, margin: '0 auto', width: '100%',
                                        padding: '80px 48px',
                                        display: 'grid', gridTemplateColumns: '1fr 1fr',
                                        gap: 80, alignItems: 'center',
                                }}>

                                        {/* Left — Hero text */}
                                        <div style={{ animation: 'fade-in-up 0.6s ease both' }}>
                                                {/* Status pill */}
                                                <div style={{
                                                        display: 'inline-flex', alignItems: 'center', gap: 8,
                                                        padding: '5px 14px',
                                                        background: 'rgba(251,198,76,0.07)',
                                                        border: '1px solid rgba(251,198,76,0.18)',
                                                        borderRadius: 1,
                                                        marginBottom: 36,
                                                }}>
                                                        <div className="pulse-dot" style={{ width: 5, height: 5 }} />
                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--amber)', letterSpacing: '0.2em', fontWeight: 500 }}>
                                                                ADAPTIVE CLOUD HONEYPOT PLATFORM
                                                        </span>
                                                </div>

                                                {/* Wordmark */}
                                                <h1 style={{
                                                        fontFamily: 'var(--font-display)',
                                                        fontWeight: 800,
                                                        fontSize: 'clamp(52px, 6vw, 88px)',
                                                        lineHeight: 0.95,
                                                        letterSpacing: '-0.03em',
                                                        margin: '0 0 8px',
                                                        color: 'var(--antiquity)',
                                                }}>
                                                        Honey
                                                        <span style={{
                                                                color: 'var(--amber)',
                                                                textShadow: '0 0 40px rgba(251,198,76,0.35)',
                                                        }}>Cloud</span>
                                                </h1>
                                                <h2 style={{
                                                        fontFamily: 'var(--font-display)',
                                                        fontWeight: 800,
                                                        fontSize: 'clamp(52px, 6vw, 88px)',
                                                        lineHeight: 0.95,
                                                        letterSpacing: '-0.03em',
                                                        margin: '0 0 40px',
                                                        color: 'var(--void-4)',
                                                }}>
                                                        Threat Intel.
                                                </h2>

                                                {/* Tagline rotator */}
                                                <div style={{ height: 30, overflow: 'hidden', marginBottom: 32 }}>
                                                        <p style={{
                                                                fontFamily: 'var(--font-mono)',
                                                                fontSize: 16,
                                                                color: 'var(--bronze)',
                                                                margin: 0,
                                                                letterSpacing: '0.05em',
                                                                opacity: taglineVisible ? 1 : 0,
                                                                transform: `translateY(${taglineVisible ? '0' : '-8px'})`,
                                                                transition: 'opacity 0.3s, transform 0.3s',
                                                        }}>
                                                                {TAGLINES[taglineIdx]}
                                                        </p>
                                                </div>

                                                {/* Description */}
                                                <p style={{
                                                        fontFamily: 'var(--font-display)',
                                                        fontSize: 15,
                                                        color: 'var(--antiquity-4)',
                                                        lineHeight: 1.75,
                                                        maxWidth: 460,
                                                        marginBottom: 52,
                                                        fontWeight: 400,
                                                }}>
                                                        Deploy decoy services that look real. Capture every attacker action.
                                                        Score threats with a 3-layer ML pipeline. Predict the next move
                                                        before it happens.
                                                </p>

                                                {/* CTAs */}
                                                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                                        <button className="btn-primary" onClick={() => navigate('/dashboard')}>
                                                                Open Dashboard →
                                                        </button>
                                                        <button className="btn-ghost" onClick={() => navigate('/intel')}>
                                                                Threat Intelligence
                                                        </button>
                                                </div>
                                        </div>

                                        {/* Right — Live terminal preview */}
                                        <div style={{ position: 'relative', animation: 'slide-in-right 0.6s ease 0.2s both' }}>
                                                {/* Corner decoration */}
                                                <div style={{ position: 'relative' }}>
                                                        {/* Top-left corner marker */}
                                                        <div style={{ position: 'absolute', top: -1, left: -1, width: 16, height: 16, borderTop: '2px solid var(--amber)', borderLeft: '2px solid var(--amber)', zIndex: 2 }} />
                                                        {/* Bottom-right corner marker */}
                                                        <div style={{ position: 'absolute', bottom: -1, right: -1, width: 16, height: 16, borderBottom: '2px solid var(--amber)', borderRight: '2px solid var(--amber)', zIndex: 2 }} />

                                                        <div style={{
                                                                background: 'var(--void-2)',
                                                                border: '1px solid var(--void-4)',
                                                                borderRadius: 2,
                                                                overflow: 'hidden',
                                                                boxShadow: '0 0 80px rgba(0,0,0,0.8), 0 0 40px rgba(251,198,76,0.04)',
                                                                transition: 'box-shadow 0.4s',
                                                        }}>
                                                                {/* Terminal titlebar */}
                                                                <div style={{
                                                                        padding: '10px 16px',
                                                                        borderBottom: '1px solid var(--void-4)',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                        background: 'rgba(251,198,76,0.025)',
                                                                }}>
                                                                        <div style={{ display: 'flex', gap: 7 }}>
                                                                                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FF5F57' }} />
                                                                                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#FFBD2E' }} />
                                                                                <div style={{ width: 9, height: 9, borderRadius: '50%', background: '#28C840' }} />
                                                                        </div>
                                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bronze-3)', letterSpacing: '0.08em' }}>
                                                                                honeycloud — live-feed — sensor-01
                                                                        </span>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                                <div className="pulse-dot" style={{ width: 5, height: 5 }} />
                                                                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--amber)', letterSpacing: '0.1em' }}>STREAMING</span>
                                                                        </div>
                                                                </div>

                                                                {/* Column headers */}
                                                                <div style={{
                                                                        display: 'grid', gridTemplateColumns: '1fr 1fr auto auto',
                                                                        gap: 12, padding: '6px 16px',
                                                                        borderBottom: '1px solid rgba(30,24,16,0.8)',
                                                                        background: 'rgba(0,0,0,0.2)',
                                                                }}>
                                                                        {['SOURCE IP', 'ATTACK TYPE', 'PORT', 'SEVERITY'].map(h => (
                                                                                <span key={h} style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.16em' }}>{h}</span>
                                                                        ))}
                                                                </div>

                                                                {/* Live events */}
                                                                {visibleEvents.map((ev, i) => {
                                                                        const color = SEV_COLOR[ev.sev]
                                                                        const isNew = i === 0 && eventFlash === 0
                                                                        return (
                                                                                <div
                                                                                        key={`${ev.ip}-${i}`}
                                                                                        style={{
                                                                                                display: 'grid', gridTemplateColumns: '1fr 1fr auto auto',
                                                                                                gap: 12, padding: '9px 16px',
                                                                                                alignItems: 'center',
                                                                                                borderBottom: '1px solid rgba(30,24,16,0.6)',
                                                                                                background: isNew ? 'rgba(251,198,76,0.06)' : 'transparent',
                                                                                                opacity: Math.max(0.3, 1 - i * 0.12),
                                                                                                transition: 'background 0.5s, opacity 0.4s',
                                                                                        }}
                                                                                >
                                                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: isNew ? 'var(--amber)' : 'var(--antiquity-2)', transition: 'color 0.4s' }}>
                                                                                                {ev.ip}
                                                                                        </span>
                                                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bronze-3)' }}>
                                                                                                {ev.type.replace(/_/g, ' ')}
                                                                                        </span>
                                                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--void-4)', background: 'var(--void-3)', padding: '1px 5px', borderRadius: 1 }}>
                                                                                                :{ev.port}
                                                                                        </span>
                                                                                        <span style={{
                                                                                                fontFamily: 'var(--font-mono)', fontSize: 9,
                                                                                                color, background: `${color}14`,
                                                                                                border: `1px solid ${color}35`,
                                                                                                padding: '2px 6px', borderRadius: 1,
                                                                                        }}>
                                                                                                {ev.sev}
                                                                                        </span>
                                                                                </div>
                                                                        )
                                                                })}

                                                                {/* Terminal footer */}
                                                                <div style={{
                                                                        padding: '10px 16px',
                                                                        borderTop: '1px solid var(--void-4)',
                                                                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                                                        background: 'rgba(0,0,0,0.3)',
                                                                }}>
                                                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)' }}>
                                                                                $ tail -f /var/log/honeypot/events.log
                                                                        </span>
                                                                        <div className="cursor-blink" style={{ width: 6, height: 11 }} />
                                                                </div>
                                                        </div>
                                                </div>

                                                {/* Floating counter badge */}
                                                <div style={{
                                                        position: 'absolute', bottom: -28, right: -20,
                                                        background: 'var(--void-2)',
                                                        border: '1px solid rgba(251,198,76,0.2)',
                                                        borderRadius: 2,
                                                        padding: '14px 20px',
                                                        boxShadow: '0 0 30px rgba(251,198,76,0.1)',
                                                }}>
                                                        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: 'var(--amber)', lineHeight: 1, letterSpacing: '-0.02em' }}>
                                                                {totalCaptured.toLocaleString()}
                                                        </div>
                                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', marginTop: 5, letterSpacing: '0.12em' }}>
                                                                EVENTS CAPTURED
                                                        </div>
                                                </div>
                                        </div>
                                </div>

                                {/* Diagonal bottom separator */}
                                <div style={{
                                        position: 'absolute', bottom: 0, left: 0, right: 0,
                                        height: 1,
                                        background: 'linear-gradient(90deg, transparent, var(--amber), transparent)',
                                        opacity: 0.2,
                                }} />
                        </section>

                        {/* ── Stats Bar ── */}
                        <section style={{
                                borderTop: '1px solid var(--void-4)',
                                borderBottom: '1px solid var(--void-4)',
                                background: 'rgba(251,198,76,0.015)',
                                padding: '32px 48px',
                        }}>
                                <div style={{
                                        maxWidth: 1200, margin: '0 auto',
                                        display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
                                        gap: 0,
                                }}>
                                        {STATS.map((s, i) => (
                                                <div
                                                        key={s.label}
                                                        style={{
                                                                textAlign: 'center',
                                                                padding: '0 32px',
                                                                borderRight: i < STATS.length - 1 ? '1px solid var(--void-4)' : 'none',
                                                        }}
                                                >
                                                        <div style={{
                                                                fontFamily: 'var(--font-display)', fontWeight: 800,
                                                                fontSize: 40, color: 'var(--amber)', lineHeight: 1,
                                                                letterSpacing: '-0.03em',
                                                                textShadow: '0 0 30px rgba(251,198,76,0.2)',
                                                        }}>
                                                                {s.value}
                                                        </div>
                                                        <div style={{
                                                                fontFamily: 'var(--font-mono)', fontSize: 9,
                                                                color: 'var(--bronze-3)', marginTop: 8,
                                                                letterSpacing: '0.16em', textTransform: 'uppercase',
                                                        }}>
                                                                {s.label}
                                                        </div>
                                                </div>
                                        ))}
                                </div>
                        </section>

                        {/* ── Features ── */}
                        <section style={{ padding: '100px 48px', maxWidth: 1440, margin: '0 auto' }}>
                                <div style={{ marginBottom: 64 }}>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', letterSpacing: '0.2em', marginBottom: 16 }}>
                                                ARCHITECTURE / PIPELINE
                                        </div>
                                        <h2 style={{
                                                fontFamily: 'var(--font-display)', fontWeight: 800,
                                                fontSize: 'clamp(32px, 3.5vw, 52px)',
                                                color: 'var(--antiquity)', margin: 0,
                                                letterSpacing: '-0.03em',
                                                lineHeight: 1.05,
                                        }}>
                                                Four layers.<br />
                                                <span style={{ color: 'var(--bronze)', fontSize: '0.75em', fontWeight: 700 }}>One pipeline.</span>
                                        </h2>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--void-4)' }}>
                                        {FEATURES.map((f) => (
                                                <div
                                                        key={f.id}
                                                        className="feat-card"
                                                        style={{ borderRadius: 0, border: 'none', background: 'var(--void-2)' }}
                                                >
                                                        <div style={{
                                                                fontFamily: 'var(--font-mono)', fontWeight: 600,
                                                                fontSize: 32, color: f.accent, marginBottom: 24,
                                                                opacity: 0.5, lineHeight: 1,
                                                        }}>
                                                                {f.id}
                                                        </div>
                                                        <div style={{
                                                                fontFamily: 'var(--font-display)', fontWeight: 700,
                                                                fontSize: 16, color: 'var(--antiquity)',
                                                                marginBottom: 12, lineHeight: 1.3,
                                                        }}>
                                                                {f.title}
                                                        </div>
                                                        <div style={{
                                                                fontFamily: 'var(--font-display)', fontSize: 13,
                                                                color: 'var(--bronze-3)', lineHeight: 1.7, fontWeight: 400,
                                                        }}>
                                                                {f.desc}
                                                        </div>
                                                        {/* Bottom accent line */}
                                                        <div style={{
                                                                position: 'absolute', bottom: 0, left: 0, right: 0,
                                                                height: 2, background: f.accent, opacity: 0,
                                                                transition: 'opacity 0.25s',
                                                        }}
                                                                onMouseEnter={e => (e.currentTarget.style.opacity = '0.6')}
                                                                onMouseLeave={e => (e.currentTarget.style.opacity = '0')}
                                                        />
                                                </div>
                                        ))}
                                </div>
                        </section>

                        {/* ── ML Pipeline Visual ── */}
                        <section style={{
                                padding: '80px 48px',
                                background: 'var(--void-2)',
                                borderTop: '1px solid var(--void-4)',
                                borderBottom: '1px solid var(--void-4)',
                        }}>
                                <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                                        <div style={{ textAlign: 'center', marginBottom: 56 }}>
                                                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', letterSpacing: '0.2em', marginBottom: 12 }}>
                                                        ML PIPELINE
                                                </div>
                                                <h3 style={{
                                                        fontFamily: 'var(--font-display)', fontWeight: 800,
                                                        fontSize: 36, color: 'var(--antiquity)', margin: 0, letterSpacing: '-0.02em',
                                                }}>
                                                        Three models. One verdict.
                                                </h3>
                                        </div>

                                        <div style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
                                                {[
                                                        { name: 'Isolation\nForest', role: 'Anomaly Detection', color: 'var(--amber)', desc: 'Detects novel attack patterns without labeled data' },
                                                        { name: 'XGBoost\n+ RF', role: 'Classification', color: 'var(--bronze)', desc: 'Classifies attack type with 94%+ accuracy' },
                                                        { name: 'Bi-LSTM', role: 'Sequence Prediction', color: 'var(--amber)', desc: 'Predicts attacker\'s next move from event sequence' },
                                                ].map((model, i) => (
                                                        <div key={model.name} style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                                                                <div style={{
                                                                        flex: 1,
                                                                        background: 'var(--void)',
                                                                        border: `1px solid ${model.color}33`,
                                                                        borderRadius: 2,
                                                                        padding: '28px 24px',
                                                                        position: 'relative',
                                                                        textAlign: 'center',
                                                                }}>
                                                                        {/* Step number */}
                                                                        <div style={{
                                                                                position: 'absolute', top: -1, left: 20,
                                                                                background: model.color, color: 'var(--void)',
                                                                                fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 600,
                                                                                padding: '2px 8px', letterSpacing: '0.1em',
                                                                        }}>
                                                                                LAYER {i + 1}
                                                                        </div>
                                                                        <div style={{
                                                                                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18,
                                                                                color: model.color, marginTop: 12, marginBottom: 6,
                                                                                whiteSpace: 'pre-line', lineHeight: 1.2,
                                                                        }}>
                                                                                {model.name}
                                                                        </div>
                                                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', letterSpacing: '0.1em', marginBottom: 10 }}>
                                                                                {model.role}
                                                                        </div>
                                                                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, color: 'var(--antiquity-4)', lineHeight: 1.5, fontWeight: 400 }}>
                                                                                {model.desc}
                                                                        </div>
                                                                </div>
                                                                {i < 2 && (
                                                                        <div style={{
                                                                                width: 60, height: 2, flexShrink: 0,
                                                                                background: `linear-gradient(90deg, var(--amber), var(--bronze))`,
                                                                                opacity: 0.4, position: 'relative',
                                                                        }}>
                                                                                <div style={{
                                                                                        position: 'absolute', right: -4, top: -4,
                                                                                        border: '4px solid transparent', borderLeft: '8px solid var(--amber)',
                                                                                        opacity: 0.6,
                                                                                }} />
                                                                        </div>
                                                                )}
                                                        </div>
                                                ))}
                                        </div>
                                </div>
                        </section>

                        {/* ── CTA ── */}
                        <section style={{
                                padding: '120px 48px',
                                position: 'relative',
                                overflow: 'hidden',
                                textAlign: 'center',
                        }}>
                                <div style={{
                                        position: 'absolute', top: '50%', left: '50%',
                                        transform: 'translate(-50%, -50%)',
                                        width: 800, height: 400,
                                        background: 'radial-gradient(ellipse, rgba(251,198,76,0.06) 0%, transparent 65%)',
                                        pointerEvents: 'none',
                                }} />
                                <div style={{
                                        position: 'relative', zIndex: 1,
                                        maxWidth: 600, margin: '0 auto',
                                }}>
                                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', letterSpacing: '0.2em', marginBottom: 20 }}>
                                                RESTRICTED ACCESS
                                        </div>
                                        <h2 style={{
                                                fontFamily: 'var(--font-display)', fontWeight: 800,
                                                fontSize: 'clamp(36px, 4vw, 56px)',
                                                color: 'var(--antiquity)', margin: '0 0 16px',
                                                letterSpacing: '-0.03em', lineHeight: 1.05,
                                        }}>
                                                The trap is<br />
                                                <span style={{ color: 'var(--amber)', textShadow: '0 0 30px rgba(251,198,76,0.3)' }}>
                                                        already set.
                                                </span>
                                        </h2>
                                        <p style={{
                                                fontFamily: 'var(--font-display)', fontSize: 15,
                                                color: 'var(--bronze-3)', marginBottom: 48, fontWeight: 400,
                                        }}>
                                                Threat actors are probing your network right now.
                                                See who they are — before you know it.
                                        </p>
                                        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
                                                <button className="btn-primary" onClick={() => navigate('/dashboard')} style={{ padding: '14px 40px', fontSize: 14 }}>
                                                        Enter Command Center →
                                                </button>
                                                <button className="btn-ghost" onClick={() => navigate('/ip')} style={{ padding: '14px 28px', fontSize: 14 }}>
                                                        Score an IP
                                                </button>
                                        </div>
                                </div>
                        </section>

                        {/* ── Footer ── */}
                        <footer style={{
                                borderTop: '1px solid var(--void-4)',
                                padding: '24px 48px',
                                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                background: 'var(--void)',
                        }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                        <div style={{
                                                width: 22, height: 22,
                                                background: 'var(--amber)', borderRadius: 2,
                                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        }}>
                                                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 8, color: '#000' }}>HC</span>
                                        </div>
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bronze-3)' }}>
                                                HoneyCloud · MIT License
                                        </span>
                                </div>
                                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bronze-3)', opacity: 0.6 }}>
                                        Cowrie · Isolation Forest · XGBoost · Bi-LSTM · MITRE ATT&CK
                                </span>
                        </footer>
                </div>
        )
}