import { NextRequest, NextResponse } from 'next/server'
import { fetchScheduledSends, createScheduledSend } from '@/lib/textbee'

export async function GET() {
  try { const data = await fetchScheduledSends(); return NextResponse.json({ data }) }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 502 }) }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { deviceId, message, recipients, scheduledAt, recurrence } = body
    if (!deviceId || !message || !Array.isArray(recipients) || recipients.length === 0 || !scheduledAt) {
      return NextResponse.json({ error: 'deviceId, message, recipients, and scheduledAt are required' }, { status: 400 })
    }
    const data = await createScheduledSend(deviceId, message, recipients, scheduledAt, recurrence)
    return NextResponse.json(data, { status: 201 })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 502 }) }
}
