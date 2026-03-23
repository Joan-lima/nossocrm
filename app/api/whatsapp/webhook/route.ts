/**
 * Webhook da Evolution API — recebe eventos do WhatsApp
 *
 * Configure na Evolution API:
 *   URL: https://nossocrm-ashy.vercel.app/api/whatsapp/webhook
 *   Events: MESSAGES_UPSERT
 *
 * Quando um lead responde, o deal é movido para "Respondeu" automaticamente.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createStaticAdminClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'

// Verificação simples: o webhook da Evolution envia o apikey no header
function isAuthorized(request: NextRequest): boolean {
  const apiKey = process.env.EVOLUTION_API_KEY
  if (!apiKey) return true // Se não configurado, aceita tudo (dev mode)

  const headerKey = request.headers.get('apikey') || request.headers.get('x-api-key')
  return headerKey === apiKey
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let payload: any
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const event = payload?.event
  const data = payload?.data

  // Só processa mensagens recebidas (de contatos para nós)
  if (event !== 'messages.upsert' && event !== 'MESSAGES_UPSERT') {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const fromMe = data?.key?.fromMe
  if (fromMe) {
    // Mensagem enviada por nós — ignora
    return NextResponse.json({ ok: true, skipped: true })
  }

  // Extrai o número do remetente
  const remoteJid: string = data?.key?.remoteJid || ''
  const phone = remoteJid.replace('@s.whatsapp.net', '').replace(/\D/g, '')

  if (!phone) {
    return NextResponse.json({ ok: true, skipped: true })
  }

  const messageText: string =
    data?.message?.conversation ||
    data?.message?.extendedTextMessage?.text ||
    ''

  console.log(`[WhatsApp Webhook] Mensagem de ${phone}: "${messageText.slice(0, 100)}"`)

  // Move o deal para "Respondeu" no board de prospecção
  const boardKey = process.env.PROSPECTING_BOARD_KEY
  if (!boardKey) {
    console.warn('[WhatsApp Webhook] PROSPECTING_BOARD_KEY não configurado — pulando move-stage')
    return NextResponse.json({ ok: true })
  }

  try {
    const sb = createStaticAdminClient()

    // Busca o deal pelo telefone do contato
    const { data: contacts } = await sb
      .from('contacts')
      .select('id, organization_id')
      .eq('phone', phone)
      .is('deleted_at', null)
      .limit(1)

    if (!contacts || contacts.length === 0) {
      console.log(`[WhatsApp Webhook] Contato não encontrado para ${phone}`)
      return NextResponse.json({ ok: true })
    }

    const contact = contacts[0]

    // Busca o board pelo key
    const { data: boards } = await sb
      .from('boards')
      .select('id')
      .eq('organization_id', contact.organization_id)
      .eq('key', boardKey)
      .limit(1)

    if (!boards || boards.length === 0) {
      console.log(`[WhatsApp Webhook] Board "${boardKey}" não encontrado`)
      return NextResponse.json({ ok: true })
    }

    const boardId = boards[0].id

    // Busca o stage "Respondeu"
    const { data: stages } = await sb
      .from('board_stages')
      .select('id')
      .eq('board_id', boardId)
      .ilike('name', '%respond%')
      .limit(1)

    if (!stages || stages.length === 0) {
      console.log(`[WhatsApp Webhook] Stage "Respondeu" não encontrado no board`)
      return NextResponse.json({ ok: true })
    }

    const stageId = stages[0].id

    // Move o deal aberto do contato neste board para "Respondeu"
    await sb
      .from('deals')
      .update({ stage_id: stageId, updated_at: new Date().toISOString() })
      .eq('contact_id', contact.id)
      .eq('board_id', boardId)
      .eq('is_won', false)
      .eq('is_lost', false)
      .is('deleted_at', null)

    console.log(`[WhatsApp Webhook] Deal do contato ${phone} movido para "Respondeu"`)
  } catch (err: any) {
    console.error('[WhatsApp Webhook] Erro ao mover deal:', err?.message)
  }

  return NextResponse.json({ ok: true })
}
