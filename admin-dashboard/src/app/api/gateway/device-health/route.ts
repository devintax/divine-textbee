import { NextResponse } from 'next/server'
import { fetchDeviceHealth } from '@/lib/textbee'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const data = await fetchDeviceHealth()
    return NextResponse.json({ data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
