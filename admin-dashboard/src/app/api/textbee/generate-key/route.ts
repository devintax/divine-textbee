import { NextResponse } from 'next/server'
import { fetchTextBee } from '@/lib/textbee'

function extractApiKey(result: unknown): string | null {
  if (typeof result === 'string') return result
  if (!result || typeof result !== 'object') return null

  const record = result as Record<string, unknown>
  const direct = record.apiKey ?? record.key ?? record.token
  if (typeof direct === 'string') return direct

  const data = record.data
  if (typeof data === 'string') return data
  if (data && typeof data === 'object') {
    const nested = data as Record<string, unknown>
    const nestedKey = nested.apiKey ?? nested.key ?? nested.token
    if (typeof nestedKey === 'string') return nestedKey
  }

  return null
}

export async function POST() {
  try {
    const result = await fetchTextBee('/auth/api-keys', {
      method: 'POST',
      body: JSON.stringify({}),
      raw: true,
    })
    const key = extractApiKey(result)
    if (!key) {
      return NextResponse.json(
        { error: 'TextBee API did not return a usable API key.' },
        { status: 502 },
      )
    }
    return NextResponse.json({ data: key })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
