import { useEffect, useState } from 'react'
import { getTopIPs } from '../api/clients'
import type { TopIP } from '../types'

const W = 800, H = 400

function project(lng: number, lat: number): [number, number] {
  return [((lng + 180) / 360) * W, ((90 - lat) / 180) * H]
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#FF3B3B',
  HIGH: '#FF8800',
  MEDIUM: '#FBC64C',
  LOW: '#3DDB7A',
}

function scoreToSev(score: number | null) {
  if (!score) return 'LOW'
  if (score >= 0.80) return 'CRITICAL'
  if (score >= 0.60) return 'HIGH'
  if (score >= 0.40) return 'MEDIUM'
  return 'LOW'
}

const PRIVATE_COORD: [number, number] = project(-30, 20)

const LAND_PATHS = [
  "M 155,60 L 130,65 L 110,80 L 105,95 L 115,110 L 130,120 L 140,140 L 150,155 L 160,150 L 170,140 L 180,125 L 185,110 L 175,95 L 170,80 L 165,70 Z",
  "M 165,165 L 155,170 L 148,185 L 150,210 L 158,230 L 165,245 L 172,240 L 178,220 L 175,200 L 172,180 Z",
  "M 355,55 L 345,60 L 340,70 L 348,78 L 360,80 L 372,75 L 378,65 L 370,58 Z",
  "M 355,110 L 345,125 L 342,145 L 348,170 L 358,185 L 368,178 L 374,160 L 372,140 L 368,120 L 360,108 Z",
  "M 390,55 L 375,62 L 370,75 L 378,88 L 395,92 L 415,88 L 435,80 L 450,70 L 445,58 L 425,52 Z",
  "M 385,42 L 370,46 L 365,55 L 375,60 L 390,58 L 420,52 L 450,48 L 470,42 L 455,36 L 430,34 L 405,36 Z",
  "M 520,225 L 508,230 L 505,245 L 512,258 L 525,260 L 538,252 L 542,238 L 535,228 Z",
  "M 550,80 L 545,85 L 548,92 L 555,90 L 558,83 Z",
  "M 480,130 L 472,138 L 475,148 L 483,152 L 492,146 L 494,135 L 488,128 Z",
]

interface GeoResult {
  ip: string; lat: number | null; lon: number | null
  country: string | null; countryCode: string | null
  city: string | null; private: boolean
}

interface Dot {
  x: number; y: number; ip: string; sev: string
  count: number; country: string | null; city: string | null; isPrivate: boolean
}

