'use client'

import { useEffect, useState } from 'react'
import type { Device, SMSRecord } from '@/lib/textbee'

export default function HistoryPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [msgs, setMsgs] = useState<SMSRecord[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/textbee/devices')
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error)
        setDevices(j.data)
        if (j.data.length > 0) {
          setDeviceId(j.data[0]._id)
        }
      })
      .catch((e) => setError(e.message))
  }, [])

  useEffect(() => {
    if (!deviceId) return
    setLoading(true)
    fetch(`/api/textbee/devices/${deviceId}/messages?page=${page}&limit=25`)
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error)
        setMsgs(j.data)
        setTotalPages(j.meta.totalPages)
        setTotal(j.meta.total)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [deviceId, page])

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
      <span className={`text-xs px-2 py-0.5 rounded-full ${colors[s] || 'bg-gray-100'}`}>{s}</span>
    )
  }

  const devName = (d: Device) =>
    d.name || `${d.brand || ''} ${d.model || ''}`.trim() || d._id

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Message History</h1>

      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Device</label>
        <select
          value={deviceId}
          onChange={(e) => { setDeviceId(e.target.value); setPage(1) }}
          className="w-full max-w-xs border rounded-lg px-3 py-2 text-sm"
        >
          {devices.map((d) => (
            <option key={d._id} value={d._id}>
              {devName(d)}
            </option>
          ))}
        </select>
      </div>

      {!deviceId && <p className="text-gray-500">No devices available.</p>}
      {loading && <p className="text-gray-500">Loading messages...</p>}
      {error && <p className="text-red-600">Error: {error}</p>}

      {!loading && !error && msgs.length === 0 && (
        <p className="text-gray-500">No messages found for this device.</p>
      )}

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
              {m.deliveredAt && ` · Delivered: ${new Date(m.deliveredAt).toLocaleString()}`}
              {m.failedAt && ` · Failed: ${new Date(m.failedAt).toLocaleString()}`}
              {m.errorMessage && ` · ${m.errorMessage}`}
            </div>
          </div>
        ))}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-4">
          <button
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="text-sm px-3 py-1 rounded bg-gray-200 disabled:opacity-40"
          >
            Prev
          </button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages} ({total} total)
          </span>
          <button
            disabled={page >= totalPages}
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
