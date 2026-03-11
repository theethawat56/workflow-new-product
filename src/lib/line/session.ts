export interface ProductDraft {
    sku_code: string          // must be unique — agent generates or user provides
    product_name: string
    status: 'Draft' | 'Active'
    brand: string
    price: number             // selling price (THB)
    cost: number              // COGS (THB)
    category: string
    supplier_name: string
    moq: number
    lead_time_days: number
    source_fair?: string      // trade fair name (from Trade Fair Agent context)
    source_booth?: string
    notes?: string
}

export interface LineSession {
    userId: string
    state: 'idle' | 'collecting' | 'confirming'
    pendingProduct: Partial<ProductDraft>
    conversationHistory: Array<{ role: 'user' | 'assistant', content: string }>
    lastActivity: Date
    fairContext?: {          // optional: if adding product from a trade fair
        fairName: string
        boothNumber?: string
        capturedAt: Date
    }
}

const sessions = new Map<string, LineSession>();

const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

export function getSession(userId: string): LineSession {
    const session = sessions.get(userId);
    if (session) {
        if (Date.now() - session.lastActivity.getTime() > SESSION_TTL) {
            clearSession(userId);
        } else {
            return session;
        }
    }

    const newSession: LineSession = {
        userId,
        state: 'idle',
        pendingProduct: {},
        conversationHistory: [],
        lastActivity: new Date()
    };
    sessions.set(userId, newSession);
    return newSession;
}

export function updateSession(userId: string, patch: Partial<LineSession>): void {
    const session = getSession(userId);
    sessions.set(userId, {
        ...session,
        ...patch,
        lastActivity: new Date()
    });
}

export function clearSession(userId: string): void {
    sessions.delete(userId);
}
