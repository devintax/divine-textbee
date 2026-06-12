import { deleteTextBeeDevice } from '@/lib/textbee'
import { NextResponse } from 'next/server'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    await deleteTextBeeDevice(params.id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
