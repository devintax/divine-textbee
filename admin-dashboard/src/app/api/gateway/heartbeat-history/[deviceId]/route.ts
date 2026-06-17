import { NextResponse } from 'next/server'
import { fetchHeartbeatHistory } from '@/lib/textbee'

export async function GET(
  _req: Request,
  { params }: { params: { deviceId: string } },
) {
  try {
    const data = await fetchHeartbeatHistory(params.deviceId)
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
