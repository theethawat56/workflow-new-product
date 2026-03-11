export async function replyMessage(replyToken: string, messages: any[]) {
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!channelAccessToken) {
        throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not defined');
    }

    const response = await fetch('https://api.line.me/v2/bot/message/reply', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${channelAccessToken}`
        },
        body: JSON.stringify({
            replyToken,
            messages
        })
    });

    if (!response.ok) {
        const errText = await response.text();
        console.error('Failed to reply message:', errText);
    }
}

export async function getContent(messageId: string): Promise<Buffer> {
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    if (!channelAccessToken) {
        throw new Error('LINE_CHANNEL_ACCESS_TOKEN is not defined');
    }
    const response = await fetch(`https://api-data.line.me/v2/bot/message/${messageId}/content`, {
        headers: {
            'Authorization': `Bearer ${channelAccessToken}`
        }
    });
    if (!response.ok) throw new Error('Failed to fetch image content');
    return Buffer.from(await response.arrayBuffer());
}
