import { getSession, updateSession, clearSession, ProductDraft } from './session';
import { replyMessage, getContent } from './client';
import OpenAI from 'openai';
import { validators } from './validators';
import { getDriveClient } from '@/lib/google/drive';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Image-protected fields — never let AI overwrite these
const PROTECTED_FIELDS = ['product_image_url', 'contact_image_url'];

function buildSystemPrompt(draft: Partial<ProductDraft>): string {
    const hasProductImage = !!draft.product_image_url;
    const hasContactImage = !!draft.contact_image_url;
    const hasName = !!draft.product_name;
    const hasPrice = !!draft.price;
    const hasMoq = !!draft.moq;

    return `You are a fast product capture assistant for sourcing at trade fairs.
Current draft state: ${JSON.stringify(draft)}

IMAGE STATUS (set programmatically — DO NOT ask for these again):
- Product image: ${hasProductImage ? '✅ RECEIVED' : '❌ MISSING'}
- Contact/namecard image: ${hasContactImage ? '✅ RECEIVED' : '❌ MISSING'}

CHECKLIST:
- product_image_url: ${hasProductImage ? '✅' : '❌ ask user to send product photo'}
- contact_image_url: ${hasContactImage ? '✅' : '❌ ask user to send namecard/contact photo'}
- product_name: ${hasName ? '✅ ' + draft.product_name : '❌ missing'}
- price (THB): ${hasPrice ? '✅ ' + draft.price : '❌ missing'}
- moq: ${hasMoq ? '✅ ' + draft.moq : '❌ missing'}

RULES:
1. Ask for items in the checklist order — one at a time, short message (1-2 lines)
2. If ALL 5 items are ✅ → action=confirm, show a short summary in Thai and ask ใช่/ไม่
3. If user says ใช่ after confirm → action=save
4. If user says ยกเลิก/cancel → action=cancel
5. Accept price/moq in any currency — just save the number (e.g. "20 usd" → price=20)
6. Extract product_name, brand, supplier_name from images when possible
7. NEVER include product_image_url or contact_image_url in extracted — those are set by the system

Respond ONLY in JSON:
{"action":"ask"|"confirm"|"save"|"cancel","message":"<reply in Thai>","extracted":{"field":"value",...}}`;
}

export class LineProductAgent {
    userId: string;

    constructor(userId: string) {
        this.userId = userId;
    }

    async handle(event: any) {
        if (event.type !== 'message') return;
        try {
            if (event.message.type === 'text') {
                await this.handleMessage(event.message.text, event.replyToken);
            } else if (event.message.type === 'image') {
                await this.handleImage(event.message.id, event.replyToken);
            } else {
                const session = await getSession(this.userId);
                const draft = session.pendingProduct;
                if (!draft.product_image_url) {
                    await replyMessage(event.replyToken, [{ type: 'text', text: 'กรุณาส่งรูปสินค้าก่อนเลยครับ 📸' }]);
                } else if (!draft.contact_image_url) {
                    await replyMessage(event.replyToken, [{ type: 'text', text: 'ได้รูปสินค้าแล้ว ขอรูปนามบัตรผู้ขายด้วยครับ 📇' }]);
                } else {
                    await replyMessage(event.replyToken, [{ type: 'text', text: 'พิมพ์ข้อมูลเพิ่มเติม หรือส่งรูปได้เลยครับ 📸' }]);
                }
            }
        } catch (error) {
            console.error('Error handling event:', error);
            await replyMessage(event.replyToken, [{ type: 'text', text: 'ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่ครับ' }]);
        }
    }

