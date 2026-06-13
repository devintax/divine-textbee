import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({ cap: parseInt(process.env.BULK_MAX_RECIPIENTS || '50', 10) })
}
