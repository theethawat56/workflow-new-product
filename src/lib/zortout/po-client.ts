/**
 * Zortout PurchaseOrder client + per-SKU cost aggregator.
 *
 * The sales dashboard needs an authoritative unit cost for every SKU we sell.
 * Zort stores cost data on each PurchaseOrder line item (`pricepernumber_pretax`,
 * the unit price *before* VAT). Because the same SKU is purchased multiple
 * times — sometimes at different prices — we aggregate quantity-weighted
 * average cost across all successful POs in a configurable window.
 *
 * Usage:
 *   const summaries = await aggregatePoCosts({ createdAfter: "2024-01-01" })
 *   // → [{ sku, total_qty, total_value_pretax, weighted_avg_cost, ... }]
 */

const ZORT_BASE = "https://open-api.zortout.com/v4"

function getZortHeaders(): Record<string, string> {
    const storeName = process.env.ZORTOUT_STORE_NAME ?? "narong1.autobot@gmail.com"
    const apiKey = process.env.ZORTOUT_API_KEY ?? "wt2nFpHIUZrrm9VdOCLPGlJCNkLCQRZCtWy4aaA="
    const apiSecret =
        process.env.ZORTOUT_API_SECRET ?? "kQYH9bb2S4FhqXuNGRvICjfA4w4mR2aKycINNc8mgWY="
    return {
        storename: storeName,
        apikey: apiKey,
        apisecret: apiSecret,
    }
}

// Raw shapes from Zort — only the fields we actually consume.
interface ZortPoLineItem {
    sku?: string
    name?: string
    number?: number // quantity
    pricepernumber_pretax?: number // unit cost ex-VAT (THB)
    totalprice_pretax?: number // line total ex-VAT
}

// PO statuses with agreed unit cost — include Partial Transfer & Pending.
const INCLUDED_PO_STATUSES = new Set(["Success", "Partial Transfer", "Pending"])

function isIncludedPoStatus(status: string | undefined): boolean {
    if (!status) return true
    return INCLUDED_PO_STATUSES.has(status)
}

interface ZortPurchaseOrder {
    id: number
    number: string
    status?: string // "Success" | "Cancel" | "Draft" | ...
    purchaseorderdate?: string // ISO
    purchaseorderdateString?: string // "YYYY-MM-DD"
    list?: ZortPoLineItem[]
}

interface ZortPoListResponse {
    res?: { resCode?: string; resDesc?: string }
    list?: ZortPurchaseOrder[]
    count?: number
    totalAmount?: number
}

export interface SkuCostSummary {
    sku: string
    product_name: string
    total_qty: number
    total_value_pretax: number
    weighted_avg_cost: number
    latest_po_date: string
    earliest_po_date: string
    po_count: number
}

/**
 * Fetch a page of POs. Zort's `limit` query param appears to be a soft cap;
 * empirically `limit=2000` returns up to ~2000 records in a single call.
 */
async function fetchPoPage(opts: {
    createdAfter: string
    limit: number
    page?: number
}): Promise<ZortPoListResponse> {
    const params = new URLSearchParams()
    params.set("limit", String(opts.limit))
    params.set("createdafter", opts.createdAfter)
    if (opts.page) params.set("page", String(opts.page))

    const url = `${ZORT_BASE}/PurchaseOrder/GetPurchaseOrders?${params.toString()}`
    const res = await fetch(url, { headers: getZortHeaders(), cache: "no-store" })
    if (!res.ok) {
        throw new Error(`Zort PO fetch failed: HTTP ${res.status} ${await res.text()}`)
    }
    return (await res.json()) as ZortPoListResponse
}

/**
 * Aggregate cost across Success / Partial Transfer / Pending POs since `createdAfter`.
 *
 * Returns one row per SKU with quantity-weighted average unit cost (pre-VAT).
 */
