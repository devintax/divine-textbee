'use client'

import { useEffect, useState } from 'react'
import type { Device, SMSRecord, PaginationMeta, DeviceHealthEntry, HeartbeatLogEntry } from '@/lib/textbee'
import { isDeviceOnline } from '@/lib/textbee'

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

export default function DeviceDetailPage({ params }: { params: { id: string } }) {
  const [device, setDevice] = useState<Device | null>(null)
  const [health, setHealth] = useState<DeviceHealthEntry | null>(null)
  const [hbLogs, setHbLogs] = useState<HeartbeatLogEntry[]>([])
  const [msgs, setMsgs] = useState<SMSRecord[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all')
  const [showHbLog, setShowHbLog] = useState(false)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/textbee/devices').then((r) => r.json()),
      fetch(`/api/textbee/devices/${params.id}/messages?page=${page}&limit=25&type=${filter}`).then((r) => r.json()),
      fetch('/api/gateway/device-health').then((r) => r.json()).catch(() => ({ data: [] })),
    ])
      .then(([dRes, mRes, hRes]) => {
        if (dRes.error) throw new Error(dRes.error)
        if (mRes.error) throw new Error(mRes.error)
        const found = dRes.data.find((d: Device) => d._id === params.id)
        if (!found) throw new Error('Device not found')
        setDevice(found)
        setMsgs(mRes.data)
        setMeta(mRes.meta)
        if (Array.isArray(hRes.data)) {
          const h = hRes.data.find((h: DeviceHealthEntry) => h.id === params.id)
          if (h) setHealth(h)
        }
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [params.id, page, filter])

  function loadHbLogs() {
    fetch(`/api/gateway/heartbeat-history/${params.id}`)
      .then((r) => r.json())
      .then((j) => { if (!j.error) setHbLogs(j.data) })
      .catch(() => {})
  }

  if (loading) return <p className="text-gray-500">Loading...</p>
  if (error) return <p className="text-red-600">Error: {error}</p>
  if (!device) return <p className="text-gray-500">Device not found.</p>

  const online = isDeviceOnline(device)
  const lastHb = device.lastHeartbeat ? new Date(device.lastHeartbeat).getTime() : 0
  const staleFor = lastHb ? Date.now() - lastHb : 0
  const awaiting = !device.lastHeartbeat

  const statusBadge = (s: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 text-yellow-700',
      dispatched: 'bg-blue-100 text-blue-700',
      sent: 'bg-green-100 text-green-700',
      delivered: 'bg-green-100 text-green-700',
      failed: 'bg-red-100 text-red-700',
      received: 'bg-purple-100 text-purple-700',
      unknown: 'bg-gray-100 text-gray-500',
    }
    return <span className={`text-xs px-2 py-0.5 rounded-full ${colors[s] || 'bg-gray-100'}`}>{s}</span>
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <a href="/devices" className="text-sm text-blue-600 hover:underline">&larr; Devices</a>
        <h1 className="text-2xl font-bold">
          {device.name || `${device.brand || ''} ${device.model || ''}`.trim() || 'Device'}
        </h1>
      </div>

      {/* Offline banner */}
      {awaiting && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-sm text-yellow-800">
          <strong>Awaiting connection.</strong> Device is registered but hasn&apos;t sent a heartbeat yet. Pair the app on the phone.
        </div>
      )}
      {!awaiting && !online && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800">
          <strong>Device is OFFLINE.</strong> Last seen {ago(staleFor)} ago ({new Date(device.lastHeartbeat!).toLocaleString()}). No messages can be sent through this device until the app is reopened on the phone.
        </div>
      )}
      {!awaiting && online && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-sm text-green-800">
          <strong>Device is ONLINE.</strong> Last seen {ago(staleFor)} ago. Ready to send messages.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          ['Model', `${device.brand || ''} ${device.model || ''}`.trim() || '-'],
          ['OS', `${device.os || ''} ${device.osVersion || ''}`.trim() || '-'],
          ['App', `${device.appVersionName || ''} (${device.appVersionCode || ''})`],
          ['Serial', device.serial || '-'],
          ['Heartbeat', `${device.heartbeatIntervalMinutes || '-'}min interval`],
          ['Status', awaiting ? 'Awaiting' : online ? 'Online' : 'Offline'],
          ['Last Seen', device.lastHeartbeat ? `${ago(staleFor)} ago` : 'Never'],
          ['SMS Sent', String(device.sentSMSCount ?? '-')],
          ['SMS Received', String(device.receivedSMSCount ?? '-')],
          ['Battery', health?.batteryPercentage !== null && health?.batteryPercentage !== undefined ? `${health.batteryPercentage}%${health.batteryCharging ? ' (charging)' : ''}` : '-'],
          ['Network', health?.networkType || '-'],
          ['Uptime', health?.uptimeSeconds !== null && health?.uptimeSeconds !== undefined ? ago(health.uptimeSeconds * 1000) : '-'],
          ['SIM', health?.simCarrier || '-'],
          ['Enabled', device.enabled !== false ? 'Yes' : 'No'],
        ].map(([label, value]) => (
          <div key={label} className="bg-white rounded-lg shadow p-3">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-sm font-medium mt-0.5 truncate">{value}</div>
          </div>
        ))}
      </div>

      {/* Heartbeat history toggle */}
      <div className="mb-4">
        <button
          onClick={() => { setShowHbLog(!showHbLog); if (!showHbLog && hbLogs.length === 0) loadHbLogs() }}
          className="text-sm text-blue-600 hover:underline"
        >
          {showHbLog ? 'Hide' : 'Show'} heartbeat history
        </button>
        {showHbLog && (
          <div className="mt-2 bg-white rounded-lg shadow p-3 max-h-48 overflow-y-auto">
            {hbLogs.length === 0 ? (
              <p className="text-xs text-gray-400">No heartbeat logs yet. Heartbeats are logged from now on.</p>
            ) : (
              <div className="space-y-1">
                {hbLogs.map((h, i) => (
                  <div key={i} className="text-xs font-mono text-gray-600">
                    {new Date(h.timestamp).toLocaleString()} &mdash; batt:{h.batteryPercentage ?? '?'}%{h.batteryCharging ? '⚡' : ''} net:{h.networkType ?? '?'} uptime:{h.uptimeSeconds ? ago(h.uptimeSeconds * 1000) : '?'}
                    {h.simCarrier ? ` sim:${h.simCarrier}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 mb-3">
        <h2 className="text-lg font-semibold">Messages</h2>
        {(['all', 'sent', 'received'] as const).map((f) => (
          <button
            key={f}
            onClick={() => { setFilter(f); setPage(1) }}
            className={`text-xs px-3 py-1 rounded-full ${filter === f ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700'}`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {msgs.length === 0 && <p className="text-gray-500 text-sm">No messages yet.</p>}

      <div className="space-y-2">
        {msgs.map((m) => (
          <div key={m._id} className="bg-white rounded-lg shadow p-3 text-sm">
            <div className="flex items-center justify-between">
              <div className="font-medium truncate max-w-md">{m.message}</div>
              {statusBadge(m.status)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {m.type === 'SENT' ? `To: ${m.recipient}` : `From: ${m.sender}`}
              {' · '}
              {new Date(m.createdAt).toLocaleString()}
              {m.sentAt && ` · Sent: ${new Date(m.sentAt).toLocaleString()}`}
              {m.failedAt && ` · Failed: ${new Date(m.failedAt).toLocaleString()}`}
              {m.errorMessage && ` · Error: ${m.errorMessage}`}
            </div>
          </div>
        ))}
      </div>

      {meta && meta.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="text-sm px-3 py-1 rounded bg-gray-200 disabled:opacity-40">Prev</button>
          <span className="text-sm text-gray-500">Page {meta.page} of {meta.totalPages} ({meta.total} total)</span>
          <button disabled={page >= meta.totalPages} onClick={() => setPage((p) => p + 1)} className="text-sm px-3 py-1 rounded bg-gray-200 disabled:opacity-40">Next</button>
        </div>
      )}
    </div>
  )
}
