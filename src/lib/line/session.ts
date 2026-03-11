/**
 * Persistent session store backed by Google Sheets.
 * Replaces the in-memory Map which doesn't work on Vercel serverless.
 * Each LINE userId gets one row in the `line_sessions` sheet.
 */

export interface ProductDraft {
    sku_code: string
    product_name: string
    status: 'Draft' | 'Active'
    brand: string
    price: number
    cost: number
    category: string
    supplier_name: string
    moq: number
    lead_time_days: number
    source_fair?: string
    source_booth?: string
    notes?: string
    product_image_url?: string  // uploaded from Line product image
    contact_image_url?: string  // uploaded from Line namecard/contact image
}

export interface LineSession {
    userId: string
    state: 'idle' | 'collecting' | 'confirming'
    pendingProduct: Partial<ProductDraft>
    conversationHistory: Array<{ role: 'user' | 'assistant', content: string }>
    lastActivity: Date
}

const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeEmptySession(userId: string): LineSession {
    return {
        userId,
        state: 'idle',
        pendingProduct: {},
        conversationHistory: [],
        lastActivity: new Date()
    };
}

async function getAdapter() {
    const [{ findAll, create, deleteRow }, { getSheetsClient, getSpreadsheetId }] = await Promise.all([
        import('@/lib/db/adapter'),
        import('@/lib/google/sheets'),
    ]);
    return { findAll, create, deleteRow, getSheetsClient, getSpreadsheetId };
}

// ─── Public API (all async) ────────────────────────────────────────────────────

export async function getSession(userId: string): Promise<LineSession> {
    try {
        const { findAll } = await import('@/lib/db/adapter');
        const rows = await findAll<any>('line_sessions');
        const row = rows.find((r: any) => r.user_id === userId);

        if (row) {
            const lastActivity = new Date(row.last_activity);
            // TTL check
            if (Date.now() - lastActivity.getTime() > SESSION_TTL_MS) {
                await clearSession(userId);
                return makeEmptySession(userId);
            }
            return {
                userId,
                state: row.state || 'idle',
                pendingProduct: JSON.parse(row.pending_product || '{}'),
                conversationHistory: JSON.parse(row.conversation_history || '[]'),
                lastActivity,
            };
        }
    } catch (err) {
        console.error('[session] getSession error:', err);
    }
    return makeEmptySession(userId);
}

export async function updateSession(userId: string, session: LineSession): Promise<void> {
    try {
        const { findAll, deleteRow, create } = await import('@/lib/db/adapter');
        const rows = await findAll<any>('line_sessions');
        const exists = rows.some((r: any) => r.user_id === userId);

        if (exists) {
            await deleteRow('line_sessions', 'user_id', userId);
        }

        await create('line_sessions', {
            user_id: userId,
            state: session.state,
            pending_product: JSON.stringify(session.pendingProduct),
            // Only keep last 4 messages to save space
            conversation_history: JSON.stringify(session.conversationHistory.slice(-4)),
            last_activity: new Date().toISOString(),
        });
    } catch (err) {
        console.error('[session] updateSession error:', err);
    }
}

export async function clearSession(userId: string): Promise<void> {
    try {
        const { findAll, deleteRow } = await import('@/lib/db/adapter');
        const rows = await findAll<any>('line_sessions');
        const exists = rows.some((r: any) => r.user_id === userId);
        if (exists) {
            await deleteRow('line_sessions', 'user_id', userId);
        }
    } catch (err) {
        console.error('[session] clearSession error:', err);
    }
}
