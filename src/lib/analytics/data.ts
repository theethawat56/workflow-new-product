/**
 * RobotMaker Analytics — server-only data layer.
 * ONLY this file reads Google Sheets for the analytics dashboard.
 */

import "server-only"
import { unstable_cache } from "next/cache"
import { google } from "googleapis"
import { classifyOrderChannel } from "@/lib/sales/channel"
import { buildStockQtyRecord, lookupStockQty, toStockQtyMap } from "@/lib/stock/stock-at-columns"
import {
    CORE_WINNER_SEEDS,
    DEFAULT_LEAD_TIME,
    NEW_2025_SKUS,
    NEW_2026_SKUS,
    VALID_STATUSES,
    Z_BY_SERVICE,
    getCohort,
    resolveLaunchYear,
    type LaunchRef,
} from "./constants"
import type {
    AnalyticsOverview,
    Cohort,
    JoinedRow,
    PoCostRow,
    SalesOrderRow,
    Seasonality,
    SkuWindowMetrics,
    StockSkuMetrics,
} from "./types"

export type {
    AnalyticsOverview,
    Cohort,
    JoinedRow,
    PoCostRow,
    SalesOrderRow,
    Seasonality,
    SkuWindowMetrics,
    StockSkuMetrics,
} from "./types"

// ─── Sheets read (private) ───────────────────────────────────────────────────

function sheetsAuth() {
    return new google.auth.JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
        scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    })
}

async function readTab(tab: string): Promise<Record<string, string>[]> {
    const spreadsheetId =
        process.env.GOOGLE_SHEETS_ID ?? process.env.GOOGLE_SHEETS_SPREADSHEET_ID
    if (!spreadsheetId) {
        throw new Error("GOOGLE_SHEETS_SPREADSHEET_ID is not defined")
    }
    const sheets = google.sheets({ version: "v4", auth: sheetsAuth() })
    const res = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: tab,
    })
    const values = res.data.values ?? []
    if (values.length < 2) return []
    const header = values[0].map((h) => String(h).trim())
    return values.slice(1).map((row) =>
        Object.fromEntries(header.map((h, i) => [h, row[i] ?? ""])),
    )
}

function num(v: string | undefined): number {
    if (v == null || v === "") return 0
    const n = Number(String(v).replace(/,/g, ""))
    return Number.isFinite(n) ? n : 0
}

function parseSales(raw: Record<string, string>[]): SalesOrderRow[] {
    return raw.map((r) => ({
        row_id: String(r.row_id ?? ""),
        order_id: num(r.order_id),
        order_number: String(r.order_number ?? ""),
        order_date: String(r.order_date ?? "").slice(0, 10),
        success_date: String(r.success_date ?? ""),
        status: String(r.status ?? ""),
        payment_status: String(r.payment_status ?? ""),
        channel_raw: String(r.channel_raw ?? ""),
        marketplace_name: String(r.marketplace_name ?? ""),
        integration_name: String(r.integration_name ?? ""),
        sku: String(r.sku ?? "").trim(),
        product_name: String(r.product_name ?? "").trim(),
        is_bundle: num(r.is_bundle),
        quantity: num(r.quantity),
        unit_price: num(r.unit_price),
        unit_price_pretax: num(r.unit_price_pretax),
        line_total: num(r.line_total),
        line_total_pretax: num(r.line_total_pretax),
        line_discount: num(r.line_discount),
        synced_at: String(r.synced_at ?? ""),
    }))
}

function parseCosts(raw: Record<string, string>[]): PoCostRow[] {
    return raw.map((r) => ({
        sku: String(r.sku ?? "").trim(),
        product_name: String(r.product_name ?? "").trim(),
        total_qty: num(r.total_qty),
        total_value_pretax: num(r.total_value_pretax),
        weighted_avg_cost: num(r.weighted_avg_cost),
        latest_po_date: String(r.latest_po_date ?? ""),
        earliest_po_date: String(r.earliest_po_date ?? ""),
        po_count: num(r.po_count),
        synced_at: String(r.synced_at ?? ""),
    }))
}

