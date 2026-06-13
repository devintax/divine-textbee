import { NextRequest, NextResponse } from 'next/server'
import { fetchTemplates, createTemplate } from '@/lib/textbee'

export async function GET() {
  try { const data = await fetchTemplates(); return NextResponse.json({ data }) }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 502 }) }
}

export async function POST(req: NextRequest) {
  try { const body = await req.json(); const data = await createTemplate(body.name, body.body); return NextResponse.json(data, { status: 201 }) }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 502 }) }
}
