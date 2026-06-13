import { NextRequest, NextResponse } from 'next/server'
import { bulkSend } from '@/lib/textbee'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { deviceId, message, recipients, delaySeconds } = body
    if (!deviceId || !message || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'deviceId, message, and recipients (array) are required' }, { status: 400 })
    }
    const result = await bulkSend(deviceId, message, recipients, delaySeconds)
    return NextResponse.json({ data: result })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 502 }) }
}