function parseLaunchedProducts(
    raw: Record<string, string>[],
): Record<string, LaunchRef> {
    const map: Record<string, LaunchRef> = {}
    for (const r of raw) {
        const sku = String(r.zort_sku ?? "").trim().toUpperCase()
        if (!sku) continue
        map[sku] = {
            launch_date: String(r.launch_date ?? ""),
            launch_type: String(r.launch_type ?? ""),
        }
    }
    return map
}

async function fetchRawSheetsDirect() {
    const [salesRaw, costRaw, launchedRaw] = await Promise.all([
        readTab("sales_orders"),
        readTab("po_costs"),
        readTab("launched_products"),
    ])
    return {
        sales: parseSales(salesRaw),
        costs: parseCosts(costRaw),
        // Stock_AT is fetched fresh in loadRawSheets — never cache it.
        // (Map/empty-parser cache previously wiped Current Stock on every page.)
        launchedBySku: parseLaunchedProducts(launchedRaw),
        loadedAt: new Date().toISOString(),
    }
}

const getCachedRawSheets = unstable_cache(
    fetchRawSheetsDirect,
    // v3: stock fetched fresh each request (not cached)
    ["robotmaker-analytics-raw-v3"],
    { revalidate: 3600, tags: ["analytics-data"] },
)

async function loadRawSheets() {
    let raw
    try {
        raw = await getCachedRawSheets()
    } catch {
        raw = await fetchRawSheetsDirect()
    }
    // Always read Stock_AT fresh — never from unstable_cache.
    const stockRaw = await readTab("Stock_AT")
    return {
        ...raw,
        stockBySku: toStockQtyMap(buildStockQtyRecord(stockRaw)),
        launchedBySku: new Map(Object.entries(raw.launchedBySku ?? {})),
    }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function filterSales(rows: SalesOrderRow[]): SalesOrderRow[] {
    return rows.filter(
        (r) =>
            VALID_STATUSES.has(r.status) &&
            r.line_total > 0 &&
            r.sku &&
            r.order_date,
    )
}

function inRange(date: string, from: string, to: string): boolean {
    return date >= from && date <= to
}

function stdev(values: number[]): number {
    if (values.length === 0) return 0
    const mean = values.reduce((a, b) => a + b, 0) / values.length
    const variance =
        values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length
    return Math.sqrt(variance)
}

function computeSeasonality(
    sku: string,
    sales2025: SalesOrderRow[],
): Seasonality {
    const monthly = new Array(12).fill(0)
    let total = 0
    for (const r of sales2025) {
        if (r.sku !== sku) continue
        const m = new Date(r.order_date).getMonth()
        if (!Number.isFinite(m)) continue
        monthly[m] += r.quantity
        total += r.quantity
    }
    if (total === 0) return "YEAR-ROUND"
    const summer = monthly[2] + monthly[3] + monthly[4] + monthly[5] + monthly[6]
    return summer / total > 0.55 ? "SEASONAL (summer)" : "YEAR-ROUND"
}

export function computeStockMetrics(
    sku: string,
    productName: string,
    cohort: Cohort,
    seasonality: Seasonality,
    sales90: SalesOrderRow[],
    dataAsOf: string,
    stockBySku: Map<string, number>,
    launchedBySku: Map<string, LaunchRef>,
    leadTime: number = DEFAULT_LEAD_TIME,
    z: number = Z_BY_SERVICE[90],
): StockSkuMetrics {
    const end = new Date(dataAsOf)
    const start = new Date(end)
    start.setDate(start.getDate() - 89)

    const dailyMap = new Map<string, number>()
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        dailyMap.set(d.toISOString().slice(0, 10), 0)
    }
    for (const r of sales90) {
        if (r.sku !== sku) continue
        const key = r.order_date
        if (dailyMap.has(key)) {
            dailyMap.set(key, (dailyMap.get(key) ?? 0) + r.quantity)
        }
    }
    const dailyUnits90 = [...dailyMap.values()]
    const dailyAvg = dailyUnits90.reduce((a, b) => a + b, 0) / dailyUnits90.length
    const dailyStd = stdev(dailyUnits90)
    const safetyStock = z * dailyStd * Math.sqrt(leadTime)
    const reorderPoint = dailyAvg * leadTime + safetyStock
    const minOrderQty = dailyAvg * leadTime
    const units90d = sales90
        .filter((r) => r.sku === sku)
        .reduce((s, r) => s + r.quantity, 0)

    const normalizedSku = sku.trim().toUpperCase()
    const sheetStock = lookupStockQty(stockBySku, normalizedSku)

    return {
        sku,
        productName,
        cohort,
        launchYear: resolveLaunchYear(sku, cohort, launchedBySku),
        seasonality,
        dailyAvg,
        dailyStd,
        dailyUnits90,
        safetyStock,
        reorderPoint,
        minOrderQty,
        units90d,
        currentStock: sheetStock !== undefined ? sheetStock : null,
    }
}

