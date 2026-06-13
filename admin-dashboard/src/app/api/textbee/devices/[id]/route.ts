import { NextRequest, NextResponse } from 'next/server'

const TEXTBEE_API_URL = process.env.TEXTBEE_API_URL || ''
const TEXTBEE_API_KEY = process.env.TEXTBEE_API_KEY || ''

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const patch = await req.json()
    const res = await fetch(
      `${TEXTBEE_API_URL}/gateway/devices/${params.id}`,
      {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': TEXTBEE_API_KEY,
        },
        body: JSON.stringify(patch),
      },
    )
    const json = await res.json()
    if (!res.ok) {
      return NextResponse.json({ error: json.error || 'Update failed' }, { status: res.status })
    }
    return NextResponse.json({ data: json.data })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
