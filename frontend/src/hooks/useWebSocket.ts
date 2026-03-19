import { useEffect, useRef, useState, useCallback } from 'react'
import type { Attack, WSMessage } from '../types'

const WS_URL = import.meta.env.VITE_WS_URL ?? `ws://${window.location.host}/ws/live`
const MAX_FEED = 200

export function useWebSocket() {
  const [attacks, setAttacks] = useState<Attack[]>([])
  const [connected, setConnected] = useState(false)
  const [newCount, setNewCount] = useState(0)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return

    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnected(true)
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
    }

    ws.onmessage = (e) => {
      try {
        const msg: WSMessage = JSON.parse(e.data)
        if (msg.type === 'history') {
          setAttacks(msg.attacks.slice(-MAX_FEED))
        } else if (msg.type === 'new_attacks') {
          setAttacks(prev => [...msg.attacks, ...prev].slice(0, MAX_FEED))
          setNewCount(n => n + msg.attacks.length)
        }
      } catch { /* ignore malformed messages */ }
    }

    ws.onclose = () => {
      setConnected(false)
      // auto-reconnect after 3s
      reconnectTimer.current = setTimeout(connect, 3000)
    }

    ws.onerror = () => ws.close()
  }, [])

  useEffect(() => {
    connect()
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current)
      wsRef.current?.close()
    }
  }, [connect])

  return { attacks, connected, newCount }
}