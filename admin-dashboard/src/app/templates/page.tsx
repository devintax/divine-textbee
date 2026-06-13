'use client'

import { useEffect, useState, useCallback } from 'react'
import type { Template } from '@/lib/textbee'

const VAR_REGEX = /\{\{\s*(\w+)\s*\}\}/g

function extractVars(body: string): string[] {
  const vars: string[] = []
  let m: RegExpExecArray | null
  const re = new RegExp(VAR_REGEX.source, 'g')
  while ((m = re.exec(body)) !== null) { if (!vars.includes(m[1])) vars.push(m[1]) }
  return vars
}

function renderPreview(body: string, sample: Record<string, string>): string {
  return body.replace(VAR_REGEX, (_, name) => sample[name] || `{{${name}}}`)
}

export default function TemplatesPage() {
  const [items, setItems] = useState<Template[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editId, setEditId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [body, setBody] = useState('')
  const [busy, setBusy] = useState(false)
  const [previewSample, setPreviewSample] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try { const r = await fetch('/api/gateway/templates'); const j = await r.json(); if (j.error) throw new Error(j.error); setItems(j.data) }
    catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  function resetForm() { setEditId(null); setName(''); setBody(''); setPreviewSample({}) }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('')
    try {
      const r = editId ? await fetch(`/api/gateway/templates/${editId}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), body: body.trim() }) }) : await fetch('/api/gateway/templates', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), body: body.trim() }) })
      const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Save failed')
      resetForm(); await load()
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this template?')) return
    try { const r = await fetch(`/api/gateway/templates/${id}`, { method: 'DELETE' }); const j = await r.json(); if (!r.ok) throw new Error(j.error); await load() }
    catch (e: any) { setError(e.message) }
  }

  function startEdit(t: Template) { setEditId(t.id); setName(t.name); setBody(t.body); const vars = extractVars(t.body); const s: Record<string, string> = {}; vars.forEach((v) => { s[v] = '' }); setPreviewSample(s) }

  const vars = extractVars(body)

  if (loading) return <p className="text-gray-500">Loading...</p>

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-bold mb-4">SMS Templates</h1>

      <form onSubmit={handleSave} className="bg-white rounded-xl shadow p-4 mb-6 space-y-3">
        <h2 className="text-sm font-semibold">{editId ? 'Edit Template' : 'New Template'}</h2>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <div>
          <label className="block text-xs font-medium mb-1">Name</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. Order Confirmation" required />
        </div>
        <div>
          <label className="block text-xs font-medium mb-1">Message body <span className="text-gray-400">(use {'{{'} variableName {'}}'} for dynamic values)</span></label>
          <textarea value={body} onChange={(e) => setBody(e.target.value)} rows={4} maxLength={1600} className="w-full border rounded-lg px-3 py-2 text-sm font-mono" placeholder={"Hello {{ name }}, your order #{{ orderId }} is ready!"} required />
          <div className="text-xs text-gray-400 mt-1">{body.length} / 1600</div>
        </div>
        {vars.length > 0 && (
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-xs font-semibold mb-2">Preview with sample values</div>
            <div className="space-y-2">
              {vars.map((v) => (
                <div key={v} className="flex items-center gap-2">
                  <span className="text-xs font-mono w-24">{'{{'}{v}{'}}'}</span>
                  <input type="text" value={previewSample[v] || ''} onChange={(e) => setPreviewSample({ ...previewSample, [v]: e.target.value })} className="flex-1 border rounded px-2 py-1 text-xs" placeholder={`Value for ${v}`} />
                </div>
              ))}
            </div>
            <div className="mt-2 p-2 bg-white border rounded text-sm">{renderPreview(body, previewSample) || <span className="text-gray-400">Preview will appear here</span>}</div>
          </div>
        )}
        <div className="flex gap-2">
          <button type="submit" disabled={busy} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">{busy ? 'Saving...' : editId ? 'Update' : 'Create'}</button>
          {editId && <button type="button" onClick={resetForm} className="bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200">Cancel</button>}
        </div>
      </form>

      {items.length === 0 ? <p className="text-gray-500">No templates yet.</p> : (
        <div className="space-y-3">
          {items.map((t) => (
            <div key={t.id} className="bg-white rounded-xl shadow p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-gray-500 font-mono mt-1 whitespace-pre-wrap break-all">{t.body}</div>
                  <div className="text-xs text-gray-400 mt-1">
                    {extractVars(t.body).length > 0 ? `Variables: ${extractVars(t.body).join(', ')}` : 'No variables'}
                    {' · '} Updated {new Date(t.updatedAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="flex gap-2 ml-4">
                  <button onClick={() => startEdit(t)} className="text-xs text-blue-600 hover:underline">Edit</button>
                  <button onClick={() => handleDelete(t.id)} className="text-xs text-red-600 hover:underline">Delete</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
