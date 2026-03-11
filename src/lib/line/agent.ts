import { getSession, updateSession, clearSession, ProductDraft } from './session';
import { replyMessage, getContent } from './client';
import OpenAI from 'openai';
import { validators } from './validators';

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are a product data entry assistant for a sourcing team.
Your job is to help users add new products to the product catalog through a Line chat.

## Your behavior:
- Collect product information conversationally (Thai or English based on user's language)
- Ask for ONE missing field at a time — do not overwhelm the user
- Validate as you go (e.g., price must be a number, SKU must be uppercase alphanumeric)
- When all REQUIRED fields are collected, show a confirmation summary before saving
- Be concise — this is a chat interface, not a form

## Required fields (must collect all before saving):
1. product_name — ชื่อสินค้า
2. brand — แบรนด์
3. price — ราคาขาย (THB, numbers only)
4. cost — ต้นทุน (THB, numbers only)
5. category — หมวดหมู่สินค้า
6. supplier_name — ชื่อ supplier

## Optional fields (ask after required, or skip if user says "ข้ามได้"):
- moq — จำนวนสั่งซื้อขั้นต่ำ
- lead_time_days — ระยะเวลานำส่ง (วัน)
- notes — หมายเหตุ

## SKU generation:
- Auto-generate as: {BRAND_PREFIX}-{CATEGORY_PREFIX}-{RANDOM4DIGITS}
- Example: "NKE-SHOE-4821"
- Always show generated SKU to user and ask for confirmation

## Response format (always respond as JSON):
{
  "action": "ask_field" | "confirm" | "save" | "cancel" | "clarify",
  "message": "<message to send to user in Thai/English>",
  "field_asking": "<field name if action=ask_field>",
  "extracted_fields": { ...any fields extracted from the user's message },
  "ready_to_save": false,
  "product_draft": { ...current known fields }
}

## Rules:
- NEVER save without user confirmation (action=confirm first, then user says yes)
- If user says "ยกเลิก" or "cancel" → action=cancel, clear session
- If user sends a photo → extract product_name, brand, price from image and pre-fill
- If user says "เพิ่มสินค้าจากงาน [fair name]" → set source_fair context
`;

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
                await replyMessage(event.replyToken, [{ type: 'text', text: 'Sorry, I can only understand text and images right now.' }]);
            }
        } catch (error) {
            console.error('Error handling event:', error);
            await replyMessage(event.replyToken, [{ type: 'text', text: 'An error occurred while processing your request. Please try again later.' }]);
        }
    }

    private async callOpenAI(session: any, userMessage: string, imageBase64?: string, mediaType?: string) {
        const messages: any[] = [...session.conversationHistory];

        if (imageBase64 && mediaType) {
            messages.push({
                role: 'user',
                content: [
                    { type: 'text', text: userMessage || 'Here is an image, please extract product details from it.' },
                    { type: 'image_url', image_url: { url: `data:${mediaType};base64,${imageBase64}` } }
                ]
            });
        } else {
            messages.push({ role: 'user', content: userMessage || 'Hello' });
        }

        const systemMessage = {
            role: 'system',
            content: SYSTEM_PROMPT + '\nCurrent Draft State: ' + JSON.stringify(session.pendingProduct) + '\nFair Context: ' + JSON.stringify(session.fairContext || {})
        };

        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [systemMessage, ...messages],
            response_format: { type: 'json_object' }
        });

        let responseText = response.choices[0]?.message?.content || '{}';

        // Keep string content for history
        session.conversationHistory.push({ role: 'user', content: userMessage || '[Image attached]' });
        session.conversationHistory.push({ role: 'assistant', content: responseText });

        try {
            return JSON.parse(responseText);
        } catch (e) {
            console.error('Failed to parse OpenAI response:', responseText);
            throw new Error('Invalid response from AI');
        }
    }

    private async processClaudeDecision(decision: any, session: any, replyToken: string) {
        if (decision.extracted_fields) {
            Object.assign(session.pendingProduct, decision.extracted_fields);
            // Basic naive validation for some fields
            for (const [key, val] of Object.entries(decision.extracted_fields)) {
                const validate = (validators as any)[key];
                if (validate && !validate(val)) {
                    delete session.pendingProduct[key]; // reject invalid extracted
                }
            }
        }

        if (decision.action === 'cancel') {
            clearSession(this.userId);
            await replyMessage(replyToken, [{ type: 'text', text: decision.message || 'Cancelled. You can start over anytime.' }]);
            return;
        }

        if (decision.action === 'save') {
            try {
                await this.saveProduct(session.pendingProduct);
                clearSession(this.userId);

                const sku = session.pendingProduct.sku_code || session.pendingProduct.product_name;
                const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://yourapp.com';
                const successMsg = decision.message + "\n\nView in workspace: " + appUrl + "/workspace?sku=" + sku;

                await replyMessage(replyToken, [{ type: 'text', text: successMsg }]);
            } catch (err: any) {
                await replyMessage(replyToken, [{ type: 'text', text: "Error saving product: " + err.message }]);
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

        // Check for fair context mention specifically if not already set by Claude (or let Claude do it)
        const match = text.match(/เพิ่มสินค้าจากงาน\s+(.+)/);
        if (match) {
            session.fairContext = {
                fairName: match[1],
                capturedAt: new Date()
            };
            session.pendingProduct.source_fair = match[1];
        }

        const decision = await this.callOpenAI(session, text);
        await this.processClaudeDecision(decision, session, replyToken);
    }

    private async handleImage(messageId: string, replyToken: string) {
        const session = getSession(this.userId);

        // Get image content
        const buffer = await getContent(messageId);
        const base64 = buffer.toString('base64');

        const decision = await this.callOpenAI(session, '', base64, 'image/jpeg');
        await this.processClaudeDecision(decision, session, replyToken);
    }

    private async saveProduct(draft: Partial<ProductDraft>) {
        const { create, findOne } = await import('@/lib/db/adapter');

        if (!draft.sku_code) throw new Error('Missing SKU');

        // Check for duplicate SKU
        const existing = await findOne('products', 'sku_code', draft.sku_code);
        if (existing) throw new Error("SKU " + draft.sku_code + " already exists");

        const newProduct = {
            product_id: draft.sku_code, // fallback if needed
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
            created_by: "line:" + this.userId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        };

        // Insert into products sheet
        await create('products', newProduct);

        // Write to activity_log sheet
        await create('activity_log', {
            log_id: Date.now().toString(),
            action: 'CREATE_PRODUCT',
            entity_type: 'product',
            entity_id: draft.sku_code,
            actor_email: "line:" + this.userId,
            timestamp: new Date().toISOString(),
            before_json: '',
            after_json: JSON.stringify({
                source: 'line_agent',
                fair: draft.source_fair || null,
                ...newProduct
            }),
        });
    }
}
