import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import type { Stats } from '../types'

const COLORS = [
  '#dc2626', '#ea580c', '#d97706', '#65a30d',
  '#0891b2', '#2563eb', '#7c3aed', '#db2777',
  '#0f766e', '#b45309', '#64748b',
]

const REMAP: Record<string, string> = {
  ssh_bruteforce:  'SSH Brute',
  vnc_bruteforce:  'VNC Brute',
  web_scan:        'Web Scan',
  telnet_probe:    'Telnet',
  db_probe:        'DB Probe',
  smb_exploit:     'SMB',
  ftp_probe:       'FTP',
  snmp_probe:      'SNMP',
  iot_probe:       'IoT',
  port_scan:       'Port Scan',
  icmp_scan:       'ICMP',
}

interface Props { stats: Stats | null }

export function AttackTypeDonut({ stats }: Props) {
  const data = (stats?.by_attack_type ?? [])
    .slice(0, 8)
    .map(r => ({ name: REMAP[r.attack_type] ?? r.attack_type, value: r.count }))

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div className="bg-white border border-stone-200 rounded-lg overflow-hidden">
      <div className="px-4 py-3 border-b border-stone-100">
        <h2 className="text-xs font-semibold text-stone-500 uppercase tracking-widest">Attack Types</h2>
      </div>

      {data.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-stone-300 text-xs font-mono">
          no data yet
        </div>
      ) : (
        <div className="p-4">
          <div className="relative" style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${Number(value)} events (${((Number(value)/total)*100).toFixed(1)}%)`, '']}
                  contentStyle={{ fontSize: 11, fontFamily: 'monospace', border: '1px solid #e7e5e4', borderRadius: 6 }}
                />
              </PieChart>
            </ResponsiveContainer>
            {/* Centre label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span className="text-2xl font-bold text-stone-900 tabular-nums">{total}</span>
              <span className="text-[10px] text-stone-400 uppercase tracking-widest">events</span>
            </div>
          </div>

          {/* Legend */}
          <div className="mt-2 space-y-1">
            {data.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-stone-600 font-mono">{d.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-16 bg-stone-100 rounded-full h-1">
                    <div
                      className="h-1 rounded-full"
                      style={{ width: `${(d.value / total) * 100}%`, background: COLORS[i % COLORS.length] }}
                    />
                  </div>
                  <span className="text-stone-400 font-mono w-8 text-right">{d.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}