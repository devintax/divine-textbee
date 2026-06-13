'use client'

import { useEffect, useState, useRef } from 'react'
import type { Device, Template } from '@/lib/textbee'

// Case-insensitive variable matching with whitespace trimming
const VAR_REGEX = /\{\{\s*([^}]+)\s*\}\}/g

function renderTemplate(body: string, row: Record<string, string>): { text: string; missing: string[] } {
  const rowLower: Record<string, string> = {}
  for (const [k, v] of Object.entries(row)) rowLower[k.toLowerCase()] = v

  const missing: string[] = []
  const used = new Set<string>()

  const text = body.replace(VAR_REGEX, (_, raw: string) => {
    const name = raw.trim()
    const key = name.toLowerCase()
    if (rowLower[key] !== undefined) {
      used.add(key)
      return rowLower[key]
    }
    if (!missing.includes(name)) missing.push(name)
    return `[MISSING: ${name}]`
  })

  return { text, missing }
}

function extractVars(body: string): string[] {
  const set = new Set<string>()
  let m: RegExpExecArray | null
  const re = new RegExp(VAR_REGEX.source, 'g')
  while ((m = re.exec(body)) !== null) {
    set.add(m[1].trim())
  }
  return [...set]
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
  const [previewedOnce, setPreviewedOnce] = useState(false)
  const [previewText, setPreviewText] = useState('')
  const [previewMissing, setPreviewMissing] = useState<string[]>([])
  const [error, setError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [bulkCap, setBulkCap] = useState(50)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([fetch('/api/textbee/devices'), fetch('/api/gateway/templates'), fetch('/api/config/bulk-cap')]).then(async ([d, t, c]) => {
      const dj = await d.json(); if (!dj.error) { setDevices(dj.data); if (dj.data.length > 0) setDeviceId(dj.data[0]._id) }
      const tj = await t.json(); if (!tj.error) setTemplates(tj.data)
      const cj = await c.json(); if (cj.cap) setBulkCap(cj.cap)
    }).catch(() => {})
  }, [])

  const currentTemplate = templates.find((t) => t.id === templateId)
  const rawMessage = templateId && currentTemplate ? currentTemplate.body : customMessage
  const needsCustom = !templateId

  function parseCSV(text: string) {
    setError('')
    setResult(null)
    setPreviewedOnce(false)
    setPreviewText('')
    const lines = text.trim().split('\n').filter(Boolean)
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

  function handleParseClick() {
    parseCSV(csvText)
  }

  function handleFileUpload(f: File) {
    if (!f.name.endsWith('.csv')) { setError('Please upload a .csv file'); return }
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target?.result as string
      setCsvText(text)
      parseCSV(text)
    }
    reader.readAsText(f)
  }

  function handleDragOver(e: React.DragEvent) { e.preventDefault(); setDragOver(true) }
  function handleDragLeave() { setDragOver(false) }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false)
    const f = e.dataTransfer.files[0]; if (f) handleFileUpload(f)
  }

  function handlePreviewRow(row: Record<string, string>) {
    setPreviewRow(row)
    if (currentTemplate) {
      const { text, missing } = renderTemplate(currentTemplate.body, row)
      setPreviewText(text)
      setPreviewMissing(missing)
    } else {
      setPreviewText(customMessage)
      setPreviewMissing([])
    }
    setPreviewedOnce(true)
  }

  // Determine disabled reason
  const phoneNumbers = parsedRows.map((r) => r[phoneColumn]).filter(Boolean)
  const overCap = phoneNumbers.length > bulkCap

  let disableReason = ''
  let canSend = false
  if (!deviceId) disableReason = 'Select a device'
  else if (parsedRows.length === 0) disableReason = 'Parse CSV data first'
  else if (!phoneColumn) disableReason = 'Select the phone number column'
  else if (phoneNumbers.length === 0) disableReason = 'No phone numbers found in the selected column'
  else if (!rawMessage) disableReason = 'Select a template or write a message'
  else if (overCap) disableReason = `Over recipient cap (${bulkCap} max, CSV has ${phoneNumbers.length})`
  else if (currentTemplate && previewMissing.length > 0) disableReason = `Missing template variables: ${previewMissing.join(', ')} — check CSV column names`
  else if (!previewedOnce) disableReason = 'Preview a recipient before sending'
  else canSend = true

  async function handleSend() {
    setError(''); setResult(null)
    if (!deviceId) { setError('Select a device'); return }
    if (!phoneColumn) { setError('Select the phone number column'); return }
    if (!rawMessage) { setError('Select a template or write a message'); return }

    const numPhones = phoneNumbers.length
    if (numPhones === 0) { setError('No phone numbers found in the selected column'); return }
    if (numPhones > bulkCap) { setError(`Recipient cap is ${bulkCap}, CSV has ${numPhones}. Reduce or increase BULK_SEND_CAP env var.`); return }

    // Check missing vars
    if (currentTemplate) {
      const { missing } = renderTemplate(currentTemplate.body, parsedRows[0])
      if (missing.length > 0) { setError(`Missing template variables: ${missing.join(', ')}. Check CSV column names match.`); return }
    }

    setSending(true)
    try {
      const entries = parsedRows.map((r) => ({
        phone: r[phoneColumn],
        message: currentTemplate ? renderTemplate(currentTemplate.body, r).text : customMessage,
      })).filter((e) => e.phone)

      const res = await fetch('/api/gateway/bulk-send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: entries, deviceId, delaySeconds }),
      })
      const j = await res.json()
      if (!res.ok) throw new Error(j.error || 'Bulk send failed')
      setResult(j.data)
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

        {/* CSV upload section */}
        <div>
          <label className="block text-xs font-medium mb-1">Upload CSV</label>
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors text-xs ${dragOver ? 'border-blue-400 bg-blue-50' : 'border-gray-300 hover:border-gray-400'}`}
          >
            {dragOver ? 'Drop CSV file here' : 'Drag & drop a .csv file, or click to browse'}
            <input ref={fileInputRef} type="file" accept=".csv" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f) }} className="hidden" />
          </div>
        </div>

        {/* Or paste CSV */}
        <div>
          <label className="block text-xs font-medium mb-1">Or paste CSV data <span className="text-gray-400">(headers + rows, comma-separated)</span></label>
          <textarea value={csvText} onChange={(e) => setCsvText(e.target.value)} rows={4} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder={"phone,name,orderId\n+251912345678,Abebe,1234\n+251987654321,Belay,5678"} />
          <button type="button" onClick={handleParseClick} className="mt-2 bg-gray-100 text-gray-700 px-3 py-1.5 rounded text-sm hover:bg-gray-200">Parse CSV</button>
        </div>

        {columns.length > 0 && (
          <div>
            <label className="block text-xs font-medium mb-1">Phone number column</label>
            <select value={phoneColumn} onChange={(e) => setPhoneColumn(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
              {columns.map((c) => (<option key={c} value={c}>{c}</option>))}
            </select>
            <div className="text-xs text-gray-400 mt-1">
              {parsedRows.length} row(s) parsed
              {bulkCap > 0 && phoneNumbers.length > bulkCap && (
                <span className="text-red-500 ml-2">&#9888; Over cap: {bulkCap} max, CSV has {phoneNumbers.length}</span>
              )}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium mb-1">Template <span className="text-gray-400">(or write custom message below)</span></label>
          <select value={templateId} onChange={(e) => { setTemplateId(e.target.value); setPreviewedOnce(false); setPreviewText(''); setPreviewMissing([]) }} className="w-full border rounded-lg px-3 py-2 text-sm">
            <option value="">-- No template (use custom message) --</option>
            {templates.map((t) => (<option key={t.id} value={t.id}>{t.name}</option>))}
          </select>
        </div>

        {needsCustom && (
          <div>
            <label className="block text-xs font-medium mb-1">Custom message</label>
            <textarea value={customMessage} onChange={(e) => { setCustomMessage(e.target.value); setPreviewedOnce(false) }} rows={3} maxLength={1600} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Type a message (no variable substitution)" />
            <div className="text-xs text-gray-400 mt-1">{customMessage.length} / 1600</div>
          </div>
        )}

        {/* Variable extraction hint */}
        {currentTemplate && (
          <div className="text-xs text-gray-500">
            Template variables: <code className="bg-gray-100 px-1 rounded">{extractVars(currentTemplate.body).join(', ') || '(none)'}</code>
          </div>
        )}

        {/* Per-row preview */}
        {parsedRows.length > 0 && (
          <div>
            <label className="block text-xs font-medium mb-1">Preview a recipient</label>
            <div className="flex gap-2">
              <select
                value={previewRow ? parsedRows.indexOf(previewRow) : -1}
                onChange={(e) => handlePreviewRow(parsedRows[parseInt(e.target.value)])}
                className="flex-1 border rounded-lg px-3 py-2 text-sm"
              >
                <option value={-1}>-- Select a row --</option>
                {parsedRows.map((row, i) => (
                  <option key={i} value={i}>
                    {row[phoneColumn] || `Row ${i + 1}`} — {Object.entries(row).slice(0, 2).map(([k, v]) => `${k}=${v}`).join(', ')}
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {previewRow && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold mb-1">Message preview</div>
            <div className="text-xs text-gray-500 mb-1">{Object.entries(previewRow).map(([k, v]) => `${k}=${v}`).join(', ')}</div>
            <div className="bg-white border rounded p-2 text-sm whitespace-pre-wrap">{previewText || rawMessage}</div>
            {previewMissing.length > 0 && (
              <div className="text-xs text-red-500 mt-1">
                &#9888; Missing variables (not found in CSV): {previewMissing.join(', ')}
              </div>
            )}
            {previewedOnce && (
              <div className="text-xs text-green-600 mt-1">&#10003; Preview verified — message will match this exactly</div>
            )}
          </div>
        )}

        {/* Suppression info */}
        {parsedRows.length > 0 && (
          <div className="text-xs text-gray-400">
            Recipients will be checked against the suppression list before sending. Opted-out numbers are skipped.
          </div>
        )}

        {error && <p className="text-red-600 text-sm">{error}</p>}

        {parsedRows.length > 0 && (
          <div>
            <button
              onClick={handleSend}
              disabled={!canSend || sending}
              className={`w-full px-6 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                canSend
                  ? 'bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50'
                  : 'bg-gray-200 text-gray-500 cursor-not-allowed'
              }`}
            >
              {sending
                ? `Sending to ${phoneNumbers.length} recipient(s)...`
                : canSend
                  ? `Send to ${phoneNumbers.length} recipient(s)`
                  : disableReason}
            </button>
            {!canSend && !sending && (
              <p className="text-xs text-gray-400 mt-1 text-center">{disableReason}</p>
            )}
          </div>
        )}

        {result && (
          <div className={`rounded-lg p-3 text-sm ${result.failed > 0 || result.suppressed > 0 ? 'bg-amber-50 border border-amber-200' : 'bg-green-50 border border-green-200'}`}>
            <strong>Result:</strong> {result.total} total · {result.sent} sent · {result.failed} failed · {result.suppressed} suppressed (opted out)
            {result.results?.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto space-y-1">
                {result.results.map((r: any, i: number) => (
                  <div key={i} className={`text-xs font-mono ${r.status === 'sent' ? 'text-green-700' : r.status === 'suppressed' ? 'text-orange-600' : 'text-red-600'}`}>
                    {r.phoneNumber}: {r.status}{r.error ? ` — ${r.error}` : ''}
                    {r.message && r.status === 'sent' && <span className="text-gray-400"> — &ldquo;{r.message.slice(0, 60)}{r.message.length > 60 ? '…' : ''}&rdquo;</span>}
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