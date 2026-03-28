import { useEffect, useRef, useState } from 'react'
import { getTopIPs } from '../api/clients'
import type { TopIP } from '../types'
import { getGeoInfo, isPrivateIP } from '../utils/geo';

// ── Severity ─────────────────────────────────────────────────
const SEV_COLOR: Record<string, string> = {
  CRITICAL: '#FF3B3B',
  HIGH: '#FF7A00',
  MEDIUM: '#FBC64C',
  LOW: '#3DBA6E',
}

function scoreToSev(s: number | null): string {
  if (!s) return 'LOW'
  if (s >= 0.80) return 'CRITICAL'
  if (s >= 0.60) return 'HIGH'
  if (s >= 0.40) return 'MEDIUM'
  return 'LOW'
}

// ── Home = Kalyan, Maharashtra ────────────────────────────────
const HOME_LAT = 41.2591
const HOME_LNG = -95.8517


// ── Leaflet CDN loader ────────────────────────────────────────
let lfPromise: Promise<void> | null = null
function loadLeaflet(): Promise<void> {
  if (lfPromise) return lfPromise
  lfPromise = new Promise((res, rej) => {
    if ((window as any).L) { res(); return }
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
    document.head.appendChild(link)
    const script = document.createElement('script')
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'
    script.onload = () => res()
    script.onerror = rej
    document.head.appendChild(script)
  })
  return lfPromise
}

