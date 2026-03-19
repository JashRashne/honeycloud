import { useEffect, useState, useRef } from 'react'
import { getTopIPs } from '../api/clients'
import type { TopIP } from '../types'

// Approximate country centroids for known attack source countries
// Mapped from common ASN/IP ranges seen in honeypot data
const COUNTRY_COORDS: Record<string, [number, number]> = {
  CN: [104.1954,  35.8617], RU: [ 37.6173, 55.7558], US: [-95.7129, 37.0902],
  DE: [ 10.4515,  51.1657], NL: [  5.2913, 52.1326], FR: [  2.2137, 46.2276],
  BR: [-51.9253, -14.2350], IN: [ 78.9629, 20.5937], KR: [127.7669, 35.9078],
  GB: [ -3.4360,  55.3781], JP: [138.2529, 36.2048], TW: [120.9605, 23.6978],
  UA: [ 31.1656,  48.3794], VN: [108.2772, 14.0583], SG: [103.8198,  1.3521],
  TR: [ 35.2433,  38.9637], IR: [ 53.6880,  32.4279], PL: [ 19.1451, 51.9194],
  IT: [ 12.5674,  41.8719], ES: [ -3.7492,  40.4637], TH: [100.9925, 15.8700],
  ID: [113.9213,  -0.7893], HK: [114.1694,  22.3193], AR: [-63.6167,-38.4161],
}

// SVG world map path — simplified Robinson projection bounding box
// We use a simple equirectangular projection: x = (lng+180)/360*W, y = (90-lat)/180*H
const W = 800, H = 400

function project(lng: number, lat: number): [number, number] {
  return [((lng + 180) / 360) * W, ((90 - lat) / 180) * H]
}

const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#dc2626', HIGH: '#ea580c', MEDIUM: '#d97706', LOW: '#3b82f6',
}

function scoreToSev(score: number | null) {
  if (!score) return 'LOW'
  if (score >= 0.80) return 'CRITICAL'
  if (score >= 0.60) return 'HIGH'
  if (score >= 0.40) return 'MEDIUM'
  return 'LOW'
}

// Minimal world map land masses as simplified SVG paths (equirectangular)
const LAND_PATHS = [
  // North America
  "M 155,60 L 130,65 L 110,80 L 105,95 L 115,110 L 130,120 L 140,140 L 150,155 L 160,150 L 170,140 L 180,125 L 185,110 L 175,95 L 170,80 L 165,70 Z",
  // South America
  "M 165,165 L 155,170 L 148,185 L 150,210 L 158,230 L 165,245 L 172,240 L 178,220 L 175,200 L 172,180 Z",
  // Europe
  "M 355,55 L 345,60 L 340,70 L 348,78 L 360,80 L 372,75 L 378,65 L 370,58 Z",
  // Africa
  "M 355,110 L 345,125 L 342,145 L 348,170 L 358,185 L 368,178 L 374,160 L 372,140 L 368,120 L 360,108 Z",
  // Asia (simplified)
  "M 390,55 L 375,62 L 370,75 L 378,88 L 395,92 L 415,88 L 435,80 L 450,70 L 445,58 L 425,52 Z",
  // Russia (simplified)
  "M 385,42 L 370,46 L 365,55 L 375,60 L 390,58 L 420,52 L 450,48 L 470,42 L 455,36 L 430,34 L 405,36 Z",
  // Australia
  "M 520,225 L 508,230 L 505,245 L 512,258 L 525,260 L 538,252 L 542,238 L 535,228 Z",
  // Japan
  "M 550,80 L 545,85 L 548,92 L 555,90 L 558,83 Z",
  // Southeast Asia
  "M 480,130 L 472,138 L 475,148 L 483,152 L 492,146 L 494,135 L 488,128 Z",
]

interface Dot {
  x: number
  y: number
  ip: string
  sev: string
  count: number
  country: string
}

