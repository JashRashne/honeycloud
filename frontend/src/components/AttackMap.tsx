import { useEffect, useState } from 'react'
import { getTopIPs } from '../api/clients'
import type { TopIP } from '../types'

const W = 800, H = 380
function project(lng: number, lat: number): [number, number] {
  return [((lng + 180) / 360) * W, ((90 - lat) / 180) * H]
}
const SEV_DOT: Record<string, string> = { CRITICAL: '#B91C1C', HIGH: '#C2410C', MEDIUM: '#92400E', LOW: '#065F46' }
function scoreToSev(s: number | null) {
  if (!s) return 'LOW'; if (s >= .80) return 'CRITICAL'; if (s >= .60) return 'HIGH'; if (s >= .40) return 'MEDIUM'; return 'LOW'
}
const PRIV: [number, number] = project(-30, 20)
const LAND = [
  "M 155,57 L 130,62 L 110,76 L 105,90 L 115,105 L 130,114 L 140,133 L 150,147 L 160,143 L 170,133 L 180,119 L 185,105 L 175,90 L 170,76 L 165,67 Z",
  "M 165,157 L 155,162 L 148,176 L 150,200 L 158,219 L 165,233 L 172,228 L 178,209 L 175,190 L 172,171 Z",
  "M 355,52 L 345,57 L 340,67 L 348,74 L 360,76 L 372,71 L 378,62 L 370,55 Z",
  "M 355,105 L 345,119 L 342,138 L 348,162 L 358,176 L 368,169 L 374,152 L 372,133 L 368,114 L 360,102 Z",
  "M 390,52 L 375,59 L 370,71 L 378,84 L 395,87 L 415,84 L 435,76 L 450,67 L 445,55 L 425,49 Z",
  "M 385,40 L 370,44 L 365,52 L 375,57 L 390,55 L 420,49 L 450,46 L 470,40 L 455,34 L 430,32 Z",
  "M 520,214 L 508,219 L 505,233 L 512,245 L 525,247 L 538,239 L 542,226 L 535,216 Z",
  "M 550,76 L 545,81 L 548,87 L 555,86 L 558,79 Z",
  "M 480,124 L 472,131 L 475,140 L 483,144 L 492,139 L 494,128 L 488,121 Z",
]

interface GeoResult { ip: string; lat: number | null; lon: number | null; country: string | null; city: string | null; private: boolean }
interface Dot { x: number; y: number; ip: string; sev: string; count: number; country: string | null; city: string | null; isPrivate: boolean }

