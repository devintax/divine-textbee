import { NextRequest, NextResponse } from 'next/server'
import { destroySession } from '@/lib/auth'

export async function POST(req: NextRequest) {
  const proto = req.headers.get('x-forwarded-proto') || 'http'
  await destroySession(proto === 'https')
  return NextResponse.json({ success: true })
}
