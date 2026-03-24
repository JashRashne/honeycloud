// AttackTypeDonut.tsx
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts'
import type { Stats } from '../types'
const PAL = ['#E8960C', '#B91C1C', '#C2410C', '#065F46', '#1D4ED8', '#7C3AED', '#BE185D', '#0F766E', '#92400E']
const REMAP: Record<string, string> = { ssh_bruteforce: 'SSH Bruteforce', vnc_bruteforce: 'VNC Bruteforce', web_scan: 'Web Scanning', telnet_probe: 'Telnet Probe', db_probe: 'Database Probe', smb_exploit: 'SMB Exploit', ftp_probe: 'FTP Probe', snmp_probe: 'SNMP Probe', iot_probe: 'IoT Probe', port_scan: 'Port Scan', icmp_scan: 'ICMP Scan' }

export function AttackTypeDonut({ stats }: { stats: Stats | null }) {
  const data = (stats?.by_attack_type ?? []).slice(0, 8).map(r => ({ name: REMAP[r.attack_type] ?? r.attack_type, value: r.count }))
  const total = data.reduce((s, d) => s + d.value, 0)
  return (
    <div className="panel au d1">
      <div className="panel-hd"><span className="label">Attack Breakdown</span></div>
      {data.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 200 }}><div className="skeleton" style={{ width: 120, height: 120, borderRadius: '50%' }} /></div>
      ) : (
        <div style={{ padding: '16px 20px' }}>
          <div style={{ position: 'relative', height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data} cx="50%" cy="50%" innerRadius={58} outerRadius={86} paddingAngle={2} dataKey="value" strokeWidth={0}>
                  {data.map((_, i) => <Cell key={i} fill={PAL[i % PAL.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => [`${Number(v)} events (${((Number(v) / total) * 100).toFixed(1)}%)`, '']} contentStyle={{ background: 'var(--surf)', border: '1px solid var(--bdr)', borderRadius: 8, fontSize: 11, fontFamily: 'var(--mono)', color: 'var(--char)' }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="donut-center">
              <span style={{ fontFamily: 'var(--serif)', fontSize: 28, color: 'var(--char)', lineHeight: 1 }}>{total.toLocaleString()}</span>
              <span className="label" style={{ marginTop: 4, fontSize: 8 }}>total</span>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
            {data.map((d, i) => (
              <div key={d.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: PAL[i % PAL.length], flexShrink: 0 }} />
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--char3)' }}>{d.name}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="bar-track" style={{ width: 54, height: 3 }}><div className="bar-fill" style={{ width: `${(d.value / total) * 100}%`, background: PAL[i % PAL.length] }} /></div>
                  <span style={{ fontFamily: 'var(--mono)', fontSize: 10, color: 'var(--char5)', minWidth: 24, textAlign: 'right' }}>{d.value}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}