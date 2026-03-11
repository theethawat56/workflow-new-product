import { getSession, updateSession, clearSession, ProductDraft } from './session';
import { replyMessage, getContent } from './client';
import OpenAI from 'openai';
import { validators } from './validators';
import { getDriveClient } from '@/lib/google/drive';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Short, token-efficient system prompt for trade fair use
const SYSTEM_PROMPT = `You are a fast product capture assistant for sourcing at trade fairs.
Your goal: collect 5 things in order:
1. product_image (photo of product) — required
2. contact_image (namecard/supplier contact) — required
3. product name
4. price (THB)
5. MOQ
Do NOT ask for confirmation until BOTH images have been received (product_image_url and contact_image_url are set).
If user sends an image and product_image_url is empty → it's the product image.
If user sends an image and product_image_url is already set → it's the contact/namecard image.
Extract as much info as possible from each image.
Ask only 1 question at a time. Keep messages short (1-2 lines).
Respond in JSON only:
{"action":"ask"|"confirm"|"save"|"cancel","message":"<reply in Thai/English>","extracted":{},"draft":{}}
Rules:
- action=ask: still missing something (image or field)
- action=confirm: both images received + name+price+MOQ known → show summary, ask yes/no
- action=save: user confirmed yes
- action=cancel: user said ยกเลิก/cancel
- If supplier contact or booth number mentioned, save in notes`;

// Required fields (both images + 3 data fields)
const REQUIRED_FIELDS: (keyof ProductDraft)[] = ['product_image_url', 'contact_image_url', 'product_name', 'price', 'moq'];

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
                // Check what images we still need and guide user
                const session = getSession(this.userId);
                const draft = session.pendingProduct;
                if (!draft.product_image_url) {
                    await replyMessage(event.replyToken, [{ type: 'text', text: 'กรุณาส่งรูปสินค้าก่อนเลยครับ 📸' }]);
                } else if (!draft.contact_image_url) {
                    await replyMessage(event.replyToken, [{ type: 'text', text: 'ได้รูปสินค้าแล้ว ขอรูปนามบัตร/ช่องทางติดต่อ Supplier ด้วยครับ 📇' }]);
                } else {
                    await replyMessage(event.replyToken, [{ type: 'text', text: 'ส่งรูปสินค้าหรือนามบัตรได้เลยครับ 📸' }]);
                }
            }
        } catch (error) {
            console.error('Error handling event:', error);
            await replyMessage(event.replyToken, [{ type: 'text', text: 'ขออภัย เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้งครับ' }]);
        }
    }

    // Cap history to last 4 messages to save tokens
    private trimHistory(history: any[]) {
        return history.slice(-4);
    }

    private async callAI(session: any, userMessage: string, imageBase64?: string) {
        const trimmedHistory = this.trimHistory(session.conversationHistory);
        const systemWithState = SYSTEM_PROMPT + '\nDraft: ' + JSON.stringify(session.pendingProduct);

        let messages: any[];

        if (imageBase64) {
            // Vision call — use gpt-4o (required for images)
            messages = [
                { role: 'system', content: systemWithState },
                ...trimmedHistory,
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: userMessage || 'ดึงข้อมูลสินค้าจากรูปนี้ครับ (ชื่อสินค้า ราคา MOQ contact)' },
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
            return this.parseResponse(response, session, userMessage || '[Image]');
        } else {
            // Text-only — use gpt-4o-mini (10x cheaper)
            messages = [
                { role: 'system', content: systemWithState },
                ...trimmedHistory,
                { role: 'user', content: userMessage }
            ];
            const response = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                messages,
                max_tokens: 300,
                response_format: { type: 'json_object' }
            });
            return this.parseResponse(response, session, userMessage);
        }
    }

    private parseResponse(response: any, session: any, userMessage: string) {
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
        // Merge extracted fields
        if (decision.extracted && Object.keys(decision.extracted).length > 0) {
            for (const [key, val] of Object.entries(decision.extracted)) {
                const validate = (validators as any)[key];
                if (!validate || validate(val)) {
                    (session.pendingProduct as any)[key] = val;
                }
            }
        }

        if (decision.action === 'cancel') {
            clearSession(this.userId);
            await replyMessage(replyToken, [{ type: 'text', text: decision.message || 'ยกเลิกแล้วครับ ✌️' }]);
            return;
        }

        if (decision.action === 'save') {
            try {
                const sku = await this.saveProduct(session.pendingProduct);
                clearSession(this.userId);
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

        updateSession(this.userId, {
            state: decision.action === 'confirm' ? 'confirming' : 'collecting',
            pendingProduct: session.pendingProduct,
            conversationHistory: session.conversationHistory
        });

        await replyMessage(replyToken, [{ type: 'text', text: decision.message }]);
    }

    private async handleMessage(text: string, replyToken: string) {
        const session = getSession(this.userId);

        // Fair context extraction
        const fairMatch = text.match(/จากงาน\s+(.+)/);
        if (fairMatch) {
            session.pendingProduct.source_fair = fairMatch[1].trim();
        }

        const decision = await this.callAI(session, text);
        await this.applyDecision(decision, session, replyToken);
    }

    private async handleImage(messageId: string, replyToken: string) {
        const session = getSession(this.userId);
        const buffer = await getContent(messageId);
        const base64 = buffer.toString('base64');

        // Determine which image slot to fill
        const isProductImage = !session.pendingProduct.product_image_url;
        const imageLabel = isProductImage ? 'product' : 'contact';

        // Upload image to Google Drive and save URL in draft
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

        const decision = await this.callAI(session, '', base64);
        await this.applyDecision(decision, session, replyToken);
    }

    private async saveProduct(draft: Partial<ProductDraft>): Promise<string> {
        const { create, findOne } = await import('@/lib/db/adapter');

        // Auto-generate SKU if missing
        if (!draft.sku_code) {
            const brand = (draft.brand || 'XX').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
            const cat = (draft.category || 'GEN').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3);
            const rand = Math.floor(1000 + Math.random() * 9000).toString();
            draft.sku_code = `${brand}-${cat}-${rand}`;
        }

        // Ensure no duplicate SKU — re-roll random if collision
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

// Suppress unused variable warning for REQUIRED_FIELDS (used for documentation purposes)
void REQUIRED_FIELDS;