export function AttackMap() {
  const [dots, setDots] = useState<Dot[]>([])
  const [tooltip, setTooltip] = useState<{ dot: Dot; mx: number; my: number } | null>(null)
  const [pulse, setPulse] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const load = async () => {
      try {
        const { top_ips } = await getTopIPs(20)
        const newDots: Dot[] = []
        top_ips.forEach((ip: TopIP) => {
          // Derive a pseudo-country from IP range for demo
          // In production this would use a GeoIP lookup
          const first = parseInt(ip.src_ip.split('.')[0])
          let country = 'US'
          if (first >= 1   && first <= 60)  country = 'CN'
          else if (first >= 61  && first <= 80)  country = 'JP'
          else if (first >= 81  && first <= 100) country = 'RU'
          else if (first >= 101 && first <= 120) country = 'IN'
          else if (first >= 170 && first <= 190) country = 'BR'
          else if (first >= 191 && first <= 200) country = 'DE'
          else if (first >= 210 && first <= 220) country = 'KR'

          const coords = COUNTRY_COORDS[country]
          if (!coords) return
          // Add slight jitter so dots don't stack exactly
          const jitter = () => (Math.random() - 0.5) * 8
          const [x, y] = project(coords[0] + jitter(), coords[1] + jitter())
          newDots.push({
            x, y, ip: ip.src_ip,
            sev: scoreToSev(ip.max_anomaly_score),
            count: ip.total_events,
            country,
          })
        })
        setDots(newDots)
      } catch { /* ignore */ }
    }
    load()
    const t = setInterval(load, 60_000)
    // Pulse animation
    const p = setInterval(() => setPulse(n => n + 1), 2000)
    return () => { clearInterval(t); clearInterval(p) }
  }, [])

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Attack Origins</h2>
        <span className="text-xs text-stone-400 font-mono">{dots.length} active sources</span>
      </div>

      <div className="relative bg-stone-50 p-2">
        <svg
          ref={svgRef}
          viewBox={`0 0 ${W} ${H}`}
          width="100%"
          className="block"
          style={{ maxHeight: 340 }}
        >
          {/* Ocean background */}
          <rect width={W} height={H} fill="#f0f4f8" rx="4" />

          {/* Land masses */}
          {LAND_PATHS.map((d, i) => (
            <path key={i} d={d} fill="#dde3ea" stroke="#c8d0da" strokeWidth="0.5" />
          ))}

          {/* Grid lines */}
          {[-60, -30, 0, 30, 60].map(lat => {
            const [, y] = project(0, lat)
            return <line key={lat} x1={0} y1={y} x2={W} y2={y} stroke="#e2e8f0" strokeWidth="0.3" />
          })}
          {[-120, -60, 0, 60, 120].map(lng => {
            const [x] = project(lng, 0)
            return <line key={lng} x1={x} y1={0} x2={x} y2={H} stroke="#e2e8f0" strokeWidth="0.3" />
          })}

          {/* Attack dots */}
          {dots.map((dot, i) => {
            const color = SEV_COLOR[dot.sev]
            const r = Math.min(3 + Math.log10(dot.count + 1) * 3, 10)
            return (
              <g key={dot.ip}
                onMouseEnter={e => setTooltip({ dot, mx: e.clientX, my: e.clientY })}
                onMouseLeave={() => setTooltip(null)}
                style={{ cursor: 'pointer' }}
              >
                {/* Pulse ring */}
                <circle
                  cx={dot.x} cy={dot.y}
                  r={r + 4 + (pulse % 2 === i % 2 ? 4 : 0)}
                  fill="none"
                  stroke={color}
                  strokeWidth="0.8"
                  opacity={pulse % 2 === i % 2 ? 0.3 : 0.1}
                  style={{ transition: 'r 1s ease, opacity 1s ease' }}
                />
                {/* Main dot */}
                <circle cx={dot.x} cy={dot.y} r={r} fill={color} opacity={0.85} />
              </g>
            )
          })}
        </svg>

        {/* Tooltip */}
        {tooltip && (
          <div className="absolute z-10 bg-white border border-stone-200 rounded-lg shadow-sm p-2 text-xs font-mono pointer-events-none"
            style={{ top: 8, right: 8 }}
          >
            <div className="font-semibold text-stone-800">{tooltip.dot.ip}</div>
            <div className="text-stone-500">{tooltip.dot.country} · {tooltip.dot.count} events</div>
            <div style={{ color: SEV_COLOR[tooltip.dot.sev] }} className="font-semibold">{tooltip.dot.sev}</div>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-3 px-2 pb-1 pt-1">
          {Object.entries(SEV_COLOR).map(([sev, color]) => (
            <div key={sev} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ background: color }} />
              <span className="text-[10px] text-stone-400 font-mono">{sev}</span>
            </div>
          ))}
          <span className="text-[10px] text-stone-300 font-mono ml-auto">dot size = event volume</span>
        </div>
      </div>
    </div>
  )
}