'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Device, Template, ScheduledSendEntry, DeviceHealthEntry } from '@/lib/textbee'
import { isDeviceOnline } from '@/lib/textbee'

export default function ScheduledSendsPage() {
  const [items, setItems] = useState<ScheduledSendEntry[]>([])
  const [devices, setDevices] = useState<Device[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [deviceHealth, setDeviceHealth] = useState<Map<string, DeviceHealthEntry>>(new Map())
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [message, setMessage] = useState('')
  const [recipients, setRecipients] = useState('')
  const [scheduledAt, setScheduledAt] = useState('')
  const [recurrence, setRecurrence] = useState('none')
  const [templateId, setTemplateId] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const [s, d, t, h] = await Promise.all([
        fetch('/api/gateway/scheduled-sends').then((r) => r.json()),
        fetch('/api/textbee/devices').then((r) => r.json()),
        fetch('/api/gateway/templates').then((r) => r.json()),
        fetch('/api/gateway/device-health').then((r) => r.json()).catch(() => ({ data: [] })),
      ])
      if (s.error) throw new Error(s.error)
      setItems(s.data)
      if (!d.error) { setDevices(d.data); if (d.data.length > 0) setDeviceId(d.data[0]._id) }
      if (!t.error) setTemplates(t.data)
      if (Array.isArray(h.data)) setDeviceHealth(new Map(h.data.map((e: DeviceHealthEntry) => [e.id, e])))
    } catch (e: any) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const currentTemplate = templates.find((t) => t.id === templateId)

  async function handleSchedule(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    const recipientsList = recipients.split(/[\n,]+/).map((r) => r.trim()).filter(Boolean)
    if (recipientsList.length === 0) { setError('Enter at least one recipient'); setBusy(false); return }
    const msg = templateId && currentTemplate ? currentTemplate.body : message.trim()
    if (!msg) { setError('Select a template or write a message'); setBusy(false); return }
    try {
      const r = await fetch('/api/gateway/scheduled-sends', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deviceId, message: msg, recipients: recipientsList, scheduledAt: new Date(scheduledAt).toISOString(), recurrence }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Schedule failed')
      setMessage(''); setRecipients(''); setTemplateId(''); setScheduledAt('')
      await load()
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  async function handleCancel(id: string) {
    if (!confirm('Cancel this scheduled send?')) return
    try { const r = await fetch(`/api/gateway/scheduled-sends/${id}`, { method: 'DELETE' }); const j = await r.json(); if (!r.ok) throw new Error(j.error); await load() }
    catch (e: any) { setError(e.message) }
  }

  if (loading) return <p className="text-gray-500">Loading...</p>

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">Scheduled Sends</h1>

      <form onSubmit={handleSchedule} className="bg-white rounded-xl shadow p-4 mb-6 space-y-3">
        <h2 className="text-sm font-semibold">Schedule a new send</h2>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Device</label>
            <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {devices.map((d) => {
                const online = isDeviceOnline(d)
                return (<option key={d._id} value={d._id}>{d.name || `${d.brand || ''} ${d.model || ''}`.trim() || d._id} — {online ? 'Online' : 'OFFLINE'}</option>)
              })}
            </select>
            {(() => {
              const dev = devices.find((d) => d._id === deviceId)
              if (!dev) return null
              const online = isDeviceOnline(dev)
              const h = deviceHealth.get(deviceId)
              return (
                <div className="flex items-center gap-2 mt-1">
                  <span className={`w-2 h-2 rounded-full ${online ? 'bg-green-500' : 'bg-red-500'}`} />
                  <span className={`text-xs ${online ? 'text-green-700' : 'text-red-600'}`}>
                    {online ? 'Online' : 'OFFLINE'}
                  </span>
                  {h?.batteryPercentage !== null && h?.batteryPercentage !== undefined && (
                    <span className="text-xs text-gray-400">batt: {h.batteryPercentage}%{h.batteryCharging ? '⚡' : ''}</span>
                  )}
                </div>
              )
            })()}
          </div>
          {devices.find((d) => d._id === deviceId) && !isDeviceOnline(devices.find((d) => d._id === deviceId)!) && (
            <div className="col-span-2 bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">
              Device is currently OFFLINE. Scheduled send will be blocked at send time if the device is still offline. Open the TextBee Gateway app on the phone to reconnect.
            </div>
          )}
          <div>
            <label className="block text-xs font-medium mb-1">Recurrence</label>
            <select value={recurrence} onChange={(e) => setRecurrence(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="none">One-time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Scheduled date &amp; time</label>
          <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" required />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Template</label>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">-- No template --</option>
            {templates.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
        </div>
        {templateId && currentTemplate ? (
          <div className="bg-gray-50 rounded-lg p-2 text-xs font-mono">{currentTemplate.body}</div>
        ) : (
          <div>
            <label className="block text-xs font-medium mb-1">Message</label>
            <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} maxLength={1600} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Type a message..." />
          </div>
        )}
        <div>
          <label className="block text-xs font-medium mb-1">Recipients <span className="text-gray-400">(one per line or comma-separated)</span></label>
          <textarea value={recipients} onChange={(e) => setRecipients(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder="+251912345678" required />
        </div>
        <button type="submit" disabled={busy} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{busy ? 'Scheduling...' : 'Schedule Send'}</button>
      </form>

      {items.length === 0 ? <p className="text-gray-500">No scheduled sends.</p> : (
        <div className="space-y-3">
          {items.map((s) => (
            <div key={s.id} className="bg-white rounded-xl shadow p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${s.status === 'completed' ? 'bg-green-100 text-green-700' : s.status === 'pending' ? 'bg-blue-100 text-blue-700' : s.status === 'processing' ? 'bg-yellow-100 text-yellow-700' : s.status === 'cancelled' ? 'bg-gray-100 text-gray-500' : 'bg-red-100 text-red-700'}`}>{s.status}</span>
                    <span className="text-xs text-gray-400">{s.recurrence !== 'none' ? s.recurrence : 'One-time'}</span>
                  </div>
                  <div className="text-xs font-mono mt-1 text-gray-600 break-all">{s.message}</div>
                  <div className="text-xs text-gray-400 mt-1">{s.recipients.length} recipient(s) · Scheduled: {new Date(s.scheduledAt).toLocaleString()}</div>
                  {(s.status === 'completed' || s.status === 'failed') && (
                    <div className="text-xs mt-1">{s.totalSent} sent · {s.totalFailed} failed · {s.totalSuppressed} suppressed</div>
                  )}
                </div>
                {s.status === 'pending' && (
                  <button onClick={() => handleCancel(s.id)} className="shrink-0 text-xs text-red-600 hover:underline ml-4">Cancel</button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
