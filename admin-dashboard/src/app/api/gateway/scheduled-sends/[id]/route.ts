import { NextRequest, NextResponse } from 'next/server'
import { cancelScheduledSend } from '@/lib/textbee'

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try { await cancelScheduledSend(params.id); return NextResponse.json({ success: true }) }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 502 }) }
}