export async function aggregatePoCosts(opts: {
    createdAfter?: string
    onProgress?: (msg: string) => void
} = {}): Promise<{
    summaries: SkuCostSummary[]
    rawPoCount: number
    consideredPoCount: number
    skippedPoCount: number
}> {
    const createdAfter = opts.createdAfter ?? "2024-01-01"
    const log = opts.onProgress ?? (() => {})

    // First page; if Zort returned `count` greater than the page size, paginate.
    const PAGE_SIZE = 2000
    let page = 1
    const allPos: ZortPurchaseOrder[] = []
    let total = 0

    while (true) {
        log(`Fetching PO page ${page} (limit=${PAGE_SIZE})…`)
        const resp = await fetchPoPage({ createdAfter, limit: PAGE_SIZE, page })
        const list = resp.list ?? []
        if (page === 1) total = resp.count ?? list.length
        allPos.push(...list)
        log(`  → got ${list.length} POs (cumulative ${allPos.length} / ${total})`)

        // Stop conditions:
        //  - empty page (no more data)
        //  - we've collected at least `total` rows
        if (list.length === 0 || allPos.length >= total) break
        page += 1
        // Safety brake — never paginate more than 20 pages (40k POs is absurd).
        if (page > 20) {
            log("⚠ Pagination safety brake at 20 pages")
            break
        }
    }

    // Aggregate per SKU
    const acc = new Map<
        string,
        {
            sku: string
            product_name: string
            total_qty: number
            total_value_pretax: number
            latest_po_date: string
            earliest_po_date: string
            po_ids: Set<number>
        }
    >()

    let consideredPoCount = 0
    let skippedPoCount = 0

    for (const po of allPos) {
        // Only count successful POs — cancelled / draft POs aren't realised cost.
        if (!isIncludedPoStatus(po.status)) {
            skippedPoCount += 1
            continue
        }
        const poDate = po.purchaseorderdateString || po.purchaseorderdate?.slice(0, 10) || ""
        const lines = po.list ?? []
        if (lines.length === 0) {
            skippedPoCount += 1
            continue
        }
        consideredPoCount += 1

        for (const line of lines) {
            const sku = (line.sku ?? "").trim()
            const qty = Number(line.number) || 0
            const unitCost = Number(line.pricepernumber_pretax) || 0
            if (!sku || qty <= 0) continue
            // Some adjustment / freight-only lines have unitCost=0; keep them
            // out of the average so they don't drag the cost down to 0.
            if (unitCost <= 0) continue

            const lineValue = qty * unitCost
            const existing = acc.get(sku)
            if (!existing) {
                acc.set(sku, {
                    sku,
                    product_name: line.name ?? "",
                    total_qty: qty,
                    total_value_pretax: lineValue,
                    latest_po_date: poDate,
                    earliest_po_date: poDate,
                    po_ids: new Set([po.id]),
                })
            } else {
                existing.total_qty += qty
                existing.total_value_pretax += lineValue
                if (poDate > existing.latest_po_date) existing.latest_po_date = poDate
                if (poDate && (poDate < existing.earliest_po_date || !existing.earliest_po_date))
                    existing.earliest_po_date = poDate
                existing.po_ids.add(po.id)
                // Prefer the most recent non-empty product_name
                if (line.name && poDate >= existing.latest_po_date) {
                    existing.product_name = line.name
                }
            }
        }
    }

    const summaries: SkuCostSummary[] = [...acc.values()]
        .map((r) => ({
            sku: r.sku,
            product_name: r.product_name,
            total_qty: round(r.total_qty, 2),
            total_value_pretax: round(r.total_value_pretax, 2),
            weighted_avg_cost: round(r.total_value_pretax / r.total_qty, 2),
            latest_po_date: r.latest_po_date,
            earliest_po_date: r.earliest_po_date,
            po_count: r.po_ids.size,
        }))
        // Sort biggest-spend SKUs first — easier to eyeball results
        .sort((a, b) => b.total_value_pretax - a.total_value_pretax)

    return {
        summaries,
        rawPoCount: allPos.length,
        consideredPoCount,
        skippedPoCount,
    }
}

function round(n: number, dp: number): number {
    const m = Math.pow(10, dp)
    return Math.round(n * m) / m
}
