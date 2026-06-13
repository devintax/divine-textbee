'use client'

import { useEffect, useState, useCallback } from 'react'
import type { SuppressionEntry } from '@/lib/textbee'

export default function SuppressionsPage() {
  const [items, setItems] = useState<SuppressionEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [phoneNumber, setPhoneNumber] = useState('')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/gateway/suppressions')
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      setItems(j.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const r = await fetch('/api/gateway/suppressions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim(), reason: reason.trim() || undefined }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      setPhoneNumber('')
      setReason('')
      await load()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleRemove(id: string) {
    if (!confirm('Remove this number from the suppression list?')) return
    try {
      const r = await fetch(`/api/gateway/suppressions/${id}`, { method: 'DELETE' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      await load()
    } catch (e: any) {
      setError(e.message)
    }
  }

  if (loading) return <p className="text-gray-500">Loading...</p>

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Suppression List / Opt-outs</h1>

      <div className="bg-white rounded-xl shadow p-4 mb-6 max-w-lg">
        <h2 className="text-sm font-semibold mb-3">Manually add a number</h2>
        <form onSubmit={handleAdd} className="space-y-3">
          <div>
            <label className="block text-xs font-medium mb-1">Phone number (with country code)</label>
            <input
              type="text"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="+251912345678"
              className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1">Reason (optional)</label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Customer requested opt-out"
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={busy}
            className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? 'Adding...' : 'Add to Suppression List'}
          </button>
        </form>
      </div>

      {items.length === 0 ? (
        <p className="text-gray-500">No suppressed numbers.</p>
      ) : (
        <div className="bg-white rounded-xl shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Phone Number</th>
                <th className="px-4 py-3 font-medium">Reason</th>
                <th className="px-4 py-3 font-medium">Source</th>
                <th className="px-4 py-3 font-medium">Added</th>
                <th className="px-4 py-3 font-medium">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {items.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-mono">{s.phoneNumber}</td>
                  <td className="px-4 py-3 text-gray-600">{s.reason}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${s.source === 'auto_stop' ? 'bg-yellow-100 text-yellow-800' : 'bg-blue-100 text-blue-800'}`}>
                      {s.source === 'auto_stop' ? 'Auto (STOP)' : 'Manual'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{new Date(s.createdAt).toLocaleString()}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleRemove(s.id)}
                      className="text-red-600 hover:text-red-800 text-xs font-medium"
                    >
                      Remove
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
