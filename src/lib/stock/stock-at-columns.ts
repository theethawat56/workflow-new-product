/**
 * Stock_AT sheet column helpers.
 *
 * Live sheet headers (as of 2026-08) use `ATB` + `Item name` instead of the
 * older `SKU` / `Product Name` labels. Qty lives in header **"Current Stock"**
 * (col P today) — always resolve by header name, never by column letter.
 *
 * Also: Next.js `unstable_cache` JSON-serializes Maps to `{}`, which wiped
 * stock on analytics pages. Prefer Records in cache payloads and revive Maps
 * via `toStockQtyMap`.
 */

export type StockAtRow = Record<string, unknown>

function normalizeHeader(h: string): string {
    return h.replace(/\u00a0/g, " ").trim().toLowerCase()
}

function findKey(row: StockAtRow, candidates: string[]): string | null {
    for (const key of candidates) {
        if (Object.prototype.hasOwnProperty.call(row, key)) return key
    }
    const wanted = candidates.map(normalizeHeader)
    for (const key of Object.keys(row)) {
        if (wanted.includes(normalizeHeader(key))) return key
    }
    return null
}

function firstString(row: StockAtRow, keys: string[]): string {
    const key = findKey(row, keys)
    if (!key) return ""
    const v = row[key]
    if (v == null) return ""
    return String(v).trim()
}

function parseNum(v: unknown): number {
    if (v == null || v === "") return 0
    const n = Number(String(v).replace(/,/g, "").trim())
    return Number.isFinite(n) ? n : 0
}

/** SKU code — live sheet uses `ATB`; keep `SKU` / `sku` for older dumps. */
export function stockAtSku(row: StockAtRow): string {
    return firstString(row, ["ATB", "SKU", "sku", "ATB Code", "Code"]).toUpperCase()
}

/** Product display name. */
export function stockAtName(row: StockAtRow): string {
    return firstString(row, ["Item name", "Product Name", "product_name", "Name"])
}

/**
 * On-hand qty from the `Current Stock` column only.
 * Does not fall back to Total Available / In-Transit.
 */
export function stockAtCurrent(row: StockAtRow): number {
    const key = findKey(row, ["Current Stock", "current_stock", "CurrentStock"])
    if (!key) return 0
    const raw = row[key]
    if (raw == null || String(raw).trim() === "") return 0
    return parseNum(raw)
}

export function stockAtInTransit(row: StockAtRow): number {
    const key = findKey(row, ["In-Transit Stock", "In Transit Stock", "in_transit"])
    return key ? parseNum(row[key]) : 0
}

export function stockAtSafetyPcs(row: StockAtRow): number {
    const key = findKey(row, ["Safety Stock pcs", "Safety Stock"])
    return key ? parseNum(row[key]) : 0
}

export function stockAtDio(row: StockAtRow): number {
    const key = findKey(row, ["Day inventory outstanding", "DIO"])
    return key ? parseNum(row[key]) : 0
}

/** Normalize a raw sheet row into the fields the /stock UI expects. */
export function normalizeStockAtRow(row: StockAtRow): {
    STATUS: string
    SKU: string
    "Product Name": string
    "Current Stock": number
    "Safety Stock pcs": number
    "Day inventory outstanding": number
    "In-Transit Stock": number
} {
    return {
        STATUS: firstString(row, ["STATUS", "Status", "status"]),
        SKU: stockAtSku(row),
        "Product Name": stockAtName(row),
        "Current Stock": stockAtCurrent(row),
        "Safety Stock pcs": stockAtSafetyPcs(row),
        "Day inventory outstanding": stockAtDio(row),
        "In-Transit Stock": stockAtInTransit(row),
    }
}

/** ATB092119 ↔ ATB92119 style aliases used across sales vs Stock_AT. */
export function stockSkuVariants(sku: string): string[] {
    const u = sku.trim().toUpperCase()
    if (!u) return []
    const out = new Set<string>([u])
    if (/^ATB0\d/.test(u)) out.add(`ATB${u.slice(4)}`)
    if (/^ATB[1-9]/.test(u)) out.add(`ATB0${u.slice(3)}`)
    return [...out]
}

/** Build a JSON-safe qty map from Stock_AT rows (Current Stock only). */
export function buildStockQtyRecord(rows: StockAtRow[]): Record<string, number> {
    const rec: Record<string, number> = {}
    for (const r of rows) {
        const sku = stockAtSku(r)
        if (!sku) continue
        const qty = stockAtCurrent(r)
        // Last row wins for duplicate ATB keys (matches prior Map behavior).
        rec[sku] = qty
    }
    return rec
}

/**
 * Revive cache payload → Map, and index SKU variants so sales/cohort codes
 * still resolve when Stock_AT uses a zero-padded / unpadded ATB form.
 */
export function toStockQtyMap(
    input: Record<string, number> | Map<string, number> | null | undefined,
): Map<string, number> {
    const base =
        input instanceof Map
            ? input
            : new Map(Object.entries(input ?? {}))
    const map = new Map<string, number>()
    for (const [sku, qty] of base) {
        for (const v of stockSkuVariants(sku)) {
            if (!map.has(v)) map.set(v, qty)
        }
        map.set(sku.toUpperCase(), qty)
    }
    return map
}

export function lookupStockQty(
    stockBySku: Map<string, number>,
    sku: string,
): number | undefined {
    for (const v of stockSkuVariants(sku)) {
        if (stockBySku.has(v)) return stockBySku.get(v)
    }
    return undefined
}
