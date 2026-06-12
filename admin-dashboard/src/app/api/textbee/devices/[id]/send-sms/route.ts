import { sendSms } from '@/lib/textbee'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const body = await req.json()
    const { message, recipients } = body
    if (!message || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return NextResponse.json(
        { error: 'message and recipients (non-empty array) are required' },
        { status: 400 },
      )
    }
    const result = await sendSms(params.id, message, recipients)
    return NextResponse.json({ data: result })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
