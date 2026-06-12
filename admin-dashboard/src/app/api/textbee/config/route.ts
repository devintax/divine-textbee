import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.TEXTBEE_API_URL || '(not set)'
  const keySet = process.env.TEXTBEE_API_KEY ? true : false

  return NextResponse.json({
    data: {
      url,
      keySet,
    },
  })
}
