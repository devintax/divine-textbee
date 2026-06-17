'use client'

import { useEffect, useState } from 'react'
import type { Stats, DeviceHealthEntry } from '@/lib/textbee'

function ago(ms: number): string {
  const sec = Math.floor(ms / 1000)
  if (sec < 60) return `${sec}s`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}min`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ${min % 60}min`
  const days = Math.floor(hr / 24)
  return `${days}d ${hr % 24}h`
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [health, setHealth] = useState<DeviceHealthEntry[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      fetch('/api/textbee/stats').then((r) => r.json()),
      fetch('/api/gateway/device-health').then((r) => r.json()).catch(() => ({ data: [] })),
    ])
      .then(([s, h]) => {
        if (s.error) throw new Error(s.error)
        setStats(s.data)
        if (Array.isArray(h.data)) setHealth(h.data)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-500">Loading...</p>
  if (error) return <p className="text-red-600">Error: {error}</p>

  const offlineDevices = health.filter((h) => h.onlineState === 'offline')
  const awaitingDevices = health.filter((h) => h.onlineState === 'never')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>

      {/* Offline banner */}
      {offlineDevices.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full bg-red-500" />
            <span className="font-bold text-red-800 text-sm">Device OFFLINE</span>
          </div>
          {offlineDevices.map((d) => (
            <div key={d.id} className="text-sm text-red-700 mt-1">
              <a href={`/devices/${d.id}`} className="underline hover:no-underline font-medium">{d.name}</a>
              {' — '}last seen {d.lastSeenAgo || 'long ago'}
              {d.batteryPercentage !== null && ` — battery ${d.batteryPercentage}%${d.batteryCharging ? ' (charging)' : ''}`}
            </div>
          ))}
          <div className="text-xs text-red-600 mt-2">
            No messages can be sent through offline devices. Open the TextBee Gateway app on the phone to reconnect.
          </div>
        </div>
      )}

      {awaitingDevices.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-full bg-yellow-400" />
            <span className="font-bold text-yellow-800 text-sm">Device awaiting connection</span>
          </div>
          {awaitingDevices.map((d) => (
            <div key={d.id} className="text-sm text-yellow-700">
              <a href={`/devices/${d.id}`} className="underline hover:no-underline font-medium">{d.name}</a>
              {' — '}registered but never connected
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: 'Devices', value: stats.totalDeviceCount },
            { label: 'SMS Sent', value: stats.totalSentSMSCount },
            { label: 'SMS Received', value: stats.totalReceivedSMSCount },
            { label: 'API Keys', value: stats.totalApiKeyCount },
          ].map((c) => (
            <div key={c.label} className="bg-white rounded-xl shadow p-4">
              <div className="text-sm text-gray-500">{c.label}</div>
              <div className="text-3xl font-bold mt-1">{c.value}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
