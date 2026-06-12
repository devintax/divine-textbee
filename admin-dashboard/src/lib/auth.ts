import { SignJWT, jwtVerify } from 'jose'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'

const SESSION_SECRET = process.env.SESSION_SECRET || ''
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || ''
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH || ''
const IS_PROD = process.env.NODE_ENV === 'production'

function getSecret(): Uint8Array {
  return new TextEncoder().encode(SESSION_SECRET)
}

export type SessionPayload = { email: string }

export async function createSession(email: string, secure = IS_PROD) {
  const token = await new SignJWT({ email })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('24h')
    .sign(getSecret())

  const cookieStore = await cookies()
  cookieStore.set('session', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24,
  })
}

export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get('session')?.value
  if (!token) return null

  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      algorithms: ['HS256'],
    })
    return payload as unknown as SessionPayload
  } catch {
    return null
  }
}

export async function destroySession(secure = IS_PROD) {
  const cookieStore = await cookies()
  cookieStore.set('session', '', {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 0,
  })
}

export async function verifyCredentials(email: string, password: string): Promise<boolean> {
  if (!email || !password) return false
  if (email.toLowerCase() !== ADMIN_EMAIL.toLowerCase()) return false
  return bcrypt.compareSync(password, ADMIN_PASSWORD_HASH)
}