export function AttackMap() {
  const [dots, setDots] = useState<Dot[]>([])
  const [tooltip, setTooltip] = useState<Dot | null>(null)
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const { top_ips } = await getTopIPs(20)
        if (!top_ips.length) return
        const res = await fetch(`/api/geoip?ips=${encodeURIComponent(top_ips.map((i: TopIP) => i.src_ip).join(','))}`)
        const geo: { results: Record<string, GeoResult> } = await res.json()
        let po = 0; const nd: Dot[] = []
        top_ips.forEach((ip: TopIP) => {
          const g = geo.results[ip.src_ip]; if (!g) return
          let x: number, y: number
          if (g.private || !g.lat || !g.lon) { x = PRIV[0] + (po % 3) * 12 - 12; y = PRIV[1] + Math.floor(po / 3) * 12 - 6; po++ }
          else { const j = () => (Math.random() - .5) * 4;[x, y] = project(g.lon! + j(), g.lat! + j()) }
          nd.push({ x, y, ip: ip.src_ip, sev: scoreToSev(ip.max_anomaly_score), count: ip.total_events, country: g.private ? 'Local' : g.country, city: g.private ? 'Private IP' : g.city, isPrivate: g.private || !g.lat })
        })
        setDots(nd)
      } catch { }
    }
    load()
    const t = setInterval(load, 60_000)
    const p = setInterval(() => setPulse(n => n + 1), 2200)
    return () => { clearInterval(t); clearInterval(p) }
  }, [])

  return (
    <div className="panel au">
      <div className="panel-hd">
        <span className="label">Where attacks come from</span>
        <span className="label" style={{ color: 'var(--char6)' }}>{dots.length} active sources</span>
      </div>
      <div style={{ position: 'relative', background: '#F5EDDA' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 280, display: 'block' }}>
          <rect width={W} height={H} fill="#F5EDDA" />
          {[-60, -30, 0, 30, 60].map(lat => { const [, y] = project(0, lat); return <line key={lat} x1={0} y1={y} x2={W} y2={y} stroke="#DDD0B3" strokeWidth=".5" /> })}
          {[-120, -60, 0, 60, 120].map(lng => { const [x] = project(lng, 0); return <line key={lng} x1={x} y1={0} x2={x} y2={H} stroke="#DDD0B3" strokeWidth=".5" /> })}
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#C8B896" strokeWidth=".8" strokeDasharray="5 5" />
          {LAND.map((d, i) => <path key={i} d={d} fill="#D4C5A0" stroke="#C4B390" strokeWidth=".8" />)}
          {dots.some(d => d.isPrivate) && (
            <>
              <rect x={PRIV[0] - 30} y={PRIV[1] - 25} width={80} height={60} rx="2" fill="none" stroke="#C9B7A1" strokeWidth=".8" strokeDasharray="4 3" opacity={.7} />
              <text x={PRIV[0] + 10} y={PRIV[1] - 14} textAnchor="middle" fontSize="7" fill="#9B6A35" fontFamily="DM Mono" letterSpacing=".1em">LOCAL</text>
            </>
          )}
          {dots.map((dot, i) => {
            const color = SEV_DOT[dot.sev]
            const r = Math.min(3 + Math.log10(dot.count + 1) * 2.5, 9)
            const isPulsing = pulse % 2 === i % 2
            return (
              <g key={dot.ip} onMouseEnter={() => setTooltip(dot)} onMouseLeave={() => setTooltip(null)} style={{ cursor: 'pointer' }}>
                <circle cx={dot.x} cy={dot.y} r={r + 7 + (isPulsing ? 4 : 0)} fill="none" stroke={color} strokeWidth=".5" opacity={isPulsing ? .22 : .07} style={{ transition: 'r 1.2s ease,opacity 1.2s ease' }} />
                <circle cx={dot.x} cy={dot.y} r={r + 3} fill="none" stroke={color} strokeWidth=".5" opacity={.12} />
                <circle cx={dot.x} cy={dot.y} r={r} fill={dot.isPrivate ? 'none' : color} stroke={color} strokeWidth={dot.isPrivate ? '1.5' : '0'} strokeDasharray={dot.isPrivate ? '3 2' : 'none'} opacity={.85} style={{ filter: `drop-shadow(0 1px 3px ${color}55)` }} />
                {dot.isPrivate && <circle cx={dot.x} cy={dot.y} r={r * .45} fill={color} opacity={.6} />}
              </g>
            )
          })}
        </svg>

        {tooltip && (
          <div style={{ position: 'absolute', top: 10, right: 10, background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 8, padding: '10px 14px', minWidth: 148, pointerEvents: 'none', boxShadow: '0 4px 20px rgba(0,0,0,.1)' }}>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--char2)', fontWeight: 600, marginBottom: 4 }}>{tooltip.ip}</div>
            {tooltip.city && <div className="label" style={{ fontSize: 8, color: 'var(--char5)' }}>{tooltip.city}</div>}
            {tooltip.country && <div className="label" style={{ fontSize: 8, color: 'var(--char5)', marginBottom: 4 }}>{tooltip.country}</div>}
            <div style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--char5)', marginBottom: 4 }}>{tooltip.count.toLocaleString()} events</div>
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, fontWeight: 600, color: SEV_DOT[tooltip.sev] }}>{tooltip.sev}</div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 14, padding: '6px 14px', borderTop: '1px solid var(--bdr)', flexWrap: 'wrap', alignItems: 'center', background: 'rgba(245,237,218,.8)' }}>
          {Object.entries(SEV_DOT).map(([sev, col]) => (
            <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: col, display: 'inline-block', boxShadow: `0 0 4px ${col}55` }} />
              <span className="label" style={{ fontSize: 8 }}>{sev}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}