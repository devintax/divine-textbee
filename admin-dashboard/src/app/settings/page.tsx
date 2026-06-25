'use client'

import { useEffect, useState } from 'react'
import { generateTextBeeApiKey } from '@/lib/textbee'

export default function SettingsPage() {
  const [config, setConfig] = useState<{
    url: string
    keyPrefix: string
    keySet: boolean
    gatewayUrl: string
    gatewayTokenSet: boolean
  } | null>(null)
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [newKey, setNewKey] = useState('')
  const [genError, setGenError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/textbee/config')
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error)
        setConfig(j.data)
      })
      .catch((e) => setError(e.message))
  }, [])

  async function handleGenerate() {
    setGenerating(true)
    setGenError('')
    setNewKey('')
    try {
      const key = await generateTextBeeApiKey()
      setNewKey(key)
    } catch (e: any) {
      setGenError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  function copyKey() {
    navigator.clipboard.writeText(newKey).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Settings</h1>

      <div className="space-y-4 max-w-xl">
        {/* TextBee Connection */}
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
            TextBee Connection
          </h2>
          {error && <p className="text-red-600 text-sm mb-2">Error: {error}</p>}
          {config && (
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b">
                  <td className="py-2 font-medium text-gray-700 w-48">TEXTBEE_API_URL</td>
                  <td className="py-2 text-gray-500 font-mono text-xs">{config.url}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 font-medium text-gray-700">TEXTBEE_API_KEY</td>
                  <td className="py-2">
                    {config.keySet ? (
                      <span className="text-green-600 text-xs font-medium">
                        Set ({config.keyPrefix})
                      </span>
                    ) : (
                      <span className="text-red-500 text-xs font-medium">Not set</span>
                    )}
                  </td>
                </tr>
                <tr>
                  <td className="py-2 font-medium text-gray-700">GATEWAY_ADMIN_URL</td>
                  <td className="py-2 text-gray-500 font-mono text-xs">{config.gatewayUrl}</td>
                </tr>
                <tr>
                  <td className="py-2 font-medium text-gray-700">GATEWAY_ADMIN_TOKEN</td>
                  <td className="py-2">
                    {config.gatewayTokenSet ? (
                      <span className="text-green-600 text-xs font-medium">Set</span>
                    ) : (
                      <span className="text-red-500 text-xs font-medium">Not set</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          )}
          <p className="text-xs text-gray-400 mt-4">
            These values are read from environment variables at runtime.
            To change them, update your .env or Coolify environment variables and restart.
          </p>
        </div>

        {/* Generate New TextBee API Key */}
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Generate TextBee API Key
          </h2>
          <p className="text-xs text-gray-500 mb-3">
            Create a new API key for the TextBee API. The current key (set via the
            <code className="font-mono text-[10px] bg-gray-100 px-1">TEXTBEE_API_KEY</code> env var)
            is used by this dashboard to communicate with the TextBee API. A newly generated key
            will be created on the server — you must then update the env var and restart the
            container for it to take effect.
          </p>

          {newKey && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-3">
              <div className="text-xs font-bold text-amber-800 mb-1">
                New API Key Generated — Save this now, it will not be shown again
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 text-xs font-mono bg-white border rounded px-2 py-1 select-all break-all">
                  {newKey}
                </code>
                <button
                  onClick={copyKey}
                  className="shrink-0 text-xs bg-amber-200 text-amber-800 px-2 py-1 rounded hover:bg-amber-300"
                >
                  {copied ? 'Copied!' : 'Copy'}
                </button>
              </div>
              <div className="text-xs text-amber-700 mt-2">
                Update the <code className="font-mono bg-amber-100 px-0.5">TEXTBEE_API_KEY</code>{' '}
                environment variable with this value and restart the container.
              </div>
            </div>
          )}

          {genError && (
            <p className="text-red-600 text-xs mb-2">Failed to generate key: {genError}</p>
          )}

          <button
            onClick={handleGenerate}
            disabled={generating}
            className="text-sm bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {generating ? 'Generating...' : 'Generate New API Key'}
          </button>
        </div>

        {/* Connection test */}
        <div className="bg-white rounded-xl shadow p-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 mb-3">
            Connection Status
          </h2>
          <div className="flex items-center gap-2 text-sm">
            <span className={`w-2 h-2 rounded-full ${config?.keySet ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>
              TextBee API: {config?.keySet ? 'Key configured' : 'No key configured'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm mt-1">
            <span className={`w-2 h-2 rounded-full ${config?.gatewayTokenSet ? 'bg-green-500' : 'bg-red-500'}`} />
            <span>
              Gateway: {config?.gatewayTokenSet ? 'Token configured' : 'No token configured'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