// ── Pulsing dot icon ─────────────────────────────────────────
function makeDotIcon(L: any, sev: string, count: number) {
  const col = SEV_COLOR[sev]
  const r = Math.min(7 + Math.log10(count + 1) * 3.5, 18)
  const size = (r + 16) * 2
  const cx = size / 2
  const uid = `g${(Math.random() * 1e6 | 0)}`

  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <defs>
        <radialGradient id="${uid}" cx="38%" cy="38%" r="62%">
          <stop offset="0%" stop-color="${col}" stop-opacity=".98"/>
          <stop offset="100%" stop-color="${col}" stop-opacity=".55"/>
        </radialGradient>
      </defs>
      <circle cx="${cx}" cy="${cx}" r="${r + 14}" fill="none" stroke="${col}" stroke-width="0.7" opacity=".14"/>
      <circle cx="${cx}" cy="${cx}" r="${r + 8}"  fill="none" stroke="${col}" stroke-width="0.9" opacity=".24"/>
      <circle cx="${cx}" cy="${cx}" r="${r}"
        fill="url(#${uid})"
        style="filter:drop-shadow(0 0 7px ${col}88)"/>
      <circle cx="${cx - r * 0.28}" cy="${cx - r * 0.3}" r="${r * 0.3}"
        fill="rgba(255,255,255,.55)"/>
    </svg>`,
    className: '',
    iconSize: [size, size],
    iconAnchor: [cx, cx],
    popupAnchor: [0, -(r + 14)],
  })
}

// ── Amber home pin ───────────────────────────────────────────
function makeHomeIcon(L: any) {
  return L.divIcon({
    html: `<svg xmlns="http://www.w3.org/2000/svg" width="26" height="34" viewBox="0 0 26 34">
      <defs>
        <radialGradient id="hg" cx="40%" cy="30%" r="70%">
          <stop offset="0%"   stop-color="#FFD976"/>
          <stop offset="100%" stop-color="#D49800"/>
        </radialGradient>
      </defs>
      <path d="M13 1C7.48 1 3 5.48 3 11c0 7.75 10 22 10 22S23 18.75 23 11C23 5.48 18.52 1 13 1z"
        fill="url(#hg)"
        stroke="rgba(255,255,255,.5)" stroke-width="1"
        style="filter:drop-shadow(0 3px 10px rgba(251,198,76,.75))"/>
      <circle cx="13" cy="11" r="3.8" fill="rgba(255,255,255,.88)"/>
    </svg>`,
    className: '',
    iconSize: [26, 34],
    iconAnchor: [13, 34],
    popupAnchor: [0, -36],
  })
}

let cssInjected = false
function injectMapCSS() {
  if (cssInjected) return
  cssInjected = true
  const s = document.createElement('style')
  s.textContent = `
    .hc-lf .leaflet-container { 
      background: #FDFDF9 !important; 
      font-family: 'JetBrains Mono', monospace; 
    }
    .hc-lf .leaflet-control-zoom {
      border: 1px solid rgba(95,55,24,.25)!important; 
      border-radius: 2px!important; 
    }
    .hc-lf .leaflet-control-zoom a {
      background: #FDFDF9 !important; 
      color: #5F3718 !important;
      border-color: rgba(95,55,24,.25)!important;
    }
    .hc-lf .leaflet-control-zoom a:hover { 
      background: #F7B733 !important; 
      color: #FFF !important; 
    }
    .hc-lf .leaflet-control-attribution {
      background: rgba(253,253,249,.95)!important; 
      color: rgba(95,55,24,.6)!important; 
    }

    .hc-popup .leaflet-popup-content-wrapper {
      background: #FDFDF9 !important;
      border: 1px solid #5F3718 !important;
      box-shadow: 0 8px 30px rgba(0,0,0,.12)!important;
    }
    .hc-popup .leaflet-popup-close-button { color: #5F3718 !important; }
    .hc-popup .leaflet-popup-close-button:hover { color: #FEC53C !important; }

    @keyframes hc-spin { to { transform:rotate(360deg); } }
    .hc-spin { animation:hc-spin .75s linear infinite; }
  `
  document.head.appendChild(s)
}

// ── Quadratic bezier arc (attacker → home) ───────────────────
function drawArc(L: any, map: any, fromLat: number, fromLng: number, sev: string) {
  const lat1 = fromLat, lng1 = fromLng
  const lat2 = HOME_LAT, lng2 = HOME_LNG
  const cLat = (lat1 + lat2) / 2 + Math.abs(lat1 - lat2) * 0.25
  const cLng = (lng1 + lng2) / 2

  const pts: [number, number][] = []
  for (let i = 0; i <= 30; i++) {
    const t = i / 30
    const mt = 1 - t
    pts.push([
      mt * mt * lat1 + 2 * mt * t * cLat + t * t * lat2,
      mt * mt * lng1 + 2 * mt * t * cLng + t * t * lng2,
    ])
  }

  const stroke = sev === 'CRITICAL' ? 'rgba(255,59,59,0.35)'
    : sev === 'HIGH' ? 'rgba(255,122,0,0.30)'
      : sev === 'MEDIUM' ? 'rgba(252,197,60,0.28)'
        : 'rgba(61,186,110,0.22)'
  const w = sev === 'CRITICAL' ? 1.6 : 1.1

  return L.polyline(pts, {
    color: stroke,
    weight: w,
    dashArray: '5 7',
    opacity: 1,
    smoothFactor: 1,
  }).addTo(map)
}

// ═════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════
export function AttackMap() {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<any>(null)
  const markersRef = useRef<any[]>([])
  const arcsRef = useRef<any[]>([])

  const [ready, setReady] = useState(false)
  const [loading, setLoading] = useState(true)
  const [plotCount, setPlotCount] = useState(0)

  // Init map once
  useEffect(() => {
    let cancelled = false
    loadLeaflet().then(() => {
      if (cancelled || !containerRef.current || mapRef.current) return
      injectMapCSS()
      const L = (window as any).L

      const map = L.map(containerRef.current, {
        center: [41.2591, -95.8517],
        zoom: 3,
        zoomControl: true,
        scrollWheelZoom: true,
        attributionControl: true,
        minZoom: 2,
        maxZoom: 18,
      })

      // 1. Clean white / very light basemap
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(map)

      // 2. Light yellow-tinted labels + roads overlay on top
      L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd',
        maxZoom: 19,
        opacity: 0.95,           // slightly transparent so it blends nicely
        zIndex: 650,
      }).addTo(map)

      // Home pin
      L.marker([HOME_LAT, HOME_LNG], { icon: makeHomeIcon(L), zIndexOffset: 3000 })
        .addTo(map)
        .bindPopup(`
          <div style="padding:13px 16px;min-width:170px">
            <div style="font-family:JetBrains Mono;font-size:8px;font-weight:600;color:#FBC64C;letter-spacing:.2em;margin-bottom:7px">HONEYPOT NODE</div>
            <div style="font-family:JetBrains Mono;font-size:13px;color:#5F3718;font-weight:600">Council Bluffs, Iowa</div>
            const HOME_LAT = 41.2591
const HOME_LNG = -95.8517

            <div style="font-family:JetBrains Mono;font-size:9px;color:#73421A;margin-top:3px">United States · 41.2591° N, 95.8517° W</div>
            <div style="margin-top:9px;padding-top:9px;border-top:1px solid rgba(95,55,24,.18);font-family:JetBrains Mono;font-size:8px;color:#73421A">
              All attack arcs terminate here
            </div>
          </div>
        `, { className: 'hc-popup' })

      mapRef.current = map
      setReady(true)
      setTimeout(() => map.invalidateSize(), 50)
    }).catch(console.error)

    return () => { cancelled = true }
  }, [])

  // Fetch IPs → geo → plot (unchanged except popup text color tweaks for light theme)
  useEffect(() => {
    if (!ready) return
    let cancelled = false

    const plot = async () => {
      setLoading(true)
      try {
        const { top_ips } = await getTopIPs(50)
        if (cancelled || !top_ips.length) { setLoading(false); return }

        const ipList = top_ips.map((ip: TopIP) => ip.src_ip);
        const { geoMap } = await getGeoInfo(ipList);
        if (cancelled) return

        const L = (window as any).L
        const map = mapRef.current
        if (!L || !map) return

        markersRef.current.forEach(m => map.removeLayer(m))
        arcsRef.current.forEach(a => map.removeLayer(a))
        markersRef.current = []
        arcsRef.current = []

        const sevOrder = { CRITICAL: 3, HIGH: 2, MEDIUM: 1, LOW: 0 } as Record<string, number>
        const sorted = [...top_ips].sort((a: TopIP, b: TopIP) =>
          (sevOrder[scoreToSev(a.max_anomaly_score)] ?? 0) -
          (sevOrder[scoreToSev(b.max_anomaly_score)] ?? 0)
        )

        let n = 0
        const bounds: [number, number][] = [[HOME_LAT, HOME_LNG]]

        sorted.forEach((ip: TopIP) => {
          if (isPrivateIP(ip.src_ip)) return
          const geo = geoMap[ip.src_ip]
          if (!geo || !geo.latitude || !geo.longitude) return

          const sev = scoreToSev(ip.max_anomaly_score)
          const col = SEV_COLOR[sev]
          const jit = () => (Math.random() - 0.5) * 0.09
          const lat = geo.latitude + jit()
          const lng = geo.longitude + jit()

          bounds.push([lat, lng])

          const arc = drawArc(L, map, lat, lng, sev)
          arcsRef.current.push(arc)

          const marker = L.marker([lat, lng], {
            icon: makeDotIcon(L, sev, ip.total_events),
            zIndexOffset: sev === 'CRITICAL' ? 900 : sev === 'HIGH' ? 600 : 0,
          })

          const locationStr = [geo.city, geo.country_name].filter(Boolean).join(', ') || 'Unknown location'

          const popup = `
            <div style="padding:14px 16px;min-width:210px;color:#5F3718">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:9px;border-bottom:1px solid rgba(95,55,24,.2)">
                <span style="font-family:JetBrains Mono;font-size:13px;font-weight:600;letter-spacing:.03em">${ip.src_ip}</span>
                <span style="font-family:JetBrains Mono;font-size:8px;font-weight:600;color:${col};background:${col}18;border:1px solid ${col}38;padding:2px 7px;letter-spacing:.08em">${sev}</span>
              </div>

              <div style="display:flex;align-items:center;gap:5px;margin-bottom:10px">
                <svg width="8" height="10" viewBox="0 0 8 10" xmlns="http://www.w3.org/2000/svg">
                  <path d="M4 0C1.8 0 0 1.8 0 4c0 3 4 6 4 6s4-3 4-6C8 1.8 6.2 0 4 0z" fill="${col}" opacity=".65"/>
                </svg>
                <span style="font-family:JetBrains Mono;font-size:10px">${locationStr}</span>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-bottom:10px">
                <div style="background:rgba(252,197,60,.08);border:1px solid rgba(95,55,24,.18);padding:8px 10px">
                  <div style="font-family:JetBrains Mono;font-size:7px;color:rgba(95,55,24,.55);letter-spacing:.12em;margin-bottom:4px">EVENTS</div>
                  <div style="font-family:Syne;font-size:17px;font-weight:800;line-height:1">${ip.total_events.toLocaleString()}</div>
                </div>
                <div style="background:rgba(252,197,60,.08);border:1px solid rgba(95,55,24,.18);padding:8px 10px">
                  <div style="font-family:JetBrains Mono;font-size:7px;color:rgba(95,55,24,.55);letter-spacing:.12em;margin-bottom:4px">ANOMALY</div>
                  <div style="font-family:Syne;font-size:17px;font-weight:800;color:${col};line-height:1">
                    ${ip.max_anomaly_score !== null ? (ip.max_anomaly_score * 100).toFixed(0) + '%' : '—'}
                  </div>
                </div>
              </div>

              ${ip.max_anomaly_score !== null ? `
              <div style="margin-bottom:9px">
                <div style="background:rgba(95,55,24,.12);border-radius:1px;height:3px">
                  <div style="width:${(ip.max_anomaly_score * 100).toFixed(0)}%;height:3px;background:${col};box-shadow:0 0 6px ${col}88;border-radius:1px"></div>
                </div>
              </div>` : ''}

              ${ip.top_attack_type ? `
              <div style="font-family:JetBrains Mono;font-size:8px;color:rgba(95,55,24,.55);letter-spacing:.12em;padding-top:7px;border-top:1px solid rgba(95,55,24,.15)">
                ${ip.top_attack_type.replace(/_/g, ' ').toUpperCase()}
              </div>` : ''}
            </div>
          `

          marker.bindPopup(popup, { className: 'hc-popup', maxWidth: 270 })
          marker.addTo(map)
          markersRef.current.push(marker)
          n++
        })

        if (bounds.length > 1) {
          map.fitBounds(bounds, { padding: [40, 40], maxZoom: 5 })
        }

        setPlotCount(n)
        setTimeout(() => map.invalidateSize(), 100)

      } catch (e) { console.error(e) }
      if (!cancelled) setLoading(false)
    }

    plot()
    const t = setInterval(plot, 90_000)
    return () => { cancelled = true; clearInterval(t) }
  }, [ready])


  // Resize observer for dynamic height changes
  useEffect(() => {
    if (!mapRef.current) return

    const resizeObserver = new ResizeObserver(() => {
      mapRef.current.invalidateSize()
    })

    if (containerRef.current?.parentElement) {
      resizeObserver.observe(containerRef.current.parentElement)
    }

    return () => resizeObserver.disconnect()
  }, [ready])


  return (
    <div className="panel hc-lf" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column', height: '100%' }}>

      {/* Header (unchanged) */}
      <div className="panel-hd">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {loading && (
            <div className="hc-spin" style={{
              width: 11, height: 11,
              border: '2px solid rgba(95,55,24,.25)',
              borderTopColor: '#F7B733',
              borderRadius: '50%',
              flexShrink: 0,
            }} />
          )}
          <span className="lbl">Attack Origin Map</span>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: 'rgba(95,55,24,.55)', letterSpacing: '.06em' }}>
            {loading ? '— locating IPs…' : `— ${plotCount} sources plotted`}
          </span>
        </div>

        {/* Legend (unchanged) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {Object.entries(SEV_COLOR).map(([sev, col]) => (
            <div key={sev} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: col, boxShadow: `0 0 4px ${col}88`, flexShrink: 0 }} />
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 7.5, color: 'rgba(95,55,24,.6)', letterSpacing: '.1em' }}>{sev}</span>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingLeft: 8, borderLeft: '1px solid rgba(95,55,24,.2)' }}>
            <svg width="7" height="10" viewBox="0 0 26 34">
              <path d="M13 1C7.48 1 3 5.48 3 11c0 7.75 10 22 10 22S23 18.75 23 11C23 5.48 18.52 1 13 1z" fill="#FBC64C" />
            </svg>
            <span style={{ fontFamily: 'JetBrains Mono', fontSize: 7.5, color: 'rgba(95,55,24,.6)', letterSpacing: '.1em' }}>HONEYPOT</span>
          </div>
        </div>
      </div>

      {/* Map container — now fills remaining space completely */}
      <div style={{ position: 'relative', flex: 1, minHeight: 0 }}>
        <div
          ref={containerRef}
          style={{ width: '100%', height: '100%', background: '#FDF5DC' }}
        />

        {/* Init loading overlay */}
        {!ready && (
          <div style={{
            position: 'absolute', inset: 0, zIndex: 999,
            background: '#FDF5DC',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 18,
          }}>
            <svg width="60" height="60" viewBox="0 0 60 60" style={{ animation: 'hc-spin 2s linear infinite' }}>
              <polygon points="30,4 53,17 53,43 30,56 7,43 7,17"
                fill="none" stroke="rgba(95,55,24,.25)" strokeWidth="1.5" />
              <polygon points="30,4 53,17 53,43 30,56 7,43 7,17"
                fill="none" stroke="#F7B733" strokeWidth="1.5"
                strokeDasharray="160" strokeDashoffset="100"
                style={{ transformOrigin: '30px 30px' }} />
              <circle cx="30" cy="30" r="4.5" fill="#F7B733" opacity=".85" />
            </svg>
            <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 10, color: '#5F3718', letterSpacing: '.22em' }}>
                INITIALIZING MAP
              </span>
              <span style={{ fontFamily: 'JetBrains Mono', fontSize: 8, color: 'rgba(95,55,24,.5)', letterSpacing: '.1em' }}>
                Stamen Watercolor • OpenStreetMap
              </span>
            </div>
          </div>
        )}

        {/* Arc legend */}
        <div style={{
          position: 'absolute', bottom: 8, left: 8, zIndex: 500,
          background: 'rgba(253,245,220,.92)', backdropFilter: 'blur(6px)',
          border: '1px solid rgba(95,55,24,.2)',
          padding: '5px 10px',
          display: 'flex', alignItems: 'center', gap: 8,
          pointerEvents: 'none',
        }}>
          <svg width="26" height="8" viewBox="0 0 26 8">
            <path d="M0 6 Q13 0 26 6" fill="none" stroke="rgba(247,183,51,.55)" strokeWidth="1" strokeDasharray="3 3" />
          </svg>
          <span style={{ fontFamily: 'JetBrains Mono', fontSize: 7.5, color: 'rgba(95,55,24,.55)', letterSpacing: '.1em' }}>
            ATTACK ARC → HONEYPOT
          </span>
        </div>
      </div>
    </div>
  )
}