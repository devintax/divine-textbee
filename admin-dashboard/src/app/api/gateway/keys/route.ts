import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { fetchApiKeys, createApiKey } from '@/lib/textbee'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const keys = await fetchApiKeys()
    return NextResponse.json({ data: keys })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}

export async function POST(req: Request) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const { label } = await req.json()
    if (!label || typeof label !== 'string') {
      return NextResponse.json({ error: 'Label is required' }, { status: 400 })
    }
    const result = await createApiKey(label)
    return NextResponse.json({ data: result }, { status: 201 })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
