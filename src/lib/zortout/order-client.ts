/**
 * Zortout Order/GetOrders client.
 *
 * Pagination strategy:
 *   - Zort returns `count` (total matching rows) and `list` (page rows).
 *   - We page through with `page=N&limit=PAGE_SIZE` until we have all rows.
 *
 * Filtering strategy:
 *   - `createdafter` / `createdbefore` use the order created date.
 *   - We keep all statuses *except* "Voided" and "Cancel" (their variants), so
 *     that "Success", "Waiting", "Pending" all flow through and represent
 *     either confirmed or in-flight revenue.
 *
 * Output:
 *   - The client returns *normalised line-item rows*, not whole orders, so the
 *     downstream sheet writer can append them directly.
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

interface ZortOrderLineItem {
    id?: number
    sku?: string
    name?: string
    number?: number
    pricepernumber?: number
    pricepernumber_pretax?: number
    totalprice?: number
    totalprice_pretax?: number
    discountamount?: number
    bundleid?: number | null
}

interface ZortOrder {
    id?: number
    number?: string
    status?: string
    paymentstatus?: string
    orderdateString?: string
    successDateString?: string | null
    marketplacename?: string | null
    saleschannel?: string | null
    integrationName?: string | null
    list?: ZortOrderLineItem[]
}

interface ZortOrderListResponse {
    res?: { resCode?: string; resDesc?: string }
    list?: ZortOrder[]
    count?: number
}

/**
 * Per-line-item row already serialised in the schema column order
 * (sales_orders sheet). Returned as Record so the writer can use the header
 * array directly.
 */
export interface SalesOrderRow {
    row_id: string
    order_id: string
    order_number: string
    order_date: string
    success_date: string
    status: string
    payment_status: string
    channel_raw: string
    marketplace_name: string
    integration_name: string
    sku: string
    product_name: string
    is_bundle: 0 | 1
    quantity: number
    unit_price: number
    unit_price_pretax: number
    line_total: number
    line_total_pretax: number
    line_discount: number
    synced_at: string
}

// Statuses we drop entirely from the sheet. Everything else flows through.
const EXCLUDED_STATUSES = new Set(["voided", "cancel", "cancelled"])

async function fetchOrderPage(opts: {
    createdAfter: string
    createdBefore: string
    page: number
    limit: number
}): Promise<ZortOrderListResponse> {
    const params = new URLSearchParams()
    params.set("page", String(opts.page))
    params.set("limit", String(opts.limit))
    params.set("createdafter", opts.createdAfter)
    params.set("createdbefore", opts.createdBefore)

    const url = `${ZORT_BASE}/Order/GetOrders?${params.toString()}`
    const res = await fetch(url, { headers: getZortHeaders(), cache: "no-store" })
    if (!res.ok) {
        throw new Error(`Zort Orders fetch failed: HTTP ${res.status} ${await res.text()}`)
    }
    return (await res.json()) as ZortOrderListResponse
}

/**
 * Fetch all orders in a [createdAfter..createdBefore] window and return
 * normalised line-item rows. Both dates are YYYY-MM-DD strings; Zort treats
 * them as inclusive ranges on the created date.
 *
 * `onProgress` is optional and fires after each page so callers (CLI, API
 * route) can stream progress to stdout / SSE.
 */
export async function fetchSalesOrderRows(opts: {
    createdAfter: string
    createdBefore: string
    pageLimit?: number
    maxPages?: number
    onProgress?: (msg: string) => void
}): Promise<{
    rows: SalesOrderRow[]
    rawOrderCount: number
    droppedOrders: number
    pages: number
}> {
    const pageLimit = opts.pageLimit ?? 500
    const maxPages = opts.maxPages ?? 200
    const log = opts.onProgress ?? (() => {})
    const syncedAt = new Date().toISOString()

    const rows: SalesOrderRow[] = []
    let rawOrderCount = 0
    let droppedOrders = 0
    let page = 1
    let total = 0

    while (page <= maxPages) {
        log(
            `Fetching orders page ${page} (window ${opts.createdAfter} → ${opts.createdBefore}, limit=${pageLimit})…`,
        )
        const resp = await fetchOrderPage({
            createdAfter: opts.createdAfter,
            createdBefore: opts.createdBefore,
            page,
            limit: pageLimit,
        })
        const list = resp.list ?? []
        if (page === 1) total = resp.count ?? list.length
        rawOrderCount += list.length
        log(`  → got ${list.length} orders (cumulative ${rawOrderCount} / ${total})`)

        for (const order of list) {
            const status = (order.status ?? "").trim()
            if (EXCLUDED_STATUSES.has(status.toLowerCase())) {
                droppedOrders += 1
                continue
            }
            const lines = order.list ?? []
            if (lines.length === 0) {
                droppedOrders += 1
                continue
            }
            for (const line of lines) {
                rows.push({
                    row_id: `${order.id ?? ""}-${line.id ?? ""}`,
                    order_id: String(order.id ?? ""),
                    order_number: order.number ?? "",
                    order_date: order.orderdateString ?? "",
                    success_date: order.successDateString ?? "",
                    status,
                    payment_status: order.paymentstatus ?? "",
                    channel_raw: order.saleschannel ?? "",
                    marketplace_name: order.marketplacename ?? "",
                    integration_name: order.integrationName ?? "",
                    sku: line.sku ?? "",
                    product_name: line.name ?? "",
                    is_bundle: line.bundleid ? 1 : 0,
                    quantity: Number(line.number) || 0,
                    unit_price: Number(line.pricepernumber) || 0,
                    unit_price_pretax: Number(line.pricepernumber_pretax) || 0,
                    line_total: Number(line.totalprice) || 0,
                    line_total_pretax: Number(line.totalprice_pretax) || 0,
                    line_discount: Number(line.discountamount) || 0,
                    synced_at: syncedAt,
                })
            }
        }

        // Stop if we've collected all orders OR the page was short.
        if (list.length === 0 || rawOrderCount >= total) break
        page += 1
    }

    return { rows, rawOrderCount, droppedOrders, pages: page }
}
