import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import type { Stats } from '../types'

interface Props { stats: Stats | null }

function formatHour(iso: string) {
  const d = new Date(iso)
  return `${String(d.getUTCHours()).padStart(2, '0')}:00`
}

export function HourlyTimeline({ stats }: Props) {
  const raw = stats?.hourly_24h ?? []

  const filled = Array.from({ length: 24 }, (_, i) => {
    const h = new Date()
    h.setUTCMinutes(0, 0, 0)
    h.setUTCHours(h.getUTCHours() - (23 - i))
    const key = h.toISOString().slice(0, 13)
    const match = raw.find(r => r.hour.startsWith(key))
    return { hour: formatHour(h.toISOString()), count: match?.count ?? 0 }
  })

  const max = Math.max(...filled.map(d => d.count), 1)

  return (
    <div style={{ background: 'var(--void-2)', border: '1px solid var(--void-4)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid var(--void-4)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(251,198,76,0.02)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', letterSpacing: '0.18em' }}>
          HOURLY ACTIVITY — 24H
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)' }}>
          peak {max.toLocaleString()} / hr
        </span>
      </div>

      <div style={{ padding: '16px 18px', height: 240 }}>
        {raw.length === 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bronze-3)' }}>
            no data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filled} barSize={16} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
              <CartesianGrid vertical={false} stroke="rgba(45,32,16,0.6)" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 8, fontFamily: 'JetBrains Mono', fill: '#4d3a1e' }}
                tickLine={false} axisLine={false} interval={3}
              />
              <YAxis
                tick={{ fontSize: 8, fontFamily: 'JetBrains Mono', fill: '#4d3a1e' }}
                tickLine={false} axisLine={false} allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: 'rgba(251,198,76,0.04)' }}
                contentStyle={{
                  background: 'var(--void-2)',
                  border: '1px solid var(--void-4)',
                  borderRadius: 2, fontSize: 11,
                  fontFamily: 'JetBrains Mono',
                  color: 'var(--antiquity-2)',
                }}
                formatter={(value) => [`${Number(value)} events`, 'count']}
              />
              <Bar dataKey="count" radius={[2, 2, 0, 0]}>
                {filled.map((d, i) => (
                  <Cell
                    key={i}
                    fill={
                      d.count === 0 ? '#1a1208' :
                        d.count >= max * 0.8 ? '#FF3B3B' :
                          d.count >= max * 0.5 ? '#FF8800' :
                            '#FBC64C'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}