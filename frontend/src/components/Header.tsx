import { useEffect, useState } from 'react'
import { getHealth } from '../api/clients'
import type { HealthStatus } from '../types'

interface Props {
  connected: boolean
  totalAttacks: number
  newCount: number
}

export function Header({ connected, totalAttacks, newCount }: Props) {
  const [health, setHealth] = useState<HealthStatus | null>(null)
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    getHealth().then(setHealth).catch(() => {})
    const t = setInterval(() => {
      setNow(new Date())
      getHealth().then(setHealth).catch(() => {})
    }, 30_000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <header className="border-b border-stone-200 bg-white sticky top-0 z-50">
      <div className="max-w-screen-2xl mx-auto px-6 h-14 flex items-center justify-between">

        {/* Logo + name */}
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 bg-red-600 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold tracking-tight">HC</span>
          </div>
          <span className="font-semibold text-stone-900 tracking-tight text-sm">
            HoneyCloud
          </span>
          <span className="text-stone-300 text-xs">|</span>
          <span className="text-stone-400 text-xs font-mono">Threat Intelligence Platform</span>
        </div>

        {/* Centre — live counter */}
        <div className="flex items-center gap-2">
          {newCount > 0 && (
            <span className="bg-red-50 text-red-700 text-xs font-mono px-2 py-0.5 rounded-full border border-red-200 animate-pulse">
              +{newCount} new
            </span>
          )}
          <span className="text-stone-500 text-xs font-mono">
            {totalAttacks.toLocaleString()} events captured
          </span>
        </div>

        {/* Right — status indicators */}
        <div className="flex items-center gap-4 text-xs font-mono">

          {/* DB status */}
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${health?.database.connected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            <span className="text-stone-400">DB</span>
          </div>

          {/* ML status */}
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${health?.ml_models.loaded ? 'bg-emerald-500' : 'bg-amber-400'}`} />
            <span className="text-stone-400">ML</span>
          </div>

          {/* WebSocket status */}
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-stone-400">{connected ? 'LIVE' : 'RECONNECTING'}</span>
          </div>

          {/* Clock */}
          <span className="text-stone-300">
            {now.toUTCString().slice(17, 25)} UTC
          </span>
        </div>
      </div>
    </header>
  )
}