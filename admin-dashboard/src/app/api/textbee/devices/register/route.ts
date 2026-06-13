import { generateTextBeeApiKey } from '@/lib/textbee'
import { NextResponse } from 'next/server'
import QRCode from 'qrcode'

export async function POST() {
  try {
    const apiKey = await generateTextBeeApiKey()
    if (!apiKey) {
      return NextResponse.json({ error: 'TextBee API returned empty key' }, { status: 502 })
    }
    const qrDataUrl = await QRCode.toDataURL(apiKey, {
      width: 300,
      margin: 2,
      color: { dark: '#000', light: '#fff' },
    })
    return NextResponse.json({ apiKey, qrDataUrl })
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 502 })
  }
}
