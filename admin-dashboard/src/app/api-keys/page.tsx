'use client'

import { useEffect, useState, useCallback } from 'react'
import type { GatewayApiKey } from '@/lib/textbee'

export default function ApiKeysPage() {
  const [keys, setKeys] = useState<GatewayApiKey[]>([])
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [label, setLabel] = useState('')
  const [creating, setCreating] = useState(false)
  const [createdKey, setCreatedKey] = useState<{ label: string; key: string } | null>(null)

  const loadKeys = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      const r = await fetch('/api/gateway/keys')
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      setKeys(j.data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadKeys() }, [loadKeys])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!label.trim()) return
    setCreating(true)
    setError('')
    try {
      const r = await fetch('/api/gateway/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: label.trim() }),
      })
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      setCreatedKey({ label: j.data.label, key: j.data.key })
      setLabel('')
      await loadKeys()
    } catch (e: any) {
      setError(e.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleRevoke(id: string, label: string) {
    if (!confirm(`Revoke key "${label}"? This action cannot be undone.`)) return
    try {
      const r = await fetch(`/api/gateway/keys/${id}/revoke`, { method: 'POST' })
      const j = await r.json()
      if (j.error) throw new Error(j.error)
      await loadKeys()
    } catch (e: any) {
      setError(e.message)
    }
  }

  async function copyKey(key: string) {
    try {
      await navigator.clipboard.writeText(key)
      alert('Key copied to clipboard')
    } catch {
      alert('Failed to copy. Select and copy the key manually.')
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">API Keys</h1>

      {/* Created key banner */}
      {createdKey && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 max-w-xl">
          <p className="text-amber-800 text-sm font-semibold mb-1">
            Key created — store it now
          </p>
          <p className="text-amber-700 text-xs mb-2">
            This is the only time you will see the full key. Copy it immediately.
          </p>
          <div className="bg-white border rounded-lg p-2 flex items-center gap-2">
            <code className="flex-1 text-xs font-mono break-all select-all">
              {createdKey.key}
            </code>
            <button
              onClick={() => copyKey(createdKey.key)}
              className="shrink-0 text-xs bg-amber-600 text-white px-3 py-1.5 rounded hover:bg-amber-700"
            >
              Copy
            </button>
          </div>
          <button
            onClick={() => setCreatedKey(null)}
            className="mt-2 text-xs text-amber-600 hover:text-amber-800"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Create form */}
      <div className="bg-white rounded-xl shadow p-4 mb-6 max-w-xl">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
          Create New Key
        </h2>
        <form onSubmit={handleCreate} className="flex gap-2">
          <input
            type="text"
            placeholder="e.g. staging-app"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="flex-1 border rounded-lg px-3 py-2 text-sm"
            required
          />
          <button
            type="submit"
            disabled={creating || !label.trim()}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {creating ? 'Creating...' : 'Create'}
          </button>
        </form>
      </div>

      {/* Error */}
      {error && (
        <p className="text-red-600 text-sm mb-4">Error: {error}</p>
      )}

      {/* Loading */}
      {loading && <p className="text-gray-500">Loading keys...</p>}

      {/* Empty */}
      {!loading && !error && keys.length === 0 && (
        <p className="text-gray-500">No API keys created yet.</p>
      )}

      {/* Key list */}
      {!loading && keys.length > 0 && (
        <div className="space-y-3">
          {keys.map((k) => (
            <div
              key={k.id}
              className="bg-white rounded-xl shadow p-4 flex items-center justify-between"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{k.label}</span>
                  {k.active ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">
                      Active
                    </span>
                  ) : (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      Revoked
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-500 font-mono">{k.prefix}...</div>
                <div className="text-xs text-gray-400 mt-0.5">
                  Created {new Date(k.createdAt).toLocaleDateString()}
                  &nbsp;·&nbsp;This month: {k.thisMonth.sent} sent, {k.thisMonth.failed} failed
                  {k.monthlyQuota > 0 && ` / ${k.monthlyQuota} quota`}
                </div>
              </div>
              {k.active && (
                <button
                  onClick={() => handleRevoke(k.id, k.label)}
                  className="shrink-0 text-sm px-3 py-1.5 rounded bg-red-50 text-red-600 hover:bg-red-100"
                >
                  Revoke
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
