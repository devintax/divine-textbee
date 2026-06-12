'use client'

import { useEffect, useState } from 'react'
import type { Device } from '@/lib/textbee'
import { isDeviceOnline } from '@/lib/textbee'

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/textbee/devices')
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error)
        setDevices(j.data)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-500">Loading devices...</p>
  if (error) return <p className="text-red-600">Error: {error}</p>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Devices</h1>
      {devices.length === 0 && (
        <p className="text-gray-500">No devices registered yet.</p>
      )}
      <div className="space-y-3">
        {devices.map((d) => {
          const online = isDeviceOnline(d)
          return (
            <a
              key={d._id}
              href={`/devices/${d._id}`}
              className="block bg-white rounded-xl shadow p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-semibold">
                    {d.name || `${d.brand || ''} ${d.model || ''}`.trim() || 'Unnamed Device'}
                  </div>
                  <div className="text-sm text-gray-500 mt-0.5">
                    {d.brand && `${d.brand} ${d.model || ''}`.trim()}
                    {d.os && ` · ${d.os} ${d.osVersion || ''}`}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {d.enabled !== false ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Enabled
                    </span>
                  ) : (
                    <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                      Disabled
                    </span>
                  )}
                  <span
                    className={`w-2.5 h-2.5 rounded-full ${online ? 'bg-green-500' : 'bg-red-400'}`}
                    title={online ? 'Online' : 'Offline'}
                  />
                </div>
              </div>
              {d.lastHeartbeat && (
                <div className="text-xs text-gray-400 mt-2">
                  Last heartbeat: {new Date(d.lastHeartbeat).toLocaleString()}
                </div>
              )}
            </a>
          )
        })}
      </div>
    </div>
  )
}
