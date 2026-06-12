import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'
import { revokeApiKey } from '@/lib/textbee'

export async function POST(_req: Request, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await revokeApiKey(params.id)
    return NextResponse.json({ success: true })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
