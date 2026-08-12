/**
 * Stock_AT sheet column helpers.
 *
 * Live sheet headers (as of 2026-08) use `ATB` + `Item name` instead of the
 * older `SKU` / `Product Name` labels. `Current Stock` is still the qty
 * column (now further right — col P), so readers must key by header name,
 * never by column letter.
 */

export type StockAtRow = Record<string, unknown>

function firstString(row: StockAtRow, keys: string[]): string {
    for (const key of keys) {
        const v = row[key]
        if (v == null) continue
        const s = String(v).trim()
        if (s) return s
    }
    return ""
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
 * On-hand qty from the `Current Stock` column (preferred), with a few
 * historical aliases. Does not fall back to Total Available / In-Transit.
 */
export function stockAtCurrent(row: StockAtRow): number {
    for (const key of ["Current Stock", "current_stock", "CurrentStock"]) {
        if (row[key] != null && String(row[key]).trim() !== "") {
            return parseNum(row[key])
        }
    }
    return 0
}

export function stockAtInTransit(row: StockAtRow): number {
    return parseNum(row["In-Transit Stock"] ?? row["In Transit Stock"] ?? row.in_transit)
}

export function stockAtSafetyPcs(row: StockAtRow): number {
    return parseNum(row["Safety Stock pcs"] ?? row["Safety Stock"])
}

export function stockAtDio(row: StockAtRow): number {
    return parseNum(row["Day inventory outstanding"] ?? row.DIO)
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
