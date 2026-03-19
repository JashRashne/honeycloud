import { useEffect, useState } from 'react'
import { getTopIPs } from '../api/clients'
import type { TopIP } from '../types'

const W = 800, H = 400

function project(lng: number, lat: number): [number, number] {
  return [((lng + 180) / 360) * W, ((90 - lat) / 180) * H]
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#dc2626',
  HIGH:     '#ea580c',
  MEDIUM:   '#d97706',
  LOW:      '#3b82f6',
}

function scoreToSev(score: number | null) {
  if (!score) return 'LOW'
  if (score >= 0.80) return 'CRITICAL'
  if (score >= 0.60) return 'HIGH'
  if (score >= 0.40) return 'MEDIUM'
  return 'LOW'
}

// Private IP placeholder — mid-Atlantic, clearly "not a real location"
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
  ip: string
  lat: number | null
  lon: number | null
  country: string | null
  countryCode: string | null
  city: string | null
  private: boolean
}

interface Dot {
  x: number
  y: number
  ip: string
  sev: string
  count: number
  country: string | null
  city: string | null
  isPrivate: boolean
}

export function AttackMap() {
  const [dots, setDots]       = useState<Dot[]>([])
  const [tooltip, setTooltip] = useState<Dot | null>(null)
  const [pulse, setPulse]     = useState(0)

  useEffect(() => {
    const load = async () => {
      try {
        const { top_ips } = await getTopIPs(20)
        if (top_ips.length === 0) return

        const ipList = top_ips.map((ip: TopIP) => ip.src_ip).join(',')
        const geoRes = await fetch(`/api/geoip?ips=${encodeURIComponent(ipList)}`)
        const geoData: { results: Record<string, GeoResult> } = await geoRes.json()

        const newDots: Dot[] = []
        // Track private IP offset so multiple private IPs don't stack exactly
        let privateOffset = 0

        top_ips.forEach((ip: TopIP) => {
          const geo = geoData.results[ip.src_ip]
          if (!geo) return

          let x: number, y: number

          if (geo.private || !geo.lat || !geo.lon) {
            // Plot private IPs at fixed mid-Atlantic position with slight spread
            x = PRIVATE_COORD[0] + (privateOffset % 3) * 12 - 12
            y = PRIVATE_COORD[1] + Math.floor(privateOffset / 3) * 12 - 6
            privateOffset++
          } else {
            const jitter = () => (Math.random() - 0.5) * 4
            ;[x, y] = project(geo.lon + jitter(), geo.lat + jitter())
          }

          newDots.push({
            x, y,
            ip:        ip.src_ip,
            sev:       scoreToSev(ip.max_anomaly_score),
            count:     ip.total_events,
            country:   geo.private ? 'Local Network' : geo.country,
            city:      geo.private ? 'Private IP' : geo.city,
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
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">
          Attack Origins
        </h2>
        <span className="text-xs text-stone-400 font-mono">{dots.length} active sources</span>
      </div>

      <div className="relative bg-stone-50 p-2">
        <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ maxHeight: 340 }} className="block">
          <rect width={W} height={H} fill="#f0f4f8" rx="4" />

          {LAND_PATHS.map((d, i) => (
            <path key={i} d={d} fill="#dde3ea" stroke="#c8d0da" strokeWidth="0.5" />
          ))}

          {[-60, -30, 0, 30, 60].map(lat => {
            const [, y] = project(0, lat)
            return <line key={lat} x1={0} y1={y} x2={W} y2={y} stroke="#e2e8f0" strokeWidth="0.3" />
          })}
          {[-120, -60, 0, 60, 120].map(lng => {
            const [x] = project(lng, 0)
            return <line key={lng} x1={x} y1={0} x2={x} y2={H} stroke="#e2e8f0" strokeWidth="0.3" />
          })}

          {/* Private IP zone label */}
          {dots.some(d => d.isPrivate) && (
            <>
              <rect
                x={PRIVATE_COORD[0] - 30} y={PRIVATE_COORD[1] - 25}
                width={80} height={60}
                rx="4" fill="none"
                stroke="#94a3b8" strokeWidth="0.8" strokeDasharray="4 3"
                opacity={0.5}
              />
              <text
                x={PRIVATE_COORD[0] + 10} y={PRIVATE_COORD[1] - 12}
                textAnchor="middle"
                fontSize="8" fill="#94a3b8"
                fontFamily="monospace"
              >
                local
              </text>
            </>
          )}

          {/* Dots */}
          {dots.map((dot, i) => {
            const color = SEV_COLOR[dot.sev]
            const r = Math.min(3 + Math.log10(dot.count + 1) * 3, 10)
            return (
              <g key={dot.ip}
                onMouseEnter={() => setTooltip(dot)}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Pulse ring */}
                <circle
                  cx={dot.x} cy={dot.y}
                  r={r + 4 + (pulse % 2 === i % 2 ? 4 : 0)}
                  fill="none" stroke={color} strokeWidth="0.8"
                  opacity={pulse % 2 === i % 2 ? 0.3 : 0.1}
                  style={{ transition: 'r 1s ease, opacity 1s ease' }}
                />
                {/* Private IPs get dashed border, public get solid */}
                <circle
                  cx={dot.x} cy={dot.y} r={r}
                  fill={dot.isPrivate ? 'none' : color}
                  stroke={color}
                  strokeWidth={dot.isPrivate ? '1.5' : '0'}
                  strokeDasharray={dot.isPrivate ? '3 2' : 'none'}
                  opacity={0.85}
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
          <div
            className="absolute z-10 bg-white border border-stone-200 rounded-lg shadow-sm p-2.5 text-xs font-mono pointer-events-none"
            style={{ top: 8, right: 8, minWidth: 160 }}
          >
            <div className="font-semibold text-stone-800 mb-1">{tooltip.ip}</div>
            {tooltip.city && (
              <div className="text-stone-500 mb-0.5">{tooltip.city}</div>
            )}
            {tooltip.country && (
              <div className="text-stone-500 mb-0.5">{tooltip.country}</div>
            )}
            <div className="text-stone-400">{tooltip.count} events</div>
            <div className="font-semibold mt-1" style={{ color: SEV_COLOR[tooltip.sev] }}>
              {tooltip.sev}
            </div>
            {tooltip.isPrivate && (
              <div className="text-stone-300 text-[10px] mt-1">shown at placeholder position</div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-3 px-2 pb-1 pt-1 flex-wrap">
          {Object.entries(SEV_COLOR).map(([sev, color]) => (
            <div key={sev} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[10px] text-stone-400 font-mono">{sev}</span>
            </div>
          ))}
          <div className="flex items-center gap-1 ml-2 pl-2 border-l border-stone-200">
            <span className="w-2 h-2 rounded-full border border-dashed border-stone-400" />
            <span className="text-[10px] text-stone-400 font-mono">local/private</span>
          </div>
        </div>
      </div>
    </div>
  )
}