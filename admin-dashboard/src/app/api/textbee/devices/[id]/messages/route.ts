import { fetchMessages } from '@/lib/textbee'
import { NextRequest, NextResponse } from 'next/server'

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    const { searchParams } = new URL(_req.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const type = (searchParams.get('type') || 'all') as 'all' | 'sent' | 'received'
    const result = await fetchMessages(params.id, page, limit, type)
    return NextResponse.json(result)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