function aggregateSkuWindow(
    rows: SalesOrderRow[],
    costMap: Map<string, number>,
    nameMap: Map<string, string>,
    seasonalityMap: Map<string, Seasonality>,
): SkuWindowMetrics[] {
    const acc = new Map<
        string,
        { units: number; revenue: number; netGp: number; name: string }
    >()
    for (const r of rows) {
        const unitCost = costMap.get(r.sku) ?? 0
        const channel = classifyOrderChannel(
            r.channel_raw,
            r.marketplace_name,
            r.integration_name,
        )
        const revenue = r.line_total
        const netRevenue = revenue * (1 - channel.deduction)
        const netGp = netRevenue - r.quantity * unitCost

        const cur = acc.get(r.sku) ?? {
            units: 0,
            revenue: 0,
            netGp: 0,
            name: r.product_name,
        }
        cur.units += r.quantity
        cur.revenue += revenue
        cur.netGp += netGp
        if (r.product_name) cur.name = r.product_name
        acc.set(r.sku, cur)
    }
    return [...acc.entries()].map(([sku, v]) => {
        const unitCost = costMap.get(sku) ?? null
        const avgSellPrice = v.units > 0 ? v.revenue / v.units : null
        const grossMarginPct =
            v.revenue > 0 ? (v.netGp / v.revenue) * 100 : null
        return {
            sku,
            productName: nameMap.get(sku) ?? v.name ?? sku,
            cohort: getCohort(sku),
            seasonality: seasonalityMap.get(sku) ?? "YEAR-ROUND",
            units: v.units,
            revenue: v.revenue,
            unitCost,
            avgSellPrice,
            grossMarginPct,
            isLoss: grossMarginPct != null && grossMarginPct < 0,
        }
    })
}

// ─── Main loader ─────────────────────────────────────────────────────────────

