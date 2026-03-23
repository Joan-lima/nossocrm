/**
 * Evolution API v2 client
 * Documentação: https://doc.evolution-api.com
 */

export interface EvolutionConfig {
  baseUrl: string
  apiKey: string
  instance: string
}

export interface SendTextResult {
  ok: boolean
  messageId?: string
  error?: string
}

function getConfig(): EvolutionConfig | null {
  const baseUrl = process.env.EVOLUTION_API_URL?.replace(/\/$/, '')
  const apiKey = process.env.EVOLUTION_API_KEY
  const instance = process.env.EVOLUTION_INSTANCE_NAME

  if (!baseUrl || !apiKey || !instance) return null

  return { baseUrl, apiKey, instance }
}

/**
 * Envia mensagem de texto via Evolution API.
 * O número deve estar no formato internacional sem + (ex: 5511999998888)
 */
export async function sendText(phone: string, message: string): Promise<SendTextResult> {
  const config = getConfig()
  if (!config) {
    return { ok: false, error: 'Evolution API não configurada (env vars ausentes)' }
  }

  // Normaliza o número: remove tudo que não é dígito
  const normalized = phone.replace(/\D/g, '')
  if (!normalized || normalized.length < 10) {
    return { ok: false, error: `Número inválido: ${phone}` }
  }

  try {
    const res = await fetch(
      `${config.baseUrl}/message/sendText/${config.instance}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': config.apiKey,
        },
        body: JSON.stringify({
          number: normalized,
          text: message,
        }),
      }
    )

    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      return { ok: false, error: body?.message || `HTTP ${res.status}` }
    }

    return { ok: true, messageId: body?.key?.id }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Erro de conexão com Evolution API' }
  }
}

/**
 * Verifica se a instância está conectada ao WhatsApp.
 */
export async function getInstanceStatus(): Promise<{
  connected: boolean
  state?: string
  error?: string
}> {
  const config = getConfig()
  if (!config) {
    return { connected: false, error: 'Evolution API não configurada' }
  }

  try {
    const res = await fetch(
      `${config.baseUrl}/instance/connectionState/${config.instance}`,
      {
        headers: { 'apikey': config.apiKey },
      }
    )

    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      return { connected: false, error: body?.message || `HTTP ${res.status}` }
    }

    const state = body?.instance?.state
    return { connected: state === 'open', state }
  } catch (err: any) {
    return { connected: false, error: err?.message || 'Erro de conexão' }
  }
}

/**
 * Retorna o QR code para conectar o WhatsApp (base64 PNG).
 * Usado durante o setup inicial da instância.
 */
export async function getQRCode(): Promise<{
  qrcode?: string
  error?: string
}> {
  const config = getConfig()
  if (!config) {
    return { error: 'Evolution API não configurada' }
  }

  try {
    const res = await fetch(
      `${config.baseUrl}/instance/connect/${config.instance}`,
      {
        headers: { 'apikey': config.apiKey },
      }
    )

    const body = await res.json().catch(() => ({}))

    if (!res.ok) {
      return { error: body?.message || `HTTP ${res.status}` }
    }

    return { qrcode: body?.base64 || body?.qrcode?.base64 }
  } catch (err: any) {
    return { error: err?.message || 'Erro de conexão' }
  }
}
