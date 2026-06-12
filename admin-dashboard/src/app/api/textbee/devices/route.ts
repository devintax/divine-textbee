import { fetchDevices } from '@/lib/textbee'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const devices = await fetchDevices()
    return NextResponse.json({ data: devices })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