export async function loadAnalyticsData(): Promise<AnalyticsOverview> {
    const { sales: allSales, costs, stockBySku, launchedBySku } =
        await loadRawSheets()
    const sales = filterSales(allSales)

    const costMap = new Map<string, number>()
    const nameFromCost = new Map<string, string>()
    for (const c of costs) {
        if (c.sku && c.weighted_avg_cost > 0) {
            costMap.set(c.sku, c.weighted_avg_cost)
        }
        if (c.sku && c.product_name) nameFromCost.set(c.sku, c.product_name)
    }

    const dates = sales.map((r) => r.order_date).sort()
    const dataAsOf = dates[dates.length - 1] ?? new Date().toISOString().slice(0, 10)
    const [, mm, dd] = dataAsOf.split("-")
    const ytdCutoff = `${mm}-${dd}`

    const y2026 = dataAsOf.slice(0, 4)
    const y2025 = String(Number(y2026) - 1)
    const ytd2026From = `${y2026}-01-01`
    const ytd2026To = dataAsOf
    const ytd2025From = `${y2025}-01-01`
    const ytd2025To = `${y2025}-${mm}-${dd}`

    const ytd2026 = sales.filter((r) => inRange(r.order_date, ytd2026From, ytd2026To))
    const ytd2025 = sales.filter((r) => inRange(r.order_date, ytd2025From, ytd2025To))
    const sales2025 = sales.filter((r) => r.order_date.startsWith("2025-"))

    const seasonalityMap = new Map<string, Seasonality>()
    const skuSet = new Set(sales.map((r) => r.sku))
    for (const sku of skuSet) {
        seasonalityMap.set(sku, computeSeasonality(sku, sales2025))
    }

    const nameMap = new Map<string, string>()
    for (const r of sales) {
        if (r.sku && r.product_name && !nameMap.has(r.sku)) {
            nameMap.set(r.sku, r.product_name)
        }
    }
    for (const [sku, name] of nameFromCost) {
        if (!nameMap.has(sku)) nameMap.set(sku, name)
    }

    const skuMetricsYtd = aggregateSkuWindow(ytd2026, costMap, nameMap, seasonalityMap)
    const skuMetricsYtd2025 = aggregateSkuWindow(ytd2025, costMap, nameMap, seasonalityMap)

    const totalRevYtd2026 = ytd2026.reduce((s, r) => s + r.line_total, 0)
    const totalRevYtd2025 = ytd2025.reduce((s, r) => s + r.line_total, 0)
    const revYoYPct =
        totalRevYtd2025 > 0
            ? (totalRevYtd2026 - totalRevYtd2025) / totalRevYtd2025
            : 0

    const new2026Rev = skuMetricsYtd
        .filter((s) => s.cohort === "NEW_2026")
        .reduce((a, s) => a + s.revenue, 0)
    const new2025Rev = skuMetricsYtd
        .filter((s) => s.cohort === "NEW_2025")
        .reduce((a, s) => a + s.revenue, 0)
    const coreRev = totalRevYtd2026 - new2026Rev - new2025Rev
    const newProductSharePct =
        totalRevYtd2026 > 0
            ? (new2026Rev + new2025Rev) / totalRevYtd2026
            : 0

    const targetLow = 0.3
    const targetHigh = 0.4
    const gapToTargetLow = Math.max(0, targetLow * totalRevYtd2026 - (new2026Rev + new2025Rev))
    const gapToTargetHigh = Math.max(0, targetHigh * totalRevYtd2026 - (new2026Rev + new2025Rev))

    // Weighted GM% + absolute gross profit (฿) for a SKU-metrics window.
    // grossMarginPct is already net of channel deductions, so
    // GP฿ = revenue × gmPct/100 (only for SKUs that have cost data).
    function gpStats(rows: SkuWindowMetrics[]) {
        let marginNum = 0
        let marginDen = 0
        let grossProfit = 0
        for (const s of rows) {
            if (s.grossMarginPct != null && s.revenue > 0) {
                marginNum += s.grossMarginPct * s.revenue
                marginDen += s.revenue
                grossProfit += (s.revenue * s.grossMarginPct) / 100
            }
        }
        return {
            weightedGmPct: marginDen > 0 ? marginNum / marginDen : 0,
            grossProfit,
        }
    }

    const gp2026 = gpStats(skuMetricsYtd)
    const gp2025 = gpStats(skuMetricsYtd2025)
    const totalGrossMarginPct = gp2026.weightedGmPct
    const totalGrossMarginPct2025 = gp2025.weightedGmPct
    const totalGrossProfitYtd2026 = gp2026.grossProfit
    const totalGrossProfitYtd2025 = gp2025.grossProfit
    const gpYoYPct =
        totalGrossProfitYtd2025 > 0
            ? (totalGrossProfitYtd2026 - totalGrossProfitYtd2025) /
              totalGrossProfitYtd2025
            : null
    const gpMarginDeltaPp =
        gp2025.weightedGmPct > 0
            ? totalGrossMarginPct - totalGrossMarginPct2025
            : null

    const rev2025BySku = new Map(skuMetricsYtd2025.map((s) => [s.sku, s.revenue]))
    const deltas = skuMetricsYtd
        .map((s) => ({
            sku: s.sku,
            productName: s.productName,
            delta: s.revenue - (rev2025BySku.get(s.sku) ?? 0),
        }))
        .filter((d) => d.delta !== 0)

    const topGainers = [...deltas]
        .filter((d) => d.delta > 0)
        .sort((a, b) => b.delta - a.delta)
        .slice(0, 10)
    const topDecliners = [...deltas]
        .filter((d) => d.delta < 0)
        .sort((a, b) => a.delta - b.delta)
        .slice(0, 10)

    const missingCostSkus = [
        ...new Set(
            skuMetricsYtd
                .filter((s) => s.unitCost == null && s.revenue > 0)
                .map((s) => s.sku),
        ),
    ].sort()

    const end90 = new Date(dataAsOf)
    const start90 = new Date(end90)
    start90.setDate(start90.getDate() - 89)
    const start90Str = start90.toISOString().slice(0, 10)
    const sales90 = sales.filter(
        (r) => r.order_date >= start90Str && r.order_date <= dataAsOf,
    )

    const tracked = new Set<string>(CORE_WINNER_SEEDS)
    for (const sku of NEW_2026_SKUS) {
        const u = sales90
            .filter((r) => r.sku === sku)
            .reduce((a, r) => a + r.quantity, 0)
        if (u > 0) tracked.add(sku)
    }
    for (const sku of NEW_2025_SKUS) {
        const u = sales90
            .filter((r) => r.sku === sku)
            .reduce((a, r) => a + r.quantity, 0)
        if (u > 0) tracked.add(sku)
    }
    for (const r of sales90) {
        if (r.quantity > 0 && getCohort(r.sku) !== "CORE") {
            tracked.add(r.sku)
        }
        const prefix = r.sku.toUpperCase()
        if (
            r.quantity > 0 &&
            (prefix.startsWith("ATB") || prefix.startsWith("EU") || prefix.startsWith("E00"))
        ) {
            tracked.add(r.sku)
        }
    }

    // Monthly GP (net of channel deductions) + avg selling price, trailing 18 months.
    const monthlyGpPrice = (() => {
        const end = new Date(dataAsOf)
        const months: string[] = []
        const cursor = new Date(end.getFullYear(), end.getMonth() - 17, 1)
        const endMonth = new Date(end.getFullYear(), end.getMonth(), 1)
        while (cursor <= endMonth) {
            months.push(
                `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}`,
            )
            cursor.setMonth(cursor.getMonth() + 1)
        }
        const acc = new Map<
            string,
            { revenue: number; units: number; netGp: number }
        >()
        for (const m of months) acc.set(m, { revenue: 0, units: 0, netGp: 0 })

        for (const r of sales) {
            const m = r.order_date.slice(0, 7)
            const bucket = acc.get(m)
            if (!bucket) continue
            const unitCost = costMap.get(r.sku) ?? 0
            const channel = classifyOrderChannel(
                r.channel_raw,
                r.marketplace_name,
                r.integration_name,
            )
            bucket.revenue += r.line_total
            bucket.units += r.quantity
            bucket.netGp +=
                r.line_total * (1 - channel.deduction) - r.quantity * unitCost
        }

        return months.map((month) => {
            const v = acc.get(month)!
            return {
                month,
                revenue: v.revenue,
                units: v.units,
                grossProfit: v.netGp,
                gmPct: v.revenue > 0 ? (v.netGp / v.revenue) * 100 : null,
                avgSellPrice: v.units > 0 ? v.revenue / v.units : null,
            }
        })
    })()

    const stockSkus = [...tracked].map((sku) =>
        computeStockMetrics(
            sku,
            nameMap.get(sku) ?? sku,
            getCohort(sku),
            seasonalityMap.get(sku) ?? "YEAR-ROUND",
            sales90,
            dataAsOf,
            stockBySku,
            launchedBySku,
        ),
    )

    return {
        dataAsOf,
        ytdCutoff,
        ytd2026From,
        ytd2026To,
        ytd2025From,
        ytd2025To,
        totalRevYtd2026,
        totalRevYtd2025,
        revYoYPct,
        newProductSharePct,
        newProductShareTargetLow: targetLow,
        newProductShareTargetHigh: targetHigh,
        totalGrossMarginPct,
        totalGrossMarginPct2025,
        totalGrossProfitYtd2026,
        totalGrossProfitYtd2025,
        gpYoYPct,
        gpMarginDeltaPp,
        new2026Rev,
        new2025Rev,
        coreRev,
        gapToTargetLow,
        gapToTargetHigh,
        missingCostSkus,
        topGainers,
        topDecliners,
        skuMetricsYtd,
        stockSkus,
        monthlyGpPrice,
        joinedRowCount: sales.length,
    }
}

