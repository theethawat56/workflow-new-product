/**
 * Persistent session store backed by Google Sheets.
 * Auto-creates the `line_sessions` sheet if it doesn't exist.
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
    product_image_url?: string
    contact_image_url?: string
}

export interface LineSession {
    userId: string
    state: 'idle' | 'collecting' | 'confirming'
    pendingProduct: Partial<ProductDraft>
    conversationHistory: Array<{ role: 'user' | 'assistant', content: string }>
    lastActivity: Date
}

const SESSION_TTL_MS = 30 * 60 * 1000;
const SHEET_NAME = 'line_sessions';
const HEADERS = ['user_id', 'state', 'pending_product', 'conversation_history', 'last_activity'];

function makeEmpty(userId: string): LineSession {
    return {
        userId,
        state: 'idle',
        pendingProduct: {},
        conversationHistory: [],
        lastActivity: new Date()
    };
}

// ─── Auto-ensure the sheet exists with headers ─────────────────────────────

async function ensureSheet(): Promise<boolean> {
    try {
        const { getSheetsClient, getSpreadsheetId } = await import('@/lib/google/sheets');
        const sheets = await getSheetsClient();
        const spreadsheetId = (await getSpreadsheetId()) as string;

        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        const exists = meta.data.sheets?.some(s => s.properties?.title === SHEET_NAME);

        if (!exists) {
            console.log('[session] Creating line_sessions sheet...');
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [{ addSheet: { properties: { title: SHEET_NAME } } }]
                }
            });
            await sheets.spreadsheets.values.update({
                spreadsheetId,
                range: `${SHEET_NAME}!A1:E1`,
                valueInputOption: 'RAW',
                requestBody: { values: [HEADERS] }
            });
            console.log('[session] line_sessions sheet created.');
        }
        return true;
    } catch (err) {
        console.error('[session] ensureSheet error:', err);
        return false;
    }
}

// ─── Low-level read all rows ────────────────────────────────────────────────

async function readAllRows(): Promise<any[]> {
    const { getSheetsClient, getSpreadsheetId } = await import('@/lib/google/sheets');
    const sheets = await getSheetsClient();
    const spreadsheetId = (await getSpreadsheetId()) as string;

    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${SHEET_NAME}!A:E`,
    });

    const rows = res.data.values;
    if (!rows || rows.length < 2) return [];
    const headers = rows[0];
    return rows.slice(1).map(row => {
        const obj: any = {};
        headers.forEach((h: string, i: number) => { obj[h] = row[i] || ''; });
        return obj;
    });
}

// ─── Low-level write session row ────────────────────────────────────────────

async function writeRow(session: LineSession): Promise<void> {
    const { getSheetsClient, getSpreadsheetId } = await import('@/lib/google/sheets');
    const sheets = await getSheetsClient();
    const spreadsheetId = (await getSpreadsheetId()) as string;

    const rowValues = [
        session.userId,
        session.state,
        JSON.stringify(session.pendingProduct),
        JSON.stringify(session.conversationHistory.slice(-4)),
        new Date().toISOString(),
    ];

    // Find existing row index
    const all = await readAllRows();
    const idx = all.findIndex(r => r.user_id === session.userId);

    if (idx >= 0) {
        // Update row in place (row 2 = idx 0, because row 1 = header)
        const sheetRow = idx + 2;
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${SHEET_NAME}!A${sheetRow}:E${sheetRow}`,
            valueInputOption: 'RAW',
            requestBody: { values: [rowValues] }
        });
    } else {
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${SHEET_NAME}!A1`,
            valueInputOption: 'RAW',
            requestBody: { values: [rowValues] }
        });
    }
}

// ─── Public API ─────────────────────────────────────────────────────────────

export async function getSession(userId: string): Promise<LineSession> {
    try {
        await ensureSheet();
        const rows = await readAllRows();
        const row = rows.find(r => r.user_id === userId);

        if (row) {
            const lastActivity = new Date(row.last_activity);
            if (Date.now() - lastActivity.getTime() > SESSION_TTL_MS) {
                await clearSession(userId);
                return makeEmpty(userId);
            }
            return {
                userId,
                state: (row.state as any) || 'idle',
                pendingProduct: JSON.parse(row.pending_product || '{}'),
                conversationHistory: JSON.parse(row.conversation_history || '[]'),
                lastActivity,
            };
        }
    } catch (err) {
        console.error('[session] getSession error:', err);
    }
    return makeEmpty(userId);
}

export async function updateSession(userId: string, session: LineSession): Promise<void> {
    try {
        await ensureSheet();
        await writeRow(session);
    } catch (err) {
        console.error('[session] updateSession error:', err);
    }
}

export async function clearSession(userId: string): Promise<void> {
    try {
        const { getSheetsClient, getSpreadsheetId } = await import('@/lib/google/sheets');
        const sheets = await getSheetsClient();
        const spreadsheetId = (await getSpreadsheetId()) as string;

        const all = await readAllRows();
        const idx = all.findIndex(r => r.user_id === userId);
        if (idx < 0) return;

        const sheetRow = idx + 2; // +1 for header, +1 for 1-based index
        const meta = await sheets.spreadsheets.get({ spreadsheetId });
        const sheet = meta.data.sheets?.find(s => s.properties?.title === SHEET_NAME);
        const sheetId = sheet?.properties?.sheetId;

        if (typeof sheetId === 'number') {
            await sheets.spreadsheets.batchUpdate({
                spreadsheetId,
                requestBody: {
                    requests: [{
                        deleteDimension: {
                            range: {
                                sheetId,
                                dimension: 'ROWS',
                                startIndex: sheetRow - 1,
                                endIndex: sheetRow,
                            }
                        }
                    }]
                }
            });
        }
    } catch (err) {
        console.error('[session] clearSession error:', err);
    }
}