    private async callAI(session: any, userMessage: string, imageBase64?: string) {
        const systemPrompt = buildSystemPrompt(session.pendingProduct);
        const history = session.conversationHistory.slice(-4);

        let messages: any[];

        if (imageBase64) {
            messages = [
                { role: 'system', content: systemPrompt },
                ...history,
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: userMessage || 'ดึงข้อมูลสินค้าจากรูปนี้ครับ' },
                        { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${imageBase64}`, detail: 'low' } }
                    ]
                }
            ];
            const response = await openai.chat.completions.create({
                model: 'gpt-4o',
                messages,
                max_tokens: 400,
                response_format: { type: 'json_object' }
            });
            return this.parseAndUpdateHistory(response, session, userMessage || '[Image]');
        } else {
            messages = [
                { role: 'system', content: systemPrompt },
                ...history,
                { role: 'user', content: userMessage }
            ];
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages,
                max_tokens: 300,
                response_format: { type: 'json_object' }
            });
            return this.parseAndUpdateHistory(response, session, userMessage);
        }
    }

    private parseAndUpdateHistory(response: any, session: any, userMessage: string) {
        const text = response.choices[0]?.message?.content || '{}';
        session.conversationHistory.push({ role: 'user', content: userMessage });
        session.conversationHistory.push({ role: 'assistant', content: text });
        try {
            return JSON.parse(text);
        } catch {
            throw new Error('AI returned invalid JSON');
        }
    }

    private async applyDecision(decision: any, session: any, replyToken: string) {
        // Merge extracted fields — but NEVER overwrite protected image URL fields
        if (decision.extracted && Object.keys(decision.extracted).length > 0) {
            for (const [key, val] of Object.entries(decision.extracted)) {
                if (PROTECTED_FIELDS.includes(key)) continue; // skip — set by system only
                const validate = (validators as any)[key];
                if (!validate || validate(val)) {
                    (session.pendingProduct as any)[key] = val;
                }
            }
        }

        if (decision.action === 'cancel') {
            await clearSession(this.userId);
            await replyMessage(replyToken, [{ type: 'text', text: decision.message || 'ยกเลิกแล้วครับ ✌️' }]);
            return;
        }

        if (decision.action === 'save') {
            try {
                const sku = await this.saveProduct(session.pendingProduct);
                await clearSession(this.userId);
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://work-flow-new-product.vercel.app';
                await replyMessage(replyToken, [{
                    type: 'text',
                    text: (decision.message || '✅ บันทึกสินค้าแล้วครับ!') + '\n🔗 ' + appUrl + '/workspace?sku=' + sku
                }]);
            } catch (err: any) {
                await replyMessage(replyToken, [{ type: 'text', text: '❌ บันทึกไม่สำเร็จ: ' + err.message }]);
            }
            return;
        }

        // Save updated session (single write at the very end)
        await updateSession(this.userId, {
            ...session,
            state: decision.action === 'confirm' ? 'confirming' : 'collecting',
        });

        await replyMessage(replyToken, [{ type: 'text', text: decision.message }]);
    }

    private async handleMessage(text: string, replyToken: string) {
        const session = await getSession(this.userId);

        const fairMatch = text.match(/จากงาน\s+(.+)/);
        if (fairMatch) {
            session.pendingProduct.source_fair = fairMatch[1].trim();
        }

        const decision = await this.callAI(session, text);
        await this.applyDecision(decision, session, replyToken);
    }

    private async handleImage(messageId: string, replyToken: string) {
        const session = await getSession(this.userId);
        const buffer = await getContent(messageId);
        const base64 = buffer.toString('base64');

        const isProductImage = !session.pendingProduct.product_image_url;
        const imageLabel = isProductImage ? 'product' : 'contact';

        try {
            const drive = await getDriveClient();
            const folderId = '13fcUC1dRmeCBEfYaCP_vJW3bkIGWNxqg';
            const fileName = 'line_' + imageLabel + '_' + Date.now() + '.jpg';
            const { Readable } = await import('stream');
            const driveRes = await drive.files.create({
                requestBody: { name: fileName, parents: [folderId] },
                media: { mimeType: 'image/jpeg', body: Readable.from(buffer) },
                fields: 'id',
                supportsAllDrives: true,
            });
            const fileId = driveRes.data.id;
            if (fileId) {
                await drive.permissions.create({
                    fileId,
                    supportsAllDrives: true,
                    requestBody: { role: 'reader', type: 'anyone' },
                });
                const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://work-flow-new-product.vercel.app';
                const imageUrl = baseUrl + '/api/image?fileId=' + fileId;
                if (isProductImage) {
                    session.pendingProduct.product_image_url = imageUrl;
                } else {
                    session.pendingProduct.contact_image_url = imageUrl;
                }
            }
        } catch (uploadErr) {
            console.error('Failed to upload image to Drive:', uploadErr);
        }

        // Single write: the AI decision + image URL saved together in applyDecision
        const decision = await this.callAI(session, '', base64);
        await this.applyDecision(decision, session, replyToken);
    }

    private async saveProduct(draft: Partial<ProductDraft>): Promise<string> {
        const { create, findOne } = await import('@/lib/db/adapter');

        if (!draft.sku_code) {
            const brand = (draft.brand || 'XX').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
            const cat = (draft.category || 'GEN').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
            const rand = Math.floor(1000 + Math.random() * 9000).toString();
            draft.sku_code = `${brand}-${cat}-${rand}`;
        }

        const existing = await findOne('products', 'sku_code', draft.sku_code);
        if (existing) {
            const rand = Math.floor(1000 + Math.random() * 9000).toString();
            draft.sku_code = draft.sku_code.replace(/-\d{4}$/, '-' + rand);
        }

        const newProduct = {
            product_id: draft.sku_code,
            sku_code: draft.sku_code,
            product_name: draft.product_name || '',
            status: 'Draft',
            brand: draft.brand || '',
            price: draft.price || 0,
            cost: draft.cost || 0,
            category: draft.category || '',
            sub_category: '',
            supplier_name: draft.supplier_name || '',
            moq: draft.moq || 1,
            lead_time_days: draft.lead_time_days || 0,
            notes: draft.notes || '',
            source_fair: draft.source_fair || '',
            source_booth: draft.source_booth || '',
            product_image_url: draft.product_image_url || '',
            contact_image_url: draft.contact_image_url || '',
            created_by: 'line:' + this.userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        await create('products', newProduct);

        await create('activity_log', {
            log_id: Date.now().toString(),
            action: 'CREATE_PRODUCT',
            entity_type: 'product',
            entity_id: draft.sku_code,
            actor_email: 'line:' + this.userId,
            timestamp: new Date().toISOString(),
            before_json: '',
            after_json: JSON.stringify({ source: 'line_agent', fair: draft.source_fair || null }),
        });

        return draft.sku_code;
    }
}
