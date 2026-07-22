import { fetchTextBee } from '@/lib/textbee'
import { NextResponse } from 'next/server'

export async function POST(
  _req: Request,
  { params }: { params: { id: string } },
) {
  try {
    const result = await fetchTextBee(`/gateway/devices/${params.id}/wake`, {
      method: 'POST',
      raw: true,
    })
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
