import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getInstanceStatus, getQRCode } from '@/lib/whatsapp/evolution'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const url = new URL(request.url)
  const qr = url.searchParams.get('qr') === 'true'

  if (qr) {
    const result = await getQRCode()
    return NextResponse.json(result)
  }

  const result = await getInstanceStatus()
  return NextResponse.json(result)
}
