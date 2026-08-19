'use client'

import { useEffect, useState } from 'react'
import type { Device, SMSRecord, PaginationMeta, DeviceHealthEntry, HeartbeatLogEntry } from '@/lib/textbee'
import { isDeviceOnline, wakeDevice } from '@/lib/textbee'
import { displayText, errorText } from '@/lib/display'

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

function fmt(n: number | undefined | null): string {
  if (n === null || n === undefined) return '-'
  return n.toLocaleString()
}

function bytes(n: number | undefined | null): string {
  if (n === null || n === undefined) return '-'
  if (n >= 1073741824) return `${(n / 1073741824).toFixed(2)} GB`
  if (n >= 1048576) return `${(n / 1048576).toFixed(1)} MB`
  if (n >= 1024) return `${(n / 1024).toFixed(0)} KB`
  return `${n} B`
}

function copyToClipboard(text: string) {
  navigator.clipboard.writeText(text).catch(() => {})
}

function DetailCard({ label, value, mono, copy }: { label: string; value: string; mono?: boolean; copy?: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-3">
      <div className="text-xs text-gray-500">{label}</div>
      <div className={`text-sm font-medium mt-0.5 truncate ${mono ? 'font-mono text-xs' : ''}`}>
        {value}
      </div>
      {copy && (
        <button onClick={() => copyToClipboard(copy)} className="text-[10px] text-blue-500 hover:underline mt-0.5">
          Copy
        </button>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-6">
      <h2 className="text-sm font-bold text-gray-700 uppercase tracking-wider mb-2">{title}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">{children}</div>
    </div>
  )
}

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
  const [waking, setWaking] = useState(false)
  const [wakeResult, setWakeResult] = useState('')

  async function handleWake() {
    setWaking(true)
    setWakeResult('')
    try {
      const result = await wakeDevice(params.id)
      setWakeResult(result.fcmSent ? 'Wake signal sent' : displayText(result.message, 'Wake request completed'))
    } catch (e: any) {
      setWakeResult(errorText(e))
    } finally {
      setWaking(false)
    }
  }

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
      .catch((e) => setError(errorText(e)))
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
  const fcmInvalid = device.fcmTokenInvalidatedAt

  return (
    <div>
      {/* Back + title + ID */}
      <div className="flex items-center gap-3 mb-1">
        <a href="/devices" className="text-sm text-blue-600 hover:underline">&larr; Devices</a>
        <h1 className="text-2xl font-bold">
          {device.name || `${device.brand || ''} ${device.model || ''}`.trim() || 'Device'}
        </h1>
      </div>
      <div className="flex items-center gap-3 mb-4">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-400 font-mono">{params.id}</span>
          <button onClick={() => copyToClipboard(params.id)} className="text-[10px] text-blue-500 hover:underline">Copy</button>
        </div>
        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
          awaiting ? 'bg-yellow-100 text-yellow-700' : online ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
        }`}>
          {awaiting ? 'Awaiting' : online ? 'Online' : 'OFFLINE'}
        </span>
        <span className={`text-xs px-2 py-0.5 rounded-full ${device.enabled !== false ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
          {device.enabled !== false ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      {/* Status banners */}
      {awaiting && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 mb-4 text-sm text-yellow-800">
          <strong>Awaiting connection.</strong> Device is registered but hasn&apos;t sent a heartbeat yet. Pair the app on the phone.
        </div>
      )}
      {!awaiting && !online && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-4 text-sm text-red-800">
          <div className="flex items-start justify-between">
            <div>
              <strong>Device is OFFLINE.</strong> Last seen {ago(staleFor)} ago ({new Date(device.lastHeartbeat!).toLocaleString()}). No messages can be sent until the app is reopened.
            </div>
            <button
              onClick={handleWake}
              disabled={waking}
              className="shrink-0 ml-3 text-xs bg-red-600 text-white px-3 py-1 rounded hover:bg-red-700 disabled:opacity-50"
            >
              {waking ? 'Waking...' : 'Wake Device'}
            </button>
          </div>
          {wakeResult && <p className="text-xs mt-1 text-red-600">{wakeResult}</p>}
        </div>
      )}
      {!awaiting && online && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-4 text-sm text-green-800">
          <strong>Device is ONLINE.</strong> Ready to send messages. Last heartbeat {ago(staleFor)} ago.
        </div>
      )}

      {/* Identity */}
      <Section title="Identity">
        <DetailCard label="Brand" value={device.brand || '-'} />
        <DetailCard label="Manufacturer" value={device.manufacturer || '-'} />
        <DetailCard label="Model" value={device.model || '-'} />
        <DetailCard label="Name" value={device.name || '-'} />
        <DetailCard label="Serial" value={device.serial || '-'} mono copy={device.serial} />
        <DetailCard label="Build ID" value={device.buildId || '-'} mono copy={device.buildId} />
        <DetailCard label="OS" value={`${device.os || ''} ${device.osVersion || ''}`.trim() || '-'} />
        <DetailCard label="User ID" value={device.user || '-'} mono copy={device.user} />
      </Section>

      {/* App & Connectivity */}
      <Section title="App &amp; Connectivity">
        <DetailCard label="App Version" value={`${device.appVersionName || '-'} (code ${device.appVersionCode ?? '-'})`} />
        <DetailCard label="Heartbeat Enabled" value={device.heartbeatEnabled !== false ? 'Yes' : 'No'} />
        <DetailCard label="Heartbeat Interval" value={`${device.heartbeatIntervalMinutes || 30} min`} />
        <DetailCard label="Receive SMS" value={device.receiveSMSEnabled ? 'Enabled' : 'Disabled'} />
        <DetailCard label="Send Delay" value={`${device.smsSendDelaySeconds ?? 5}s`} />
        <DetailCard label="FCM Token" value={device.fcmToken ? `${device.fcmToken.slice(0, 32)}...` : '-'} mono copy={device.fcmToken} />
        <DetailCard label="FCM Status" value={fcmInvalid ? `Invalid: ${device.fcmTokenInvalidReason || 'unknown'}` : (device.fcmToken ? 'Valid' : 'None')} />
        {fcmInvalid && <DetailCard label="FCM Invalidated At" value={new Date(device.fcmTokenInvalidatedAt!).toLocaleString()} />}
      </Section>

      {/* Hardware Status */}
      <Section title="Hardware Status">
        <DetailCard label="Battery" value={
          health?.batteryPercentage !== null && health?.batteryPercentage !== undefined
            ? `${health.batteryPercentage}%${health.batteryCharging ? ' (charging)' : ''}`
            : device.batteryInfo?.percentage !== undefined ? `${device.batteryInfo.percentage}%${device.batteryInfo.isCharging ? ' (charging)' : ''}` : '-'
        } />
        <DetailCard label="Network" value={health?.networkType || device.networkInfo?.networkType || '-'} />
        <DetailCard label="Uptime" value={
          health?.uptimeSeconds !== null && health?.uptimeSeconds !== undefined
            ? ago(health.uptimeSeconds * 1000)
            : device.deviceUptimeInfo?.uptimeMillis ? ago(device.deviceUptimeInfo.uptimeMillis) : '-'
        } />
        <DetailCard label="Last Heartbeat" value={device.lastHeartbeat ? `${ago(staleFor)} ago` : 'Never'} />
        {device.batteryInfo?.lastUpdated && <DetailCard label="Battery Reported" value={new Date(device.batteryInfo.lastUpdated).toLocaleString()} />}
        {device.networkInfo?.lastUpdated && <DetailCard label="Network Reported" value={new Date(device.networkInfo.lastUpdated).toLocaleString()} />}
      </Section>

      {/* SIM Details */}
      {device.simInfo?.sims && device.simInfo.sims.length > 0 && (
        <Section title={device.simInfo.sims.length > 1 ? `SIM Cards (${device.simInfo.sims.length} slots)` : 'SIM Card'}>
          {device.simInfo.sims.map((sim, i) => (
            <div key={i} className="bg-white rounded-lg shadow p-3 col-span-2 lg:col-span-2">
              <div className="text-[10px] text-gray-400 uppercase font-bold mb-1">SIM Slot {sim.simSlotIndex ?? i + 1}</div>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                <div><span className="text-gray-400">Carrier:</span> {sim.carrierName || '-'}</div>
                <div><span className="text-gray-400">Display:</span> {sim.displayName || '-'}</div>
                <div><span className="text-gray-400">ICC ID:</span> <span className="font-mono">{sim.iccId || '-'}</span></div>
                <div><span className="text-gray-400">Card ID:</span> {sim.cardId ?? '-'}</div>
                <div><span className="text-gray-400">Subscription ID:</span> {sim.subscriptionId ?? '-'}</div>
                <div><span className="text-gray-400">MCC/MNC:</span> {sim.mcc || '-'}/{sim.mnc || '-'}</div>
                <div><span className="text-gray-400">Country:</span> {sim.countryIso || '-'}</div>
                <div><span className="text-gray-400">Type:</span> {sim.subscriptionType || '-'}</div>
              </div>
            </div>
          ))}
          {device.simInfo.lastUpdated && <DetailCard label="SIM Reported" value={new Date(device.simInfo.lastUpdated).toLocaleString()} />}
        </Section>
      )}

      {/* Memory & Storage */}
      <Section title="Memory &amp; Storage">
        {device.memoryInfo ? (
          <>
            <DetailCard label="Free Memory" value={bytes(device.memoryInfo.freeBytes)} />
            <DetailCard label="Total Memory" value={bytes(device.memoryInfo.totalBytes)} />
            <DetailCard label="Max Memory" value={bytes(device.memoryInfo.maxBytes)} />
            {device.memoryInfo.lastUpdated && <DetailCard label="Memory Reported" value={new Date(device.memoryInfo.lastUpdated).toLocaleString()} />}
          </>
        ) : <DetailCard label="Memory" value="Not reported" />}
        {device.storageInfo ? (
          <>
            <DetailCard label="Free Storage" value={bytes(device.storageInfo.availableBytes)} />
            <DetailCard label="Total Storage" value={bytes(device.storageInfo.totalBytes)} />
            {device.storageInfo.lastUpdated && <DetailCard label="Storage Reported" value={new Date(device.storageInfo.lastUpdated).toLocaleString()} />}
          </>
        ) : <DetailCard label="Storage" value="Not reported" />}
      </Section>

      {/* System */}
      {(device.systemInfo?.timezone || device.systemInfo?.locale) && (
        <Section title="System">
          {device.systemInfo.timezone && <DetailCard label="Timezone" value={device.systemInfo.timezone} />}
          {device.systemInfo.locale && <DetailCard label="Locale" value={device.systemInfo.locale} />}
          {device.systemInfo.lastUpdated && <DetailCard label="System Reported" value={new Date(device.systemInfo.lastUpdated).toLocaleString()} />}
        </Section>
      )}

      {/* Stats & Timestamps */}
      <Section title="Statistics">
        <DetailCard label="SMS Sent" value={fmt(device.sentSMSCount)} />
        <DetailCard label="SMS Received" value={fmt(device.receivedSMSCount)} />
        <DetailCard label="Created" value={new Date(device.createdAt).toLocaleString()} />
        <DetailCard label="Updated" value={new Date(device.updatedAt).toLocaleString()} />
      </Section>

      {/* Heartbeat history */}
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
              <p className="text-xs text-gray-400">No heartbeat logs yet. Heartbeats are being logged from now on.</p>
            ) : (
              <div className="space-y-1">
                {hbLogs.map((h, i) => (
                  <div key={i} className="text-xs font-mono text-gray-600">
                    {new Date(h.timestamp).toLocaleString()} &mdash;
                    batt:{h.batteryPercentage ?? '?'}%{h.batteryCharging ? ' charging' : ''}
                    net:{h.networkType ?? '?'}
                    uptime:{h.uptimeSeconds ? ago(h.uptimeSeconds * 1000) : '?'}
                    {h.simCarrier ? ` sim:${h.simCarrier}` : ''}
                    {h.appVersion ? ` app:${h.appVersion}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Messages */}
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
              <div className="font-medium truncate max-w-md">{displayText(m.message, '(empty message)')}</div>
              {statusBadge(m.status)}
            </div>
            <div className="text-xs text-gray-400 mt-1">
              {m.type === 'SENT' ? `To: ${m.recipient}` : `From: ${m.sender}`}
              {' - '}
              {new Date(m.createdAt).toLocaleString()}
              {m.sentAt && ` - Sent: ${new Date(m.sentAt).toLocaleString()}`}
              {m.failedAt && ` - Failed: ${new Date(m.failedAt).toLocaleString()}`}
              {displayText(m.errorMessage) && ` - Error: ${displayText(m.errorMessage)}`}
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

