import { fetchStats } from '@/lib/textbee'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const stats = await fetchStats()
    return NextResponse.json({ data: stats })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
