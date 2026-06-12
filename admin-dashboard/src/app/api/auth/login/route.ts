import { NextRequest, NextResponse } from 'next/server'
import { createSession, verifyCredentials } from '@/lib/auth'

const MAX_ATTEMPTS = 5
const WINDOW_MS = 15 * 60 * 1000
const attempts = new Map<string, { count: number; resetAt: number }>()

function getClientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || '127.0.0.1'
}

export async function POST(req: NextRequest) {
  const ip = getClientIp(req)
  const now = Date.now()

  const record = attempts.get(ip)
  if (record && record.resetAt > now && record.count >= MAX_ATTEMPTS) {
    return NextResponse.json(
      { error: 'Too many login attempts. Try again later.' },
      { status: 429 },
    )
  }

  let body: { email?: string; password?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  const { email, password } = body
  const ok = await verifyCredentials(email || '', password || '')

  if (!ok) {
    if (!record || record.resetAt < now) {
      attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
    } else {
      record.count++
    }
    return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
  }

  attempts.delete(ip)

  try {
    const proto = req.headers.get('x-forwarded-proto') || 'http'
    await createSession(email!, proto === 'https')
    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Session creation failed' }, { status: 500 })
  }
}
