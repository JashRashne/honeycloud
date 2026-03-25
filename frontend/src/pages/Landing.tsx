import { useNavigate } from 'react-router-dom'
import { useEffect, useRef, useState } from 'react'
import { Box, Brain, Zap, Globe, Link as LinkIcon, BarChart3, ArrowRight } from 'lucide-react'

const TAGLINES = ['Every attacker leaves a trace.', 'Decoy. Detect. Destroy.', 'The trap is already set.', 'See threats before they see you.']

const FAKE_EVENTS = [
        { ip: '45.33.32.156', type: 'Password Guessing', sev: 'CRITICAL' },
        { ip: '94.102.49.190', type: 'Website Scanning', sev: 'HIGH' },
        { ip: '185.220.101.3', type: 'Database Probing', sev: 'HIGH' },
        { ip: '198.20.69.74', type: 'Port Scanning', sev: 'MEDIUM' },
        { ip: '91.241.19.80', type: 'Remote Access Probe', sev: 'MEDIUM' },
        { ip: '162.247.72.21', type: 'File Share Attack', sev: 'CRITICAL' },
]
const SEV_COLOR: Record<string, string> = { CRITICAL: '#B91C1C', HIGH: '#C2410C', MEDIUM: '#92400E', LOW: '#065F46' }
const SEV_BG: Record<string, string> = { CRITICAL: 'rgba(185,28,28,.12)', HIGH: 'rgba(194,65,12,.12)', MEDIUM: 'rgba(146,64,14,.12)', LOW: 'rgba(6,95,70,.12)' }

const HOW = [
        { n: '01', title: 'We set the trap', desc: 'HoneyCloud creates fake servers that look exactly like real ones — SSH terminals, web apps, databases. Attackers can\'t tell the difference.' },
        { n: '02', title: 'Attackers take the bait', desc: 'When someone tries to break in, they interact with our decoys instead of your real systems. Every move they make is recorded.' },
        { n: '03', title: 'We score every threat', desc: 'Three AI models instantly analyse the attack — detecting anomalies, classifying the attacker\'s technique, and predicting what they\'ll do next.' },
        { n: '04', title: 'You stay informed', desc: 'Get a real-time dashboard showing who is attacking, where they\'re from, how dangerous they are, and what steps to take.' },
]

const FEATURES = [
        { icon: <Box size={32} />, title: 'Realistic Decoys', desc: 'SSH servers, web apps and databases that behave like the real thing — sophisticated attackers can\'t tell they\'re fake.' },
        { icon: <Brain size={32} />, title: 'AI Threat Scoring', desc: 'Every attack is automatically scored using three different AI models. No manual analysis required.' },
        { icon: <Zap size={32} />, title: 'Attack Prediction', desc: 'Our Bi-LSTM model learns attacker patterns and tells you what they\'ll try next — before they do it.' },
        { icon: <Globe size={32} />, title: 'Global Attack Map', desc: 'See exactly where attacks are coming from on a live world map. Updated every minute.' },
        { icon: <LinkIcon size={32} />, title: 'Kill Chain Tracking', desc: 'Follow every step of an attack from first contact to final action — visualised as a clear timeline.' },
        { icon: <BarChart3 size={32} />, title: 'Intelligence Reports', desc: 'Every attacker IP gets a full dossier — their behaviour, risk score, and recommended response.' },
]

const STATS = [
        { val: '451K+', label: 'Attacks Captured' },
        { val: '20+', label: 'Decoy Types' },
        { val: '8', label: 'Global Sensors' },
        { val: '3-Layer', label: 'AI Pipeline' },
]

const MARQUEE_ITEMS = ['SSH Brute Force', 'Port Scanning', 'Database Probing', 'Web Exploitation', 'Credential Stuffing', 'Lateral Movement', 'Command Execution', 'Remote Access', 'File Share Attacks', 'Botnet Activity']

