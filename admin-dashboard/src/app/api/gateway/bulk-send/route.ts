import { NextRequest, NextResponse } from 'next/server'
import { bulkSend } from '@/lib/textbee'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { deviceId, recipients, delaySeconds } = body
    if (!deviceId || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'deviceId and recipients array required. Each recipient: { phone, message }' }, { status: 400 })
    }
    const result = await bulkSend(deviceId, recipients, delaySeconds)
    return NextResponse.json({ data: result })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 502 }) }
}