export function AttackMap() {
  const [dots, setDots] = useState<Dot[]>([])
  const [tooltip, setTooltip] = useState<Dot | null>(null)
  const [pulse, setPulse] = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const { top_ips } = await getTopIPs(20)
        if (top_ips.length === 0) return
        const ipList = top_ips.map((ip: TopIP) => ip.src_ip).join(',')
        const geoRes = await fetch(`/api/geoip?ips=${encodeURIComponent(ipList)}`)
        const geoData: { results: Record<string, GeoResult> } = await geoRes.json()
        const newDots: Dot[] = []
        let privateOffset = 0
        top_ips.forEach((ip: TopIP) => {
          const geo = geoData.results[ip.src_ip]
          if (!geo) return
          let x: number, y: number
          if (geo.private || !geo.lat || !geo.lon) {
            x = PRIVATE_COORD[0] + (privateOffset % 3) * 12 - 12
            y = PRIVATE_COORD[1] + Math.floor(privateOffset / 3) * 12 - 6
            privateOffset++
          } else {
            const jitter = () => (Math.random() - 0.5) * 4
              ;[x, y] = project(geo.lon + jitter(), geo.lat + jitter())
          }
          newDots.push({
            x, y, ip: ip.src_ip,
            sev: scoreToSev(ip.max_anomaly_score),
            count: ip.total_events,
            country: geo.private ? 'Local Network' : geo.country,
            city: geo.private ? 'Private IP' : geo.city,
            isPrivate: geo.private || !geo.lat,
          })
        })
        setDots(newDots)
      } catch { /* ignore */ }
    }
    load()
    const t = setInterval(load, 60_000)
    const p = setInterval(() => setPulse(n => n + 1), 2000)
    return () => { clearInterval(t); clearInterval(p) }
  }, [])

  return (
    <div style={{ background: 'var(--void-2)', border: '1px solid var(--void-4)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid var(--void-4)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(251,198,76,0.02)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', letterSpacing: '0.18em' }}>
          ATTACK ORIGIN MAP
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)' }}>
          {dots.length} active sources
        </span>
      </div>

      <div style={{ position: 'relative', background: '#000' }}>
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 340, display: 'block' }}>
          {/* Background */}
          <rect width={W} height={H} fill="#000" />

          {/* Grid lines — subtle bronze */}
          {[-60, -30, 0, 30, 60].map(lat => {
            const [, y] = project(0, lat)
            return <line key={lat} x1={0} y1={y} x2={W} y2={y} stroke="#1a1208" strokeWidth="0.5" />
          })}
          {[-120, -60, 0, 60, 120].map(lng => {
            const [x] = project(lng, 0)
            return <line key={lng} x1={x} y1={0} x2={x} y2={H} stroke="#1a1208" strokeWidth="0.5" />
          })}

          {/* Equator */}
          <line x1={0} y1={H / 2} x2={W} y2={H / 2} stroke="#2d2010" strokeWidth="0.8" strokeDasharray="4 6" />

          {/* Land masses */}
          {LAND_PATHS.map((d, i) => (
            <path key={i} d={d} fill="#16110a" stroke="#2a1e0f" strokeWidth="0.8" />
          ))}

          {/* Private zone indicator */}
          {dots.some(d => d.isPrivate) && (
            <>
              <rect
                x={PRIVATE_COORD[0] - 30} y={PRIVATE_COORD[1] - 25}
                width={80} height={60} rx="1"
                fill="none" stroke="#3d2d14" strokeWidth="1"
                strokeDasharray="4 3" opacity={0.5}
              />
              <text x={PRIVATE_COORD[0] + 10} y={PRIVATE_COORD[1] - 14}
                textAnchor="middle" fontSize="7" fill="#4d3a1e" fontFamily="JetBrains Mono">
                LOCAL
              </text>
            </>
          )}

          {/* Attack dots */}
          {dots.map((dot, i) => {
            const color = SEV_COLOR[dot.sev]
            const r = Math.min(3 + Math.log10(dot.count + 1) * 2.5, 9)
            const isPulsing = pulse % 2 === i % 2
            return (
              <g key={dot.ip}
                onMouseEnter={() => setTooltip(dot)}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Outer pulse */}
                <circle cx={dot.x} cy={dot.y}
                  r={r + 8 + (isPulsing ? 5 : 0)}
                  fill="none" stroke={color} strokeWidth="0.5"
                  opacity={isPulsing ? 0.18 : 0.05}
                  style={{ transition: 'r 1.2s ease, opacity 1.2s ease' }}
                />
                {/* Mid ring */}
                <circle cx={dot.x} cy={dot.y} r={r + 3}
                  fill="none" stroke={color} strokeWidth="0.5" opacity={0.15} />
                {/* Core */}
                <circle cx={dot.x} cy={dot.y} r={r}
                  fill={dot.isPrivate ? 'none' : color}
                  stroke={color}
                  strokeWidth={dot.isPrivate ? '1.2' : '0'}
                  strokeDasharray={dot.isPrivate ? '3 2' : 'none'}
                  opacity={0.9}
                  style={{ filter: `drop-shadow(0 0 5px ${color})` }}
                />
                {dot.isPrivate && (
                  <circle cx={dot.x} cy={dot.y} r={r * 0.4} fill={color} opacity={0.6} />
                )}
              </g>
            )
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div style={{
            position: 'absolute', top: 10, right: 10,
            background: 'var(--void-2)',
            border: '1px solid var(--void-4)',
            borderRadius: 2,
            padding: '10px 14px',
            minWidth: 148,
            pointerEvents: 'none',
            boxShadow: '0 4px 24px rgba(0,0,0,0.6)',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: 'var(--antiquity)', fontWeight: 600, marginBottom: 5 }}>
              {tooltip.ip}
            </div>
            {tooltip.city && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)' }}>{tooltip.city}</div>
            )}
            {tooltip.country && (
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', marginBottom: 5 }}>{tooltip.country}</div>
            )}
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', marginBottom: 4 }}>
              {tooltip.count.toLocaleString()} events
            </div>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
              color: SEV_COLOR[tooltip.sev],
            }}>
              {tooltip.sev}
            </div>
          </div>
        )}

        {/* Legend */}
        <div style={{
          display: 'flex', gap: 14, padding: '6px 12px',
          background: 'rgba(0,0,0,0.4)',
          flexWrap: 'wrap', alignItems: 'center',
        }}>
          {Object.entries(SEV_COLOR).map(([sev, color]) => (
            <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{
                width: 6, height: 6, borderRadius: '50%',
                background: color,
                boxShadow: `0 0 5px ${color}`,
                display: 'inline-block',
              }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)', letterSpacing: '0.1em' }}>{sev}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginLeft: 8, paddingLeft: 8, borderLeft: '1px solid var(--void-4)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', border: '1px dashed var(--bronze-3)', display: 'inline-block' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)' }}>local/private</span>
          </div>
        </div>
      </div>
    </div>
  )
}