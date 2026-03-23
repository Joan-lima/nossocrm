import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { provider, apiKey, model } = await request.json()

        if (!provider || !apiKey || !model) {
            return NextResponse.json({ valid: false, error: 'Parâmetros inválidos' }, { status: 400 })
        }

        if (provider === 'anthropic') {
            // Usa claude-3-haiku (modelo estável e amplamente disponível) para validação
            // O model selecionado pelo usuário é usado nas chamadas reais, não na validação
            const validationModel = 'claude-3-haiku-20240307'
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: validationModel,
                    max_tokens: 1,
                    messages: [{ role: 'user', content: 'Hi' }]
                })
            })

            const responseBody = await response.json().catch(() => ({}))
            console.error('Anthropic validate response:', response.status, JSON.stringify(responseBody))

            const errorMessage: string = responseBody?.error?.message || ''
            const errorType: string = responseBody?.error?.type || ''

            if (response.ok) return NextResponse.json({ valid: true })
            if (response.status === 401) return NextResponse.json({ valid: false, error: 'Chave de API inválida' })
            if (response.status === 429) return NextResponse.json({ valid: true }) // Rate limit = key válida

            // Saldo insuficiente = chave válida, só precisa de créditos
            if (errorType === 'invalid_request_error' && errorMessage.includes('credit balance')) {
                return NextResponse.json({ valid: true })
            }

            // 400 genérico = chave válida mas algum problema de configuração
            if (response.status === 400) return NextResponse.json({ valid: true })

            return NextResponse.json({ valid: false, error: `Erro ${response.status}: ${errorMessage || 'Erro ao validar'}` })
        }

        return NextResponse.json({ valid: false, error: 'Provedor não suportado nesta rota' }, { status: 400 })
    } catch (error) {
        console.error('Validate key error:', error)
        return NextResponse.json({ valid: false, error: 'Erro interno ao validar chave' }, { status: 500 })
    }
}