// ─── Canvas Rain ───────────────────────────────────────────────
function Rain() {
        const ref = useRef<HTMLCanvasElement>(null)
        useEffect(() => {
                const c = ref.current; if (!c) return
                const ctx = c.getContext('2d')!
                const resize = () => { c.width = c.offsetWidth; c.height = c.offsetHeight }
                resize(); window.addEventListener('resize', resize)
                const cols = Math.floor(c.width / 22)
                const drops = Array.from({ length: cols }, () => Math.random() * -40)
                const chars = '01アイウエカキ∞∂◈⬡░▒'
                const id = setInterval(() => {
                        ctx.fillStyle = 'rgba(253, 250, 243, 0.15)'; ctx.fillRect(0, 0, c.width, c.height)
                        for (let i = 0; i < drops.length; i++) {
                                const x = i * 22, y = drops[i] * 22
                                if (drops[i] > 0) {
                                        ctx.fillStyle = 'rgba(232,150,12,0.8)'; ctx.font = '11px DM Mono'; ctx.fillText(chars[Math.floor(Math.random() * chars.length)], x, y)
                                }
                                if (drops[i] > 3) {
                                        ctx.fillStyle = 'rgba(179,139,90,0.16)'; ctx.font = '10px DM Mono'; ctx.fillText(chars[Math.floor(Math.random() * chars.length)], x, y - 22)
                                }
                                if (y > c.height && Math.random() > 0.974) drops[i] = 0
                                drops[i] += 0.4
                        }
                }, 55)
                return () => { clearInterval(id); window.removeEventListener('resize', resize) }
        }, [])
        return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: .45, pointerEvents: 'none' }} />
}

