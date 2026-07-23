import { NextResponse } from 'next/server'
import { fetchTextBee } from '@/lib/textbee'

export async function POST() {
  try {
    const result = await fetchTextBee('/auth/api-keys', {
      method: 'POST',
      body: JSON.stringify({}),
      raw: true,
    })
    const key = typeof result === 'string' ? result : result.apiKey || result
    return NextResponse.json({ data: key })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
