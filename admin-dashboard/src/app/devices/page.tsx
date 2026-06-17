'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Device, DeviceHealthEntry } from '@/lib/textbee'
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

function batteryColor(pct: number): string {
  if (pct <= 10) return 'text-red-600'
  if (pct <= 20) return 'text-orange-500'
  if (pct <= 50) return 'text-yellow-600'
  return 'text-green-600'
}

export default function DevicesPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [healthMap, setHealthMap] = useState<Map<string, DeviceHealthEntry>>(new Map())
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [showRegister, setShowRegister] = useState(false)
  const [registerState, setRegisterState] = useState<'idle' | 'creating' | 'done' | 'error'>('idle')
  const [newKey, setNewKey] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState('')
  const [registerError, setRegisterError] = useState('')

  const loadData = useCallback(async () => {
    setError('')
    try {
      const [dr, hr] = await Promise.all([
        fetch('/api/textbee/devices').then((r) => r.json()),
        fetch('/api/gateway/device-health').then((r) => r.json()).catch(() => ({ data: [] as DeviceHealthEntry[] })),
      ])
      if (dr.error) throw new Error(dr.error)
      setDevices(dr.data)
      const m = new Map<string, DeviceHealthEntry>()
      if (Array.isArray(hr.data)) hr.data.forEach((h: DeviceHealthEntry) => m.set(h.id, h))
      setHealthMap(m)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  useEffect(() => {
    const id = setInterval(loadData, 10000)
    return () => clearInterval(id)
  }, [loadData])

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
      loadData()
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
      await loadData()
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
      await loadData()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function copyText(text: string) {
    try { await navigator.clipboard.writeText(text) } catch { alert('Failed to copy to clipboard') }
  }

  function closeModal() {
    setShowRegister(false); setNewKey(''); setQrDataUrl(''); setRegisterState('idle'); setRegisterError('')
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

      {registerState === 'error' && <p className="text-red-600 text-sm mb-4">Error: {registerError}</p>}
      {error && <p className="text-red-600 text-sm mb-4">Error: {error}</p>}
      {loading && <p className="text-gray-500">Loading devices...</p>}

      {!loading && !error && devices.length === 0 && (
        <p className="text-gray-500">No devices registered yet. Click &quot;Register Device&quot; to generate a pairing key.</p>
      )}

      {!loading && devices.length > 0 && (
        <div className="space-y-3">
          {devices.map((d) => {
            const online = isDeviceOnline(d)
            const health = healthMap.get(d._id)
            const lastHb = d.lastHeartbeat ? new Date(d.lastHeartbeat).getTime() : 0
            const interval = (d.heartbeatIntervalMinutes || 30) * 60 * 1000
            const awaiting = !d.lastHeartbeat
            const staleFor = lastHb ? Date.now() - lastHb : 0
            const staleMinutes = Math.floor(staleFor / 60000)
            const battery = health?.batteryPercentage ?? d.batteryInfo?.percentage
            return (
              <a
                key={d._id}
                href={`/devices/${d._id}`}
                className={`block rounded-xl shadow p-4 hover:shadow-md transition-shadow ${
                  awaiting ? 'bg-yellow-50 border border-yellow-200' :
                  online ? 'bg-white' :
                  'bg-red-50 border border-red-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`w-3 h-3 rounded-full ${
                        awaiting ? 'bg-yellow-400' : online ? 'bg-green-500' : 'bg-red-500'
                      }`} />
                      <span className="font-semibold">
                        {d.name || `${d.brand || ''} ${d.model || ''}`.trim() || 'Unnamed Device'}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        awaiting ? 'bg-yellow-100 text-yellow-700' :
                        online ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {awaiting ? 'AWAITING CONNECTION' : online ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {d.brand && `${d.brand} ${d.model || ''}`.trim()}
                      {d.os && ` · ${d.os} ${d.osVersion || ''}`}
                    </div>
                    {!awaiting && (
                      <div className="text-xs mt-1.5 space-y-0.5">
                        {staleMinutes < 60 ? (
                          <span className={online ? 'text-green-600' : 'text-red-500'}>
                            Last seen: {staleMinutes}min ago — {new Date(d.lastHeartbeat!).toLocaleString()}
                          </span>
                        ) : (
                          <span className="text-red-500 font-medium">
                            Last seen: {ago(staleFor)} ago — {new Date(d.lastHeartbeat!).toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                    {awaiting && (
                      <div className="text-xs text-yellow-600 mt-1">Registered — waiting for first heartbeat</div>
                    )}
                    {/* Battery, network, uptime */}
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-400">
                      {battery !== null && battery !== undefined && (
                        <span className={batteryColor(battery)}>
                          &#9889; {battery}%{health?.batteryCharging ? ' ⚡' : ''}
                        </span>
                      )}
                      {health?.networkType && <span>&#127760; {health.networkType}</span>}
                      {health?.uptimeSeconds !== null && health?.uptimeSeconds !== undefined && (
                        <span>&#9201; {ago(health.uptimeSeconds * 1000)} uptime</span>
                      )}
                      {d.heartbeatIntervalMinutes && (
                        <span>&#128467; Every {d.heartbeatIntervalMinutes}min</span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 ml-4">
                    <button
                      onClick={(e) => { e.preventDefault(); handleToggle(d._id, !d.enabled) }}
                      className={`text-xs px-2 py-0.5 rounded-full border ${
                        d.enabled !== false
                          ? 'bg-green-100 text-green-700 border-green-200 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-500 border-gray-200 hover:bg-gray-200'
                      }`}
                    >
                      {d.enabled !== false ? 'Enabled' : 'Disabled'}
                    </button>
                    <button
                      onClick={(e) => { e.preventDefault(); handleDelete(d._id, d.name || `${d.brand || ''} ${d.model || ''}`.trim() || 'Unnamed Device') }}
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

      {showRegister && registerState === 'done' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={closeModal}>
          <div className="bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-1">Pair a Device</h2>
            <p className="text-sm text-gray-500 mb-4">
              Open the TextBee Gateway app on your phone and scan the QR code below, or enter the API key manually.
            </p>
            <div className="flex justify-center mb-4">
              <img src={qrDataUrl} alt="Pairing QR Code" className="w-48 h-48" />
            </div>
            <div className="bg-gray-50 rounded-xl p-3 mb-4 space-y-2">
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">API URL</label>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="flex-1 text-xs font-mono bg-white border rounded px-2 py-1 select-all break-all">https://api-textbee.dfgworld.net</code>
                  <button onClick={() => copyText('https://api-textbee.dfgworld.net')} className="shrink-0 text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300">Copy</button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wider">API Key</label>
                <div className="flex items-center gap-2 mt-0.5">
                  <code className="flex-1 text-xs font-mono bg-white border rounded px-2 py-1 select-all break-all">{newKey}</code>
                  <button onClick={() => copyText(newKey)} className="shrink-0 text-xs bg-gray-200 text-gray-700 px-2 py-1 rounded hover:bg-gray-300">Copy</button>
                </div>
              </div>
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-800">
              <strong>Instructions:</strong> Open the TextBee Gateway app on your phone &rarr; tap &quot;Scan QR Code&quot; (or &quot;Enter Manually&quot;) &rarr; enter the URL and API key above &rarr; grant SMS permissions. The device will appear here once connected.
            </div>
            <button onClick={closeModal} className="w-full bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">Done</button>
          </div>
        </div>
      )}
    </div>
  )
}
