import axios from 'axios'
import type { Attack, Session, SessionDetail, TopIP, Stats, ScoreResult, HealthStatus } from '../types'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? `${import.meta.env.VITE_API_URL}/api` : '/api',
  headers: {
    'ngrok-skip-browser-warning': 'true'
  }
});

export const getHealth = () =>
  api.get<HealthStatus>('/health').then(r => r.data)

export const getLiveAttacks = (limit = 50) =>
  api.get<{ count: number; attacks: Attack[] }>('/attacks/live', { params: { limit } }).then(r => r.data)

export const getStats = () =>
  api.get<Stats>('/attacks/stats').then(r => r.data)

export const getSessions = (limit = 20) =>
  api.get<{ count: number; sessions: Session[] }>('/sessions', { params: { limit } }).then(r => r.data)

export const getSessionDetail = (sessionId: string) =>
  api.get<SessionDetail>(`/sessions/${sessionId}`).then(r => r.data)

export const getTopIPs = (limit = 10) =>
  api.get<{ count: number; top_ips: TopIP[] }>('/top-ips', { params: { limit } }).then(r => r.data)

export const scoreIP = (ip: string) =>
  api.get<ScoreResult>(`/score/${ip}`).then(r => r.data)