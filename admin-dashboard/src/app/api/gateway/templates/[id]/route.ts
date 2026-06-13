import { NextRequest, NextResponse } from 'next/server'
import { updateTemplate, deleteTemplate } from '@/lib/textbee'

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try { const body = await req.json(); const data = await updateTemplate(params.id, body.name, body.body); return NextResponse.json(data) }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 502 }) }
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try { await deleteTemplate(params.id); return NextResponse.json({ success: true }) }
  catch (e: any) { return NextResponse.json({ error: e.message }, { status: 502 }) }
}