export async function loadJoinedRows(options?: {
    cohort?: Cohort | "ALL"
    channel?: string
    status?: string
    skuSearch?: string
    dateFrom?: string
    dateTo?: string
    offset?: number
    limit?: number
}): Promise<{ rows: JoinedRow[]; total: number }> {
    const { sales: allSales, costs } = await loadRawSheets()
    const sales = filterSales(allSales)
    const costMap = new Map(costs.map((c) => [c.sku, c.weighted_avg_cost]))

    let rows: JoinedRow[] = sales.map((r) => ({
        ...r,
        unit_cost: costMap.get(r.sku) ?? null,
        cohort: getCohort(r.sku),
    }))

    if (options?.cohort && options.cohort !== "ALL") {
        rows = rows.filter((r) => r.cohort === options.cohort)
    }
    if (options?.channel && options.channel !== "ALL") {
        rows = rows.filter(
            (r) =>
                r.channel_raw === options.channel ||
                r.integration_name === options.channel,
        )
    }
    if (options?.status && options.status !== "ALL") {
        rows = rows.filter((r) => r.status === options.status)
    }
    if (options?.skuSearch) {
        const q = options.skuSearch.toLowerCase()
        rows = rows.filter(
            (r) =>
                r.sku.toLowerCase().includes(q) ||
                r.product_name.toLowerCase().includes(q),
        )
    }
    if (options?.dateFrom) {
        rows = rows.filter((r) => r.order_date >= options.dateFrom!)
    }
    if (options?.dateTo) {
        rows = rows.filter((r) => r.order_date <= options.dateTo!)
    }

    const total = rows.length
    const offset = options?.offset ?? 0
    const limit = options?.limit ?? 100
    return { rows: rows.slice(offset, offset + limit), total }
}

