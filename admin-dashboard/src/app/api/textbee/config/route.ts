import { NextResponse } from 'next/server'
import { getSession } from '@/lib/auth'

export async function GET() {
  const session = await getSession()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const url = process.env.TEXTBEE_API_URL || '(not set)'
  const key = process.env.TEXTBEE_API_KEY || ''
  const token = process.env.GATEWAY_ADMIN_TOKEN || ''
  const gatewayUrl = process.env.GATEWAY_ADMIN_URL || '(not set)'

  return NextResponse.json({
    data: {
      url,
      keyPrefix: key ? key.slice(0, 8) + '...' : '',
      keySet: !!key,
      gatewayUrl,
      gatewayTokenPrefix: token ? token.slice(0, 8) + '...' : '',
      gatewayTokenSet: !!token,
    },
  })
}
