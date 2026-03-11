import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { LineProductAgent } from '@/lib/line/agent'

// Line requires a 200 response for webhook verification
export async function GET() {
    return NextResponse.json({ status: 'ok' }, { status: 200 })
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.text()

        // 1. Verify signature
        const signature = req.headers.get('x-line-signature') ?? ''
        const channelSecret = process.env.LINE_CHANNEL_SECRET

        if (!channelSecret) {
            console.error("Missing LINE_CHANNEL_SECRET");
            // Still return 200 to avoid Line marking the webhook as broken
            // The bot simply won't work until env var is set
            return NextResponse.json({ status: 'ok' }, { status: 200 })
        }

        const hash = crypto
            .createHmac('SHA256', channelSecret)
            .update(body)
            .digest('base64')

        if (hash !== signature) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // 2. Parse events
        const { events } = JSON.parse(body)
        if (!events || !Array.isArray(events)) {
            return NextResponse.json({ status: 'ok' });
        }

        for (const event of events) {
            if (event.type !== 'message') continue
            const userId = event.source?.userId;
            if (!userId) {
                console.error('No userId in event source', event.source);
                continue;
            }

            const agent = new LineProductAgent(userId)
            await agent.handle(event)
        }

        return NextResponse.json({ status: 'ok' })
    } catch (error) {
        console.error('Error handling webhook POST:', error);
        // Always return 200 to Line — log errors internally
        return NextResponse.json({ status: 'ok' }, { status: 200 });
    }
}
