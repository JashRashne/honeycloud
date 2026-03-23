import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { Stats } from '../types'

const PALETTE = [
  '#FBC64C', '#FF3B3B', '#FF8800', '#3DDB7A',
  '#60a5fa', '#a78bfa', '#f472b6', '#34d399',
  '#fb923c', '#B28742',
]

const REMAP: Record<string, string> = {
  ssh_bruteforce: 'SSH Brute',
  vnc_bruteforce: 'VNC Brute',
  web_scan: 'Web Scan',
  telnet_probe: 'Telnet',
  db_probe: 'DB Probe',
  smb_exploit: 'SMB',
  ftp_probe: 'FTP',
  snmp_probe: 'SNMP',
  iot_probe: 'IoT',
  port_scan: 'Port Scan',
  icmp_scan: 'ICMP',
}

interface Props { stats: Stats | null }

export function AttackTypeDonut({ stats }: Props) {
  const data = (stats?.by_attack_type ?? [])
    .slice(0, 8)
    .map(r => ({ name: REMAP[r.attack_type] ?? r.attack_type, value: r.count }))

  const total = data.reduce((s, d) => s + d.value, 0)

  return (
    <div style={{ background: 'var(--void-2)', border: '1px solid var(--void-4)', borderRadius: 2, overflow: 'hidden' }}>
      <div style={{
        padding: '12px 18px',
        borderBottom: '1px solid var(--void-4)',
        background: 'rgba(251,198,76,0.02)',
      }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'var(--bronze-3)', letterSpacing: '0.18em' }}>
          ATTACK DISTRIBUTION
        </span>
      </div>

      {data.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200, fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--bronze-3)' }}>
          no data yet
        </div>
      ) : (
        <div style={{ padding: '16px 18px' }}>
          <div style={{ position: 'relative', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%" cy="50%"
                  innerRadius={62} outerRadius={88}
                  paddingAngle={2}
                  dataKey="value"
                  strokeWidth={0}
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value) => [`${Number(value)} events (${((Number(value) / total) * 100).toFixed(1)}%)`, '']}
                  contentStyle={{
                    background: 'var(--void-2)',
                    border: '1px solid var(--void-4)',
                    borderRadius: 2, fontSize: 11,
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--antiquity-2)',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Centre label */}
            <div style={{
              position: 'absolute', inset: 0,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              pointerEvents: 'none',
            }}>
              <span style={{
                fontFamily: 'var(--font-display)', fontWeight: 800,
                fontSize: 30, color: 'var(--antiquity)', lineHeight: 1,
                letterSpacing: '-0.02em',
              }}>
                {total.toLocaleString()}
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 8, color: 'var(--bronze-3)',
                letterSpacing: '0.14em', marginTop: 5,
              }}>
                EVENTS
              </span>
            </div>
          </div>

          {/* Legend */}
          <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
            {data.map((d, i) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: PALETTE[i % PALETTE.length],
                    flexShrink: 0,
                    boxShadow: `0 0 5px ${PALETTE[i % PALETTE.length]}66`,
                  }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--antiquity-3)' }}>
                    {d.name}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 56, background: 'var(--void-4)', borderRadius: 1, height: 3 }}>
                    <div style={{
                      width: `${(d.value / total) * 100}%`,
                      height: 3,
                      background: PALETTE[i % PALETTE.length],
                      borderRadius: 1,
                    }} />
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--bronze-3)', minWidth: 24, textAlign: 'right' }}>
                    {d.value}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}