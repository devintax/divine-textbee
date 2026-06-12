'use client'

import { useEffect, useState } from 'react'
import type { Device, SMSRecord, PaginationMeta } from '@/lib/textbee'
import { isDeviceOnline } from '@/lib/textbee'

export default function DeviceDetailPage({ params }: { params: { id: string } }) {
  const [device, setDevice] = useState<Device | null>(null)
  const [msgs, setMsgs] = useState<SMSRecord[]>([])
  const [meta, setMeta] = useState<PaginationMeta | null>(null)
  const [page, setPage] = useState(1)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<'all' | 'sent' | 'received'>('all')

  useEffect(() => {
    setLoading(true)
    Promise.all([
      fetch('/api/textbee/devices').then((r) => r.json()),
      fetch(`/api/textbee/devices/${params.id}/messages?page=${page}&limit=25&type=${filter}`).then(
        (r) => r.json(),
      ),
    ])
      .then(([dRes, mRes]) => {
        if (dRes.error) throw new Error(dRes.error)
        if (mRes.error) throw new Error(mRes.error)
        const found = dRes.data.find((d: Device) => d._id === params.id)
        if (!found) throw new Error('Device not found')
        setDevice(found)
        setMsgs(mRes.data)
        setMeta(mRes.meta)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [params.id, page, filter])

  if (loading) return <p className="text-gray-500">Loading...</p>
  if (error) return <p className="text-red-600">Error: {error}</p>
  if (!device) return <p className="text-gray-500">Device not found.</p>

  const online = isDeviceOnline(device)

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
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full ${colors[s] || 'bg-gray-100'}`}>
        {s}
      </span>
    )
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <a href="/devices" className="text-sm text-blue-600 hover:underline">&larr; Devices</a>
        <h1 className="text-2xl font-bold">
          {device.name || `${device.brand || ''} ${device.model || ''}`.trim() || 'Device'}
        </h1>
        <span
          className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-400'}`}
          title={online ? 'Online' : 'Offline'}
        />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {[
          ['Model', `${device.brand || ''} ${device.model || ''}`.trim() || '-'],
          ['OS', `${device.os || ''} ${device.osVersion || ''}`.trim() || '-'],
          ['App', `${device.appVersionName || ''} (${device.appVersionCode || ''})`],
          ['Serial', device.serial || '-'],
          ['Heartbeat Interval', `${device.heartbeatIntervalMinutes || '-'} min`],
          ['Last Heartbeat', device.lastHeartbeat ? new Date(device.lastHeartbeat).toLocaleString() : 'Never'],
          ['SMS Sent', String(device.sentSMSCount ?? '-')],
          ['SMS Received', String(device.receivedSMSCount ?? '-')],
        ].map(([label, value]) => (
          <div key={label} className="bg-white rounded-lg shadow p-3">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-sm font-medium mt-0.5 truncate">{value}</div>
          </div>
        ))}
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
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-sm px-3 py-1 rounded bg-gray-200 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {meta.page} of {meta.totalPages} ({meta.total} total)
          </span>
          <button
            disabled={page >= meta.totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="text-sm px-3 py-1 rounded bg-gray-200 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      )}
    </div>
  )
}