export async function revalidateAnalyticsCache() {
    const { revalidateTag } = await import("next/cache")
    revalidateTag("analytics-data", "default")
    revalidateTag("launch-command-center", "default")
    revalidateTag("what-if", "default")
}

export async function getAnalyticsSalesContext() {
    const { sales: allSales, costs, stockBySku, launchedBySku } =
        await loadRawSheets()
    const sales = filterSales(allSales)
    const costMap = new Map<string, number>()
    const nameMap = new Map<string, string>()
    for (const c of costs) {
        if (c.sku && c.weighted_avg_cost > 0) costMap.set(c.sku, c.weighted_avg_cost)
        if (c.sku && c.product_name) nameMap.set(c.sku, c.product_name)
    }
    for (const r of sales) {
        if (r.sku && r.product_name && !nameMap.has(r.sku)) {
            nameMap.set(r.sku, r.product_name)
        }
    }
    const dates = sales.map((r) => r.order_date).sort()
    const dataAsOf = dates[dates.length - 1] ?? new Date().toISOString().slice(0, 10)
    const [, mm, dd] = dataAsOf.split("-")
    const y2026 = dataAsOf.slice(0, 4)
    const y2025 = String(Number(y2026) - 1)
    return {
        sales,
        costMap,
        nameMap,
        stockBySku,
        launchedBySku,
        dataAsOf,
        ytd2026From: `${y2026}-01-01`,
        ytd2026To: dataAsOf,
        ytd2025From: `${y2025}-01-01`,
        ytd2025To: `${y2025}-${mm}-${dd}`,
        sales2025: sales.filter((r) => r.order_date.startsWith("2025-")),
    }
}
