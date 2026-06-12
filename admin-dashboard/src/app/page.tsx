'use client'

import { useEffect, useState } from 'react'
import type { Stats } from '@/lib/textbee'

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/textbee/stats')
      .then((r) => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error)
        setStats(j.data)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  if (loading) return <p className="text-gray-500">Loading...</p>
  if (error) return <p className="text-red-600">Error: {error}</p>
  if (!stats) return <p className="text-gray-500">No stats available.</p>

  const cards = [
    { label: 'Devices', value: stats.totalDeviceCount },
    { label: 'SMS Sent', value: stats.totalSentSMSCount },
    { label: 'SMS Received', value: stats.totalReceivedSMSCount },
    { label: 'API Keys', value: stats.totalApiKeyCount },
  ]

  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="bg-white rounded-xl shadow p-4">
            <div className="text-sm text-gray-500">{c.label}</div>
            <div className="text-3xl font-bold mt-1">{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