export function Landing() {
        const navigate = useNavigate()
        const [tagIdx, setIdx] = useState(0)
        const [tagVis, setVis] = useState(true)
        const [tick, setTick] = useState(0)
        const [flashIdx, setFlash] = useState<number | null>(null)
        const [loaderDone, setLDone] = useState(false)
        const [loadStep, setLStep] = useState(0)
        const LOAD_LABELS = ['Initialising sensors…', 'Connecting to honeypots…', 'Loading threat models…', 'Ready.']

        // Page loader
        useEffect(() => {
                const steps = [0, 1, 2, 3].map((i, _, a) =>
                        setTimeout(() => setLStep(i), i * 480)
                )
                const done = setTimeout(() => {
                        setLDone(true)
                        const el = document.getElementById('page-loader')
                        if (el) el.classList.add('done')
                }, 2000)
                return () => { steps.forEach(clearTimeout); clearTimeout(done) }
        }, [])

        // Tagline rotator
        useEffect(() => {
                const t = setInterval(() => {
                        setVis(false)
                        setTimeout(() => { setIdx(i => (i + 1) % TAGLINES.length); setVis(true) }, 350)
                }, 3200)
                return () => clearInterval(t)
        }, [])

        // Live feed ticker
        useEffect(() => {
                const t = setInterval(() => {
                        setTick(n => n + 1)
                        setFlash(0)
                        setTimeout(() => setFlash(null), 700)
                }, 1700)
                return () => clearInterval(t)
        }, [])

        const visEvents = Array.from({ length: 5 }, (_, i) => FAKE_EVENTS[(tick + i) % FAKE_EVENTS.length])
        const counter = 451000 + tick * 3

        return (
                <>
                        {/* ── Page loader ── */}
                        <div id="page-loader">
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                                        <div className="ld-hex"><img src="/honeycloud.png" style={{ width: 64, height: 64, objectFit: 'contain', animation: 'ld-spin 2s ease-in-out infinite' }} alt="HoneyCloud Logo" /></div>
                                        <div className="ld-word">HoneyCloud</div>
                                        <div className="ld-sub">Threat Intelligence Platform</div>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
                                        <div className="ld-bar-wrap"><div className="ld-bar" /></div>
                                        <div className="ld-status">{LOAD_LABELS[loadStep]}</div>
                                </div>
                        </div>

                        <div className="land-root" style={{ visibility: loaderDone ? 'visible' : 'hidden', background: 'var(--cream)', color: 'var(--char)' }}>

                                {/* ── Sticky nav ── */}
                                <nav style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(253, 250, 243, 0.92)', borderBottom: '1px solid var(--bdr)', backdropFilter: 'blur(16px)', height: 64, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 48px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                                <img src="/honeycloud.png" style={{ width: 38, height: 38, objectFit: 'contain' }} alt="HoneyCloud Logo" />
                                                <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--char)', fontWeight: 600, letterSpacing: '-.01em' }}>HoneyCloud</div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 10 }}>
                                                <button className="btn-outline" onClick={() => navigate('/dashboard')} style={{ padding: '8px 24px', fontSize: 13, borderColor: 'var(--bdr2)', color: 'var(--char)' }}>Dashboard</button>
                                                <button className="btn-amber" onClick={() => navigate('/ip')} style={{ padding: '8px 24px', fontSize: 13 }}>Score an IP <ArrowRight size={14} style={{ marginLeft: 4, display: 'inline' }} /></button>
                                        </div>
                                </nav>

                                {/* ── HERO ── */}
                                <section className="land-section" style={{ minHeight: '90vh', display: 'flex', alignItems: 'center', overflow: 'hidden', position: 'relative' }}>
                                        <Rain />
                                        <div className="land-grid-bg" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,.03) 1px, transparent 1px)' }} />
                                        <div style={{ position: 'absolute', top: '15%', left: '35%', width: 700, height: 700, background: 'radial-gradient(circle, rgba(232,150,12,.1) 0%, transparent 65%)', pointerEvents: 'none' }} />

                                        <div style={{ position: 'relative', zIndex: 2, maxWidth: 1300, margin: '0 auto', width: '100%', padding: '80px 48px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>

                                                {/* Left */}
                                                <div className="au">
                                                        {/* Status pill */}
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '5px 14px', background: 'var(--amber-p)', border: '1px solid rgba(232,150,12,.2)', borderRadius: 99, marginBottom: 32 }}>
                                                                <div className="live-dot amber" style={{ width: 5, height: 5 }} />
                                                                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--amber)', fontWeight: 600, letterSpacing: '.2em' }}>LIVE — SENSORS ACTIVE</span>
                                                        </div>

                                                        <h1 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(52px, 6vw, 82px)', lineHeight: .97, letterSpacing: '-.02em', color: 'var(--char)', marginBottom: 12 }}>
                                                                Catch hackers<br />
                                                                <span style={{ fontStyle: 'italic', color: 'var(--amber)' }}>before they reach</span><br />
                                                                your real servers.
                                                        </h1>

                                                        {/* Tagline */}
                                                        <div style={{ height: 26, overflow: 'hidden', marginBottom: 28 }}>
                                                                <p style={{ fontFamily: 'var(--mono)', fontSize: 15, color: 'var(--char5)', margin: 0, letterSpacing: '.04em', opacity: tagVis ? 1 : 0, transform: `translateY(${tagVis ? 0 : -8}px)`, transition: 'opacity .3s, transform .3s' }}>
                                                                        {TAGLINES[tagIdx]}
                                                                </p>
                                                        </div>

                                                        <p style={{ fontFamily: 'var(--sans)', fontSize: 16, color: 'var(--char4)', lineHeight: 1.75, maxWidth: 460, marginBottom: 48, fontWeight: 400 }}>
                                                                HoneyCloud sets up fake servers that attract hackers. When they take the bait, we capture everything they do — and our AI tells you exactly how dangerous they are.
                                                        </p>

                                                        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                                                                <button className="btn-amber" onClick={() => navigate('/dashboard')} style={{ padding: '14px 32px', fontSize: 14 }}>
                                                                        See the Live Dashboard <ArrowRight size={16} style={{ marginLeft: 6, display: 'inline' }} />
                                                                </button>
                                                                <button className="btn-outline" onClick={() => navigate('/ip')} style={{ padding: '13px 24px', fontSize: 14, borderColor: 'var(--bdr2)', color: 'var(--char)' }}>
                                                                        Check Any IP Address
                                                                </button>
                                                        </div>
                                                </div>

                                                {/* Right — terminal preview */}
                                                <div className="au d2" style={{ position: 'relative' }}>
                                                        {/* Corner brackets */}
                                                        <div style={{ position: 'absolute', top: -2, left: -2, width: 18, height: 18, borderTop: '2px solid var(--amber)', borderLeft: '2px solid var(--amber)', zIndex: 2 }} />
                                                        <div style={{ position: 'absolute', bottom: -2, right: -2, width: 18, height: 18, borderBottom: '2px solid var(--amber)', borderRight: '2px solid var(--amber)', zIndex: 2 }} />

                                                        <div style={{ background: 'var(--char)', border: '1px solid var(--char2)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 24px 48px rgba(0,0,0,.25)' }}>
                                                                {/* Terminal bar */}
                                                                <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,.05)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,.03)' }}>
                                                                        <div style={{ display: 'flex', gap: 6 }}>
                                                                                {['#FF5F57', '#FFBD2E', '#28C840'].map(c => <div key={c} style={{ width: 9, height: 9, borderRadius: '50%', background: c }} />)}
                                                                        </div>
                                                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char5)' }}>honeycloud — live-feed</span>
                                                                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                                                                <div className="live-dot amber" style={{ width: 5, height: 5 }} />
                                                                                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--amber-l)', letterSpacing: '.1em' }}>LIVE</span>
                                                                        </div>
                                                                </div>

                                                                {/* Col headers */}
                                                                <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: 12, padding: '6px 16px', background: 'rgba(0,0,0,.2)' }}>
                                                                        {['ATTACKER IP', 'WHAT THEY TRIED', 'RISK'].map(h => (
                                                                                <span key={h} style={{ fontFamily: 'var(--mono)', fontSize: 8, color: 'var(--char6)', letterSpacing: '.14em' }}>{h}</span>
                                                                        ))}
                                                                </div>

                                                                {/* Events */}
                                                                <div style={{ padding: '4px 0' }}>
                                                                        {visEvents.map((ev, i) => {
                                                                                const c = SEV_COLOR[ev.sev]
                                                                                const bg = SEV_BG[ev.sev]
                                                                                const isNew = i === 0 && flashIdx === 0
                                                                                return (
                                                                                        <div key={`${ev.ip}-${i}`} style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr auto', gap: 12, padding: '10px 16px', alignItems: 'center', background: isNew ? 'rgba(232,150,12,.1)' : 'transparent', opacity: Math.max(.3, 1 - i * .13), transition: 'background .5s, opacity .4s' }}>
                                                                                                <span style={{ fontFamily: 'var(--mono)', fontSize: 12, color: isNew ? 'var(--amber-l)' : 'rgba(253,250,243,.9)', transition: 'color .4s' }}>{ev.ip}</span>
                                                                                                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--char6)' }}>{ev.type}</span>
                                                                                                <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: c, background: bg, padding: '2px 7px', borderRadius: 3, fontWeight: 600 }}>{ev.sev}</span>
                                                                                        </div>
                                                                                )
                                                                        })}
                                                                </div>

                                                                {/* Footer */}
                                                                <div style={{ padding: '10px 16px', borderTop: '1px solid rgba(255,255,255,.05)', background: 'rgba(0,0,0,.3)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char5)' }}>$ honeypot-monitor --watch</span>
                                                                        <div style={{ width: 6, height: 12, background: 'var(--amber)', opacity: .8, animation: 'pulse-s 1s step-end infinite' }} />
                                                                </div>
                                                        </div>

                                                        {/* Floating counter */}
                                                        <div style={{ position: 'absolute', bottom: -28, right: -16, background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 12, padding: '16px 22px', boxShadow: '0 12px 32px rgba(0,0,0,.08)' }}>
                                                                <div style={{ fontFamily: 'var(--serif)', fontSize: 32, color: 'var(--amber)', lineHeight: 1, letterSpacing: '-.02em', fontWeight: 600 }}>{counter.toLocaleString()}</div>
                                                                <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--char5)', marginTop: 6, letterSpacing: '.12em', textTransform: 'uppercase' }}>attacks captured</div>
                                                        </div>
                                                </div>
                                        </div>
                                </section>

                                {/* ── MARQUEE ── */}
                                <div className="marquee-wrap" style={{ background: 'var(--surf2)', borderTop: '1px solid var(--bdr)', borderBottom: '1px solid var(--bdr)' }}>
                                        <div className="marquee-track">
                                                {[...MARQUEE_ITEMS, ...MARQUEE_ITEMS].map((item, i) => (
                                                        <span key={i} className="marquee-item" style={{ color: 'var(--char4)' }}>
                                                                <span className="marquee-sep">◆</span>{item}
                                                        </span>
                                                ))}
                                        </div>
                                </div>

                                {/* ── HOW IT WORKS ── */}
                                <section className="land-section" style={{ padding: '120px 48px', background: 'var(--surf2)' }}>
                                        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
                                                <div style={{ textAlign: 'center', marginBottom: 80 }}>
                                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--amber)', fontWeight: 600, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 20 }}>How It Works</div>
                                                        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(32px, 4vw, 54px)', color: 'var(--char)', letterSpacing: '-.02em', lineHeight: 1.05 }}>
                                                                Simple idea.<br /><span style={{ fontStyle: 'italic', color: 'var(--amber)' }}>Powerful results.</span>
                                                        </h2>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--bdr)' }}>
                                                        {HOW.map((h, i) => (
                                                                <div key={h.n} style={{ background: 'var(--surf)', padding: '48px 32px', position: 'relative' }}>
                                                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 42, marginBottom: 24, lineHeight: 1, fontWeight: 700 }}>{h.n}</div>
                                                                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: `linear-gradient(90deg, var(--amber) ${(i + 1) * 25}%, transparent)`, opacity: .4 }} />
                                                                        <div style={{ fontFamily: 'var(--serif)', fontSize: 22, color: 'var(--char)', marginBottom: 16, lineHeight: 1.3, fontWeight: 600 }}>{h.title}</div>
                                                                        <div style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--char4)', lineHeight: 1.7, fontWeight: 400 }}>{h.desc}</div>
                                                                </div>
                                                        ))}
                                                </div>
                                        </div>
                                </section>

                                {/* ── STATS ── */}
                                <section style={{ padding: '80px 48px', borderTop: '1px solid var(--bdr)', borderBottom: '1px solid var(--bdr)', background: 'var(--surf)' }}>
                                        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
                                                {STATS.map((s, i) => (
                                                        <div key={s.label} style={{ textAlign: 'center', padding: '0 24px', borderRight: i < 3 ? '1px solid var(--bdr)' : 'none' }}>
                                                                <div className="land-stat-num" style={{ color: 'var(--amber)' }}>{s.val}</div>
                                                                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--char5)', marginTop: 12, letterSpacing: '.16em', textTransform: 'uppercase', fontWeight: 500 }}>{s.label}</div>
                                                        </div>
                                                ))}
                                        </div>
                                </section>

                                {/* ── FEATURES ── */}
                                <section style={{ padding: '120px 48px' }}>
                                        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
                                                <div style={{ marginBottom: 80 }}>
                                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--amber)', fontWeight: 600, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 20 }}>What You Get</div>
                                                        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(28px, 3.5vw, 48px)', color: 'var(--char)', letterSpacing: '-.02em', lineHeight: 1.05 }}>
                                                                Everything you need<br />
                                                                <span style={{ fontStyle: 'italic', color: 'var(--amber)' }}>to stay one step ahead.</span>
                                                        </h2>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20 }}>
                                                        {FEATURES.map((f, i) => (
                                                                <div key={f.title} className="feature-card" style={{ animationDelay: `${i * .06}s`, background: 'var(--surf)', border: '1px solid var(--bdr)' }}>
                                                                        <div style={{ color: 'var(--amber)', marginBottom: 20 }}>{f.icon}</div>
                                                                        <div style={{ fontFamily: 'var(--serif)', fontSize: 20, color: 'var(--char)', marginBottom: 12, lineHeight: 1.3, fontWeight: 600 }}>{f.title}</div>
                                                                        <div style={{ fontFamily: 'var(--sans)', fontSize: 14, color: 'var(--char4)', lineHeight: 1.7, fontWeight: 400 }}>{f.desc}</div>
                                                                </div>
                                                        ))}
                                                </div>
                                        </div>
                                </section >

                                {/* ── WHO IS IT FOR ── */}
                                < section style={{ padding: '100px 48px', background: 'var(--surf2)', borderTop: '1px solid var(--bdr)' }
                                }>
                                        <div style={{ maxWidth: 1000, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 80, alignItems: 'center' }}>
                                                <div>
                                                        <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--amber)', fontWeight: 600, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 20 }}>Who It's For</div>
                                                        <h2 style={{ fontFamily: 'var(--serif)', fontSize: 42, color: 'var(--char)', letterSpacing: '-.02em', marginBottom: 28, lineHeight: 1.1 }}>
                                                                Built for anyone who<br />
                                                                <span style={{ fontStyle: 'italic', color: 'var(--amber)' }}>needs to know.</span>
                                                        </h2>
                                                        <p style={{ fontFamily: 'var(--sans)', fontSize: 16, color: 'var(--char4)', lineHeight: 1.75, fontWeight: 400 }}>
                                                                Whether you're a solo developer protecting your side project, a security researcher studying attack patterns, or an enterprise team monitoring a complex network — HoneyCloud gives you the visibility you need, without the complexity you don't.
                                                        </p>
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                                                        {[
                                                                { who: 'Developers & Startups', what: 'Protect early infrastructure without a dedicated security team.' },
                                                                { who: 'Security Researchers', what: 'Study real attacker behaviour and techniques in the wild.' },
                                                                { who: 'IT & Security Teams', what: 'Add an early warning layer to your existing security stack.' },
                                                        ].map(r => (
                                                                <div key={r.who} style={{ display: 'flex', gap: 16, padding: '22px 24px', background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 12, alignItems: 'flex-start', boxShadow: '0 4px 12px rgba(0,0,0,.03)' }}>
                                                                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'var(--amber)', marginTop: 5, flexShrink: 0 }} />
                                                                        <div>
                                                                                <div style={{ fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 14, color: 'var(--char)', marginBottom: 6 }}>{r.who}</div>
                                                                                <div style={{ fontFamily: 'var(--sans)', fontSize: 13, color: 'var(--char4)', lineHeight: 1.6, fontWeight: 400 }}>{r.what}</div>
                                                                        </div>
                                                                </div>
                                                        ))}
                                                </div>
                                        </div>
                                </section >

                                {/* ── CTA ── */}
                                < section style={{ padding: '140px 48px', textAlign: 'center', position: 'relative', overflow: 'hidden' }}>
                                        <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 800, height: 400, background: 'radial-gradient(ellipse, rgba(232,150,12,.1) 0%, transparent 65%)', pointerEvents: 'none' }} />
                                        <div style={{ position: 'relative', zIndex: 1, maxWidth: 640, margin: '0 auto' }}>
                                                <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--amber)', fontWeight: 600, letterSpacing: '.2em', textTransform: 'uppercase', marginBottom: 24 }}>Get Started Now</div>
                                                <h2 style={{ fontFamily: 'var(--serif)', fontSize: 'clamp(42px, 5.5vw, 68px)', color: 'var(--char)', letterSpacing: '-.02em', marginBottom: 28, lineHeight: 1.05 }}>
                                                        The trap is already<br />
                                                        <span style={{ fontStyle: 'italic', color: 'var(--amber)' }}>set.</span>
                                                </h2>
                                                <p style={{ fontFamily: 'var(--sans)', fontSize: 16, color: 'var(--char4)', marginBottom: 56, fontWeight: 400, lineHeight: 1.7 }}>
                                                        Attackers are probing your network right now. Find out who they are — and stop them in their tracks.
                                                </p>
                                                <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
                                                        <button className="btn-amber" onClick={() => navigate('/dashboard')} style={{ padding: '16px 48px', fontSize: 15 }}>Enter the Dashboard <ArrowRight size={18} style={{ marginLeft: 8, display: 'inline' }} /></button>
                                                        <button className="btn-outline" onClick={() => navigate('/ip')} style={{ padding: '15px 36px', fontSize: 15, borderColor: 'var(--bdr2)', color: 'var(--char)' }}>Look Up an IP</button>
                                                </div>
                                        </div>
                                </section >

                                {/* ── Footer ── */}
                                < footer style={{ borderTop: '1px solid var(--bdr)', padding: '32px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 24, background: 'var(--surf)' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                                                <img src="/honeycloud.png" style={{ width: 28, height: 28, objectFit: 'contain' }} alt="Logo" />
                                                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--char5)', fontWeight: 500 }}>HoneyCloud — MIT License</span>
                                        </div>
                                        <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--char5)', opacity: .7 }}>Powered by Cowrie · Isolation Forest · XGBoost · Bi-LSTM · MITRE ATT&CK</span>
                                </footer >
                        </div >
                </>
        )
}