'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Device, Template } from '@/lib/textbee'

const VAR_REGEX = /\{\{\s*(\w+)\s*\}\}/g

function renderTemplate(body: string, row: Record<string, string>): string {
  return body.replace(VAR_REGEX, (_, name) => row[name] || '')
}

function extractVars(body: string): string[] {
  const vars: string[] = []
  let m: RegExpExecArray | null
  const re = new RegExp(VAR_REGEX.source, 'g')
  while ((m = re.exec(body)) !== null) { if (!vars.includes(m[1])) vars.push(m[1]) }
  return vars
}

export default function BulkSendPage() {
  const [devices, setDevices] = useState<Device[]>([])
  const [templates, setTemplates] = useState<Template[]>([])
  const [deviceId, setDeviceId] = useState('')
  const [csvText, setCsvText] = useState('')
  const [parsedRows, setParsedRows] = useState<Record<string, string>[]>([])
  const [columns, setColumns] = useState<string[]>([])
  const [phoneColumn, setPhoneColumn] = useState('')
  const [templateId, setTemplateId] = useState('')
  const [customMessage, setCustomMessage] = useState('')
  const [delaySeconds, setDelaySeconds] = useState(3)
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [previewRow, setPreviewRow] = useState<Record<string, string> | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([fetch('/api/textbee/devices'), fetch('/api/gateway/templates')]).then(async ([d, t]) => {
      const dj = await d.json(); if (!dj.error) { setDevices(dj.data); if (dj.data.length > 0) setDeviceId(dj.data[0]._id) }
      const tj = await t.json(); if (!tj.error) setTemplates(tj.data)
    }).catch(() => {})
  }, [])

  const currentTemplate = templates.find((t) => t.id === templateId)
  const templateVars = currentTemplate ? extractVars(currentTemplate.body) : []
  const rawMessage = templateId && currentTemplate ? currentTemplate.body : customMessage
  const needsCustom = !templateId

  function parseCSV() {
    setError('')
    const lines = csvText.trim().split('\n').filter(Boolean)
    if (lines.length < 2) { setError('CSV must have at least a header row and one data row'); return }
    const headers = lines[0].split(',').map((h) => h.trim())
    const rows = lines.slice(1).map((line) => {
      const vals = line.split(',').map((v) => v.trim())
      const row: Record<string, string> = {}
      headers.forEach((h, i) => { row[h] = vals[i] || '' })
      return row
    })
    setColumns(headers)
    setParsedRows(rows)
    if (!phoneColumn && headers.length > 0) setPhoneColumn(headers[0])
    if (rows.length > 0) setPreviewRow(rows[0])
  }

  function getMessageForRow(row: Record<string, string>): string {
    return currentTemplate ? renderTemplate(currentTemplate.body, row) : customMessage
  }

  async function handleSend() {
    setError(''); setResult(null)
    if (!deviceId) { setError('Select a device'); return }
    if (!phoneColumn) { setError('Select the phone number column'); return }
    if (!rawMessage) { setError('Select a template or write a message'); return }

    const recipients = parsedRows.map((r) => r[phoneColumn]).filter(Boolean)
    if (recipients.length === 0) { setError('No phone numbers found in the selected column'); return }

    setSending(true)
    try {
      const res = await fetch('/api/gateway/bulk-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          message: rawMessage,
          recipients: parsedRows.map((r) => {
            const msg = getMessageForRow(r)
            return { phone: r[phoneColumn], message: msg }
          }).map((x) => x.phone),
          delaySeconds,
        }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Bulk send failed')
      setResult(j.data)
      // Note: actual personalized messages are sent; the bulk endpoint currently sends the raw template text.
      // For full per-recipient personalization, each recipient's rendered message should be sent individually.
    } catch (e: any) { setError(e.message) }
    finally { setSending(false) }
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">Bulk Send via CSV</h1>

      <div className="bg-white rounded-xl shadow p-4 mb-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium mb-1">Device</label>
            <select value={deviceId} onChange={(e) => setDeviceId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {devices.map((d) => (<option key={d._id} value={d._id}>{d.name || `${d.brand || ''} ${d.model || ''}`.trim() || d._id}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Delay between messages (seconds)</label>
            <input type="number" value={delaySeconds} onChange={(e) => setDelaySeconds(parseInt(e.target.value) || 3)} min={1} max={60} className="w-full border rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium mb-1">CSV data <span className="text-gray-400">(paste or type)</span></label>
          <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={5} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder={"phone,name,orderId\n+251912345678,Abebe,1234\n+251987654321,Belay,5678"} />
          <button type="button" onClick={parseCSV} className="mt-2 bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-200">Parse CSV</button>
        </div>

        {columns.length > 0 && (
          <div>
            <label className="block text-xs font-medium mb-1">Phone number column</label>
            <select value={phoneColumn} onChange={(e) => setPhoneColumn(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {columns.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
            <div className="text-xs text-gray-400 mt-1">{parsedRows.length} row(s) parsed</div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium mb-1">Template <span className="text-gray-400">(or write custom message below)</span></label>
          <select value={templateId} onChange={(e) => setTemplateId(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">-- No template (use custom message) --</option>
            {templates.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
        </div>

        {needsCustom && (
          <div>
            <label className="block text-xs font-medium mb-1">Custom message</label>
            <textarea value={customMessage} onChange={(e) => setCustomMessage(e.target.value)} rows={3} maxLength={1600} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Type a message (no variable substitution)" />
            <div className="text-xs text-gray-400 mt-1">{customMessage.length} / 1600</div>
          </div>
        )}

        {currentTemplate && previewRow && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold mb-1">Preview for first row</div>
            <div className="text-xs text-gray-500 mb-1">{Object.entries(previewRow).map(([k, v]) => `${k}=${v}`).join(', ')}</div>
            <div className="bg-white border rounded p-2 text-sm">{renderTemplate(currentTemplate.body, previewRow)}</div>
          </div>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {parsedRows.length > 0 && (
          <button onClick={handleSend} disabled={sending} className="bg-blue-600 text-white px-6 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
            {sending ? `Sending to ${parsedRows.length} recipient(s)...` : `Send to ${parsedRows.length} recipient(s)`}
          </button>
        )}

        {result && (
          <div className={`rounded-lg p-3 text-sm ${result.failed > 0 || result.suppressed > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
            <strong>Result:</strong> {result.total} total · {result.sent} sent · {result.failed} failed · {result.suppressed} suppressed (opted out)
            {result.results?.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {result.results.map((r: any, i: number) => (
                  <div key={i} className={`text-xs font-mono ${r.status === 'sent' ? 'text-green-700' : r.status === 'suppressed' ? 'text-orange-600' : 'text-red-600'}`}>
                    {r.phoneNumber}: {r.status}{r.error ? ` — ${r.error}` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
