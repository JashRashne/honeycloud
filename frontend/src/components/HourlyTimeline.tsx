import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import type { Stats } from '../types'

function fmtHour(iso: string) {
  const d = new Date(iso)
  return `${String(d.getUTCHours()).padStart(2, '0')}:00`
}

export function HourlyTimeline({ stats }: { stats: Stats | null }) {
  const raw = stats?.hourly_24h ?? []
  const filled = Array.from({ length: 24 }, (_, i) => {
    const h = new Date(); h.setUTCMinutes(0, 0, 0); h.setUTCHours(h.getUTCHours() - (23 - i))
    const key = h.toISOString().slice(0, 13)
    const match = raw.find(r => r.hour.startsWith(key))
    return { hour: fmtHour(h.toISOString()), count: match?.count ?? 0 }
  })
  const max = Math.max(...filled.map(d => d.count), 1)

  return (
    <div className="panel au d2">
      <div className="panel-hd">
        <span className="label">Attack activity — last 24 hours</span>
        <span className="label" style={{ color: 'var(--char6)' }}>peak {max.toLocaleString()} / hr</span>
      </div>
      <div style={{ padding: '16px 20px', height: 400 }}>
        {raw.length === 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 12 }}>
            {Array.from({ length: 5 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 24, width: `${40 + i * 10}%` }} />)}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={filled} barSize={14} margin={{ top: 4, right: 4, bottom: 0, left: -24 }}>
              <CartesianGrid vertical={false} stroke="var(--bdr)" />
              <XAxis dataKey="hour" tick={{ fontSize: 8, fontFamily: 'DM Mono', fill: 'var(--char6)' }} tickLine={false} axisLine={false} interval={3} />
              <YAxis tick={{ fontSize: 8, fontFamily: 'DM Mono', fill: 'var(--char6)' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip cursor={{ fill: 'var(--amber-p2)' }} contentStyle={{ background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--char)' }} formatter={v => [`${Number(v)} events`, 'count']} />
              <Bar dataKey="count" radius={[3, 3, 0, 0]}>
                {filled.map((d, i) => (
                  <Cell key={i} fill={d.count === 0 ? 'var(--cream-3)' : d.count >= max * .8 ? 'var(--crit)' : d.count >= max * .5 ? 'var(--high)' : 'var(--amber)'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}