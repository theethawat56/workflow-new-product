/**
 * Writer + state helpers for the `sales_orders` Google Sheet.
 *
 * Why a separate module: both the CLI bootstrap and the HTTP delta-sync route
 * need the exact same write semantics (ensure sheet, upsert by row_id, advance
 * sync_state), so isolating them here keeps both call sites tiny.
 *
 * Upsert strategy:
 *   - Each line item has a stable `row_id = ${order_id}-${line_id}`.
 *   - On every write we batch by `row_id`: rows whose row_id already exists in
 *     the sheet are overwritten in place; new rows are appended. This lets us
 *     re-sync the *same date window* without producing duplicates AND lets
 *     status changes (Pending → Success) flow through correctly.
 *
 *   - When the sheet has zero rows for the window in question, append-only
 *     is much faster than the upsert path, so we expose `appendAllRows` as
 *     a fast-path the bootstrap CLI uses after `clearAll`.
 */

import { getSheetsClient, getSpreadsheetId } from "@/lib/google/sheets"
import { SHEETS_CONFIG } from "@/lib/db/schema"
import { SalesOrderRow } from "@/lib/zortout/order-client"

const ORDERS = SHEETS_CONFIG.sales_orders
const STATE = SHEETS_CONFIG.sync_state

/** Ensure a sheet tab exists and contains the canonical header row. */
export async function ensureSheetWithHeaders(
    sheetTitle: string,
    headers: readonly string[],
): Promise<void> {
    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()
    const meta = await sheets.spreadsheets.get({ spreadsheetId })
    const found = (meta.data.sheets ?? []).find((s) => s.properties?.title === sheetTitle)
    if (!found) {
        await sheets.spreadsheets.batchUpdate({
            spreadsheetId,
            requestBody: { requests: [{ addSheet: { properties: { title: sheetTitle } } }] },
        })
    }
    // Always re-write headers to enforce schema (idempotent — same string,
    // same place).
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetTitle}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [Array.from(headers)] },
    })
}

/** Translate a normalised row into a values array in header order. */
function rowToValues(row: SalesOrderRow): unknown[] {
    return ORDERS.headers.map((h) => (row as unknown as Record<string, unknown>)[h] ?? "")
}

/** Wipe everything below the header row in `sales_orders`. */
export async function clearAllOrderRows(): Promise<void> {
    await ensureSheetWithHeaders(ORDERS.name, ORDERS.headers)
    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()
    await sheets.spreadsheets.values.clear({
        spreadsheetId,
        range: `${ORDERS.name}!A2:Z`,
    })
}

/** Append rows in a single batched call. Caller must ensure no row_id collisions. */
export async function appendOrderRows(rows: SalesOrderRow[]): Promise<void> {
    if (rows.length === 0) return
    await ensureSheetWithHeaders(ORDERS.name, ORDERS.headers)
    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()
    await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${ORDERS.name}!A1`,
        valueInputOption: "USER_ENTERED",
        requestBody: { values: rows.map(rowToValues) },
    })
}

/**
 * Upsert a batch of rows by `row_id`. Existing rows are overwritten in place;
 * new rows are appended.
 *
 * Implementation detail: we read the entire `row_id` column once, build an
 * index, then issue ONE batchUpdate for existing-row overwrites and ONE
 * append for the new rows. Both Sheets calls are bulk so the operation is
 * O(1) network round-trips regardless of batch size.
 */
export async function upsertOrderRows(rows: SalesOrderRow[]): Promise<{
    updated: number
    appended: number
}> {
    if (rows.length === 0) return { updated: 0, appended: 0 }
    await ensureSheetWithHeaders(ORDERS.name, ORDERS.headers)

    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()

    // Read existing row_id column (A2:A) to build an index.
    const existingRes = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${ORDERS.name}!A2:A`,
        majorDimension: "COLUMNS",
    })
    const existingIds: string[] = (existingRes.data.values?.[0] as string[]) ?? []
    const indexByRowId = new Map<string, number>()
    existingIds.forEach((id, i) => {
        if (id) indexByRowId.set(id, i + 2) // +2: header row 1, data starts row 2
    })

    const updates: { range: string; values: unknown[][] }[] = []
    const newRows: SalesOrderRow[] = []
    for (const row of rows) {
        const sheetRow = indexByRowId.get(row.row_id)
        if (sheetRow) {
            updates.push({
                range: `${ORDERS.name}!A${sheetRow}`,
                values: [rowToValues(row)],
            })
        } else {
            newRows.push(row)
        }
    }

    if (updates.length > 0) {
        // Sheets API caps a single batchUpdate at ~5MB of values. We chunk
        // conservatively at 1000 updates per request.
        const CHUNK = 1000
        for (let i = 0; i < updates.length; i += CHUNK) {
            await sheets.spreadsheets.values.batchUpdate({
                spreadsheetId,
                requestBody: {
                    valueInputOption: "USER_ENTERED",
                    data: updates.slice(i, i + CHUNK),
                },
            })
        }
    }

    if (newRows.length > 0) {
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${ORDERS.name}!A1`,
            valueInputOption: "USER_ENTERED",
            requestBody: { values: newRows.map(rowToValues) },
        })
    }

    return { updated: updates.length, appended: newRows.length }
}

// ─── sync_state helpers ───────────────────────────────────────────────────────

export interface SyncStateValue {
    value: string
    updated_at: string
}

export async function getSyncState(key: string): Promise<SyncStateValue | null> {
    await ensureSheetWithHeaders(STATE.name, STATE.headers)
    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${STATE.name}!A2:C`,
    })
    const rows = (res.data.values as string[][]) ?? []
    const found = rows.find((r) => r[0] === key)
    if (!found) return null
    return { value: found[1] ?? "", updated_at: found[2] ?? "" }
}

export async function setSyncState(key: string, value: string): Promise<void> {
    await ensureSheetWithHeaders(STATE.name, STATE.headers)
    const sheets = await getSheetsClient()
    const spreadsheetId = await getSpreadsheetId()
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${STATE.name}!A2:C`,
    })
    const rows = (res.data.values as string[][]) ?? []
    const idx = rows.findIndex((r) => r[0] === key)
    const updated_at = new Date().toISOString()
    if (idx >= 0) {
        const sheetRow = idx + 2
        await sheets.spreadsheets.values.update({
            spreadsheetId,
            range: `${STATE.name}!A${sheetRow}:C${sheetRow}`,
            valueInputOption: "RAW",
            requestBody: { values: [[key, value, updated_at]] },
        })
    } else {
        await sheets.spreadsheets.values.append({
            spreadsheetId,
            range: `${STATE.name}!A1`,
            valueInputOption: "RAW",
            requestBody: { values: [[key, value, updated_at]] },
        })
    }
}
