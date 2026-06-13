'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Device } from '@/lib/textbee'

type MessageType = 'transactional' | 'marketing'

export default function SendSmsPage() {
  const router = useRouter()
  const [devices, setDevices] = useState<Device[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [recipient, setRecipient] = useState('')
  const [message, setMessage] = useState('')
  const [messageType, setMessageType] = useState<MessageType>('transactional')
  const [complianceFooter, setComplianceFooter] = useState(true)
  const [footerText, setFooterText] = useState('Reply STOP to opt out, HELP for help')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/textbee/devices')
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error)
        setDevices(j.data)
        if (j.data.length > 0) setDeviceId(j.data[0]._id)
      })
      .catch((e) => setError(e.message))
  }, [])

  const effectiveMessage = complianceFooter
    ? message.trim() + '\n\n' + footerText
    : message.trim()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setResult(null)
    setError('')

    if (!deviceId) {
      setError('Please select a device.')
      return
    }
    const recipients = recipient
      .split(/[\n,]+/)
      .map((r) => r.trim())
      .filter(Boolean)
    if (recipients.length === 0) {
      setError('Enter at least one recipient phone number.')
      return
    }
    if (!message.trim()) {
      setError('Message cannot be empty.')
      return
    }

    setSending(true)
    try {
      const res = await fetch(`/api/textbee/devices/${deviceId}/send-sms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: effectiveMessage, recipients }),
      })
      let j: any
      const text = await res.text()
      try { j = JSON.parse(text) } catch { throw new Error(`Server returned HTTP ${res.status} — response was not JSON. ${text.slice(0, 200)}`) }
      if (res.status === 403) throw new Error(j.error || 'Request blocked')
      if (!res.ok) throw new Error(j.error || j.message || `Request failed (${res.status})`)
      setResult({ ok: true, text: `SMS sent to ${recipients.length} recipient(s) successfully.` })
      setRecipient('')
      setMessage('')
    } catch (e: any) {
      setResult({ ok: false, text: e.message })
    } finally {
      setSending(false)
    }
  }

  const devName = (d: Device) =>
    d.name || `${d.brand || ''} ${d.model || ''}`.trim() || d._id

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Send SMS</h1>
      <form onSubmit={handleSubmit} className="bg-white rounded-xl shadow p-4 max-w-xl space-y-4">
        <div>
          <label className="block text-sm font-medium mb-1">Device</label>
          <select
            value={deviceId}
            onChange={(e) => setDeviceId(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          >
            {devices.map((d) => (
              <option key={d._id} value={d._id}>
                {devName(d)}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Message type</label>
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="messageType"
                value="transactional"
                checked={messageType === 'transactional'}
                onChange={() => setMessageType('transactional')}
              />
              <span>Transactional</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="radio"
                name="messageType"
                value="marketing"
                checked={messageType === 'marketing'}
                onChange={() => setMessageType('marketing')}
              />
              <span>Marketing</span>
            </label>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            {messageType === 'marketing'
              ? 'Marketing messages have stricter consent and opt-out requirements. Ensure you have appropriate consent before sending.'
              : 'Transactional messages (account alerts, order confirmations) typically have relaxed opt-out requirements.'}
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">
            Recipients <span className="text-gray-400">(one per line, with country code)</span>
          </label>
          <textarea
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            rows={3}
            placeholder={`+251912345678\n+251987654321`}
            className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
          />
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Message</label>
          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={4}
            maxLength={1600}
            placeholder="Type your SMS message..."
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          <div className="text-xs text-gray-400 mt-1">
            {effectiveMessage.length} / 1600
            {complianceFooter && message.trim() && (
              <span className="text-gray-400"> (includes {footerText.length} char footer)</span>
            )}
          </div>
        </div>

        <div className="border rounded-lg p-3 bg-gray-50">
          <label className="flex items-center gap-2 text-sm cursor-pointer mb-2">
            <input
              type="checkbox"
              checked={complianceFooter}
              onChange={(e) => setComplianceFooter(e.target.checked)}
            />
            <span className="font-medium">Append compliance footer</span>
          </label>
          {complianceFooter && (
            <div>
              <input
                type="text"
                value={footerText}
                onChange={(e) => setFooterText(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm"
                placeholder="Reply STOP to opt out, HELP for help"
              />
              <p className="text-xs text-gray-400 mt-1">
                Automatically appended to every message. Customize for your Sender ID or brand.
              </p>
            </div>
          )}
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}
        {result && (
          <p className={`text-sm ${result.ok ? 'text-green-700' : 'text-red-600'}`}>
            {result.text}
          </p>
        )}

        <button
          type="submit"
          disabled={sending}
          className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
        >
          {sending ? 'Sending...' : 'Send SMS'}
        </button>
      </form>
    </div>
  )
}
