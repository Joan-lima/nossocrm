import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
    try {
        const { provider, apiKey, model } = await request.json()

        if (!provider || !apiKey || !model) {
            return NextResponse.json({ valid: false, error: 'Parâmetros inválidos' }, { status: 400 })
        }

        if (provider === 'anthropic') {
            const response = await fetch('https://api.anthropic.com/v1/messages', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': apiKey,
                    'anthropic-version': '2023-06-01'
                },
                body: JSON.stringify({
                    model: model,
                    max_tokens: 1,
                    messages: [{ role: 'user', content: 'Hi' }]
                })
            })

            if (response.ok) return NextResponse.json({ valid: true })
            if (response.status === 401) return NextResponse.json({ valid: false, error: 'Chave de API inválida' })
            if (response.status === 429) return NextResponse.json({ valid: true }) // Rate limit = key válida
            return NextResponse.json({ valid: false, error: 'Erro ao validar chave' })
        }

        return NextResponse.json({ valid: false, error: 'Provedor não suportado nesta rota' }, { status: 400 })
    } catch (error) {
        console.error('Validate key error:', error)
        return NextResponse.json({ valid: false, error: 'Erro interno ao validar chave' }, { status: 500 })
    }
}
