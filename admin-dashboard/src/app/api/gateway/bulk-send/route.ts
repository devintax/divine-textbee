import { NextRequest, NextResponse } from 'next/server'
import { bulkSend, checkDeviceOnline } from '@/lib/textbee'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { deviceId, recipients, delaySeconds } = body
    if (!deviceId || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json({ error: 'deviceId and recipients array required. Each recipient: { phone, message }' }, { status: 400 })
    }

    // Check device is online before dispatching
    const deviceStatus = await checkDeviceOnline(deviceId)
    if (deviceStatus.onlineState !== 'online') {
      const lastSeen = deviceStatus.lastSeenAgo || 'unknown'
      return NextResponse.json(
        { error: `Device is ${deviceStatus.onlineState} (last seen ${lastSeen}). Cannot send bulk messages to an offline device. Open the TextBee Gateway app on the phone to reconnect.` },
        { status: 503 },
      )
    }

    const result = await bulkSend(deviceId, recipients, delaySeconds)
    return NextResponse.json({ data: result })
  } catch (e: any) { return NextResponse.json({ error: e.message }, { status: 502 }) }
}
