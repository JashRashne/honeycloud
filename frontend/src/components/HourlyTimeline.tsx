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
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">
          Hourly Activity (24h)
        </h2>
        <span className="text-xs text-stone-400 font-mono">
          peak {max.toLocaleString()} events/hr
        </span>
      </div>

      <div className="p-4" style={{ height: 260 }}>
        {raw.length === 0 ? (
          <div className="flex items-center justify-center h-full text-stone-300 text-xs font-mono">
            no data yet
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filled} barSize={18} margin={{ top: 4, right: 8, bottom: 0, left: -16 }}>
              <CartesianGrid vertical={false} stroke="#f5f5f4" />
              <XAxis
                dataKey="hour"
                tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#a8a29e' }}
                tickLine={false}
                axisLine={false}
                interval={3}
              />
              <YAxis
                tick={{ fontSize: 10, fontFamily: 'monospace', fill: '#a8a29e' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                cursor={{ fill: '#f5f5f4' }}
                contentStyle={{
                  fontSize: 11, fontFamily: 'monospace',
                  border: '1px solid #e7e5e4', borderRadius: 6,
                }}
                formatter={(value) => [`${Number(value)} events`, 'count']}
              />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {filled.map((d, i) => (
                  <Cell
                    key={i}
                    fill={
                      d.count === 0        ? '#e7e5e4' :
                      d.count >= max * 0.8 ? '#dc2626' :
                      d.count >= max * 0.5 ? '#ea580c' : '#3b82f6'
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