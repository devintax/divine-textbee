import crypto from 'crypto'

export function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex')
}

export function generateKey(): { raw: string; prefix: string } {
  const raw = crypto.randomBytes(32).toString('hex')
  const prefix = raw.substring(0, 8)
  return { raw, prefix }
}
