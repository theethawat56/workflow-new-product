import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { LineProductAgent } from '@/lib/line/agent'

export async function POST(req: NextRequest) {
    try {
        const body = await req.text()

        // 1. Verify signature
        const signature = req.headers.get('x-line-signature') ?? ''
        const channelSecret = process.env.LINE_CHANNEL_SECRET

        if (!channelSecret) {
            console.error("Missing LINE_CHANNEL_SECRET");
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
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
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
