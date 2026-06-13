'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Device } from '@/lib/textbee'
import { isDeviceOnline } from '@/lib/textbee'

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showRegister, setShowRegister] = useState(false)
  const [registerState, setRegisterState] = useState<'idle' | 'creating' | 'done' | 'error'>('idle')
  const [newKey, setNewKey] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [registerError, setRegisterError] = useState('')

  const loadDevices = useCallback(async () => {
    setError('')
    try {
      const r = await fetch('/api/textbee/devices')
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      setDevices(j.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadDevices() }, [loadDevices])

  // Poll every 10 seconds
  useEffect(() => {
    const id = setInterval(() => {
      fetch('/api/textbee/devices')
        .then((r) => r.json())
        .then((j) => { if (!j.error) setDevices(j.data) })
        .catch(() => {})
    }, 10000)
    return () => clearInterval(id)
  }, [])

  async function handleRegister() {
    setRegisterState('creating')
    setRegisterError('')
    try {
      const r = await fetch('/api/textbee/devices/register', { method: 'POST' })
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      setNewKey(j.apiKey)
      setQrDataUrl(j.qrDataUrl)
      setRegisterState('done')
      setShowRegister(true)
      loadDevices()
    } catch (e: any) {
      setRegisterError(e.message)
      setRegisterState('error')
    }
  }

  async function handleDelete(deviceId: string, name: string) {
    if (!confirm(`Delete device "${name}"? This removes it from the account.`)) return
    try {
      const r = await fetch(`/api/textbee/devices/${deviceId}/delete`, { method: 'POST' })
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      await loadDevices()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function handleToggle(deviceId: string, enabled: boolean) {
    try {
      const r = await fetch(`/api/textbee/devices/${deviceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled }),
      })
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      await loadDevices()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      alert('Failed to copy to clipboard')
    }
  }

  function closeModal() {
    setShowRegister(false)
    setNewKey('')
    setQrDataUrl('')
    setRegisterState('idle')
    setRegisterError('')
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">Devices</h1>
        <button
          onClick={handleRegister}
          disabled={registerState === 'creating'}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {registerState === 'creating' ? 'Generating...' : 'Register Device'}
        </button>
      </div>

      {registerState === 'error' && (
        <p className="text-red-600 text-sm mb-4">Error: {registerError}</p>
      )}

      {/* Error */}
      {error && (
        <p className="text-red-600 text-sm mb-4">Error: {error}</p>
      )}

      {/* Loading */}
      {loading && <p className="text-gray-500">Loading devices...</p>}

      {/* Empty */}
      {!loading && !error && devices.length === 0 && (
        <p className="text-gray-500">No devices registered yet. Click &quot;Register Device&quot; to generate a pairing key.</p>
      )}

      {/* Device list */}
      {!loading && devices.length > 0 && (
        <div className="space-y-3">
          {devices.map((d) => {
            const online = isDeviceOnline(d)
            const lastHb = d.lastHeartbeat ? new Date(d.lastHeartbeat).getTime() : 0
            const interval = (d.heartbeatIntervalMinutes || 30) * 60 * 1000
            const awaiting = !d.lastHeartbeat
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
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        handleToggle(d._id, !d.enabled)
                      }}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        d.enabled !== false
                          ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {d.enabled !== false ? 'Enabled' : 'Disabled'}
                    </button>
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        awaiting ? 'bg-yellow-400' : online ? 'bg-green-500' : 'bg-red-400'
                      }`}
                      title={
                        awaiting
                          ? 'Registered, awaiting connection'
                          : online
                            ? 'Online'
                            : 'Offline'
                      }
                    />
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2">
                  <div className="text-xs text-gray-400">
                    {awaiting
                      ? 'Registered — waiting for first heartbeat'
                      : `Last heartbeat: ${new Date(d.lastHeartbeat!).toLocaleString()}`}
                  </div>
                  <div className="flex items-center gap-2">
                    {!awaiting && (
                      <span className={`text-xs ${online ? 'text-green-600' : 'text-red-500'}`}>
                        {online ? 'Online' : 'Offline'}
                      </span>
                    )}
                    <button
                      onClick={(e) => {
                        e.preventDefault()
                        handleDelete(d._id, d.name || `${d.brand || ''} ${d.model || ''}`.trim() || 'Unnamed Device')
                      }}
                      className="text-xs text-red-500 hover:text-red-700 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </a>
            )
          })}
        </div>
      )}

      {/* Register Device Modal */}
      {showRegister && registerState === 'done' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1">Pair a Device</h2>
            <p className="text-sm text-gray-500 mb-4">
              Open the TextBee Gateway app on your phone and scan the QR code below, or enter the API key manually.
            </p>

            {/* QR Code */}
            <div className="flex justify-center mb-4">
              <img src={qrDataUrl} alt="Pairing QR Code" className="w-48 h-48" />
            </div>

            {/* API URL + Manual Key */}
            <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">API URL</label>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="flex-1 text-xs font-mono bg-white border rounded px-2 py-1 select-all break-all">
                    https://api-textbee.dfgworld.net
                  </code>
                  <button
                    onClick={() => copyText('https://api-textbee.dfgworld.net')}
                    className="shrink-0 text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300"
                  >
                    Copy
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">API Key</label>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="flex-1 text-xs font-mono bg-white border rounded px-2 py-1 select-all break-all">
                    {newKey}
                  </code>
                  <button
                    onClick={() => copyText(newKey)}
                    className="shrink-0 text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300"
                  >
                    Copy
                  </button>
                </div>
              </div>
            </div>

            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800">
              <strong>Instructions:</strong> Open the TextBee Gateway app on your phone → tap &quot;Scan QR Code&quot; (or &quot;Enter Manually&quot;) → enter the URL and API key above → grant SMS permissions. The device will appear here once connected.
            </div>

            <div className="flex gap-2">
              <button
                onClick={closeModal}
                className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
