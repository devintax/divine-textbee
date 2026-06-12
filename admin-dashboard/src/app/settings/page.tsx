'use client'

import { useEffect, useState } from 'react'

export default function SettingsPage() {
  const [config, setConfig] = useState<{ url: string; keySet: boolean } | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/textbee/config')
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error)
        setConfig(j.data)
      })
      .catch((e) => setError(e.message))
  }, [])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Settings</h1>
      <div className="bg-white rounded-xl shadow p-4 max-w-xl">
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
              <tr>
                <td className="py-2 font-medium text-gray-700">TEXTBEE_API_KEY</td>
                <td className="py-2">
                  {config.keySet ? (
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
          To change them, update your .env file or Coolify environment variables and restart.
        </p>
      </div>
    </div>
  )
}
